"""
Shared pytest fixtures: a fresh in-memory SQLite DB per test, a TestClient
wired to it (via FastAPI dependency override — NOT the app's real
file-based engine), and a helper to register+login a user and get a bearer
token.
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

from app.database import Base, build_engine, get_db
from app.main import app
from app.config import get_settings


@pytest.fixture()
def db_engine():
    engine = build_engine("sqlite://")  # in-memory, StaticPool (see database.py)
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


@pytest.fixture()
def client(db_engine):
    get_settings().environment = "test"
    testing_session_local = sessionmaker(bind=db_engine, autocommit=False, autoflush=False)

    def override_get_db():
        db = testing_session_local()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    # Not entering as a context manager: skips app lifespan (which would
    # `create_all` against the real file-based engine) — the in-memory
    # schema above is all these tests need.
    test_client = TestClient(app)
    yield test_client
    app.dependency_overrides.clear()


@pytest.fixture()
def register_user(client):
    """Returns a callable: register_user(username=..., password=...) ->
    (token, user_dict)."""

    def _register(username="alice", password="password123", email=None, display_name=None):
        payload = {"username": username, "password": password}
        if email is not None:
            payload["email"] = email
        if display_name is not None:
            payload["display_name"] = display_name
        resp = client.post("/api/auth/register", json=payload)
        assert resp.status_code == 201, resp.text
        body = resp.json()
        return body["access_token"], body["user"]

    return _register


@pytest.fixture()
def auth_headers(register_user):
    token, _user = register_user()
    return {"Authorization": f"Bearer {token}"}


def make_session_payload(
    exercise="squat",
    started_at="2026-01-01T10:00:00Z",
    ended_at="2026-01-01T10:05:00Z",
    duration_seconds=300.0,
    reps=None,
    form_issues=None,
    form_score=None,
):
    """Builds a valid /api/sessions POST body. Defaults to 2 clean reps
    (no issues) => a recomputed score of 100.0."""
    if reps is None:
        reps = [
            {"rep_number": 1, "duration_seconds": 3.0, "rom_value": 90.0, "tempo": 1.5, "angle_metrics": {"knee": 90.0}},
            {"rep_number": 2, "duration_seconds": 3.2, "rom_value": 92.0, "tempo": 1.6, "angle_metrics": {"knee": 92.0}},
        ]
    if form_issues is None:
        form_issues = []
    if form_score is None:
        form_score = 100.0

    return {
        "exercise": exercise,
        "started_at": started_at,
        "ended_at": ended_at,
        "duration_seconds": duration_seconds,
        "rep_count": len(reps),
        "form_score": form_score,
        "reps": reps,
        "form_issues": form_issues,
    }
