"""The real-data evaluation: who is counted, and that its figures are right."""
from datetime import datetime, timedelta

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import models
from database import Base
from services.mastery import P_GUESS, P_SLIP, PRIOR, update_mastery
from tools import evaluate_real_data as real
from tools.evaluate_mastery import auc

START = datetime(2026, 11, 1, 10, 0)


@pytest.fixture()
def make_db(tmp_path):
    """Builds a database file with the app's own tables, filled with the given answer sequences."""

    def _make(students):
        """students: list of (email, is_demo, role, [(topic, correct), ...])."""
        path = tmp_path / "eval.db"
        engine = create_engine(f"sqlite:///{path}")
        Base.metadata.create_all(engine)
        with sessionmaker(bind=engine)() as db:
            for n, (email, is_demo, role, answers) in enumerate(students):
                user = models.User(name=f"U{n}", email=email, password_hash="x", role=role, is_demo=is_demo)
                db.add(user)
                db.flush()
                session = models.PlaySession(student_id=user.id, boss_id="goblin", topic="linear_equations")
                db.add(session)
                db.flush()
                mastery = {}
                for i, (topic, correct) in enumerate(answers):
                    before = mastery.get(topic, PRIOR)
                    after = update_mastery(before, correct)
                    mastery[topic] = after
                    db.add(models.Attempt(
                        session_id=session.id, student_id=user.id, topic=topic, difficulty="medium",
                        question_text="q", options_json="[]", correct_index=0, selected_index=0,
                        is_correct=correct, mastery_before=before, mastery_after=after,
                        answered_at=START + timedelta(minutes=10 * n + i),
                    ))
                # an unanswered question at the end, which must be ignored
                db.add(models.Attempt(session_id=session.id, student_id=user.id, topic="linear_equations",
                                      difficulty="medium", question_text="q", options_json="[]", correct_index=0))
            db.commit()
        engine.dispose()
        return path

    return _make


LE = "linear_equations"


def test_only_real_students_are_counted(make_db):
    path = make_db([
        ("real@example.com", False, "student", [(LE, True), (LE, False), (LE, True)]),
        ("demo@mathverse.demo", True, "student", [(LE, True)] * 5),
        ("camera-check@example.com", False, "student", [(LE, True)] * 7),
        ("parent@example.com", False, "parent", []),
    ])
    r = real.evaluate(path)
    assert r["answers"] == 3 and r["students"] == 1  # demo, test account and the unanswered question left out
    assert r["topics"] == {LE: 3}


def test_bkt_predictions_come_from_the_stored_mastery(make_db):
    seq = [True, False, True, True, False]
    path = make_db([("a@example.com", False, "student", [(LE, c) for c in seq])])
    r = real.evaluate(path)

    # Recompute the expected AUC by hand from the same stored mastery values.
    expected, p = [], PRIOR
    for correct in seq:
        expected.append(p * (1 - P_SLIP) + (1 - p) * P_GUESS)
        p = update_mastery(p, correct)
    assert r["models"]["BKT (this project)"]["AUC"] == pytest.approx(auc(expected, seq))


def test_baselines_use_only_earlier_answers_per_topic(make_db):
    path = make_db([("a@example.com", False, "student",
                     [(LE, True), ("percentages", False), (LE, False), ("percentages", True)])])
    answers = real.load_answers(path)
    preds = real._predictions(answers, 0.5)
    # Running accuracy: 1st answer of each topic starts at 0.5; then (right + 1) / (seen + 2) within the topic.
    assert preds["Running accuracy so far"] == [0.5, 0.5, 2 / 3, 1 / 3]
    assert preds["Last answer only"] == [0.5, 0.5, 0.8, 0.3]


def test_too_little_data_is_flagged_not_presented(make_db):
    path = make_db([(f"s{i}@example.com", False, "student", [(LE, True), (LE, False)]) for i in range(3)])
    r = real.evaluate(path)
    assert r["answers"] == 6 and r["enough_data"] is False


def test_enough_data_is_recognised(make_db, monkeypatch):
    monkeypatch.setattr(real, "MIN_ANSWERS", 20)
    monkeypatch.setattr(real, "MIN_STUDENTS", 4)
    monkeypatch.setattr(real, "BOOTSTRAP_ROUNDS", 50)
    path = make_db([(f"s{i}@example.com", False, "student", [(LE, c) for c in [False, True, True, False, True, True]])
                    for i in range(4)])
    r = real.evaluate(path)
    assert r["enough_data"] is True and r["answers"] == 24
    assert r["auc_gap_ci"] is not None and r["auc_gap_ci"][0] <= r["auc_gap_ci"][1]


def test_all_right_or_all_wrong_gives_no_metrics(make_db):
    r = real.evaluate(make_db([("a@example.com", False, "student", [(LE, True)] * 4)]))
    assert r["models"] == {}


def test_the_database_is_only_read(make_db):
    path = make_db([("a@example.com", False, "student", [(LE, True), (LE, False)])])
    before = path.read_bytes()
    real.evaluate(path)
    assert path.read_bytes() == before
