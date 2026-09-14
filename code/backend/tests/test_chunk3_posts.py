import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.database import SessionLocal
from app.main import app
from app.models.user import User
from app.services.auth_service import create_access_token, hash_password
from app.services.post_service import find_or_create_destination

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
            bio="Backpacking",
            profile_picture_url="/uploads/1.jpg",
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user


def _auth_headers(username="traveler_amy"):
    token = create_access_token(username)
    return {"Authorization": f"Bearer {token}"}


def test_find_or_create_destination_reuses_existing_case_insensitive():
    with SessionLocal() as db:
        d1 = find_or_create_destination(db, "Bali, Indonesia")
        db.commit()
        db.refresh(d1)
        d2 = find_or_create_destination(db, "bali, indonesia")
        db.commit()
        db.refresh(d2)
        assert d1.id == d2.id


def test_create_post_success():
    _create_user()
    response = client.post(
        "/api/posts",
        json={
            "content": "Beautiful sunrise",
            "destination_name": "Bali",
            "image_url": "/uploads/img.jpg",
        },
        headers=_auth_headers(),
    )
    assert response.status_code == 201
    payload = response.json()
    assert payload["content"] == "Beautiful sunrise"
    assert payload["destination"]["name"] == "Bali"
    assert payload["user"]["username"] == "traveler_amy"


def test_create_post_requires_auth():
    response = client.post(
        "/api/posts",
        json={
            "content": "Beautiful sunrise",
            "destination_name": "Bali",
            "image_url": "/uploads/img.jpg",
        },
    )
    assert response.status_code == 401


def test_get_single_post():
    _create_user()
    post_res = client.post(
        "/api/posts",
        json={
            "content": "Hello",
            "destination_name": "Paris",
        },
        headers=_auth_headers(),
    )
    post_id = post_res.json()["id"]

    res = client.get(f"/api/posts/{post_id}")
    assert res.status_code == 200
    assert res.json()["content"] == "Hello"


def test_get_single_post_not_found():
    res = client.get("/api/posts/999")
    assert res.status_code == 404


def test_list_posts():
    _create_user()
    client.post(
        "/api/posts",
        json={"content": "First", "destination_name": "Rome"},
        headers=_auth_headers(),
    )
    client.post(
        "/api/posts",
        json={"content": "Second", "destination_name": "Venice"},
        headers=_auth_headers(),
    )

    res = client.get("/api/posts")
    assert res.status_code == 200
    items = res.json()
    assert len(items) == 2
    # most recent first
    assert items[0]["content"] == "Second"
    assert items[1]["content"] == "First"


def test_delete_post_success():
    _create_user()
    post_res = client.post(
        "/api/posts",
        json={"content": "To delete", "destination_name": "Berlin"},
        headers=_auth_headers(),
    )
    post_id = post_res.json()["id"]

    del_res = client.delete(f"/api/posts/{post_id}", headers=_auth_headers())
    assert del_res.status_code == 204

    get_res = client.get(f"/api/posts/{post_id}")
    assert get_res.status_code == 404


def test_delete_post_not_owner_returns_403():
    _create_user() # traveler_amy
    _create_user("bob", "bob@example.com", "Bob")

    post_res = client.post(
        "/api/posts",
        json={"content": "Amy's post", "destination_name": "Berlin"},
        headers=_auth_headers("traveler_amy"),
    )
    post_id = post_res.json()["id"]

    del_res = client.delete(f"/api/posts/{post_id}", headers=_auth_headers("bob"))
    assert del_res.status_code == 403
