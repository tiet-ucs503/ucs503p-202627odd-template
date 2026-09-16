def test_register_creates_user_and_token(client):
    resp = client.post(
        "/api/auth/register",
        json={"username": "alice", "password": "password123", "email": "alice@example.com", "display_name": "Alice"},
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["user"]["username"] == "alice"
    assert body["user"]["email"] == "alice@example.com"
    assert "id" in body["user"]
    assert body["access_token"]
    assert body["token_type"] == "bearer"


def test_register_duplicate_username_rejected(client, register_user):
    register_user(username="bob")
    resp = client.post("/api/auth/register", json={"username": "bob", "password": "password123"})
    assert resp.status_code == 409


def test_login_success(client, register_user):
    register_user(username="carol", password="s3cretpass")
    resp = client.post("/api/auth/login", json={"username": "carol", "password": "s3cretpass"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["access_token"]
    assert body["token_type"] == "bearer"


def test_login_wrong_password_rejected(client, register_user):
    register_user(username="dave", password="correct-password")
    resp = client.post("/api/auth/login", json={"username": "dave", "password": "wrong-password"})
    assert resp.status_code == 401


def test_login_unknown_username_rejected(client):
    resp = client.post("/api/auth/login", json={"username": "nobody", "password": "whatever123"})
    assert resp.status_code == 401


def test_protected_route_requires_token(client):
    resp = client.get("/api/sessions")
    assert resp.status_code == 401


def test_protected_route_rejects_garbage_token(client):
    resp = client.get("/api/sessions", headers={"Authorization": "Bearer not-a-real-token"})
    assert resp.status_code == 401


def test_protected_route_accepts_valid_token(client, auth_headers):
    resp = client.get("/api/sessions", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json() == []


def test_auth_me_returns_current_user(client, register_user):
    token, user = register_user(username="me-user", email="me@example.com")
    resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json()["id"] == user["id"]


def test_google_auth_registers_and_issues_token(client):
    resp = client.post(
        "/api/auth/google",
        json={"token": "mock-google-id-token", "email": "athlete_lakshay@gmail.com", "name": "Lakshay Gambhir"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["user"]["email"] == "athlete_lakshay@gmail.com"
    assert body["user"]["display_name"] == "Lakshay Gambhir"
    assert body["access_token"]
    assert body["token_type"] == "bearer"


def test_google_auth_missing_email_rejected(client):
    resp = client.post(
        "/api/auth/google",
        json={"token": "mock-google-id-token", "name": "No Email User"},
    )
    assert resp.status_code == 422


def test_oauth_user_cannot_login_with_password(client):
    # Register via Google OAuth
    resp = client.post(
        "/api/auth/google",
        json={"token": "mock-google-id-token", "email": "secure_athlete@gmail.com", "name": "Secure Athlete"},
    )
    assert resp.status_code == 200
    username = resp.json()["user"]["username"]

    # Attempt login via password endpoint
    login_resp = client.post(
        "/api/auth/login",
        json={"username": username, "password": "google-oauth-secure_athlete@gmail.com"},
    )
    assert login_resp.status_code == 400
    assert "Google OAuth" in login_resp.json()["detail"]


def test_oauth_user_lookup_does_not_collide_on_matching_username(client, register_user):
    # Traditional user registered with username "alex"
    register_user(username="alex", password="password123", email="alex_original@example.com")

    # Google user with display name "Alex" and different email
    resp = client.post(
        "/api/auth/google",
        json={"token": "mock-google-id-token", "email": "alex_google@gmail.com", "name": "Alex"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["user"]["email"] == "alex_google@gmail.com"
    # Username was made unique, not colliding with existing "alex"
    assert body["user"]["username"] == "alex_1"


def test_google_auth_invalid_token_rejected(client, monkeypatch):
    from app.config import get_settings
    settings = get_settings()
    monkeypatch.setattr(settings, "google_client_id", "test-client-id.apps.googleusercontent.com")

    resp = client.post(
        "/api/auth/google",
        json={"token": "invalid-unverified-token-signature", "email": "test@example.com"},
    )
    assert resp.status_code == 401
    assert "Invalid or expired Google OAuth token" in resp.json()["detail"]


def test_google_auth_requires_configuration_in_production(client, monkeypatch):
    from app.config import get_settings
    settings = get_settings()
    settings.environment = "production"
    settings.google_client_id = ""
    resp = client.post(
        "/api/auth/google",
        json={"token": "a-real-looking-token-value-123456", "email": "test@example.com"},
    )
    assert resp.status_code == 500
