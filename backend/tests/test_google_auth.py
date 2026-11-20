"""
"Sign in with Google". Google's token check is replaced by a stand-in here, so
the tests decide what Google "said"; everything after that is the real code.
"""
import pytest

import models
from config import settings
from routers import auth as auth_router
from seed import create_demo_accounts
from tests.conftest import PASSWORD

ALICE = {"sub": "google-111", "email": "alice@gmail.com", "name": "Alice Example"}


@pytest.fixture()
def google(monkeypatch):
    """Turns Google sign-in on and lets each test choose who Google says signed in."""
    monkeypatch.setattr(settings, "google_client_id", "test-client.apps.googleusercontent.com")
    identities = {}

    def fake_verify(credential):
        return identities.get(credential)

    monkeypatch.setattr(auth_router, "verify_google_credential", fake_verify)
    return identities


def sign_in(client, credential="token-alice-xxxxxxxxxxxx", role=None):
    body = {"credential": credential}
    if role:
        body["role"] = role
    return client.post("/auth/google", json=body)


def test_off_unless_a_client_id_is_set(client, monkeypatch):
    monkeypatch.setattr(settings, "google_client_id", "")
    assert sign_in(client, role="student").status_code == 404
    assert client.get("/health").json()["google_client_id"] is None


def test_the_client_id_is_published_for_the_button(client, google):
    assert client.get("/health").json()["google_client_id"] == "test-client.apps.googleusercontent.com"


def test_a_credential_google_does_not_vouch_for_is_refused(client, google, db_factory):
    res = sign_in(client, "forged-or-expired-token-xx", role="student")
    assert res.status_code == 401
    with db_factory() as db:
        assert db.query(models.User).count() == 0


@pytest.mark.parametrize("role", ["student", "parent", "teacher"])
def test_a_new_person_gets_an_account_with_the_role_they_chose(client, google, db_factory, role):
    google["token-alice-xxxxxxxxxxxx"] = ALICE
    res = sign_in(client, role=role)
    assert res.status_code == 200, res.text
    user = res.json()["user"]
    assert (user["name"], user["email"], user["role"], user["is_demo"]) == ("Alice Example", "alice@gmail.com", role, False)
    assert (user["link_code"] is not None) == (role == "student")  # only students get a link code
    me = client.get("/auth/me", headers={"Authorization": f"Bearer {res.json()['access_token']}"})
    assert me.status_code == 200 and me.json()["email"] == "alice@gmail.com"
    with db_factory() as db:
        row = db.query(models.User).filter_by(email="alice@gmail.com").one()
        assert row.google_sub == "google-111"


def test_without_a_role_a_new_person_is_asked_to_choose_one(client, google, db_factory):
    google["token-alice-xxxxxxxxxxxx"] = ALICE
    res = sign_in(client)
    assert res.status_code == 404 and "Create account" in res.json()["detail"]
    with db_factory() as db:
        assert db.query(models.User).count() == 0


def test_signing_in_again_returns_the_same_account_and_ignores_a_new_role(client, google):
    google["token-alice-xxxxxxxxxxxx"] = ALICE
    first = sign_in(client, role="student").json()["user"]
    again = sign_in(client, role="teacher").json()["user"]
    assert again["id"] == first["id"] and again["role"] == "student"  # a role cannot be changed this way


def test_an_existing_password_account_is_linked_and_its_password_still_works(client, google, register, db_factory):
    existing = client.post("/auth/register", json={
        "name": "Alice", "email": "Alice@Gmail.com", "password": PASSWORD, "role": "parent",
    }).json()["user"]
    google["token-alice-xxxxxxxxxxxx"] = ALICE

    res = sign_in(client)  # no role needed: the account exists
    assert res.status_code == 200
    assert res.json()["user"]["id"] == existing["id"] and res.json()["user"]["role"] == "parent"
    with db_factory() as db:
        assert db.get(models.User, existing["id"]).google_sub == "google-111"
        assert db.query(models.User).count() == 1  # no duplicate account
    assert client.post("/auth/login", json={"email": "alice@gmail.com", "password": PASSWORD}).status_code == 200


