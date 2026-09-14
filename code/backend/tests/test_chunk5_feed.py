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
            bio="Traveler",
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user


def _auth_headers(username="traveler_amy"):
    token = create_access_token(username)
    return {"Authorization": f"Bearer {token}"}


def test_feed_unauthenticated():
    res = client.get("/api/feed")
    assert res.status_code == 401


def test_feed_following_no_one():
    _create_user("amy", "amy@example.com", "Amy Chen")

    res = client.get("/api/feed", headers=_auth_headers("amy"))
    assert res.status_code == 200
    data = res.json()
    assert data == {"items": [], "total": 0}


def test_feed_returns_followed_posts_in_recency_order_and_excludes_own_and_non_followed():
    amy = _create_user("amy", "amy@example.com", "Amy")
    bob = _create_user("bob", "bob@example.com", "Bob")
    charlie = _create_user("charlie", "charlie@example.com", "Charlie")
    dave = _create_user("dave", "dave@example.com", "Dave")

    # Amy follows Bob and Charlie
    client.post("/api/follows", json={"followed_id": bob.id}, headers=_auth_headers("amy"))
    client.post("/api/follows", json={"followed_id": charlie.id}, headers=_auth_headers("amy"))

    # Bob posts first
    res1 = client.post(
        "/api/posts",
        json={"content": "Bob in Paris", "destination_name": "Paris"},
        headers=_auth_headers("bob"),
    )
    # Charlie posts second
    res2 = client.post(
        "/api/posts",
        json={"content": "Charlie in Tokyo", "destination_name": "Tokyo"},
        headers=_auth_headers("charlie"),
    )
    # Amy posts (own post)
    client.post(
        "/api/posts",
        json={"content": "Amy in Rome", "destination_name": "Rome"},
        headers=_auth_headers("amy"),
    )
    # Dave posts (not followed)
    client.post(
        "/api/posts",
        json={"content": "Dave in London", "destination_name": "London"},
        headers=_auth_headers("dave"),
    )

    feed_res = client.get("/api/feed", headers=_auth_headers("amy"))
    assert feed_res.status_code == 200
    data = feed_res.json()
    assert data["total"] == 2
    assert len(data["items"]) == 2
    # Recency order: Charlie's post first, then Bob's post
    assert data["items"][0]["id"] == res2.json()["id"]
    assert data["items"][0]["content"] == "Charlie in Tokyo"
    assert data["items"][1]["id"] == res1.json()["id"]
    assert data["items"][1]["content"] == "Bob in Paris"


def test_feed_pagination():
    _create_user("amy", "amy@example.com", "Amy")
    bob = _create_user("bob", "bob@example.com", "Bob")

    client.post("/api/follows", json={"followed_id": bob.id}, headers=_auth_headers("amy"))

    post_ids = []
    for i in range(5):
        r = client.post(
            "/api/posts",
            json={"content": f"Bob post {i}", "destination_name": "Dest"},
            headers=_auth_headers("bob"),
        )
        post_ids.append(r.json()["id"])

    # Page 1: skip 0, limit 2
    res_page1 = client.get("/api/feed?skip=0&limit=2", headers=_auth_headers("amy"))
    assert res_page1.status_code == 200
    data1 = res_page1.json()
    assert data1["total"] == 5
    assert len(data1["items"]) == 2
    assert data1["items"][0]["id"] == post_ids[4]
    assert data1["items"][1]["id"] == post_ids[3]

    # Page 2: skip 2, limit 2
    res_page2 = client.get("/api/feed?skip=2&limit=2", headers=_auth_headers("amy"))
    assert res_page2.status_code == 200
    data2 = res_page2.json()
    assert data2["total"] == 5
    assert len(data2["items"]) == 2
    assert data2["items"][0]["id"] == post_ids[2]
    assert data2["items"][1]["id"] == post_ids[1]
