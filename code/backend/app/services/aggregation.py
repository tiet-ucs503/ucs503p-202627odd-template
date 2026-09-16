"""
Dashboard summary/trends/improvement math.

Every function here takes a plain list of `Session` ORM rows (already
filtered `WHERE user_id = current_user.id` by the caller — see
app/routers/dashboard.py) and returns a JSON-serializable dict/list. No
session in `sessions` is trusted to belong to the current user by this
module; that invariant is the router's job.
"""
from collections import Counter
from statistics import mean

from app.models import Session

# Default improvement window: compare the mean of the most recent N sessions
# against the mean of the N sessions immediately before them. Shrinks
# automatically for users with few sessions (see `_improvement_window`).
DEFAULT_IMPROVEMENT_WINDOW = 3

# A |delta| smaller than this is reported as "flat" rather than up/down, to
# avoid noise on near-identical scores.
FLAT_EPSILON = 0.5

MOST_COMMON_ISSUES_LIMIT = 5


def _sorted_by_started_at(sessions: list[Session]) -> list[Session]:
    return sorted(sessions, key=lambda s: s.started_at)


def _improvement_window(n_sessions: int) -> int:
    return min(DEFAULT_IMPROVEMENT_WINDOW, n_sessions // 2)


def compute_improvement(sessions: list[Session]) -> dict:
    ordered = _sorted_by_started_at(sessions)
    window = _improvement_window(len(ordered))

    if window == 0:
        return {"direction": "flat", "delta": 0.0, "window": window}

    recent = ordered[-window:]
    previous = ordered[-2 * window : -window]

    recent_mean = mean(s.form_score for s in recent)
    previous_mean = mean(s.form_score for s in previous)
    delta = round(recent_mean - previous_mean, 4)

    if delta > FLAT_EPSILON:
        direction = "up"
    elif delta < -FLAT_EPSILON:
        direction = "down"
    else:
        direction = "flat"

    return {"direction": direction, "delta": delta, "window": window}


def compute_most_common_issues(sessions: list[Session], limit: int = MOST_COMMON_ISSUES_LIMIT) -> list[dict]:
    counter = Counter()
    for session in sessions:
        for issue in session.form_issues:
            counter[issue.issue_type] += 1
    return [{"issue_type": issue_type, "count": count} for issue_type, count in counter.most_common(limit)]


def compute_summary(sessions: list[Session]) -> dict:
    if not sessions:
        return {
            "total_sessions": 0,
            "total_reps": 0,
            "best_form_score": None,
            "recent_form_score": None,
            "avg_form_score": None,
            "avg_rom": None,
            "avg_tempo": None,
            "improvement": {"direction": "flat", "delta": 0.0, "window": 0},
            "most_common_issues": [],
        }

    ordered = _sorted_by_started_at(sessions)
    all_reps = [rep for s in sessions for rep in s.reps]

    return {
        "total_sessions": len(sessions),
        "total_reps": sum(s.rep_count for s in sessions),
        "best_form_score": max(s.form_score for s in sessions),
        "recent_form_score": ordered[-1].form_score,
        "avg_form_score": round(mean(s.form_score for s in sessions), 4),
        "avg_rom": round(mean(r.rom_value for r in all_reps), 4) if all_reps else None,
        "avg_tempo": round(mean(r.tempo for r in all_reps), 4) if all_reps else None,
        "improvement": compute_improvement(sessions),
        "most_common_issues": compute_most_common_issues(sessions),
    }


def compute_trend_points(sessions: list[Session], metric: str) -> list[dict]:
    ordered = _sorted_by_started_at(sessions)
    points = []
    for s in ordered:
        if metric == "form_score":
            value = s.form_score
        elif metric == "reps":
            value = s.rep_count
        elif metric == "rom":
            value = round(mean(r.rom_value for r in s.reps), 4) if s.reps else None
        elif metric == "tempo":
            value = round(mean(r.tempo for r in s.reps), 4) if s.reps else None
        else:
            raise ValueError(f"Unknown metric: {metric}")

        if value is not None:
            points.append({"date": s.started_at, "value": value})

    return points
