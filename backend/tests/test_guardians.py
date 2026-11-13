import pytest

from seed import create_demo_accounts


def link(client, guardian, code):
    return client.post("/guardians/links", json={"link_code": code}, headers=guardian.headers)


def report(client, viewer, student_id):
    return client.get(f"/students/{student_id}/report", headers=viewer.headers)


# ── T10: parent and teacher access restrictions ──────────────────────────────
@pytest.mark.parametrize("role", ["parent", "teacher"])
def test_guardian_sees_only_linked_students(client, register, role):
    child, stranger = register("student", "Child"), register("student", "Stranger")
    guardian = register(role)

    assert report(client, guardian, child.id).status_code == 403  # not linked yet
    assert link(client, guardian, child.user["link_code"]).status_code == 201
    assert report(client, guardian, child.id).status_code == 200
    assert report(client, guardian, stranger.id).status_code == 403
    assert report(client, guardian, 99999).status_code == 403


def test_linking_needs_the_students_code(client, register):
    child, guardian = register("student"), register("parent")
    assert link(client, guardian, "SPIDER-WRONG1").status_code == 404
    assert link(client, guardian, str(child.id)).status_code in (404, 422)  # an id is not a code
    assert client.get("/guardians/students", headers=guardian.headers).json() == []


def test_students_cannot_use_guardian_endpoints_or_read_each_other(client, register):
    a, b = register("student"), register("student")
    assert link(client, a, b.user["link_code"]).status_code == 403
    assert client.get("/guardians/students", headers=a.headers).status_code == 403
    assert report(client, a, b.id).status_code == 403
    assert report(client, a, a.id).status_code == 200


def test_guardian_cannot_link_to_another_guardian(client, register):
    parent, teacher = register("parent"), register("teacher")
    assert teacher.user["link_code"] is None
    assert link(client, parent, "SPIDER-AAAAAA").status_code == 404


# ── T12: several children linked to one parent ───────────────────────────────
def test_parent_with_several_children(client, register, win_mission):
    parent = register("parent")
    first, second, third = (register("student", n) for n in ("Asha", "Ben", "Chen"))
    win_mission(first)  # only the first child has played

    for child in (first, second):
        assert link(client, parent, child.user["link_code"]).status_code == 201
    assert link(client, parent, first.user["link_code"]).status_code == 201  # linking twice is harmless

    listed = client.get("/guardians/students", headers=parent.headers).json()
    assert [s["name"] for s in listed] == ["Asha", "Ben"]

    first_report = report(client, parent, first.id).json()
    second_report = report(client, parent, second.id).json()
    assert first_report["questions_answered"] == 7 and first_report["missions_won"] == 1
    assert second_report["questions_answered"] == 0 and second_report["accuracy_pct"] is None
    assert report(client, parent, third.id).status_code == 403


def test_one_child_can_have_a_parent_and_a_teacher(client, register):
    child, parent, teacher = register("student"), register("parent"), register("teacher")
    for guardian in (parent, teacher):
        assert link(client, guardian, child.user["link_code"]).status_code == 201
        assert report(client, guardian, child.id).status_code == 200


# ── Demo isolation: demo and real accounts never mix ─────────────────────────
def test_demo_and_real_accounts_cannot_be_linked(client, register, db_factory, demo_mode):
    with db_factory() as db:
        create_demo_accounts(db)
    real_child, real_parent = register("student"), register("parent")

    demo_parent = client.post("/auth/demo/parent").json()
    demo_headers = {"Authorization": f"Bearer {demo_parent['access_token']}"}
    demo_student_id = client.post("/auth/demo/student").json()["user"]["id"]

    # a demo guardian cannot attach to, or read, a real child
    res = client.post("/guardians/links", json={"link_code": real_child.user["link_code"]}, headers=demo_headers)
    assert res.status_code == 404
    assert client.get(f"/students/{real_child.id}/report", headers=demo_headers).status_code == 403

    # a real guardian cannot attach to, or read, the demo child
    assert link(client, real_parent, "SPIDER-DEMO01").status_code == 404
    assert report(client, real_parent, demo_student_id).status_code == 403

    # the demo guardian still sees the demo child
    listed = client.get("/guardians/students", headers=demo_headers).json()
    assert [s["id"] for s in listed] == [demo_student_id] and listed[0]["is_demo"] is True
