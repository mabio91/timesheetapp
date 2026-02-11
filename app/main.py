from datetime import date

from fastapi import Depends, FastAPI, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import Base, engine, get_db
from app.models import Activity, Engagement, ReportingPeriod, WorkDay, WorkDayStatus
from app.schemas import (
    ActivityCreate,
    ActivityRead,
    EngagementCreate,
    EngagementRead,
    EngagementUpdate,
    ReportingPeriodCreate,
    ReportingPeriodRead,
    WorkDayCreate,
    WorkDayRead,
)

Base.metadata.create_all(bind=engine)

app = FastAPI(title="TimeSheetApp API", version="0.1.0")


def _get_engagement_or_404(db: Session, engagement_id: int) -> Engagement:
    engagement = db.get(Engagement, engagement_id)
    if not engagement:
        raise HTTPException(status_code=404, detail="Engagement not found")
    return engagement


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
    engagement = _get_engagement_or_404(db, payload.engagement_id)

    worked_days = db.scalar(
        select(func.count(WorkDay.id)).where(
            WorkDay.engagement_id == payload.engagement_id,
            WorkDay.date >= payload.start_date,
            WorkDay.date <= payload.end_date,
            WorkDay.status == WorkDayStatus.worked,
        )
    )
    billable_days = db.scalar(
        select(func.count(WorkDay.id)).where(
            WorkDay.engagement_id == payload.engagement_id,
            WorkDay.date >= payload.start_date,
            WorkDay.date <= payload.end_date,
            WorkDay.billable.is_(True),
            WorkDay.status == WorkDayStatus.worked,
        )
    )
    amount_estimated = billable_days * engagement.daily_rate

    row = ReportingPeriod(
        **payload.model_dump(),
        total_worked_days=worked_days,
        total_billable_days=billable_days,
        amount_estimated=amount_estimated,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@app.get("/periods", response_model=list[ReportingPeriodRead])
def list_periods(engagement_id: int | None = Query(default=None), db: Session = Depends(get_db)):
    stmt = select(ReportingPeriod)
    if engagement_id:
        stmt = stmt.where(ReportingPeriod.engagement_id == engagement_id)
    return db.scalars(stmt.order_by(ReportingPeriod.start_date.desc())).all()
