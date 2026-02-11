import calendar
from datetime import date, timedelta

from fastapi import Depends, FastAPI, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import Base, engine, get_db
from app.models import (
    Activity,
    AuditEntityType,
    AuditLog,
    Engagement,
    Invoice,
    PaymentTermType,
    PeriodStatus,
    ReportingPeriod,
    WorkDay,
    WorkDayStatus,
)
from app.schemas import (
    ActivityCreate,
    ActivityRead,
    AuditLogRead,
    AutoPeriodsResponse,
    EngagementCreate,
    EngagementRead,
    EngagementUpdate,
    InvoiceCreate,
    InvoiceRead,
    PeriodStatusTransition,
    ReportingPeriodCreate,
    ReportingPeriodRead,
    WorkDayCreate,
    WorkDayRead,
)

Base.metadata.create_all(bind=engine)

app = FastAPI(title="TimeSheetApp API", version="0.2.0")


def _get_engagement_or_404(db: Session, engagement_id: int) -> Engagement:
    engagement = db.get(Engagement, engagement_id)
    if not engagement:
        raise HTTPException(status_code=404, detail="Engagement not found")
    return engagement


def _get_period_or_404(db: Session, period_id: int) -> ReportingPeriod:
    period = db.get(ReportingPeriod, period_id)
    if not period:
        raise HTTPException(status_code=404, detail="ReportingPeriod not found")
    return period


def _last_day_of_month(year: int, month: int) -> int:
    return calendar.monthrange(year, month)[1]


def _add_months(value: date, months: int) -> date:
    month = value.month - 1 + months
    year = value.year + month // 12
    month = month % 12 + 1
    day = min(value.day, _last_day_of_month(year, month))
    return date(year, month, day)


def _period_step_months(frequency: str) -> int:
    if frequency == "bimonthly":
        return 2
    if frequency == "quarterly":
        return 3
    return 1


def _calculate_period_bounds(cursor: date, anchor_day: int, months_step: int) -> tuple[date, date]:
    start = date(cursor.year, cursor.month, min(anchor_day, _last_day_of_month(cursor.year, cursor.month)))
    end_anchor_month = _add_months(start, months_step)
    end = end_anchor_month - timedelta(days=1)
    return start, end


def _compute_due_date(invoice_date: date, term_type: PaymentTermType, term_days: int) -> date:
    if term_type == PaymentTermType.df:
        return invoice_date + timedelta(days=term_days)

    month_end = date(invoice_date.year, invoice_date.month, _last_day_of_month(invoice_date.year, invoice_date.month))
    return month_end + timedelta(days=term_days)


def _recompute_period_totals(db: Session, period: ReportingPeriod) -> None:
    worked_days = db.scalar(
        select(func.count(WorkDay.id)).where(
            WorkDay.engagement_id == period.engagement_id,
            WorkDay.date >= period.start_date,
            WorkDay.date <= period.end_date,
            WorkDay.status == WorkDayStatus.worked,
        )
    )
    billable_days = db.scalar(
        select(func.count(WorkDay.id)).where(
            WorkDay.engagement_id == period.engagement_id,
            WorkDay.date >= period.start_date,
            WorkDay.date <= period.end_date,
            WorkDay.billable.is_(True),
            WorkDay.status == WorkDayStatus.worked,
        )
    )
    engagement = _get_engagement_or_404(db, period.engagement_id)

    period.total_worked_days = worked_days
    period.total_billable_days = billable_days
    period.amount_estimated = billable_days * engagement.daily_rate


def _add_audit_log(db: Session, entity_type: AuditEntityType, entity_id: int, event: str, reason: str | None = None) -> None:
    db.add(AuditLog(entity_type=entity_type, entity_id=entity_id, event=event, reason=reason))


@app.get("/health")
def healthcheck():
    return {"status": "ok"}


