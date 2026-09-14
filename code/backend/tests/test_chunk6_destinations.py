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
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user


def _auth_headers(username="traveler_amy"):
    token = create_access_token(username)
    return {"Authorization": f"Bearer {token}"}


def test_search_destinations():
    _create_user("amy")
    client.post(
        "/api/posts",
        json={"content": "Post 1", "destination_name": "Siem Reap, Cambodia"},
        headers=_auth_headers("amy"),
    )
    client.post(
        "/api/posts",
        json={"content": "Post 2", "destination_name": "Bali, Indonesia"},
        headers=_auth_headers("amy"),
    )

    # Search partial match "bali"
    res1 = client.get("/api/destinations?search=bali")
    assert res1.status_code == 200
    items1 = res1.json()
    assert len(items1) == 1
    assert items1[0]["name"] == "Bali, Indonesia"

    # Search partial match "cambodia"
    res2 = client.get("/api/destinations?search=cambodia")
    assert res2.status_code == 200
    items2 = res2.json()
    assert len(items2) == 1
    assert items2[0]["name"] == "Siem Reap, Cambodia"


def test_get_destination_detail():
    _create_user("amy")
    post_res = client.post(
        "/api/posts",
        json={"content": "Post 1", "destination_name": "Paris, France"},
        headers=_auth_headers("amy"),
    )
    dest_id = post_res.json()["destination"]["id"]

    res = client.get(f"/api/destinations/{dest_id}")
    assert res.status_code == 200
    data = res.json()
    assert data["id"] == dest_id
    assert data["name"] == "Paris, France"


def test_get_destination_detail_not_found():
    res = client.get("/api/destinations/9999")
    assert res.status_code == 404
    assert res.json()["detail"] == "Destination not found"


def test_get_destination_posts():
    _create_user("amy")
    _create_user("bob", "bob@example.com", "Bob")

    p1 = client.post(
        "/api/posts",
        json={"content": "Amy in Paris", "destination_name": "Paris"},
        headers=_auth_headers("amy"),
    )
    p2 = client.post(
        "/api/posts",
        json={"content": "Bob in Paris", "destination_name": "Paris"},
        headers=_auth_headers("bob"),
    )
    dest_id = p1.json()["destination"]["id"]

    res = client.get(f"/api/destinations/{dest_id}/posts")
    assert res.status_code == 200
    posts = res.json()
    assert len(posts) == 2
    assert posts[0]["id"] == p2.json()["id"]
    assert posts[1]["id"] == p1.json()["id"]


def test_get_destination_travelers_deduplicated():
    _create_user("amy")
    _create_user("bob", "bob@example.com", "Bob")

    # Amy posts twice at Tokyo
    p1 = client.post(
        "/api/posts",
        json={"content": "Amy first post in Tokyo", "destination_name": "Tokyo"},
        headers=_auth_headers("amy"),
    )
    client.post(
        "/api/posts",
        json={"content": "Amy second post in Tokyo", "destination_name": "Tokyo"},
        headers=_auth_headers("amy"),
    )
    # Bob posts once at Tokyo
    client.post(
        "/api/posts",
        json={"content": "Bob in Tokyo", "destination_name": "Tokyo"},
        headers=_auth_headers("bob"),
    )
    dest_id = p1.json()["destination"]["id"]

    res = client.get(f"/api/destinations/{dest_id}/travelers")
    assert res.status_code == 200
    travelers = res.json()
    # Deduplicated: exactly 2 travelers (Amy and Bob)
    assert len(travelers) == 2
    usernames = {t["username"] for t in travelers}
    assert usernames == {"amy", "bob"}
