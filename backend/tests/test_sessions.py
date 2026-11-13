import models
from services import game

ATTENTION = {"face_present_pct": 96.0, "on_screen_pct": 88.0, "blink_rate_per_min": 15.0, "sample_seconds": 8.0}


def start(client, account, boss_id="goblin"):
    return client.post("/sessions", json={"boss_id": boss_id}, headers=account.headers)


def test_question_never_contains_the_answer(client, register):
    body = start(client, register()).json()
    assert set(body["question"]) == {"attempt_id", "text", "options", "topic", "difficulty"}
    assert len(body["question"]["options"]) == 4


def test_correct_answer_scores_and_raises_mastery(client, register, play):
    student = register()
    attempt_id = start(client, student).json()["question"]["attempt_id"]
    body = play(student, attempt_id, correct=True)
    assert body["correct"] is True
    assert body["points_awarded"] == 70  # 50 base + 20 speed bonus, no streak yet
    assert body["mastery"] > 0.30
    assert body["session"]["correct_count"] == 1 and body["session"]["streak"] == 1
    assert body["progress"]["points"] == 70
    assert body["next_question"]["attempt_id"] != attempt_id


def test_wrong_answer_is_stored_as_wrong_and_lowers_mastery(client, register, play, db_factory):
    """Regression for the old bug where any score above 0 counted as correct."""
    student = register()
    attempt_id = start(client, student).json()["question"]["attempt_id"]
    body = play(student, attempt_id, correct=False)
    assert body["correct"] is False
    assert body["mastery"] < 0.30
    assert body["session"]["wrong_count"] == 1 and body["session"]["streak"] == 0
    with db_factory() as db:
        assert db.get(models.Attempt, attempt_id).is_correct is False

    report = client.get(f"/students/{student.id}/report", headers=student.headers).json()
    assert report["accuracy_pct"] == 0 and report["correct_answers"] == 0


def test_timeout_counts_as_wrong_and_earns_nothing(client, register):
    student = register()
    attempt_id = start(client, student).json()["question"]["attempt_id"]
    res = client.post(f"/attempts/{attempt_id}/answer", headers=student.headers,
                      json={"selected_index": None, "response_time_ms": 300000})
    assert res.status_code == 200
    assert res.json()["correct"] is False and res.json()["points_awarded"] == 0


# ── T1 (server half): a whole mission without any camera data ────────────────
def test_mission_can_be_won_without_a_camera(register, win_mission, db_factory):
    student = register()
    final = win_mission(student)  # no "attention" field sent at all
    assert final["session_status"] == "victory"
    assert final["bonus_points"] == game.victory_bonus(game.QUESTIONS_TO_WIN)
    assert final["progress"]["level"] == 2
    assert final["progress"]["unlocked_bosses"] == ["goblin", "doc-ock"]
    assert final["progress"]["missions_won"] == 1

    with db_factory() as db:
        attempts = db.query(models.Attempt).filter_by(student_id=student.id).all()
        assert len(attempts) == game.QUESTIONS_TO_WIN
        for a in attempts:  # not measured stays NULL, never 0 or a default label
            assert a.face_present_pct is None and a.on_screen_pct is None
            assert a.blink_rate_per_min is None and a.attention_score is None
            assert a.attention_label is None


# ── T2 (server half): camera data is stored, and changes nothing academic ────
def test_attention_is_stored_but_does_not_change_the_outcome(register, win_mission, db_factory):
    without, with_camera = register(), register()
    a = win_mission(without)
    b = win_mission(with_camera, attention=ATTENTION)
    assert a["progress"] == {**b["progress"], "link_code": a["progress"]["link_code"]}
    assert a["mastery"] == b["mastery"]

    with db_factory() as db:
        row = db.query(models.Attempt).filter_by(student_id=with_camera.id).first()
        assert row.on_screen_pct == 88.0 and row.attention_label == "Focused"


