"""
Email validation and verification for password sign-ups. Emails are captured by
the `outbox` fixture (conftest.py) instead of being sent.
"""
from datetime import timedelta

import pytest

import models
from models import utcnow
from seed import create_demo_accounts
from services import mailer, verification
from tests.conftest import PASSWORD, latest_code

EMAIL = "miles@example.com"


def sign_up(client, email=EMAIL, name="Miles", role="student", password=PASSWORD):
    return client.post("/auth/register", json={"name": name, "email": email, "password": password, "role": role})


def verify(client, code, email=EMAIL):
    return client.post("/auth/verify-email", json={"email": email, "code": code})


def age(db_factory, email=EMAIL, **changes):
    """Move the stored code's clock, e.g. to make it expired or let a resend through."""
    with db_factory() as db:
        user = db.query(models.User).filter_by(email=email).one()
        for key, value in changes.items():
            setattr(user, key, value)
        db.commit()


# ── Sign-up gives no access until the email is confirmed ────────────────────
def test_sign_up_sends_a_code_and_gives_no_token(client, outbox, db_factory):
    res = sign_up(client)
    assert res.status_code == 201
    body = res.json()
    assert body["verification_required"] is True and body["email"] == EMAIL and body["email_sent"] is True
    assert "access_token" not in body
    assert [to for to, _ in outbox] == [EMAIL]
    assert len(latest_code(outbox, EMAIL)) == 6 and latest_code(outbox, EMAIL).isdigit()
    with db_factory() as db:
        assert db.query(models.User).filter_by(email=EMAIL).one().email_verified is False


def test_the_right_code_verifies_the_email_and_signs_in(client, outbox):
    sign_up(client)
    res = verify(client, latest_code(outbox, EMAIL))
    assert res.status_code == 200
    token = res.json()["access_token"]
    assert client.get("/auth/me", headers={"Authorization": f"Bearer {token}"}).json()["email"] == EMAIL
    # From now on the normal login works.
    assert client.post("/auth/login", json={"email": EMAIL, "password": PASSWORD}).status_code == 200


def test_login_is_refused_until_the_email_is_verified(client):
    sign_up(client)
    res = client.post("/auth/login", json={"email": EMAIL, "password": PASSWORD})
    assert res.status_code == 403 and "verify your email" in res.json()["detail"]


def test_an_unverified_account_still_hides_whether_it_exists_from_wrong_passwords(client):
    sign_up(client)
    wrong = client.post("/auth/login", json={"email": EMAIL, "password": "nope-nope"})
    ghost = client.post("/auth/login", json={"email": "ghost@example.com", "password": "nope-nope"})
    assert wrong.status_code == ghost.status_code == 401 and wrong.json() == ghost.json()


def test_the_code_is_stored_only_as_a_hash(client, outbox, db_factory):
    sign_up(client)
    code = latest_code(outbox, EMAIL)
    with db_factory() as db:
        stored = db.query(models.User).filter_by(email=EMAIL).one().verify_code_hash
    assert stored and code not in stored and len(stored) == 64


# ── Wrong, expired and repeated codes ───────────────────────────────────────
def test_a_wrong_code_is_refused_and_counts_down(client, outbox):
    sign_up(client)
    right = latest_code(outbox, EMAIL)
    wrong = "000000" if right != "000000" else "111111"
    res = verify(client, wrong)
    assert res.status_code == 400 and "4 tries left" in res.json()["detail"]
    assert verify(client, right).status_code == 200  # the right code still works afterwards


def test_after_five_wrong_tries_even_the_right_code_is_refused(client, outbox):
    sign_up(client)
    right = latest_code(outbox, EMAIL)
    wrong = "000000" if right != "000000" else "111111"
    for _ in range(verification.MAX_ATTEMPTS):
        verify(client, wrong)
    res = verify(client, right)
    assert res.status_code == 400 and "new code" in res.json()["detail"]


