from datetime import date, datetime

from pydantic import BaseModel, Field

from app.models import (
    AuditEntityType,
    EngagementStatus,
    InvoiceStatus,
    PaymentTermType,
    PeriodStatus,
    ReportingFrequency,
    WorkDayStatus,
)


class EngagementBase(BaseModel):
    title: str
    subject: str | None = None
    client_name: str
    start_date: date
    end_date: date
    weekend_allowed: bool = False
    holidays_allowed: bool = False
    max_billable_days: int | None = None
    daily_rate: float = Field(..., gt=0)
    currency: str = "EUR"
    reporting_frequency: ReportingFrequency = ReportingFrequency.monthly
    reporting_anchor_day: int = Field(default=1, ge=1, le=28)
    status: EngagementStatus = EngagementStatus.active


class EngagementCreate(EngagementBase):
    pass


class EngagementUpdate(BaseModel):
    title: str | None = None
    subject: str | None = None
    client_name: str | None = None
    end_date: date | None = None
    weekend_allowed: bool | None = None
    holidays_allowed: bool | None = None
    max_billable_days: int | None = None
    daily_rate: float | None = Field(default=None, gt=0)
    reporting_anchor_day: int | None = Field(default=None, ge=1, le=28)
    status: EngagementStatus | None = None


class EngagementRead(EngagementBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class WorkDayBase(BaseModel):
    engagement_id: int
    date: date
    status: WorkDayStatus = WorkDayStatus.worked
    billable: bool = True
    internal_note: str | None = None
    location: str | None = None


class WorkDayCreate(WorkDayBase):
    pass


class WorkDayRead(WorkDayBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ActivityBase(BaseModel):
    workday_id: int
    title: str
    description: str | None = None
    category: str | None = None
    tags: str | None = None
    include_in_export: bool = True


class ActivityCreate(ActivityBase):
    pass


class ActivityRead(ActivityBase):
    id: int

    class Config:
        from_attributes = True


class ReportingPeriodBase(BaseModel):
    engagement_id: int
    start_date: date
    end_date: date
    status: PeriodStatus = PeriodStatus.draft
    client_notes: str | None = None


class ReportingPeriodCreate(ReportingPeriodBase):
    pass


class ReportingPeriodRead(ReportingPeriodBase):
    id: int
    total_worked_days: int
    total_billable_days: int
    amount_estimated: float

    class Config:
        from_attributes = True


class PeriodStatusTransition(BaseModel):
    status: PeriodStatus
    reason: str | None = None
    allow_zero_period: bool = False


class AutoPeriodsResponse(BaseModel):
    created: int
    periods: list[ReportingPeriodRead]


class InvoiceBase(BaseModel):
    engagement_id: int
    period_id: int
    invoice_number: str
    invoice_date: date
    amount: float = Field(..., gt=0)
    currency: str = "EUR"
    payment_term_type: PaymentTermType = PaymentTermType.df
    payment_term_days: int = Field(default=30, ge=0, le=365)
    notes: str | None = None


class InvoiceCreate(InvoiceBase):
    override_reason: str | None = None


class InvoiceRead(InvoiceBase):
    id: int
    computed_due_date: date
    status: InvoiceStatus

    class Config:
        from_attributes = True


class AuditLogRead(BaseModel):
    id: int
    entity_type: AuditEntityType
    entity_id: int
    event: str
    reason: str | None
    created_at: datetime

    class Config:
        from_attributes = True