def test_mission_is_lost_after_too_many_wrong_answers(client, register, play):
    student = register()
    attempt_id = start(client, student).json()["question"]["attempt_id"]
    for _ in range(game.MAX_WRONG):
        body = play(student, attempt_id, correct=False)
        if body["next_question"]:
            attempt_id = body["next_question"]["attempt_id"]
    assert body["session_status"] == "defeat" and body["next_question"] is None
    assert body["progress"]["level"] == 1


def test_question_cannot_be_answered_twice(client, register, play):
    student = register()
    attempt_id = start(client, student).json()["question"]["attempt_id"]
    play(student, attempt_id, correct=False)
    res = client.post(f"/attempts/{attempt_id}/answer", headers=student.headers,
                      json={"selected_index": 0, "response_time_ms": 1000})
    assert res.status_code == 409


def test_locked_and_unknown_missions_are_refused(client, register):
    student = register()
    assert start(client, student, "kingpin").status_code == 403
    assert start(client, student, "thanos").status_code == 404


def test_one_student_cannot_touch_anothers_question(client, register):
    owner, other = register(), register()
    attempt_id = start(client, owner).json()["question"]["attempt_id"]
    payload = {"selected_index": 0, "response_time_ms": 1000}
    assert client.post(f"/attempts/{attempt_id}/answer", json=payload, headers=other.headers).status_code == 404
    assert client.get(f"/attempts/{attempt_id}/hint", headers=other.headers).status_code == 404


def test_gameplay_requires_a_student_account(client, register):
    for role in ("parent", "teacher"):
        account = register(role)
        assert start(client, account).status_code == 403
        assert client.get("/students/me/progress", headers=account.headers).status_code == 403
    assert client.post("/sessions", json={"boss_id": "goblin"}).status_code == 401


def test_points_cannot_be_set_by_the_client(client, register):
    student = register()
    attempt_id = start(client, student).json()["question"]["attempt_id"]
    for extra in ({"score": 9999}, {"bonus_points": 9999}, {"user_id": 1}):
        res = client.post(f"/attempts/{attempt_id}/answer", headers=student.headers,
                          json={"selected_index": 0, "response_time_ms": 1000, **extra})
        assert res.status_code == 422


# ── T5 (server half): there is nowhere to send an image ──────────────────────
def test_image_data_is_rejected(client, register):
    student = register()
    attempt_id = start(client, student).json()["question"]["attempt_id"]
    base = {"selected_index": 0, "response_time_ms": 1000}
    for extra in ({"image_base64": "data:image/jpeg;base64,AAAA"},
                  {"attention": {**ATTENTION, "frame": "data:image/jpeg;base64,AAAA"}}):
        res = client.post(f"/attempts/{attempt_id}/answer", json={**base, **extra}, headers=student.headers)
        assert res.status_code == 422


def test_api_schema_has_no_image_or_binary_fields(client):
    """Walks the whole API description: no field name, format or upload type could carry an image."""
    banned = ("image", "base64", "binary", "frame", "video", "photo", "picture", "multipart", "octet")
    found = []

    def walk(node, path=""):
        if isinstance(node, dict):
            for key, value in node.items():
                if key in ("properties", "content"):  # field names / request body media types
                    found.extend(f"{path}/{key}/{name}" for name in value if any(b in name.lower() for b in banned))
                if key in ("format", "contentMediaType") and isinstance(value, str):
                    if any(b in value.lower() for b in banned):
                        found.append(f"{path}/{key}={value}")
                walk(value, f"{path}/{key}")
        elif isinstance(node, list):
            for item in node:
                walk(item, path)

    walk(client.get("/openapi.json").json())
    assert found == []


def test_hint_marks_the_attempt(client, register, db_factory):
    student = register()
    attempt_id = start(client, student).json()["question"]["attempt_id"]
    res = client.get(f"/attempts/{attempt_id}/hint", headers=student.headers)
    assert res.status_code == 200 and res.json()["hint"]
    with db_factory() as db:
        assert db.get(models.Attempt, attempt_id).hint_used is True


def test_starting_a_new_mission_abandons_the_old_one(client, register, db_factory):
    student = register()
    first = start(client, student).json()["session"]["id"]
    start(client, student)
    with db_factory() as db:
        assert db.get(models.PlaySession, first).status == "abandoned"
