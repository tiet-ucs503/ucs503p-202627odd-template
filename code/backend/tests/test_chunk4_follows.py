import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.database import SessionLocal
from app.main import app
from app.models.user import User
from app.services.auth_service import create_access_token, hash_password
from app.services.follow_service import follow_user

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


def test_follow_user_success():
    u1 = _create_user("amy", "amy@example.com", "Amy Chen")
    u2 = _create_user("bob", "bob@example.com", "Bob Smith")

    res = client.post(
        "/api/follows",
        json={"followed_id": u2.id},
        headers=_auth_headers("amy"),
    )
    assert res.status_code == 201
    data = res.json()
    assert data["follower_id"] == u1.id
    assert data["followed_id"] == u2.id


def test_follow_user_self_follow_rejected():
    u1 = _create_user("amy", "amy@example.com", "Amy Chen")

    res = client.post(
        "/api/follows",
        json={"followed_id": u1.id},
        headers=_auth_headers("amy"),
    )
    assert res.status_code == 400
    assert res.json()["detail"] == "Cannot follow yourself"


def test_follow_user_duplicate_rejected():
    u1 = _create_user("amy", "amy@example.com", "Amy Chen")
    u2 = _create_user("bob", "bob@example.com", "Bob Smith")

    client.post(
        "/api/follows",
        json={"followed_id": u2.id},
        headers=_auth_headers("amy"),
    )
    res = client.post(
        "/api/follows",
        json={"followed_id": u2.id},
        headers=_auth_headers("amy"),
    )
    assert res.status_code == 400
    assert res.json()["detail"] == "Already following this user"


def test_follow_user_target_not_found():
    _create_user("amy", "amy@example.com", "Amy Chen")

    res = client.post(
        "/api/follows",
        json={"followed_id": 9999},
        headers=_auth_headers("amy"),
    )
    assert res.status_code == 404
    assert res.json()["detail"] == "User not found"


def test_follow_user_unauthenticated():
    u2 = _create_user("bob", "bob@example.com", "Bob Smith")

    res = client.post(
        "/api/follows",
        json={"followed_id": u2.id},
    )
    assert res.status_code == 401


def test_unfollow_user_success():
    u1 = _create_user("amy", "amy@example.com", "Amy Chen")
    u2 = _create_user("bob", "bob@example.com", "Bob Smith")

    client.post(
        "/api/follows",
        json={"followed_id": u2.id},
        headers=_auth_headers("amy"),
    )

    res = client.delete(
        f"/api/follows/{u2.id}",
        headers=_auth_headers("amy"),
    )
    assert res.status_code == 204


def test_unfollow_user_not_following():
    _create_user("amy", "amy@example.com", "Amy Chen")
    u2 = _create_user("bob", "bob@example.com", "Bob Smith")

    res = client.delete(
        f"/api/follows/{u2.id}",
        headers=_auth_headers("amy"),
    )
    assert res.status_code == 404
    assert res.json()["detail"] == "Not currently following this user"


def test_list_followers_and_following():
    u1 = _create_user("amy", "amy@example.com", "Amy Chen")
    u2 = _create_user("bob", "bob@example.com", "Bob Smith")
    u3 = _create_user("charlie", "charlie@example.com", "Charlie Brown")

    # amy follows bob & charlie
    client.post("/api/follows", json={"followed_id": u2.id}, headers=_auth_headers("amy"))
    client.post("/api/follows", json={"followed_id": u3.id}, headers=_auth_headers("amy"))
    # charlie follows bob
    client.post("/api/follows", json={"followed_id": u2.id}, headers=_auth_headers("charlie"))

    # Check amy's following (bob, charlie)
    res = client.get(f"/api/users/{u1.id}/following")
    assert res.status_code == 200
    following = res.json()
    assert len(following) == 2
    following_usernames = {u["username"] for u in following}
    assert following_usernames == {"bob", "charlie"}

    # Check bob's followers (amy, charlie)
    res = client.get(f"/api/users/{u2.id}/followers")
    assert res.status_code == 200
    followers = res.json()
    assert len(followers) == 2
    follower_usernames = {u["username"] for u in followers}
    assert follower_usernames == {"amy", "charlie"}


def test_search_users():
    _create_user("traveler_amy", "amy@example.com", "Amy Chen")
    _create_user("traveler_bob", "bob@example.com", "Bob Smith")
    _create_user("charlie", "charlie@example.com", "Charlie Amy")

    # Search substring "amy" (should match traveler_amy and Charlie Amy)
    res = client.get("/api/users?search=amy")
    assert res.status_code == 200
    items = res.json()
    assert len(items) == 2
    usernames = {u["username"] for u in items}
    assert usernames == {"traveler_amy", "charlie"}
