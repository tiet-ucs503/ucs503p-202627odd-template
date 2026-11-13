"""
Academic mastery, one number between 0 and 1 per student per topic.

The only input is whether maths answers were right or wrong. There is no
attention, camera, response-time or hint parameter anywhere in this module, on
purpose: a student without a camera gets exactly the same result.

Phase A uses a simple step rule. Phase C replaces the body of `update_mastery`
with Bayesian Knowledge Tracing; the function signatures stay the same.
"""

PRIOR = 0.30
_STEP_UP = 0.08
_STEP_DOWN = 0.04
_MIN, _MAX = 0.01, 0.99


def update_mastery(p_mastery: float, is_correct: bool) -> float:
    """Returns the new mastery after one answer. Correct raises it, incorrect lowers it."""
    change = _STEP_UP if is_correct else -_STEP_DOWN
    return round(min(_MAX, max(_MIN, p_mastery + change)), 4)


def difficulty_for(p_mastery: float) -> str:
    """Which question tier to serve next for this topic. One tier until Phase C."""
    return "medium"