def test_the_account_is_found_by_google_id_even_if_the_email_changes(client, google):
    google["token-alice-xxxxxxxxxxxx"] = ALICE
    first = sign_in(client, role="student").json()["user"]
    google["token-alice-yyyyyyyyyyyy"] = {**ALICE, "email": "alice.new@gmail.com"}
    assert sign_in(client, "token-alice-yyyyyyyyyyyy").json()["user"]["id"] == first["id"]


def test_an_email_linked_to_another_google_account_is_not_taken_over(client, google):
    google["token-alice-xxxxxxxxxxxx"] = ALICE
    sign_in(client, role="student")
    google["token-mallory-xxxxxxxxxx"] = {"sub": "google-999", "email": "alice@gmail.com", "name": "Mallory"}
    assert sign_in(client, "token-mallory-xxxxxxxxxx", role="student").status_code == 409


def test_a_google_account_has_no_usable_password(client, google):
    google["token-alice-xxxxxxxxxxxx"] = ALICE
    sign_in(client, role="student")
    for guess in (PASSWORD, "", "google-111", "alice@gmail.com"):
        res = client.post("/auth/login", json={"email": "alice@gmail.com", "password": guess or "x"})
        assert res.status_code == 401


def test_demo_accounts_cannot_be_reached_with_google(client, google, db_factory):
    with db_factory() as db:
        create_demo_accounts(db)
        demo_email = db.query(models.User).filter_by(is_demo=True, role="student").one().email
    google["token-demo-xxxxxxxxxxxxx"] = {"sub": "google-222", "email": demo_email, "name": "Someone"}
    assert sign_in(client, "token-demo-xxxxxxxxxxxxx", role="student").status_code == 403


def test_the_request_accepts_only_the_expected_fields(client, google):
    google["token-alice-xxxxxxxxxxxx"] = ALICE
    assert client.post("/auth/google", json={"credential": "token-alice-xxxxxxxxxxxx", "is_demo": True}).status_code == 422
    assert sign_in(client, role="admin").status_code == 422


def test_unverified_or_foreign_tokens_are_rejected_by_the_real_checker(monkeypatch):
    """The real checker, with Google's library replaced: it must insist on a verified email and Google as issuer."""
    from google.oauth2 import id_token

    from services import google_auth

    monkeypatch.setattr(settings, "google_client_id", "test-client")
    base = {"iss": "https://accounts.google.com", "sub": "1", "email": "A@Gmail.com", "email_verified": True, "name": "A"}
    for claims, ok in [
        (base, True),
        ({**base, "email_verified": False}, False),
        ({**base, "iss": "https://evil.example"}, False),
        ({k: v for k, v in base.items() if k != "email"}, False),
    ]:
        monkeypatch.setattr(id_token, "verify_oauth2_token", lambda *a, c=claims, **k: c)
        result = google_auth.verify_google_credential("x" * 30)
        assert (result is not None) == ok, claims
        if ok:
            assert result["email"] == "a@gmail.com"

    def bad_signature(*args, **kwargs):
        raise ValueError("Token used too late")

    monkeypatch.setattr(id_token, "verify_oauth2_token", bad_signature)
    assert google_auth.verify_google_credential("x" * 30) is None


def test_an_older_database_gains_the_new_column(tmp_path, monkeypatch):
    """A database made before Google sign-in existed is upgraded in place, keeping its rows."""
    import sqlite3

    from sqlalchemy import create_engine

    import main

    path = tmp_path / "old.db"
    with sqlite3.connect(path) as con:
        con.execute("CREATE TABLE users (id INTEGER PRIMARY KEY, name VARCHAR, email VARCHAR, password_hash VARCHAR, "
                    "role VARCHAR, points INTEGER, level INTEGER, link_code VARCHAR, is_demo BOOLEAN, created_at DATETIME)")
        con.execute("INSERT INTO users (name, email, password_hash, role, points, level, is_demo) "
                    "VALUES ('Old', 'old@example.com', 'x', 'student', 5, 1, 0)")
    monkeypatch.setattr(main, "engine", create_engine(f"sqlite:///{path}"))
    main._add_missing_columns()
    main._add_missing_columns()  # safe to run twice
    with sqlite3.connect(path) as con:
        cols = [r[1] for r in con.execute("PRAGMA table_info(users)")]
        assert "google_sub" in cols
        assert con.execute("SELECT name, points, google_sub FROM users").fetchall() == [("Old", 5, None)]
