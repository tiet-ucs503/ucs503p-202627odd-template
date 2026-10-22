import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.database import SessionLocal
from app.main import app

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


def test_full_end_to_end_user_journey():
    # 1. Health check
    res_health = client.get("/api/health")
    assert res_health.status_code == 200
    assert res_health.json() == {"status": "ok"}

    # 2. Register users Amy, Bob, Charlie
    res_reg_amy = client.post(
        "/api/auth/register",
        json={
            "username": "amy_travels",
            "email": "amy@example.com",
            "password": "password123",
            "full_name": "Amy Chen",
        },
    )
    assert res_reg_amy.status_code == 201
    amy_id = res_reg_amy.json()["id"]

    res_reg_bob = client.post(
        "/api/auth/register",
        json={
            "username": "bob_explorer",
            "email": "bob@example.com",
            "password": "password123",
            "full_name": "Bob Smith",
        },
    )
    assert res_reg_bob.status_code == 201
    bob_id = res_reg_bob.json()["id"]

    # 3. Login Amy & Bob
    login_amy = client.post(
        "/api/auth/login",
        json={"username": "amy_travels", "password": "password123"},
    )
    assert login_amy.status_code == 200
    amy_token = login_amy.json()["access_token"]
    amy_headers = {"Authorization": f"Bearer {amy_token}"}

    login_bob = client.post(
        "/api/auth/login",
        json={"username": "bob_explorer", "password": "password123"},
    )
    assert login_bob.status_code == 200
    bob_token = login_bob.json()["access_token"]
    bob_headers = {"Authorization": f"Bearer {bob_token}"}

    # 4. Amy edits profile
    res_patch = client.patch(
        "/api/users/me",
        json={"bio": "Exploring the world step by step", "profile_picture_url": "/uploads/amy.png"},
        headers=amy_headers,
    )
    assert res_patch.status_code == 200
    assert res_patch.json()["bio"] == "Exploring the world step by step"

    # 5. Bob creates posts at 2 destinations
    p1 = client.post(
        "/api/posts",
        json={"content": "Sunrise at Angkor Wat", "destination_name": "Siem Reap, Cambodia"},
        headers=bob_headers,
    )
    assert p1.status_code == 201
    p1_id = p1.json()["id"]

    p2 = client.post(
        "/api/posts",
        json={"content": "Relaxing on Patong Beach", "destination_name": "Phuket, Thailand"},
        headers=bob_headers,
    )
    assert p2.status_code == 201

    # 6. Amy searches for Bob and follows Bob
    res_search = client.get("/api/users?search=bob")
    assert res_search.status_code == 200
    found_users = res_search.json()
    assert len(found_users) == 1
    assert found_users[0]["id"] == bob_id

    res_follow = client.post(
        "/api/follows",
        json={"followed_id": bob_id},
        headers=amy_headers,
    )
    assert res_follow.status_code == 201

    # 7. Amy checks personalized feed: sees Bob's 2 posts
    res_feed = client.get("/api/feed", headers=amy_headers)
    assert res_feed.status_code == 200
    feed_data = res_feed.json()
    assert feed_data["total"] == 2
    assert len(feed_data["items"]) == 2

    # 8. Amy searches destination "thailand" and checks travelers
    res_dest_search = client.get("/api/destinations?search=thailand")
    assert res_dest_search.status_code == 200
    dests = res_dest_search.json()
    assert len(dests) == 1
    thailand_dest_id = dests[0]["id"]

    res_travelers = client.get(f"/api/destinations/{thailand_dest_id}/travelers")
    assert res_travelers.status_code == 200
    travelers = res_travelers.json()
    assert len(travelers) == 1
    assert travelers[0]["id"] == bob_id

    # 9. Amy creates a post at "Siem Reap, Cambodia"
    p3 = client.post(
        "/api/posts",
        json={"content": "Visiting Bayon Temple", "destination_name": "Siem Reap, Cambodia"},
        headers=amy_headers,
    )
    assert p3.status_code == 201
    p3_id = p3.json()["id"]

    # 10. Amy checks her profile history
    res_amy_prof = client.get(f"/api/users/{amy_id}")
    assert res_amy_prof.status_code == 200
    amy_prof = res_amy_prof.json()
    assert amy_prof["post_count"] == 1
    assert len(amy_prof["destinations_visited"]) == 1
    assert amy_prof["destinations_visited"][0]["name"] == "Siem Reap, Cambodia"

    # 11. Amy tries deleting Bob's post (403 Forbidden)
    res_del_forbidden = client.delete(f"/api/posts/{p1_id}", headers=amy_headers)
    assert res_del_forbidden.status_code == 403

    # 12. Amy deletes her own post
    res_del_own = client.delete(f"/api/posts/{p3_id}", headers=amy_headers)
    assert res_del_own.status_code == 204

    # Post no longer found
    res_get_deleted = client.get(f"/api/posts/{p3_id}")
    assert res_get_deleted.status_code == 404

    # 13. Amy unfollows Bob
    res_unfollow = client.delete(f"/api/follows/{bob_id}", headers=amy_headers)
    assert res_unfollow.status_code == 204

    # Amy's feed is now empty
    res_empty_feed = client.get("/api/feed", headers=amy_headers)
    assert res_empty_feed.status_code == 200
    assert res_empty_feed.json() == {"items": [], "total": 0}

    # 14. Amy logs out
    res_logout = client.post("/api/auth/logout", headers=amy_headers)
    assert res_logout.status_code == 200
    assert res_logout.json() == {"detail": "logged out"}
