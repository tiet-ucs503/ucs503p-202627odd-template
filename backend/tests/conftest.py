import os
import sys
from pathlib import Path

# Test settings must be in place before the app modules are imported.
os.environ["JWT_SECRET_KEY"] = "test-only-secret-not-used-anywhere-else"
os.environ["DEMO_MODE"] = "false"
os.environ["DATABASE_URL"] = "sqlite://"
os.environ["BCRYPT_ROUNDS"] = "4"  # minimum work factor, so the suite runs in seconds
os.environ["GROQ_API_KEY"] = ""  # tests never call the AI service
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import models
from config import settings
from database import Base, get_db
from main import app

PASSWORD = "correct-horse-battery"


@pytest.fixture()
def db_factory():
    """A fresh, empty in-memory database for every test."""
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(bind=engine)
    factory = sessionmaker(bind=engine, autoflush=False)

    def override():
        db = factory()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override
    yield factory
    app.dependency_overrides.clear()
    engine.dispose()


@pytest.fixture()
def client(db_factory):
    return TestClient(app)


@pytest.fixture()
def demo_mode(monkeypatch):
    monkeypatch.setattr(settings, "demo_mode", True)


class Account:
    def __init__(self, token: str, user: dict):
        self.token = token
        self.user = user
        self.id = user["id"]
        self.headers = {"Authorization": f"Bearer {token}"}


@pytest.fixture(autouse=True)
def outbox(monkeypatch):
    """Verification emails are captured here instead of being sent: [(to, code), ...]."""
    sent: list[tuple[str, str]] = []

    def capture(to: str, name: str, code: str) -> bool:
        sent.append((to, code))
        return True

    monkeypatch.setattr("services.verification.send_verification_code", capture)
    return sent


def latest_code(outbox, email: str) -> str:
    return [code for to, code in outbox if to == email][-1]


@pytest.fixture()
def register(client, outbox):
    """Signs up and confirms the email with the code that was 'sent', like a real user."""
    counter = {"n": 0}

    def _register(role: str = "student", name: str = "Test User") -> Account:
        counter["n"] += 1
        email = f"user{counter['n']}@example.com"
        res = client.post("/auth/register", json={
            "name": name, "email": email, "password": PASSWORD, "role": role,
        })
        assert res.status_code == 201, res.text
        res = client.post("/auth/verify-email", json={"email": email, "code": latest_code(outbox, email)})
        assert res.status_code == 200, res.text
        body = res.json()
        return Account(body["access_token"], body["user"])

    return _register


@pytest.fixture()
def correct_index(db_factory):
    """Looks up the stored answer for an attempt (the API never reveals it early)."""

    def _lookup(attempt_id: int) -> int:
        with db_factory() as db:
            return db.get(models.Attempt, attempt_id).correct_index

    return _lookup


@pytest.fixture()
def play(client, correct_index):
    """Answers one question, correctly or not. Returns the API response body."""

    def _play(account: Account, attempt_id: int, correct: bool = True, **extra) -> dict:
        right = correct_index(attempt_id)
        selected = right if correct else (right + 1) % 4
        payload = {"selected_index": selected, "response_time_ms": 8000, **extra}
        res = client.post(f"/attempts/{attempt_id}/answer", json=payload, headers=account.headers)
        assert res.status_code == 200, res.text
        return res.json()

    return _play


@pytest.fixture()
def win_mission(client, play):
    """Plays a whole mission with correct answers. Returns the final answer response."""

    def _win(account: Account, boss_id: str = "goblin", **extra) -> dict:
        res = client.post("/sessions", json={"boss_id": boss_id}, headers=account.headers)
        assert res.status_code == 201, res.text
        attempt_id = res.json()["question"]["attempt_id"]
        while True:
            body = play(account, attempt_id, True, **extra)
            if body["next_question"] is None:
                return body
            attempt_id = body["next_question"]["attempt_id"]

    return _win
