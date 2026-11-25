"""
Turns the browser's attention summary into the values stored beside an attempt.

This is an estimate of whether the student was facing the screen. It is not a
medical assessment, and nothing academic (mastery, difficulty, points, unlocks)
ever reads it.
"""
from typing import Optional, Tuple


def score_and_label(face_present_pct: float, on_screen_pct: float) -> Tuple[float, str]:
    score = round(on_screen_pct / 100.0, 3)
    if face_present_pct < 50:
        label = "Away"
    elif on_screen_pct >= 80:
        label = "Focused"
    elif on_screen_pct >= 50:
        label = "Partly focused"
    else:
        label = "Distracted"
    return score, label


def apply_to_attempt(attempt, summary: Optional[object]) -> None:
    """Copies a summary onto an Attempt row. With no summary, every column stays NULL."""
    if summary is None:
        return
    attempt.face_present_pct = summary.face_present_pct
    attempt.on_screen_pct = summary.on_screen_pct
    attempt.blink_rate_per_min = summary.blink_rate_per_min
    attempt.attention_score, attempt.attention_label = score_and_label(
        summary.face_present_pct, summary.on_screen_pct
    )
