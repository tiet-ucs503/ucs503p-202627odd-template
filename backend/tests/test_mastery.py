"""
T6: academic mastery is unaffected by attention data.
T7: correct and incorrect answers update BKT the right way.
"""
import inspect

import pytest

import models
from services import mastery
from services.mastery import P_MAX, P_MIN, PRIOR, difficulty_for, update_mastery

GRID = [i / 100 for i in range(1, 100)]  # 0.01 … 0.99


# ── T7: the model itself ─────────────────────────────────────────────────────
@pytest.mark.parametrize("p", GRID)
def test_correct_answer_never_lowers_and_normally_raises_mastery(p):
    after = update_mastery(p, True)
    assert after >= p
    if p < 0.98:
        assert after > p
    assert P_MIN <= after <= P_MAX


@pytest.mark.parametrize("p", GRID)
def test_incorrect_answer_never_raises_and_normally_lowers_mastery(p):
    """The reason for our one change to textbook BKT (see services/mastery.py)."""
    after = update_mastery(p, False)
    assert after <= p
    if p > 0.02:
        assert after < p
    assert P_MIN <= after <= P_MAX


def test_worked_example_from_the_documentation():
    assert update_mastery(0.30, True) == pytest.approx(0.6657, abs=1e-4)
    assert update_mastery(0.30, False) == pytest.approx(0.0541, abs=1e-4)


def test_textbook_bkt_would_have_raised_mastery_after_a_wrong_answer():
    """Shows the problem we avoid: with the learning step applied, 0.05 would become about 0.16."""
    p = 0.05
    posterior = p * mastery.P_SLIP / (p * mastery.P_SLIP + (1 - p) * (1 - mastery.P_GUESS))
    textbook = posterior + (1 - posterior) * mastery.P_LEARN
    assert textbook > p  # the textbook value goes UP after a wrong answer
    assert update_mastery(p, False) < p  # ours goes down


def test_mastery_stays_inside_its_limits_under_long_streaks():
    p = PRIOR
    for _ in range(50):
        p = update_mastery(p, True)
    assert p == P_MAX
    for _ in range(50):
        p = update_mastery(p, False)
    assert p == P_MIN


def test_difficulty_thresholds():
    assert [difficulty_for(p) for p in (0.01, 0.39)] == ["easy", "easy"]
    assert [difficulty_for(p) for p in (0.40, 0.60, 0.75)] == ["medium", "medium", "medium"]
    assert [difficulty_for(p) for p in (0.76, 0.99)] == ["hard", "hard"]
    assert difficulty_for(PRIOR) == "easy"  # a new student starts gently


def test_mastery_functions_cannot_be_given_attention_data():
    """The separation is structural: there is no parameter to pass attention through."""
    assert list(inspect.signature(update_mastery).parameters) == ["p_mastery", "is_correct"]
    assert list(inspect.signature(difficulty_for).parameters) == ["p_mastery"]
    source = inspect.getsource(mastery)
    code = "\n".join(line for line in source.split('"""')[2].splitlines())  # skip the module docstring
    for word in ("attention", "camera", "on_screen", "face_present", "blink", "response_time", "hint"):
        assert word not in code


# ── T7: through the API ──────────────────────────────────────────────────────
def start(client, account, boss_id="goblin"):
    res = client.post("/sessions", json={"boss_id": boss_id}, headers=account.headers)
    assert res.status_code == 201, res.text
    return res.json()["question"]


def test_first_question_is_easy_and_streaks_move_the_difficulty(client, register, play):
    student = register()
    question = start(client, student)
    assert question["difficulty"] == "easy"

    for _ in range(5):  # five right in a row
        body = play(student, question["attempt_id"], correct=True)
        question = body["next_question"]
    assert question["difficulty"] == "hard"

    for _ in range(5):  # then five wrong in a row
        body = play(student, question["attempt_id"], correct=False)
        question = body["next_question"]
    assert question["difficulty"] == "easy"


def test_each_topic_has_its_own_mastery(client, register, play, win_mission, db_factory):
    student = register()
    win_mission(student, "goblin")  # unlocks doc-ock

    def mastery_of(topic):
        with db_factory() as db:
            row = db.query(models.TopicMastery).filter_by(student_id=student.id, topic=topic).first()
            return row.p_mastery if row else None

    algebra_before = mastery_of("linear_equations")
    assert algebra_before > 0.9
    assert mastery_of("area_perimeter") is None  # untouched until it is played

    question = start(client, student, "doc-ock")
    assert question["difficulty"] == "easy"  # strong algebra does not make geometry start hard
    play(student, question["attempt_id"], correct=False)

    assert mastery_of("area_perimeter") < PRIOR
    assert mastery_of("linear_equations") == algebra_before  # a geometry mistake leaves algebra alone


def test_mastery_before_and_after_are_recorded_on_each_attempt(client, register, play, db_factory):
    student = register()
    question = start(client, student)
    body = play(student, question["attempt_id"], correct=True)
    with db_factory() as db:
        attempt = db.get(models.Attempt, question["attempt_id"])
        assert attempt.mastery_before == PRIOR
        assert attempt.mastery_after == body["mastery"] == update_mastery(PRIOR, True)


# ── T6: attention never changes anything academic ────────────────────────────
ANSWERS = [True, True, False, True, False, False, True, True, False, True]
ATTENTION_CASES = {
    "no camera": None,
    "fully attentive": {"face_present_pct": 100, "on_screen_pct": 100, "blink_rate_per_min": 15, "sample_seconds": 8},
    "looking away": {"face_present_pct": 100, "on_screen_pct": 5, "blink_rate_per_min": 40, "sample_seconds": 8},
    "left the room": {"face_present_pct": 0, "on_screen_pct": 0, "blink_rate_per_min": None, "sample_seconds": 8},
}


def test_same_answers_give_identical_academic_results_whatever_the_attention(client, register, play, db_factory):
    outcomes = {}
    for label, attention in ATTENTION_CASES.items():
        student = register()
        question = start(client, student)
        trace = []
        for is_correct in ANSWERS:
            body = play(student, question["attempt_id"], correct=is_correct, attention=attention)
            question = body["next_question"]
            trace.append((
                body["correct"], body["points_awarded"], body["mastery"],
                question["difficulty"], body["session"]["streak"],
                body["progress"]["points"], body["progress"]["level"], body["progress"]["unlocked_bosses"],
            ))
        with db_factory() as db:
            stored = db.query(models.TopicMastery).filter_by(student_id=student.id).one().p_mastery
            labels = {a.attention_label for a in db.query(models.Attempt).filter(
                models.Attempt.student_id == student.id, models.Attempt.answered_at.isnot(None))}
        outcomes[label] = (trace, stored)
        # the attention itself was stored as given, so this is a real comparison
        expected = {"no camera": {None}, "fully attentive": {"Focused"},
                    "looking away": {"Distracted"}, "left the room": {"Away"}}[label]
        assert labels == expected

    baseline = outcomes["no camera"]
    for label, outcome in outcomes.items():
        assert outcome == baseline, f"attention case '{label}' changed an academic result"
