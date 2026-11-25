"""
T11: every dashboard statistic matches the stored records.
T12 (dashboard half): several children under one parent get separate, correct reports.

The dataset below is written straight into the database with known values, and
every expected number is worked out by hand in the comments.
"""
import json
from datetime import datetime, timedelta

import pytest

import models
from models import utcnow
from services.report_builder import TREND_DAYS, build_report

NOON_TODAY = utcnow().replace(hour=12, minute=0, second=0, microsecond=0)


def add_attempts(db, student_id, session_id, topic, days_ago, outcomes, seconds,
                 on_screen=(), hints=0, mastery_after=None):
    """Adds answered questions on one day. `on_screen` gives camera values for the first few."""
    for i, is_correct in enumerate(outcomes):
        measured = i < len(on_screen)
        db.add(models.Attempt(
            session_id=session_id, student_id=student_id, topic=topic, difficulty="medium",
            question_text="q", options_json=json.dumps(["1", "2", "3", "4"]), correct_index=0,
            selected_index=0 if is_correct else 1, is_correct=is_correct,
            response_time_ms=seconds * 1000, hint_used=i < hints, points_awarded=50 if is_correct else 5,
            mastery_after=mastery_after,
            face_present_pct=100.0 if measured else None,
            on_screen_pct=float(on_screen[i]) if measured else None,
            attention_score=on_screen[i] / 100 if measured else None,
            attention_label="Focused" if measured else None,
            answered_at=NOON_TODAY - timedelta(days=days_ago) + timedelta(minutes=i),
        ))


@pytest.fixture()
def known_student(register, db_factory):
    """
    15 answers over three days:
      9 days ago  algebra   6 answers, 3 correct, 30s each, no camera
      2 days ago  algebra   5 answers, 4 correct, 60s each, camera on for 2 (80% and 60%)
      today       geometry  4 answers, 1 correct, 15s each, camera on for 1 (40%), 2 hints
    """
    student = register("student", "Known Kid")
    with db_factory() as db:
        won = models.PlaySession(student_id=student.id, boss_id="goblin", topic="linear_equations",
                                 status="victory", correct_count=7, wrong_count=1)
        lost = models.PlaySession(student_id=student.id, boss_id="doc-ock", topic="area_perimeter",
                                  status="defeat", correct_count=1, wrong_count=7)
        db.add_all([won, lost])
        db.flush()
        add_attempts(db, student.id, won.id, "linear_equations", 9, [1, 1, 0, 0, 0, 1], 30, mastery_after=0.50)
        add_attempts(db, student.id, won.id, "linear_equations", 2, [1, 1, 1, 1, 0], 60,
                     on_screen=(80, 60), mastery_after=0.82)
        add_attempts(db, student.id, lost.id, "area_perimeter", 0, [0, 0, 1, 0], 15,
                     on_screen=(40,), hints=2, mastery_after=0.20)
        db.add_all([
            models.TopicMastery(student_id=student.id, topic="linear_equations", p_mastery=0.82, attempts_count=11),
            models.TopicMastery(student_id=student.id, topic="area_perimeter", p_mastery=0.20, attempts_count=4),
        ])
        user = db.get(models.User, student.id)
        user.points, user.level = 430, 2
        db.commit()
    return student


def get_report(client, viewer, student_id):
    res = client.get(f"/students/{student_id}/report", headers=viewer.headers)
    assert res.status_code == 200, res.text
    return res.json()


def day(report, days_ago):
    wanted = (NOON_TODAY - timedelta(days=days_ago)).date().isoformat()
    return next(d for d in report["daily"] if d["date"] == wanted)


# ── T11 ──────────────────────────────────────────────────────────────────────
def test_totals_match_the_stored_answers(client, known_student):
    r = get_report(client, known_student, known_student.id)
    assert r["questions_answered"] == 15
    assert r["correct_answers"] == 8                 # 3 + 4 + 1
    assert r["accuracy_pct"] == 53                   # 8 / 15
    assert r["practice_minutes"] == 9                # (6*30 + 5*60 + 4*15) s = 540 s
    assert (r["missions_played"], r["missions_won"], r["bosses_defeated"], r["total_bosses"]) == (2, 1, 1, 6)
    assert (r["points"], r["level"]) == (430, 2)
    assert r["last_active"].startswith(NOON_TODAY.date().isoformat())


