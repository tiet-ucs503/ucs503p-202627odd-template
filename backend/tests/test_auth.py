import pytest

import models
from seed import create_demo_accounts
from tests.conftest import PASSWORD

ROLES = ["student", "parent", "teacher"]


def test_register_login_and_me(client, register):
    account = register("student", "Miles")
    assert account.user["role"] == "student"
    assert account.user["link_code"].startswith("SPIDER-")
    assert account.user["is_demo"] is False

    res = client.post("/auth/login", json={"email": account.user["email"], "password": PASSWORD})
    assert res.status_code == 200
    me = client.get("/auth/me", headers={"Authorization": f"Bearer {res.json()['access_token']}"})
    assert me.status_code == 200 and me.json()["id"] == account.id


def test_password_is_stored_as_a_bcrypt_hash(register, db_factory):
    account = register()
    with db_factory() as db:
        stored = db.get(models.User, account.id).password_hash
    assert stored != PASSWORD and stored.startswith("$2")


def test_only_students_get_a_link_code(register):
    assert register("parent").user["link_code"] is None
    assert register("teacher").user["link_code"] is None


def test_duplicate_email_is_rejected(client, register):
    account = register()
    res = client.post("/auth/register", json={
        "name": "Copy", "email": account.user["email"], "password": PASSWORD, "role": "student",
    })
    assert res.status_code == 409


@pytest.mark.parametrize("role", ["admin", "Student", "", "guardian"])
def test_roles_are_strictly_validated(client, role):
    res = client.post("/auth/register", json={
        "name": "X", "email": "x@example.com", "password": PASSWORD, "role": role,
    })
    assert res.status_code == 422


def test_login_failures_do_not_reveal_whether_the_account_exists(client, register):
    account = register()
    wrong_password = client.post("/auth/login", json={"email": account.user["email"], "password": "nope-nope"})
    no_account = client.post("/auth/login", json={"email": "ghost@example.com", "password": "nope-nope"})
    assert wrong_password.status_code == no_account.status_code == 401
    assert wrong_password.json() == no_account.json()


@pytest.mark.parametrize("path", ["/auth/me", "/students/me/progress", "/guardians/students", "/students/1/report"])
def test_endpoints_require_a_token(client, path):
    assert client.get(path).status_code == 401
    assert client.get(path, headers={"Authorization": "Bearer not-a-real-token"}).status_code == 401


# ── T8: demo login is unavailable unless DEMO_MODE is switched on ────────────
@pytest.mark.parametrize("role", ROLES)
def test_demo_login_is_off_by_default(client, db_factory, role):
    with db_factory() as db:
        create_demo_accounts(db)  # even when demo accounts exist
    assert client.post(f"/auth/demo/{role}").status_code == 404


# ── T9: demo login only ever reaches the seeded demo accounts ────────────────
@pytest.mark.parametrize("role", ROLES)
def test_demo_login_returns_only_seeded_demo_accounts(client, db_factory, register, demo_mode, role):
    real = register(role, "Real Person")  # registered first, so it has the lowest id
    with db_factory() as db:
        create_demo_accounts(db)
        users_before = db.query(models.User).count()

    res = client.post(f"/auth/demo/{role}")
    assert res.status_code == 200
    user = res.json()["user"]
    assert user["is_demo"] is True and user["role"] == role and user["id"] != real.id

    with db_factory() as db:
        assert db.query(models.User).count() == users_before  # nothing was created


def test_demo_login_never_creates_accounts(client, db_factory, register, demo_mode):
    register("student")
    for role in ROLES:
        assert client.post(f"/auth/demo/{role}").status_code == 404  # not seeded
    with db_factory() as db:
        assert db.query(models.User).count() == 1
        assert db.query(models.User).filter_by(is_demo=True).count() == 0


@pytest.mark.parametrize("role", ["admin", "root", "STUDENT"])
def test_demo_login_rejects_unknown_roles(client, demo_mode, role):
    assert client.post(f"/auth/demo/{role}").status_code == 422


def test_demo_accounts_cannot_log_in_with_a_password(client, db_factory):
    with db_factory() as db:
        create_demo_accounts(db)
    res = client.post("/auth/login", json={"email": "demo.student@mathverse.demo", "password": PASSWORD})
    assert res.status_code == 401


def test_demo_data_is_flagged_and_seeding_is_idempotent(client, db_factory, demo_mode):
    with db_factory() as db:
        assert create_demo_accounts(db) is True
        assert create_demo_accounts(db) is False
        assert db.query(models.User).filter_by(is_demo=True).count() == 3

    token = client.post("/auth/demo/student").json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    me = client.get("/auth/me", headers=headers).json()
    report = client.get(f"/students/{me['id']}/report", headers=headers).json()
    assert me["is_demo"] is True and report["is_demo"] is True
    assert report["questions_answered"] == 30
    # some demo questions were measured, some were not (camera off)
    assert 0 < report["attention"]["measured_questions"] < report["attention"]["total_questions"]
