from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base, get_db
from app.main import app


SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


Base.metadata.drop_all(bind=engine)
Base.metadata.create_all(bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


def test_engagement_workday_period_flow():
    engagement_res = client.post(
        "/engagements",
        json={
            "title": "Consulenza PMO",
            "subject": "Supporto governance",
            "client_name": "ACME SPA",
            "start_date": "2026-01-01",
            "end_date": "2026-12-31",
            "daily_rate": 500,
            "max_billable_days": 3,
            "weekend_allowed": False,
            "reporting_frequency": "monthly",
        },
    )
    assert engagement_res.status_code == 200
    engagement_id = engagement_res.json()["id"]

    weekend_res = client.post(
        "/workdays",
        json={
            "engagement_id": engagement_id,
            "date": "2026-01-03",
            "status": "worked",
            "billable": True,
        },
    )
    assert weekend_res.status_code == 400

    weekday_res = client.post(
        "/workdays",
        json={
            "engagement_id": engagement_id,
            "date": "2026-01-05",
            "status": "worked",
            "billable": True,
        },
    )
    assert weekday_res.status_code == 200
    workday_id = weekday_res.json()["id"]

    activity_res = client.post(
        "/activities",
        json={
            "workday_id": workday_id,
            "title": "Riunione avanzamento",
            "description": "allineamento con team",
            "category": "meeting",
        },
    )
    assert activity_res.status_code == 200

    period_res = client.post(
        "/periods",
        json={
            "engagement_id": engagement_id,
            "start_date": "2026-01-01",
            "end_date": "2026-01-31",
            "status": "draft",
        },
    )
    assert period_res.status_code == 200
    payload = period_res.json()
    assert payload["total_worked_days"] == 1
    assert payload["total_billable_days"] == 1
    assert payload["amount_estimated"] == 500
