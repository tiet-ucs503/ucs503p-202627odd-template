"""
Student report for the student themself or a linked parent/teacher.

Every number here is counted from stored rows. Where there is no data the
field is None or 0; nothing is filled in with sample values.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db
from deps import student_for_viewer
from services.curriculum import BOSSES, boss_for_topic

router = APIRouter(tags=["reports"])

RECENT_LIMIT = 10


@router.get("/students/{student_id}/report", response_model=schemas.StudentReport)
def student_report(
    student: models.User = Depends(student_for_viewer),
    db: Session = Depends(get_db),
):
    answered = (
        db.query(models.Attempt)
        .filter(models.Attempt.student_id == student.id, models.Attempt.answered_at.isnot(None))
        .order_by(models.Attempt.answered_at.desc(), models.Attempt.id.desc())
        .all()
    )
    total = len(answered)
    correct = sum(1 for a in answered if a.is_correct)
    practice_ms = sum(a.response_time_ms or 0 for a in answered)

    sessions = db.query(models.PlaySession).filter_by(student_id=student.id).all()
    won = [s for s in sessions if s.status == "victory"]

    mastery_rows = {
        m.topic: m for m in db.query(models.TopicMastery).filter_by(student_id=student.id)
    }
    topic_mastery = []
    for boss in BOSSES:
        row = mastery_rows.get(boss["topic"])
        started = row is not None and row.attempts_count > 0
        topic_mastery.append(
            schemas.TopicMasteryOut(
                topic=boss["topic"],
                label=boss["label"],
                mastery_pct=round(row.p_mastery * 100) if started else None,
                questions_answered=row.attempts_count if row else 0,
            )
        )

    # Attention: only questions where it was actually measured count. Unmeasured
    # questions are reported as unmeasured, never as zero.
    measured = [a for a in answered if a.on_screen_pct is not None]
    attention = schemas.AttentionOut(
        measured_questions=len(measured),
        total_questions=total,
        avg_on_screen_pct=(
            round(sum(a.on_screen_pct for a in measured) / len(measured)) if measured else None
        ),
    )

    recent = []
    for a in answered[:RECENT_LIMIT]:
        boss = boss_for_topic(a.topic)
        recent.append(
            schemas.RecentAttemptOut(
                id=a.id,
                boss_name=boss["name"],
                topic_label=boss["label"],
                is_correct=bool(a.is_correct),
                response_time_s=round((a.response_time_ms or 0) / 1000, 1),
                hint_used=a.hint_used,
                points_awarded=a.points_awarded,
                answered_at=a.answered_at,
                attention_label=a.attention_label,
            )
        )

    return schemas.StudentReport(
        student_id=student.id,
        student_name=student.name,
        is_demo=student.is_demo,
        points=student.points,
        level=student.level,
        questions_answered=total,
        correct_answers=correct,
        accuracy_pct=round(100 * correct / total) if total else None,
        practice_minutes=round(practice_ms / 60000),
        missions_played=len([s for s in sessions if s.status != "active"]),
        missions_won=len(won),
        bosses_defeated=len({s.boss_id for s in won}),
        total_bosses=len(BOSSES),
        topic_mastery=topic_mastery,
        recent_attempts=recent,
        attention=attention,
    )
