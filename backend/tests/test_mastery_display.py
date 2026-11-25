"""
Mastery display is presentation only: it limits and labels what is shown, and
never changes what is stored or what the game decides.
"""
import inspect

import pytest

import models
from services import mastery, mastery_display
from services.mastery_display import (
    DISPLAY_MAX_PCT, DISPLAY_MIN_PCT, display_pct, display_text, mastery_band,
)

GRID = [i / 1000 for i in range(10, 991)]  # every stored value from 0.010 to 0.990


def test_displayed_percentage_always_stays_between_5_and_95():
    for p in GRID:
        assert DISPLAY_MIN_PCT <= display_pct(p) <= DISPLAY_MAX_PCT
    assert display_pct(mastery.P_MIN) == 5 and display_pct(mastery.P_MAX) == 95


def test_values_inside_the_range_are_shown_as_they_are():
    assert [display_pct(p) for p in (0.05, 0.30, 0.666, 0.82, 0.95)] == [5, 30, 67, 82, 95]


def test_display_never_reverses_the_order_of_two_students():
    shown = [display_pct(p) for p in GRID]
    assert shown == sorted(shown)


def test_limits_are_worded_as_limits():
    assert display_text(0.01) == "5% or less"
    assert display_text(0.05) == "5% or less"
    assert display_text(0.06) == "6%"
    assert display_text(0.94) == "94%"
    assert display_text(0.95) == "95% or more"
    assert display_text(0.99) == "95% or more"


def test_band_uses_the_same_thresholds_as_question_difficulty():
    tier_to_band = {"easy": "needs_practice", "medium": "developing", "hard": "strong"}
    for p in GRID:
        assert mastery_band(p) == tier_to_band[mastery.difficulty_for(p)]


def test_display_module_only_reads_the_mastery_model():
    """It imports two thresholds and nothing that could write a value back."""
    code = inspect.getsource(mastery_display).split('"""')[2]
    assert "update_mastery" not in code and "models" not in code and "db." not in code


# ── Through the API: what is stored stays raw, what is shown is limited ──────
def stored_mastery(db_factory, student_id):
    with db_factory() as db:
        row = db.query(models.TopicMastery).filter_by(student_id=student_id).one()
        attempts = db.query(models.Attempt).filter(
            models.Attempt.student_id == student_id, models.Attempt.answered_at.isnot(None)
        ).order_by(models.Attempt.id).all()
        return row.p_mastery, [(a.mastery_before, a.mastery_after) for a in attempts]


@pytest.mark.parametrize("correct,raw_end,shown,band,words", [
    (True, mastery.P_MAX, 95, "strong", "95% or more"),
    (False, mastery.P_MIN, 5, "needs_practice", "5% or less"),
])
def test_extreme_mastery_is_stored_raw_but_shown_limited(
        client, register, play, db_factory, correct, raw_end, shown, band, words):
    student = register()
    question = client.post("/sessions", json={"boss_id": "goblin"}, headers=student.headers).json()["question"]
    for _ in range(6):
        body = play(student, question["attempt_id"], correct=correct)
        question = body["next_question"]

    # The answer response carries both: the raw value and the one to show.
    assert body["mastery"] == raw_end
    assert body["mastery_display_pct"] == shown

    before = stored_mastery(db_factory, student.id)
    assert before[0] == raw_end  # stored at the model's own limit, not at 5 or 95

    report = client.get(f"/students/{student.id}/report", headers=student.headers).json()
    algebra = next(t for t in report["topic_mastery"] if t["topic"] == "linear_equations")
    assert algebra["mastery_pct"] == shown and algebra["mastery_band"] == band
    assert algebra["questions_answered"] == 6
    assert algebra["correct_answers"] == (6 if correct else 0)  # the plain record beside the estimate
    assert [p["mastery_pct"] for h in report["mastery_history"] for p in h["points"]] == [shown]

    # No raw extreme reaches any report field or sentence.
    for t in report["topic_mastery"] + report["needs_practice"]:
        assert t["mastery_pct"] is None or 5 <= t["mastery_pct"] <= 95
    text = " ".join(report["observations"])
    assert "1%" not in text.replace("11%", "") and "99%" not in text

    # Building the report changed nothing that is stored.
    assert stored_mastery(db_factory, student.id) == before


def test_needs_practice_is_decided_on_the_raw_value(client, register, play):
    """Raw mastery of 1% is shown as 5%, and is still listed as needing practice."""
    student = register()
    question = client.post("/sessions", json={"boss_id": "goblin"}, headers=student.headers).json()["question"]
    for _ in range(6):
        question = play(student, question["attempt_id"], correct=False)["next_question"]
    report = client.get(f"/students/{student.id}/report", headers=student.headers).json()
    assert [(t["topic"], t["mastery_pct"]) for t in report["needs_practice"]] == [("linear_equations", 5)]


def test_difficulty_still_follows_the_raw_value(client, register, play):
    student = register()
    question = client.post("/sessions", json={"boss_id": "goblin"}, headers=student.headers).json()["question"]
    for _ in range(4):
        body = play(student, question["attempt_id"], correct=True)
        question = body["next_question"]
        assert question["difficulty"] == mastery.difficulty_for(body["mastery"])


def test_observation_sentences_use_the_display_wording(client, register, play):
    student = register()
    question = client.post("/sessions", json={"boss_id": "goblin"}, headers=student.headers).json()["question"]
    for i in range(12):  # enough answers for observations; ends at the model's upper limit
        body = play(student, question["attempt_id"], correct=True)
        if body["next_question"] is None:
            question = client.post("/sessions", json={"boss_id": "goblin"}, headers=student.headers).json()["question"]
        else:
            question = body["next_question"]
    report = client.get(f"/students/{student.id}/report", headers=student.headers).json()
    assert "Algebra (Linear Equations) is a strength (estimated mastery 95% or more)." in report["observations"]