def test_an_expired_code_is_refused(client, outbox, db_factory):
    sign_up(client)
    age(db_factory, verify_expires_at=utcnow() - timedelta(seconds=1))
    res = verify(client, latest_code(outbox, EMAIL))
    assert res.status_code == 400 and "expired" in res.json()["detail"]


def test_a_verified_email_cannot_be_verified_again(client, outbox):
    sign_up(client)
    code = latest_code(outbox, EMAIL)
    verify(client, code)
    assert verify(client, code).status_code == 400


@pytest.mark.parametrize("code", ["12345", "1234567", "12a456", " 123456", ""])
def test_the_code_must_be_exactly_six_digits(client, code):
    assert verify(client, code).status_code == 422


# ── Asking for a new code ───────────────────────────────────────────────────
def test_a_new_code_waits_a_minute_then_replaces_the_old_one(client, outbox, db_factory):
    sign_up(client)
    old = latest_code(outbox, EMAIL)
    soon = client.post("/auth/resend-code", json={"email": EMAIL})
    assert soon.status_code == 429 and len(outbox) == 1

    age(db_factory, verify_sent_at=utcnow() - timedelta(seconds=61))
    res = client.post("/auth/resend-code", json={"email": EMAIL})
    assert res.status_code == 200 and len(outbox) == 2
    new = latest_code(outbox, EMAIL)
    if new != old:  # one in a million they match
        assert verify(client, old).status_code == 400
    assert verify(client, new).status_code == 200


def test_a_new_code_resets_the_wrong_try_count(client, outbox, db_factory):
    sign_up(client)
    for _ in range(verification.MAX_ATTEMPTS):
        verify(client, "000000" if latest_code(outbox, EMAIL) != "000000" else "111111")
    age(db_factory, verify_sent_at=utcnow() - timedelta(seconds=61))
    client.post("/auth/resend-code", json={"email": EMAIL})
    assert verify(client, latest_code(outbox, EMAIL)).status_code == 200


def test_resend_gives_the_same_answer_for_unknown_and_verified_emails(client, register, outbox):
    verified = register().user["email"]
    sent_before = len(outbox)
    unknown = client.post("/auth/resend-code", json={"email": "ghost@example.com"})
    known = client.post("/auth/resend-code", json={"email": verified})
    assert unknown.status_code == known.status_code == 200
    assert unknown.json() == known.json()
    assert len(outbox) == sent_before  # nothing is emailed to either


def test_a_failed_email_is_reported_so_the_user_can_try_again(client, monkeypatch, db_factory):
    monkeypatch.setattr("services.verification.send_verification_code", lambda *a: False)
    res = sign_up(client)
    assert res.status_code == 201 and res.json()["email_sent"] is False
    age(db_factory, verify_sent_at=utcnow() - timedelta(seconds=61))
    assert client.post("/auth/resend-code", json={"email": EMAIL}).status_code == 503


# ── Signing up again with the same email ────────────────────────────────────
def test_an_unconfirmed_sign_up_can_be_redone(client, outbox, db_factory):
    sign_up(client, name="Mlies", role="parent")
    age(db_factory, verify_sent_at=utcnow() - timedelta(seconds=61))
    res = sign_up(client, name="Miles", role="student")
    assert res.status_code == 201
    user = verify(client, latest_code(outbox, EMAIL)).json()["user"]
    assert user["name"] == "Miles" and user["role"] == "student" and user["link_code"].startswith("SPIDER-")
    with db_factory() as db:
        assert db.query(models.User).filter_by(email=EMAIL).count() == 1


def test_a_verified_email_cannot_be_signed_up_again(client, outbox):
    sign_up(client)
    verify(client, latest_code(outbox, EMAIL))
    assert sign_up(client, name="Someone else").status_code == 409


