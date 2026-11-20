"""
How mastery is SHOWN to people. Presentation only.

The mastery model (services/mastery.py) stores a probability between 0.01 and
0.99. Shown raw, "1%" or "99%" reads like certainty to a parent or teacher,
which the model cannot honestly claim after a handful of questions.

So for display:
  - the BAND comes first, in words: needs practice / developing / strong;
  - the percentage is limited to 5-95 and described as an estimate. A value
    at a limit is worded "5% or less" or "95% or more", so it is clearly a
    limit and not a measurement.

What this module never does:
  - it never changes a stored value (p_mastery, mastery_before, mastery_after);
  - it is never used to make a decision. Question difficulty, the "needs
    practice" list and which observations appear all use the raw stored value.

Reports also show the plain record ("4 of 11 correct") beside the estimate, so
the estimate is never the only thing a reader has to go on.
"""
from services.mastery import EASY_BELOW, HARD_ABOVE

DISPLAY_MIN_PCT = 5
DISPLAY_MAX_PCT = 95

NEEDS_PRACTICE = "needs_practice"
DEVELOPING = "developing"
STRONG = "strong"


def mastery_band(p_mastery: float) -> str:
    """The level in words. Uses the same thresholds that pick question difficulty."""
    if p_mastery < EASY_BELOW:
        return NEEDS_PRACTICE
    if p_mastery > HARD_ABOVE:
        return STRONG
    return DEVELOPING


def display_pct(p_mastery: float) -> int:
    """The percentage to show: the raw value rounded, then kept within 5-95."""
    return max(DISPLAY_MIN_PCT, min(DISPLAY_MAX_PCT, round(p_mastery * 100)))


def display_text(p_mastery: float) -> str:
    """The percentage as words, making the limits explicit."""
    pct = display_pct(p_mastery)
    if pct <= DISPLAY_MIN_PCT:
        return f"{DISPLAY_MIN_PCT}% or less"
    if pct >= DISPLAY_MAX_PCT:
        return f"{DISPLAY_MAX_PCT}% or more"
    return f"{pct}%"
