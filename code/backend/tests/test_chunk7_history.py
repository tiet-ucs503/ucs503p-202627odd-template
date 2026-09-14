import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.database import SessionLocal
from app.main import app
from app.models.user import User
from app.services.auth_service import create_access_token, hash_password

client = TestClient(app)


@pytest.fixture(autouse=True)
def clear_db():
    with SessionLocal() as db:
        db.execute(text("TRUNCATE TABLE users, destinations, posts, follows RESTART IDENTITY CASCADE"))
        db.commit()
    yield
    with SessionLocal() as db:
        db.execute(text("TRUNCATE TABLE users, destinations, posts, follows RESTART IDENTITY CASCADE"))
        db.commit()


def _create_user(username="traveler_amy", email="amy@example.com", full_name="Amy Chen") -> User:
    with SessionLocal() as db:
        user = User(
            username=username,
            email=email,
            password_hash=hash_password("securepass123"),
            full_name=full_name,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user


def _auth_headers(username="traveler_amy"):
    token = create_access_token(username)
    return {"Authorization": f"Bearer {token}"}


def test_profile_destinations_visited_empty_for_user_with_no_posts():
    user = _create_user("amy")

    res = client.get(f"/api/users/{user.id}")
    assert res.status_code == 200
    data = res.json()
    assert data["post_count"] == 0
    assert data["destinations_visited"] == []


def test_profile_includes_destinations_visited_deduplicated():
    user = _create_user("amy")

    # Amy posts twice at Siem Reap, once at Hanoi
    client.post(
        "/api/posts",
        json={"content": "Angkor Wat sunrise", "destination_name": "Siem Reap, Cambodia"},
        headers=_auth_headers("amy"),
    )
    client.post(
        "/api/posts",
        json={"content": "Pub Street evening", "destination_name": "Siem Reap, Cambodia"},
        headers=_auth_headers("amy"),
    )
    client.post(
        "/api/posts",
        json={"content": "Hanoi street food", "destination_name": "Hanoi, Vietnam"},
        headers=_auth_headers("amy"),
    )

    res = client.get(f"/api/users/{user.id}")
    assert res.status_code == 200
    data = res.json()
    assert data["post_count"] == 3
    
    visited = data["destinations_visited"]
    # Deduplicated: exactly 2 destinations
    assert len(visited) == 2
    visited_names = {d["name"] for d in visited}
    assert visited_names == {"Siem Reap, Cambodia", "Hanoi, Vietnam"}