@app.post("/engagements", response_model=EngagementRead)
def create_engagement(payload: EngagementCreate, db: Session = Depends(get_db)):
    row = Engagement(**payload.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@app.get("/engagements", response_model=list[EngagementRead])
def list_engagements(db: Session = Depends(get_db)):
    return db.scalars(select(Engagement).order_by(Engagement.id.desc())).all()


@app.patch("/engagements/{engagement_id}", response_model=EngagementRead)
def update_engagement(engagement_id: int, payload: EngagementUpdate, db: Session = Depends(get_db)):
    engagement = _get_engagement_or_404(db, engagement_id)
    for key, value in payload.model_dump(exclude_none=True).items():
        setattr(engagement, key, value)
    db.commit()
    db.refresh(engagement)
    return engagement


@app.post("/engagements/{engagement_id}/periods/generate", response_model=AutoPeriodsResponse)
def generate_periods(
    engagement_id: int,
    through_date: date = Query(..., description="Generate periods up to this date"),
    db: Session = Depends(get_db),
):
    engagement = _get_engagement_or_404(db, engagement_id)
    months_step = _period_step_months(engagement.reporting_frequency.value)

    existing = db.scalars(
        select(ReportingPeriod)
        .where(ReportingPeriod.engagement_id == engagement_id)
        .order_by(ReportingPeriod.end_date.desc())
    ).first()

    cursor = engagement.start_date if not existing else existing.end_date + timedelta(days=1)
    created = 0
    created_periods: list[ReportingPeriod] = []

    while cursor <= through_date and cursor <= engagement.end_date:
        start, end = _calculate_period_bounds(cursor, engagement.reporting_anchor_day, months_step)
        if end < engagement.start_date:
            cursor = end + timedelta(days=1)
            continue

        start = max(start, engagement.start_date)
        end = min(end, engagement.end_date, through_date)

        if start > end:
            break

        period = ReportingPeriod(engagement_id=engagement_id, start_date=start, end_date=end, status=PeriodStatus.draft)
        db.add(period)
        db.flush()
        _recompute_period_totals(db, period)
        created += 1
        created_periods.append(period)
        cursor = end + timedelta(days=1)

    db.commit()
    return AutoPeriodsResponse(created=created, periods=created_periods)


@app.post("/workdays", response_model=WorkDayRead)
def create_workday(payload: WorkDayCreate, db: Session = Depends(get_db)):
    engagement = _get_engagement_or_404(db, payload.engagement_id)

    if payload.date.weekday() >= 5 and not engagement.weekend_allowed and payload.status == WorkDayStatus.worked:
        raise HTTPException(status_code=400, detail="Weekend days are blocked for this engagement")

    if engagement.max_billable_days is not None and payload.billable:
        billable_days = db.scalar(
            select(func.count(WorkDay.id)).where(
                WorkDay.engagement_id == payload.engagement_id,
                WorkDay.billable.is_(True),
            )
        )
        if billable_days >= engagement.max_billable_days:
            raise HTTPException(status_code=400, detail="Max billable days reached")

    row = WorkDay(**payload.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@app.get("/workdays", response_model=list[WorkDayRead])
def list_workdays(
    engagement_id: int | None = Query(default=None),
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    db: Session = Depends(get_db),
):
    stmt = select(WorkDay)
    if engagement_id:
        stmt = stmt.where(WorkDay.engagement_id == engagement_id)
    if start_date:
        stmt = stmt.where(WorkDay.date >= start_date)
    if end_date:
        stmt = stmt.where(WorkDay.date <= end_date)
    return db.scalars(stmt.order_by(WorkDay.date.asc())).all()


@app.post("/activities", response_model=ActivityRead)
def create_activity(payload: ActivityCreate, db: Session = Depends(get_db)):
    if not db.get(WorkDay, payload.workday_id):
        raise HTTPException(status_code=404, detail="WorkDay not found")
    row = Activity(**payload.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@app.get("/activities", response_model=list[ActivityRead])
def list_activities(workday_id: int | None = Query(default=None), db: Session = Depends(get_db)):
    stmt = select(Activity)
    if workday_id:
        stmt = stmt.where(Activity.workday_id == workday_id)
    return db.scalars(stmt.order_by(Activity.id.asc())).all()


@app.post("/periods", response_model=ReportingPeriodRead)
def create_reporting_period(payload: ReportingPeriodCreate, db: Session = Depends(get_db)):
    _get_engagement_or_404(db, payload.engagement_id)

    row = ReportingPeriod(**payload.model_dump())
    db.add(row)
    db.flush()
    _recompute_period_totals(db, row)
    db.commit()
    db.refresh(row)
    return row


@app.post("/periods/{period_id}/status", response_model=ReportingPeriodRead)
def transition_period_status(period_id: int, payload: PeriodStatusTransition, db: Session = Depends(get_db)):
    period = _get_period_or_404(db, period_id)
    _recompute_period_totals(db, period)

    if payload.status == PeriodStatus.submitted and period.total_billable_days == 0 and not payload.allow_zero_period:
        raise HTTPException(status_code=400, detail="Cannot submit a period with zero billable days without allow_zero_period")

    if period.status in {PeriodStatus.submitted, PeriodStatus.approved, PeriodStatus.invoiced} and payload.status == PeriodStatus.draft:
        if not payload.reason:
            raise HTTPException(status_code=400, detail="Reason required to reopen submitted/approved/invoiced periods")

    period.status = payload.status
    _add_audit_log(db, AuditEntityType.period, period.id, f"status_changed_to_{payload.status.value}", payload.reason)
    db.commit()
    db.refresh(period)
    return period


@app.get("/periods", response_model=list[ReportingPeriodRead])
def list_periods(engagement_id: int | None = Query(default=None), db: Session = Depends(get_db)):
    stmt = select(ReportingPeriod)
    if engagement_id:
        stmt = stmt.where(ReportingPeriod.engagement_id == engagement_id)
    return db.scalars(stmt.order_by(ReportingPeriod.start_date.desc())).all()


@app.post("/invoices", response_model=InvoiceRead)
def create_invoice(payload: InvoiceCreate, db: Session = Depends(get_db)):
    period = _get_period_or_404(db, payload.period_id)
    _get_engagement_or_404(db, payload.engagement_id)

    if period.engagement_id != payload.engagement_id:
        raise HTTPException(status_code=400, detail="Period does not belong to engagement")

    if period.status != PeriodStatus.approved and not payload.override_reason:
        raise HTTPException(status_code=400, detail="Period must be approved before invoicing (or use override_reason)")

    due_date = _compute_due_date(payload.invoice_date, payload.payment_term_type, payload.payment_term_days)
    row = Invoice(
        **payload.model_dump(exclude={"override_reason"}),
        computed_due_date=due_date,
    )
    db.add(row)

    period.status = PeriodStatus.invoiced
    db.flush()
    _add_audit_log(db, AuditEntityType.invoice, row.id, f"invoice_created_{payload.invoice_number}", payload.override_reason)
    _add_audit_log(db, AuditEntityType.period, period.id, "status_changed_to_invoiced", payload.override_reason)

    if payload.override_reason:
        _add_audit_log(db, AuditEntityType.invoice, row.id, "override_used", payload.override_reason)

    db.commit()
    db.refresh(row)
    return row


@app.get("/invoices", response_model=list[InvoiceRead])
def list_invoices(engagement_id: int | None = Query(default=None), db: Session = Depends(get_db)):
    stmt = select(Invoice)
    if engagement_id:
        stmt = stmt.where(Invoice.engagement_id == engagement_id)
    return db.scalars(stmt.order_by(Invoice.invoice_date.desc(), Invoice.id.desc())).all()


@app.get("/audit-logs", response_model=list[AuditLogRead])
def list_audit_logs(
    entity_type: AuditEntityType | None = Query(default=None),
    entity_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
):
    stmt = select(AuditLog)
    if entity_type:
        stmt = stmt.where(AuditLog.entity_type == entity_type)
    if entity_id:
        stmt = stmt.where(AuditLog.entity_id == entity_id)
    return db.scalars(stmt.order_by(AuditLog.created_at.desc(), AuditLog.id.desc())).all()