def test_daily_trend_matches_the_stored_answers(client, known_student):
    r = get_report(client, known_student, known_student.id)
    assert len(r["daily"]) == TREND_DAYS
    assert [d["date"] for d in r["daily"]] == sorted(d["date"] for d in r["daily"])  # oldest first

    assert day(r, 9) == {**day(r, 9), "questions": 6, "correct": 3, "accuracy_pct": 50, "practice_minutes": 3.0}
    assert day(r, 2) == {**day(r, 2), "questions": 5, "correct": 4, "accuracy_pct": 80, "practice_minutes": 5.0}
    assert day(r, 0) == {**day(r, 0), "questions": 4, "correct": 1, "accuracy_pct": 25, "practice_minutes": 1.0}

    quiet = day(r, 5)  # a day with no practice is shown as empty, not as 0% accuracy
    assert quiet["questions"] == 0 and quiet["accuracy_pct"] is None and quiet["practice_minutes"] == 0
    assert sum(d["questions"] for d in r["daily"]) == 15


def test_topic_mastery_and_history_match_the_stored_values(client, known_student):
    r = get_report(client, known_student, known_student.id)
    by_topic = {t["topic"]: t for t in r["topic_mastery"]}
    assert by_topic["linear_equations"] == {**by_topic["linear_equations"], "mastery_pct": 82, "questions_answered": 11}
    assert by_topic["area_perimeter"] == {**by_topic["area_perimeter"], "mastery_pct": 20, "questions_answered": 4}
    assert by_topic["percentages"]["mastery_pct"] is None  # not started: unknown, not 0%
    assert by_topic["percentages"]["mastery_band"] is None

    # The band in words, and the plain record shown beside the estimate.
    assert by_topic["linear_equations"]["mastery_band"] == "strong"
    assert by_topic["area_perimeter"]["mastery_band"] == "needs_practice"
    assert by_topic["linear_equations"]["correct_answers"] == 7   # 3 nine days ago + 4 two days ago
    assert by_topic["area_perimeter"]["correct_answers"] == 1

    assert [t["topic"] for t in r["needs_practice"]] == ["area_perimeter"]  # 20% is below 40%

    history = {h["topic"]: [p["mastery_pct"] for p in h["points"]] for h in r["mastery_history"]}
    assert history == {"linear_equations": [50, 82], "area_perimeter": [20]}


def test_attention_is_averaged_only_over_measured_questions(client, known_student):
    r = get_report(client, known_student, known_student.id)
    # Measured on 3 of 15 questions: (80 + 60 + 40) / 3 = 60. If the 12 unmeasured
    # questions were wrongly counted as zero this would be 12.
    assert r["attention"] == {"measured_questions": 3, "total_questions": 15, "avg_on_screen_pct": 60}

    assert (day(r, 2)["attention_measured"], day(r, 2)["avg_on_screen_pct"]) == (2, 70)
    assert (day(r, 0)["attention_measured"], day(r, 0)["avg_on_screen_pct"]) == (1, 40)
    assert (day(r, 9)["attention_measured"], day(r, 9)["avg_on_screen_pct"]) == (0, None)  # camera not used


def test_observations_are_rule_based_statements_of_the_numbers(client, known_student):
    r = get_report(client, known_student, known_student.id)
    assert r["observations"] == [
        "Practised on 2 of the last 7 days.",
        # last 7 days: 5 of 9 correct = 56%; the 7 days before: 3 of 6 = 50%
        "Accuracy over the last 7 days was 56%, up from 50% the week before.",
        "Algebra (Linear Equations) is a strength (estimated mastery 82%).",
    ]
    # Attention never appears in, or explains, anything academic.
    text = " ".join(r["observations"]).lower()
    for word in ("attention", "camera", "focus", "screen", "distract"):
        assert word not in text


def test_badges_are_earned_from_stored_missions_only(client, known_student):
    r = get_report(client, known_student, known_student.id)
    assert [b["id"] for b in r["badges"]] == ["defeated-goblin"]  # one win, with a wrong answer in it


