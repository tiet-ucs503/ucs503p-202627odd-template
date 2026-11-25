"""Game rules that the server owns: scoring, winning, losing, levelling up."""
from typing import Optional

from sqlalchemy.orm import Session

import models
from services.curriculum import BOSS_IDS, unlocked_bosses

QUESTIONS_TO_WIN = 7   # correct answers needed to defeat a boss
MAX_WRONG = 7          # wrong answers (or time-outs) before the mission fails

_BASE_POINTS = 50
_STREAK_BONUS = 15
_SPEED_BONUS = 20
_SPEED_LIMIT_MS = 15_000
_EFFORT_POINTS = 5     # for an attempted-but-wrong answer; a time-out earns nothing


def points_for_answer(is_correct: bool, selected_index: Optional[int],
                      streak_before: int, response_time_ms: int) -> int:
    if is_correct:
        speed = _SPEED_BONUS if response_time_ms <= _SPEED_LIMIT_MS else 0
        return _BASE_POINTS + _STREAK_BONUS * streak_before + speed
    return _EFFORT_POINTS if selected_index is not None else 0


def victory_bonus(streak: int) -> int:
    return 300 + 50 * streak


def missions_won(db: Session, student_id: int) -> int:
    return (
        db.query(models.PlaySession)
        .filter_by(student_id=student_id, status="victory")
        .count()
    )


def level_for(db: Session, student_id: int) -> int:
    """Level = 1 + number of different bosses defeated (capped at the boss count)."""
    defeated = (
        db.query(models.PlaySession.boss_id)
        .filter_by(student_id=student_id, status="victory")
        .distinct()
        .count()
    )
    return min(len(BOSS_IDS), 1 + defeated)


def progress_for(db: Session, student: models.User) -> dict:
    return {
        "points": student.points,
        "level": student.level,
        "unlocked_bosses": unlocked_bosses(student.level),
        "missions_won": missions_won(db, student.id),
        "link_code": student.link_code,
    }
