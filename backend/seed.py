"""
Database helper.

    python seed.py --demo     create the three demo accounts with sample data (safe to re-run)
    python seed.py --reset    delete ALL data and recreate empty tables

Demo accounts are marked is_demo=True, hold synthetic practice history, and can
only be reached through POST /auth/demo/{role} when DEMO_MODE=true. Their
passwords are random and never shown, so they cannot be used with normal login.
"""
import argparse
import json
import random
import secrets
from datetime import timedelta

from sqlalchemy.orm import Session

import models
from database import Base, SessionLocal, engine
from models import utcnow
from security import hash_password
from services import attention, game, mastery
from services.curriculum import get_boss
from services.questions import generate_question

DEMO_EMAIL_DOMAIN = "mathverse.demo"

# (boss, days ago, camera used?, answers in order: True = correct)
_DEMO_SESSIONS = [
    ("goblin", 9, True, [True, True, False, True, True, True, False, True, True]),
    ("doc-ock", 6, False, [True, False, True, True, False, True, True, False, True, True]),
    ("mysterio", 2, True, [False, True, False, False, True, False, True, False, True, False, False]),
]


def _demo_user(db: Session, name: str, role: str, link_code=None) -> models.User:
    user = models.User(
        name=name,
        email=f"demo.{role}@{DEMO_EMAIL_DOMAIN}",
        password_hash=hash_password(secrets.token_urlsafe(24)),
        role=role,
        link_code=link_code,
        is_demo=True,
    )
    db.add(user)
    db.flush()
    return user


def _replay_session(db: Session, student: models.User, boss_id: str, days_ago: int,
                    camera: bool, answers: list, rng: random.Random) -> None:
    """Writes one synthetic mission using the same rules as the live game."""
    boss = get_boss(boss_id)
    clock = utcnow() - timedelta(days=days_ago, hours=rng.randint(1, 5))
    session = models.PlaySession(
        student_id=student.id, boss_id=boss_id, topic=boss["topic"], started_at=clock
    )
    db.add(session)
    db.flush()

    tm = db.query(models.TopicMastery).filter_by(student_id=student.id, topic=boss["topic"]).first()
    if tm is None:
        tm = models.TopicMastery(student_id=student.id, topic=boss["topic"], p_mastery=mastery.PRIOR)
        db.add(tm)

    for is_correct in answers:
        q = generate_question(boss_id, mastery.difficulty_for(tm.p_mastery), rng=rng)
        wrong_choices = [i for i in range(4) if i != q.correct_index]
        selected = q.correct_index if is_correct else rng.choice(wrong_choices)
        response_ms = rng.randint(6, 40) * 1000
        points = game.points_for_answer(is_correct, selected, session.streak, response_ms)
        before = tm.p_mastery
        tm.p_mastery = mastery.update_mastery(before, is_correct)
        tm.attempts_count = (tm.attempts_count or 0) + 1

        clock += timedelta(milliseconds=response_ms + 3000)
        attempt = models.Attempt(
            session_id=session.id, student_id=student.id, topic=boss["topic"],
            difficulty=q.difficulty, question_text=q.text, options_json=json.dumps(q.options),
            correct_index=q.correct_index, hint_text=q.hint, selected_index=selected,
            is_correct=is_correct, response_time_ms=response_ms, hint_used=not is_correct and rng.random() < 0.4,
            points_awarded=points, mastery_before=before, mastery_after=tm.p_mastery,
            served_at=clock - timedelta(milliseconds=response_ms), answered_at=clock,
        )
        if camera:  # sessions without the camera keep every attention column NULL
            face = float(rng.randint(85, 100))
            on_screen = float(rng.randint(45, 98))
            attempt.face_present_pct, attempt.on_screen_pct = face, on_screen
            attempt.blink_rate_per_min = float(rng.randint(10, 24))
            attempt.attention_score, attempt.attention_label = attention.score_and_label(face, on_screen)
        db.add(attempt)

        if is_correct:
            session.correct_count += 1
            session.streak += 1
        else:
            session.wrong_count += 1
            session.streak = 0
        session.points_awarded += points

    if session.correct_count >= game.QUESTIONS_TO_WIN:
        session.status = "victory"
        session.points_awarded += game.victory_bonus(session.streak)
    elif session.wrong_count >= game.MAX_WRONG:
        session.status = "defeat"
    else:
        session.status = "abandoned"
    session.ended_at = clock
    student.points += session.points_awarded
    db.flush()
    student.level = game.level_for(db, student.id)


def create_demo_accounts(db: Session) -> bool:
    """Creates the demo student, parent and teacher. Returns False if they already exist."""
    if db.query(models.User).filter_by(is_demo=True).first():
        return False

    student = _demo_user(db, "Peter Parker (Demo)", "student", link_code="SPIDER-DEMO01")
    parent = _demo_user(db, "Aunt May (Demo)", "parent")
    teacher = _demo_user(db, "Prof. Connors (Demo)", "teacher")
    db.add_all([
        models.GuardianLink(guardian_id=parent.id, student_id=student.id),
        models.GuardianLink(guardian_id=teacher.id, student_id=student.id),
    ])

    rng = random.Random(2026)  # fixed seed: the demo data is the same every time
    for boss_id, days_ago, camera, answers in _DEMO_SESSIONS:
        _replay_session(db, student, boss_id, days_ago, camera, answers, rng)
    db.commit()
    return True


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="MathVerse database helper")
    parser.add_argument("--demo", action="store_true", help="create demo accounts with sample data")
    parser.add_argument("--reset", action="store_true", help="delete ALL data and recreate tables")
    args = parser.parse_args()

    if args.reset:
        Base.metadata.drop_all(bind=engine)
        print("All tables dropped.")
    Base.metadata.create_all(bind=engine)

    if args.demo:
        with SessionLocal() as session:
            created = create_demo_accounts(session)
        print("Demo accounts created." if created else "Demo accounts already exist; nothing changed.")
    if not (args.demo or args.reset):
        parser.print_help()
