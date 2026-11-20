"""
Builds a student's report from stored rows.

Rules this module keeps:
- Every number is counted from the database. Where there is no data the value
  is None, 0 or an empty list; nothing is filled in with sample values.
- Learning progress (accuracy, mastery, trends, badges, observations) uses only
  maths answers. The attention estimate is reported in its own section and is
  never combined with, or used to explain, any academic number.
- Questions where attention was not measured are counted as "not measured".
  They are left out of attention averages, never treated as zero.
"""
from collections import defaultdict
from datetime import date, datetime, timedelta
from typing import Dict, List, Optional

from sqlalchemy.orm import Session

import models
import schemas
from models import utcnow
from services.curriculum import BOSSES, boss_for_topic, get_boss
from services.mastery import EASY_BELOW, HARD_ABOVE
from services.mastery_display import display_pct, display_text, mastery_band

RECENT_LIMIT = 10
TREND_DAYS = 14
MIN_ANSWERS_FOR_OBSERVATIONS = 10
MIN_ANSWERS_PER_TOPIC = 5
MIN_ANSWERS_PER_WEEK = 5
QUESTION_MILESTONES = (25, 100, 250)


def _pct(part: int, whole: int) -> Optional[int]:
    return round(100 * part / whole) if whole else None


def answered_attempts(db: Session, student_id: int) -> List[models.Attempt]:
    """A student's answered questions, newest first."""
    return (
        db.query(models.Attempt)
        .filter(models.Attempt.student_id == student_id, models.Attempt.answered_at.isnot(None))
        .order_by(models.Attempt.answered_at.desc(), models.Attempt.id.desc())
        .all()
    )


def _daily(answered: List[models.Attempt], today: date, shift: timedelta) -> List[schemas.DailyPoint]:
    """One entry per day for the last TREND_DAYS days, including days with no practice."""
    by_day: Dict[date, List[models.Attempt]] = defaultdict(list)
    for a in answered:
        by_day[(a.answered_at + shift).date()].append(a)

    points = []
    for offset in range(TREND_DAYS - 1, -1, -1):
        day = today - timedelta(days=offset)
        rows = by_day.get(day, [])
        measured = [a for a in rows if a.on_screen_pct is not None]
        points.append(schemas.DailyPoint(
            date=day,
            questions=len(rows),
            correct=sum(1 for a in rows if a.is_correct),
            accuracy_pct=_pct(sum(1 for a in rows if a.is_correct), len(rows)),
            practice_minutes=round(sum(a.response_time_ms or 0 for a in rows) / 60000, 1),
            attention_measured=len(measured),
            avg_on_screen_pct=(
                round(sum(a.on_screen_pct for a in measured) / len(measured)) if measured else None
            ),
        ))
    return points


def _mastery_history(answered: List[models.Attempt], shift: timedelta) -> List[schemas.TopicHistory]:
    """For each topic that has been played: mastery at the end of each day it was practised."""
    end_of_day: Dict[str, Dict[date, float]] = defaultdict(dict)
    for a in reversed(answered):  # oldest first, so later answers overwrite earlier ones that day
        if a.mastery_after is not None:
            end_of_day[a.topic][(a.answered_at + shift).date()] = a.mastery_after
    return [
        schemas.TopicHistory(
            topic=boss["topic"],
            label=boss["label"],
            points=[
                schemas.MasteryPoint(date=d, mastery_pct=display_pct(p))
                for d, p in sorted(end_of_day[boss["topic"]].items())
            ],
        )
        for boss in BOSSES
        if boss["topic"] in end_of_day
    ]


def _badges(answered_count: int, sessions: List[models.PlaySession]) -> List[schemas.Badge]:
    """Badges are earned from stored missions and answers. None are handed out by default."""
    won = [s for s in sessions if s.status == "victory"]
    badges = []
    for boss in BOSSES:
        if any(s.boss_id == boss["id"] for s in won):
            badges.append(schemas.Badge(
                id=f"defeated-{boss['id']}",
                label=f"{boss['name']} defeated",
                description=f"Won a mission on {boss['label']}.",
            ))
    if any(s.wrong_count == 0 for s in won):
        badges.append(schemas.Badge(
            id="flawless", label="Flawless mission",
            description="Won a mission without a single wrong answer.",
        ))
    for milestone in QUESTION_MILESTONES:
        if answered_count >= milestone:
            badges.append(schemas.Badge(
                id=f"questions-{milestone}", label=f"{milestone} questions answered",
                description=f"Answered {milestone} questions in total.",
            ))
    return badges