def test_demo_accounts_count_as_verified_and_cannot_be_signed_up_over(client, db_factory, demo_mode):
    with db_factory() as db:
        create_demo_accounts(db)
        demo = db.query(models.User).filter_by(is_demo=True).first()
        assert demo.email_verified is True
        demo_email = demo.email
    assert sign_up(client, email=demo_email).status_code == 409


# ── Email address validation ────────────────────────────────────────────────
def test_email_is_trimmed_and_lower_cased(client, outbox):
    sign_up(client, email="  Miles.Morales@Example.COM ")
    assert outbox[-1][0] == "miles.morales@example.com"
    verify(client, outbox[-1][1], email="MILES.MORALES@example.com")
    res = client.post("/auth/login", json={"email": " Miles.Morales@EXAMPLE.com", "password": PASSWORD})
    assert res.status_code == 200


@pytest.mark.parametrize("email", [
    "", "miles", "miles@", "@example.com", "miles@example", "miles@@example.com",
    "miles example@example.com", "miles@exa mple.com", "miles@.com", "a" * 250 + "@example.com",
])
def test_badly_formed_emails_are_rejected(client, outbox, email):
    assert sign_up(client, email=email).status_code == 422
    assert client.post("/auth/login", json={"email": email, "password": PASSWORD}).status_code == 422
    assert outbox == []


def test_a_blank_name_is_rejected(client):
    assert sign_up(client, name="   ").status_code == 422


# ── Sending email ───────────────────────────────────────────────────────────
def test_without_smtp_the_code_is_printed_in_the_backend_terminal(monkeypatch, capsys):
    monkeypatch.setattr(mailer.settings, "smtp_host", "")
    assert mailer.send_verification_code("a@example.com", "A", "123456") is True
    assert "123456" in capsys.readouterr().out


def test_with_smtp_a_real_message_is_handed_over(monkeypatch):
    monkeypatch.setattr(mailer.settings, "smtp_host", "smtp.example.com")
    monkeypatch.setattr(mailer.settings, "mail_from", "noreply@example.com")
    handed = []
    monkeypatch.setattr(mailer, "deliver", handed.append)
    assert mailer.send_verification_code("a@example.com", "A", "654321") is True
    msg = handed[0]
    assert msg["To"] == "a@example.com" and "654321" in msg["Subject"] and "654321" in msg.get_content()


def test_an_smtp_failure_returns_false_instead_of_crashing(monkeypatch):
    monkeypatch.setattr(mailer.settings, "smtp_host", "smtp.example.com")
    monkeypatch.setattr(mailer.settings, "mail_from", "noreply@example.com")

    def broken(msg):
        raise OSError("network down")

    monkeypatch.setattr(mailer, "deliver", broken)
    assert mailer.send_verification_code("a@example.com", "A", "654321") is False


# ── Older databases ─────────────────────────────────────────────────────────
def test_accounts_made_before_verification_existed_count_as_verified(tmp_path, monkeypatch):
    import sqlite3

    from sqlalchemy import create_engine

    import main

    path = tmp_path / "old.db"
    with sqlite3.connect(path) as con:
        con.execute("CREATE TABLE users (id INTEGER PRIMARY KEY, name VARCHAR, email VARCHAR, password_hash VARCHAR, "
                    "role VARCHAR, points INTEGER, level INTEGER, link_code VARCHAR, is_demo BOOLEAN, "
                    "google_sub VARCHAR, created_at DATETIME)")
        con.execute("INSERT INTO users (name, email, password_hash, role, points, level, is_demo) "
                    "VALUES ('Old', 'old@example.com', 'x', 'student', 5, 1, 0)")
    monkeypatch.setattr(main, "engine", create_engine(f"sqlite:///{path}"))
    main._add_missing_columns()
    main._add_missing_columns()  # safe to run twice
    with sqlite3.connect(path) as con:
        assert con.execute("SELECT name, points, email_verified, verify_attempts FROM users").fetchall() == \
            [("Old", 5, 1, 0)]
