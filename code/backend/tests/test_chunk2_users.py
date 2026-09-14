import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.database import SessionLocal
from app.main import app
from app.models.user import User
from app.services.auth_service import create_access_token, hash_password

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


def _create_user(username="traveler_amy", email="amy@example.com", full_name="Amy Chen") -> User:
    with SessionLocal() as db:
        user = User(
            username=username,
            email=email,
            password_hash=hash_password("securepass123"),
            full_name=full_name,
            bio="Backpacking through SE Asia",
            profile_picture_url="/uploads/profiles/1.jpg",
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user


def _auth_headers(username="traveler_amy"):
    token = create_access_token(username)
    return {"Authorization": f"Bearer {token}"}


def test_get_user_profile_returns_public_profile_details():
    user = _create_user()

    response = client.get(f"/api/users/{user.id}")

    assert response.status_code == 200
    assert response.json() == {
        "id": user.id,
        "username": "traveler_amy",
        "full_name": "Amy Chen",
        "bio": "Backpacking through SE Asia",
        "profile_picture_url": "/uploads/profiles/1.jpg",
        "post_count": 0,
        "destinations_visited": [],
    }


def test_get_user_profile_returns_404_for_missing_user():
    response = client.get("/api/users/999")

    assert response.status_code == 404
    assert response.json()["detail"] == "user not found"


def test_patch_me_updates_profile_fields():
    _create_user()

    response = client.patch(
        "/api/users/me",
        json={"full_name": "Amy C.", "bio": "Now in Vietnam"},
        headers=_auth_headers(),
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["full_name"] == "Amy C."
    assert payload["bio"] == "Now in Vietnam"
    assert payload["username"] == "traveler_amy"


def test_patch_me_requires_auth():
    response = client.patch(
        "/api/users/me",
        json={"full_name": "Amy C."},
    )

    assert response.status_code == 401


def test_upload_image_returns_public_url_for_valid_image():
    _create_user()

    response = client.post(
        "/api/uploads/images",
        files={"file": ("avatar.png", b"fake-png-content", "image/png")},
        headers=_auth_headers(),
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["url"].startswith("/uploads/images/")


def test_upload_image_rejects_invalid_file_type():
    _create_user()

    response = client.post(
        "/api/uploads/images",
        files={"file": ("notes.txt", b"hello", "text/plain")},
        headers=_auth_headers(),
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "invalid file type"
