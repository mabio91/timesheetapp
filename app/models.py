import enum
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Enum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ReportingFrequency(str, enum.Enum):
    monthly = "monthly"
    bimonthly = "bimonthly"
    quarterly = "quarterly"
    custom = "custom"


class EngagementStatus(str, enum.Enum):
    active = "active"
    closed = "closed"
    suspended = "suspended"


class WorkDayStatus(str, enum.Enum):
    worked = "worked"
    non_worked = "non-worked"
    blocked = "blocked"
    holiday = "holiday"
    weekend = "weekend"


class PeriodStatus(str, enum.Enum):
    draft = "draft"
    ready = "ready"
    submitted = "submitted"
    approved = "approved"
    rejected = "rejected"
    invoiced = "invoiced"


class Engagement(Base):
    __tablename__ = "engagements"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    subject: Mapped[str | None] = mapped_column(Text, nullable=True)
    client_name: Mapped[str] = mapped_column(String(255), nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    weekend_allowed: Mapped[bool] = mapped_column(Boolean, default=False)
    holidays_allowed: Mapped[bool] = mapped_column(Boolean, default=False)
    max_billable_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    daily_rate: Mapped[float] = mapped_column(Float, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="EUR")
    reporting_frequency: Mapped[ReportingFrequency] = mapped_column(Enum(ReportingFrequency), default=ReportingFrequency.monthly)
    status: Mapped[EngagementStatus] = mapped_column(Enum(EngagementStatus), default=EngagementStatus.active)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    workdays: Mapped[list["WorkDay"]] = relationship("WorkDay", back_populates="engagement", cascade="all, delete-orphan")
    periods: Mapped[list["ReportingPeriod"]] = relationship("ReportingPeriod", back_populates="engagement", cascade="all, delete-orphan")


class WorkDay(Base):
    __tablename__ = "workdays"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    engagement_id: Mapped[int] = mapped_column(ForeignKey("engagements.id"), nullable=False, index=True)
    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    status: Mapped[WorkDayStatus] = mapped_column(Enum(WorkDayStatus), default=WorkDayStatus.worked)
    billable: Mapped[bool] = mapped_column(Boolean, default=True)
    internal_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    engagement: Mapped[Engagement] = relationship("Engagement", back_populates="workdays")
    activities: Mapped[list["Activity"]] = relationship("Activity", back_populates="workday", cascade="all, delete-orphan")


class Activity(Base):
    __tablename__ = "activities"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    workday_id: Mapped[int] = mapped_column(ForeignKey("workdays.id"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[str | None] = mapped_column(String(100), nullable=True)
    tags: Mapped[str | None] = mapped_column(String(255), nullable=True)
    include_in_export: Mapped[bool] = mapped_column(Boolean, default=True)

    workday: Mapped[WorkDay] = relationship("WorkDay", back_populates="activities")


class ReportingPeriod(Base):
    __tablename__ = "reporting_periods"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    engagement_id: Mapped[int] = mapped_column(ForeignKey("engagements.id"), nullable=False, index=True)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[PeriodStatus] = mapped_column(Enum(PeriodStatus), default=PeriodStatus.draft)
    total_worked_days: Mapped[int] = mapped_column(Integer, default=0)
    total_billable_days: Mapped[int] = mapped_column(Integer, default=0)
    amount_estimated: Mapped[float] = mapped_column(Float, default=0)
    client_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    engagement: Mapped[Engagement] = relationship("Engagement", back_populates="periods")