def test_recent_answers_are_the_latest_stored_answers(client, known_student):
    r = get_report(client, known_student, known_student.id)
    recent = r["recent_attempts"]
    assert len(recent) == 10
    assert [a["is_correct"] for a in recent[:4]] == [False, True, False, False]  # today's, newest first
    assert all(a["topic_label"] == "Geometry (Area & Perimeter)" for a in recent[:4])
    assert [a["attention_label"] for a in recent[:4]] == [None, None, None, "Focused"]


def test_a_student_with_no_history_gets_an_empty_report(client, register):
    student = register("student", "Brand New")
    r = get_report(client, student, student.id)
    assert r["accuracy_pct"] is None and r["last_active"] is None
    assert r["needs_practice"] == [] and r["mastery_history"] == []
    assert r["observations"] == [] and r["badges"] == [] and r["recent_attempts"] == []
    assert len(r["daily"]) == TREND_DAYS
    assert all(d["questions"] == 0 and d["accuracy_pct"] is None and d["avg_on_screen_pct"] is None for d in r["daily"])


def test_observations_wait_until_there_is_enough_data(client, register, play):
    student = register()
    question = client.post("/sessions", json={"boss_id": "goblin"}, headers=student.headers).json()["question"]
    for _ in range(4):
        question = play(student, question["attempt_id"], correct=True)["next_question"]
    assert get_report(client, student, student.id)["observations"] == []


def test_days_follow_the_viewers_clock(register, db_factory):
    """An answer at 23:30 UTC belongs to the next day for a viewer five and a half hours ahead."""
    student = register()
    late = datetime(2026, 3, 10, 23, 30)
    with db_factory() as db:
        session = models.PlaySession(student_id=student.id, boss_id="goblin", topic="linear_equations")
        db.add(session)
        db.flush()
        db.add(models.Attempt(
            session_id=session.id, student_id=student.id, topic="linear_equations", question_text="q",
            options_json="[]", correct_index=0, selected_index=0, is_correct=True,
            response_time_ms=1000, answered_at=late,
        ))
        db.commit()
        user = db.get(models.User, student.id)
        now = datetime(2026, 3, 11, 6, 0)
        utc = build_report(db, user, 0, now=now)
        india = build_report(db, user, 330, now=now)

    assert [str(d.date) for d in utc.daily if d.questions] == ["2026-03-10"]
    assert [str(d.date) for d in india.daily if d.questions] == ["2026-03-11"]


# ── T10 and T12 on the dashboard endpoints ───────────────────────────────────
def test_parent_sees_each_child_separately(client, register, known_student):
    parent = register("parent")
    sibling = register("student", "Quiet Sibling")
    for child in (known_student, sibling):
        res = client.post("/guardians/links", json={"link_code": child.user["link_code"]}, headers=parent.headers)
        assert res.status_code == 201

    listed = {s["name"]: s for s in client.get("/guardians/students", headers=parent.headers).json()}
    assert listed["Known Kid"]["questions_answered"] == 15 and listed["Known Kid"]["accuracy_pct"] == 53
    assert listed["Known Kid"]["last_active"] is not None
    assert listed["Quiet Sibling"]["questions_answered"] == 0
    assert listed["Quiet Sibling"]["accuracy_pct"] is None and listed["Quiet Sibling"]["last_active"] is None

    assert get_report(client, parent, known_student.id)["questions_answered"] == 15
    assert get_report(client, parent, sibling.id)["questions_answered"] == 0


def test_teacher_sees_linked_students_and_nobody_else(client, register, known_student):
    teacher, outsider = register("teacher"), register("student", "Not In Class")
    client.post("/guardians/links", json={"link_code": known_student.user["link_code"]}, headers=teacher.headers)

    assert [s["name"] for s in client.get("/guardians/students", headers=teacher.headers).json()] == ["Known Kid"]
    assert get_report(client, teacher, known_student.id)["student_name"] == "Known Kid"
    for path in (f"/students/{outsider.id}/report", f"/students/{outsider.id}/report?tz_offset_minutes=330"):
        assert client.get(path, headers=teacher.headers).status_code == 403


def test_report_rejects_a_nonsense_clock_offset(client, known_student):
    res = client.get(f"/students/{known_student.id}/report?tz_offset_minutes=99999", headers=known_student.headers)
    assert res.status_code == 422