def _observations(answered: List[models.Attempt], topics: List[schemas.TopicMasteryOut],
                  raw_mastery: Dict[str, float], daily: List[schemas.DailyPoint]) -> List[str]:
    """
    Short factual statements produced by fixed rules on the numbers above.
    No AI is involved, and attention data is never used here.
    """
    if len(answered) < MIN_ANSWERS_FOR_OBSERVATIONS:
        return []
    notes = []

    this_week, last_week = daily[-7:], daily[-14:-7]
    q_now, q_before = sum(d.questions for d in this_week), sum(d.questions for d in last_week)
    days_practised = sum(1 for d in this_week if d.questions)
    notes.append(f"Practised on {days_practised} of the last 7 days.")
    if q_now >= MIN_ANSWERS_PER_WEEK and q_before >= MIN_ANSWERS_PER_WEEK:
        now = _pct(sum(d.correct for d in this_week), q_now)
        before = _pct(sum(d.correct for d in last_week), q_before)
        if now != before:
            notes.append(
                f"Accuracy over the last 7 days was {now}%, "
                f"{'up' if now > before else 'down'} from {before}% the week before."
            )
        else:
            notes.append(f"Accuracy over the last 7 days was {now}%, the same as the week before.")

    # Which topics are mentioned is decided on the raw stored mastery; only the
    # number printed in the sentence is the display value.
    practised = [t for t in topics if t.topic in raw_mastery and t.questions_answered >= MIN_ANSWERS_PER_TOPIC]
    if practised:
        weakest = min(practised, key=lambda t: raw_mastery[t.topic])
        strongest = max(practised, key=lambda t: raw_mastery[t.topic])
        if raw_mastery[weakest.topic] < EASY_BELOW:
            notes.append(
                f"{weakest.label} needs the most practice "
                f"(estimated mastery {display_text(raw_mastery[weakest.topic])})."
            )
        if raw_mastery[strongest.topic] > HARD_ABOVE:
            notes.append(
                f"{strongest.label} is a strength "
                f"(estimated mastery {display_text(raw_mastery[strongest.topic])})."
            )

    hint_pct = _pct(sum(1 for a in answered if a.hint_used), len(answered))
    if hint_pct >= 50:
        notes.append(f"A hint was used on {hint_pct}% of questions.")
    return notes


def summary_for_list(db: Session, student: models.User) -> schemas.LinkedStudent:
    """The one-line summary shown in a parent's or teacher's list of students."""
    answered = answered_attempts(db, student.id)
    return schemas.LinkedStudent(
        id=student.id, name=student.name, level=student.level, points=student.points,
        is_demo=student.is_demo,
        questions_answered=len(answered),
        accuracy_pct=_pct(sum(1 for a in answered if a.is_correct), len(answered)),
        last_active=answered[0].answered_at if answered else None,
    )


def build_report(db: Session, student: models.User, tz_offset_minutes: int = 0,
                 now: Optional[datetime] = None) -> schemas.StudentReport:
    shift = timedelta(minutes=tz_offset_minutes)  # so "today" means the viewer's day, not UTC's
    today = ((now or utcnow()) + shift).date()

    answered = answered_attempts(db, student.id)
    total = len(answered)
    correct = sum(1 for a in answered if a.is_correct)

    sessions = db.query(models.PlaySession).filter_by(student_id=student.id).all()
    won = [s for s in sessions if s.status == "victory"]

    mastery_rows = {m.topic: m for m in db.query(models.TopicMastery).filter_by(student_id=student.id)}
    correct_by_topic: Dict[str, int] = defaultdict(int)
    for a in answered:
        if a.is_correct:
            correct_by_topic[a.topic] += 1

    topics = []
    raw_mastery: Dict[str, float] = {}  # stored values, used for every decision below
    for boss in BOSSES:
        row = mastery_rows.get(boss["topic"])
        started = row is not None and row.attempts_count > 0
        if started:
            raw_mastery[boss["topic"]] = row.p_mastery
        topics.append(schemas.TopicMasteryOut(
            topic=boss["topic"],
            label=boss["label"],
            mastery_pct=display_pct(row.p_mastery) if started else None,
            mastery_band=mastery_band(row.p_mastery) if started else None,
            questions_answered=row.attempts_count if row else 0,
            correct_answers=correct_by_topic[boss["topic"]],
        ))

    daily = _daily(answered, today, shift)
    measured = [a for a in answered if a.on_screen_pct is not None]

    recent = []
    for a in answered[:RECENT_LIMIT]:
        boss = boss_for_topic(a.topic)
        recent.append(schemas.RecentAttemptOut(
            id=a.id,
            boss_name=boss["name"],
            topic_label=boss["label"],
            difficulty=a.difficulty,
            is_correct=bool(a.is_correct),
            response_time_s=round((a.response_time_ms or 0) / 1000, 1),
            hint_used=a.hint_used,
            points_awarded=a.points_awarded,
            answered_at=a.answered_at,
            attention_label=a.attention_label,
        ))

    return schemas.StudentReport(
        student_id=student.id,
        student_name=student.name,
        is_demo=student.is_demo,
        points=student.points,
        level=student.level,
        last_active=answered[0].answered_at if answered else None,
        questions_answered=total,
        correct_answers=correct,
        accuracy_pct=_pct(correct, total),
        practice_minutes=round(sum(a.response_time_ms or 0 for a in answered) / 60000),
        missions_played=len([s for s in sessions if s.status != "active"]),
        missions_won=len(won),
        bosses_defeated=len({s.boss_id for s in won if get_boss(s.boss_id)}),
        total_bosses=len(BOSSES),
        topic_mastery=topics,
        needs_practice=sorted(
            [t for t in topics if t.topic in raw_mastery and raw_mastery[t.topic] < EASY_BELOW],
            key=lambda t: raw_mastery[t.topic],
        ),
        daily=daily,
        mastery_history=_mastery_history(answered, shift),
        observations=_observations(answered, topics, raw_mastery, daily),
        badges=_badges(total, sessions),
        recent_attempts=recent,
        attention=schemas.AttentionOut(
            measured_questions=len(measured),
            total_questions=total,
            avg_on_screen_pct=(
                round(sum(a.on_screen_pct for a in measured) / len(measured)) if measured else None
            ),
        ),
    )
