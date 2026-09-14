import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.database import SessionLocal
from app.main import app
from app.models.user import User
from app.services.auth_service import hash_password

client = TestClient(app)


@pytest.fixture(autouse=True)
def clear_users():
    with SessionLocal() as db:
        db.execute(text("TRUNCATE TABLE users, destinations, posts, follows RESTART IDENTITY CASCADE"))
        db.commit()
    yield
    with SessionLocal() as db:
        db.execute(text("TRUNCATE TABLE users, destinations, posts, follows RESTART IDENTITY CASCADE"))
        db.commit()


def test_password_hash_and_verify():
    from app.services.auth_service import hash_password, verify_password

    hashed = hash_password("securepass123")

    assert hashed != "securepass123"
    assert verify_password("securepass123", hashed) is True
    assert verify_password("wrongpass", hashed) is False


def test_register_user_success():
    response = client.post(
        "/api/auth/register",
        json={
            "username": "traveler_amy",
            "email": "amy@example.com",
            "password": "securepass123",
            "full_name": "Amy Chen",
        },
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["id"] == 1
    assert payload["username"] == "traveler_amy"
    assert payload["email"] == "amy@example.com"
    assert payload["full_name"] == "Amy Chen"


@pytest.mark.parametrize(
    ("existing_username", "existing_email", "payload_username", "payload_email", "expected_detail"),
    [
        ("traveler_amy", "other@example.com", "traveler_amy", "new@example.com", "username already taken"),
        ("other_user", "amy@example.com", "new_user", "amy@example.com", "email already taken"),
    ],
)
def test_register_duplicate_user_returns_400(
    existing_username,
    existing_email,
    payload_username,
    payload_email,
    expected_detail,
):
    with SessionLocal() as db:
        db.add(
            User(
                username=existing_username,
                email=existing_email,
                password_hash="hashed",
                full_name="Amy Chen",
            )
        )
        db.commit()

    payload = {
        "username": payload_username,
        "email": payload_email,
        "password": "securepass123",
        "full_name": "Amy Chen",
    }

    response = client.post("/api/auth/register", json=payload)

    assert response.status_code == 400
    assert response.json()["detail"] == expected_detail


def test_login_returns_access_token():
    with SessionLocal() as db:
        db.add(
            User(
                username="traveler_amy",
                email="amy@example.com",
                password_hash=hash_password("securepass123"),
                full_name="Amy Chen",
            )
        )
        db.commit()

    response = client.post(
        "/api/auth/login",
        json={"username": "traveler_amy", "password": "securepass123"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["token_type"] == "bearer"
    assert payload["access_token"]


def test_login_with_invalid_credentials_returns_401():
    with SessionLocal() as db:
        db.add(
            User(
                username="traveler_amy",
                email="amy@example.com",
                password_hash=hash_password("securepass123"),
                full_name="Amy Chen",
            )
        )
        db.commit()

    response = client.post(
        "/api/auth/login",
        json={"username": "traveler_amy", "password": "wrongpass"},
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "invalid credentials"


def test_me_route_requires_auth():
    response = client.get("/api/users/me")

    assert response.status_code == 401


def test_me_route_returns_current_user():
    with SessionLocal() as db:
        user = User(
            username="traveler_amy",
            email="amy@example.com",
            password_hash=hash_password("securepass123"),
            full_name="Amy Chen",
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        token = client.post(
            "/api/auth/login",
            json={"username": "traveler_amy", "password": "securepass123"},
        ).json()["access_token"]

    response = client.get(
        "/api/users/me",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    assert response.json() == {
        "id": user.id,
        "username": "traveler_amy",
        "email": "amy@example.com",
        "full_name": "Amy Chen",
    }
