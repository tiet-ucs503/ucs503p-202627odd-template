"""
Gameplay. The server generates each question, keeps the answer, judges the
response and awards points. The client only reports which option was picked.
"""
import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db
from deps import require_student
from models import utcnow
from services import attention, game, hints, mastery
from services.curriculum import get_boss, unlocked_bosses
from services.questions import generate_question

router = APIRouter(tags=["gameplay"])


def _session_state(s: models.PlaySession) -> schemas.SessionState:
    return schemas.SessionState(
        id=s.id,
        boss_id=s.boss_id,
        status=s.status,
        correct_count=s.correct_count,
        wrong_count=s.wrong_count,
        streak=s.streak,
        questions_to_win=game.QUESTIONS_TO_WIN,
        max_wrong=game.MAX_WRONG,
        points_awarded=s.points_awarded,
    )


def _question_out(a: models.Attempt) -> schemas.QuestionOut:
    return schemas.QuestionOut(
        attempt_id=a.id,
        text=a.question_text,
        options=json.loads(a.options_json),
        topic=a.topic,
        difficulty=a.difficulty,
    )


def _get_mastery(db: Session, student_id: int, topic: str) -> models.TopicMastery:
    row = db.query(models.TopicMastery).filter_by(student_id=student_id, topic=topic).first()
    if row is None:
        row = models.TopicMastery(
            student_id=student_id, topic=topic, p_mastery=mastery.PRIOR, attempts_count=0
        )
        db.add(row)
        db.flush()
    return row


def _serve_question(db: Session, session: models.PlaySession) -> models.Attempt:
    """Generates the next question for a session and stores it, answer included."""
    p = _get_mastery(db, session.student_id, session.topic).p_mastery
    q = generate_question(session.boss_id, mastery.difficulty_for(p))
    attempt = models.Attempt(
        session_id=session.id,
        student_id=session.student_id,
        topic=session.topic,
        difficulty=q.difficulty,
        question_text=q.text,
        options_json=json.dumps(q.options),
        correct_index=q.correct_index,
        hint_text=q.hint,
    )
    db.add(attempt)
    db.flush()
    return attempt


def _own_attempt(db: Session, attempt_id: int, student: models.User) -> models.Attempt:
    attempt = db.get(models.Attempt, attempt_id)
    # 404 (not 403) for someone else's attempt, so ids cannot be probed.
    if attempt is None or attempt.student_id != student.id:
        raise HTTPException(status_code=404, detail="Question not found.")
    return attempt


@router.get("/students/me/progress", response_model=schemas.ProgressOut)
def my_progress(student: models.User = Depends(require_student), db: Session = Depends(get_db)):
    return game.progress_for(db, student)


@router.post("/sessions", response_model=schemas.StartSessionResponse, status_code=201)
def start_session(
    payload: schemas.StartSessionRequest,
    student: models.User = Depends(require_student),
    db: Session = Depends(get_db),
):
    boss = get_boss(payload.boss_id)
    if boss is None:
        raise HTTPException(status_code=404, detail="Unknown mission.")
    if boss["id"] not in unlocked_bosses(student.level):
        raise HTTPException(status_code=403, detail="Defeat the previous bosses to unlock this mission.")

    # Only one mission at a time: anything left open is closed as abandoned.
    for stale in db.query(models.PlaySession).filter_by(student_id=student.id, status="active"):
        stale.status = "abandoned"
        stale.ended_at = utcnow()

    session = models.PlaySession(student_id=student.id, boss_id=boss["id"], topic=boss["topic"])
    db.add(session)
    db.flush()
    attempt = _serve_question(db, session)
    db.commit()
    return schemas.StartSessionResponse(
        session=_session_state(session), question=_question_out(attempt)
    )


@router.get("/attempts/{attempt_id}/hint", response_model=schemas.HintOut)
def get_hint(
    attempt_id: int,
    student: models.User = Depends(require_student),
    db: Session = Depends(get_db),
):
    attempt = _own_attempt(db, attempt_id, student)
    if attempt.answered_at is None:
        attempt.hint_used = True
        db.commit()
    return schemas.HintOut(hint=hints.hint_for(attempt.question_text, attempt.topic, attempt.hint_text))


@router.post("/attempts/{attempt_id}/answer", response_model=schemas.AnswerResponse)
def answer(
    attempt_id: int,
    payload: schemas.AnswerRequest,
    student: models.User = Depends(require_student),
    db: Session = Depends(get_db),
):
    attempt = _own_attempt(db, attempt_id, student)
    session = attempt.session
    if attempt.answered_at is not None:
        raise HTTPException(status_code=409, detail="This question has already been answered.")
    if session.status != "active":
        raise HTTPException(status_code=409, detail="This mission is no longer active.")

    # ── Academic track: depends only on whether the maths was right ──────────
    is_correct = payload.selected_index is not None and payload.selected_index == attempt.correct_index
    topic_mastery = _get_mastery(db, student.id, attempt.topic)
    mastery_before = topic_mastery.p_mastery
    mastery_after = mastery.update_mastery(mastery_before, is_correct)
    topic_mastery.p_mastery = mastery_after
    topic_mastery.attempts_count += 1

    points = game.points_for_answer(
        is_correct, payload.selected_index, session.streak, payload.response_time_ms
    )

    attempt.selected_index = payload.selected_index
    attempt.is_correct = is_correct
    attempt.response_time_ms = payload.response_time_ms
    attempt.hint_used = attempt.hint_used or payload.hint_used
    attempt.points_awarded = points
    attempt.mastery_before = mastery_before
    attempt.mastery_after = mastery_after
    attempt.answered_at = utcnow()

    # ── Attention track: stored as received (or left NULL), read by nothing here ──
    attention.apply_to_attempt(attempt, payload.attention)

    if is_correct:
        session.correct_count += 1
        session.streak += 1
    else:
        session.wrong_count += 1
        session.streak = 0

    bonus = 0
    if session.correct_count >= game.QUESTIONS_TO_WIN:
        session.status = "victory"
        bonus = game.victory_bonus(session.streak)
    elif session.wrong_count >= game.MAX_WRONG:
        session.status = "defeat"
    if session.status != "active":
        session.ended_at = utcnow()

    session.points_awarded += points + bonus
    student.points += points + bonus
    db.flush()
    if session.status == "victory":
        student.level = max(student.level, game.level_for(db, student.id))

    next_attempt = _serve_question(db, session) if session.status == "active" else None
    db.commit()

    return schemas.AnswerResponse(
        correct=is_correct,
        correct_index=attempt.correct_index,
        points_awarded=points,
        bonus_points=bonus,
        mastery=mastery_after,
        session_status=session.status,
        session=_session_state(session),
        progress=game.progress_for(db, student),
        next_question=_question_out(next_attempt) if next_attempt else None,
    )
