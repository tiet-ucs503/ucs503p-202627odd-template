"""
Server-side form score computation.

    form_score = 100 * sum_i( w_i * p_i )

where `p_i` is the PASS RATE of rule `i` across all reps in the session
(fraction of reps with NO issue of that `issue_type`/rule id logged against
them), and `w_i` are fixed weights summing to 1.0.

DEFAULT_SCORE_WEIGHTS below is the Python mirror of the frontend's
`squat.config.js` `scoreWeights` block (see `shared/exercise-config/types.js`
-> `ExerciseConfig.scoreWeights`, `Record<RuleId, number>` where
`RuleId = "depth" | "knee_valgus" | "torso_lean" | "tempo"`). Python cannot
import the JS config directly, so **these two blocks must be kept in sync by
hand** — if the frontend changes a weight, update the constant below to
match, or server-side score recomputation (and its tolerance check) will
start disagreeing with the client for no code reason.
"""
from dataclasses import dataclass

# Must sum to 1.0; keep in sync with frontend squat.config.js scoreWeights.
DEFAULT_SCORE_WEIGHTS: dict[str, float] = {
    "depth": 0.35,
    "knee_valgus": 0.25,
    "torso_lean": 0.25,
    "tempo": 0.15,
}

# +/- points of slack allowed between the client-submitted form_score and the
# server's independent recomputation before we reject the session as
# untrusted/inconsistent.
SCORE_TOLERANCE = 2.0


@dataclass
class RepLike:
    rep_number: int


@dataclass
class IssueLike:
    rep_number: int
    issue_type: str


def compute_form_score(
    reps: list,
    form_issues: list,
    weights: dict[str, float] | None = None,
) -> float:
    """Recompute the 0-100 form score from rep + issue records.

    `reps` / `form_issues` may be ORM rows, Pydantic models, or any object
    exposing `.rep_number` (and `.issue_type` for issues) — duck-typed so the
    same function works against request payloads and DB rows.
    """
    weights = weights or DEFAULT_SCORE_WEIGHTS
    total_reps = len(reps)

    if total_reps == 0:
        # No reps logged: nothing to score. Treat as a perfect (unpenalized)
        # score rather than an arbitrary failure — validation.py is
        # responsible for deciding whether a zero-rep session is allowed at
        # all.
        return 100.0

    failing_rep_numbers_by_rule: dict[str, set[int]] = {rule: set() for rule in weights}
    for issue in form_issues:
        rule = issue.issue_type if hasattr(issue, "issue_type") else issue["issue_type"]
        rep_number = issue.rep_number if hasattr(issue, "rep_number") else issue["rep_number"]
        if rule in failing_rep_numbers_by_rule:
            failing_rep_numbers_by_rule[rule].add(rep_number)

    score = 0.0
    for rule, weight in weights.items():
        failed = len(failing_rep_numbers_by_rule[rule])
        pass_rate = (total_reps - failed) / total_reps
        score += weight * pass_rate

    return round(score * 100, 4)


def is_within_tolerance(
    client_score: float,
    reps: list,
    form_issues: list,
    weights: dict[str, float] | None = None,
    tolerance: float = SCORE_TOLERANCE,
) -> tuple[bool, float]:
    """Returns (ok, server_computed_score)."""
    server_score = compute_form_score(reps, form_issues, weights)
    return abs(client_score - server_score) <= tolerance, server_score
