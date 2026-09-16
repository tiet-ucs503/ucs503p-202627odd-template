from dataclasses import dataclass

from app.services.form_score import DEFAULT_SCORE_WEIGHTS, compute_form_score, is_within_tolerance


@dataclass
class _Rep:
    rep_number: int


@dataclass
class _Issue:
    rep_number: int
    issue_type: str


def test_default_weights_sum_to_one():
    assert round(sum(DEFAULT_SCORE_WEIGHTS.values()), 6) == 1.0


def test_no_reps_returns_perfect_score():
    assert compute_form_score([], []) == 100.0


def test_all_reps_clean_scores_100():
    reps = [_Rep(1), _Rep(2), _Rep(3)]
    assert compute_form_score(reps, []) == 100.0


def test_hand_computed_score_two_reps_one_issue():
    # 2 reps; rep 1 has a "depth" issue, rep 2 is clean.
    # depth pass-rate = 1/2 = 0.5; all other rules pass-rate = 1.
    # score = 100 * (0.35*0.5 + 0.25*1 + 0.25*1 + 0.15*1) = 100 * 0.825 = 82.5
    reps = [_Rep(1), _Rep(2)]
    issues = [_Issue(rep_number=1, issue_type="depth")]
    assert compute_form_score(reps, issues) == 82.5


def test_hand_computed_score_single_rep_multiple_failing_rules():
    # 1 rep, fails knee_valgus and tempo -> only depth (.35) and torso_lean
    # (.25) pass -> score = 100 * (0.35 + 0.25) = 60.0
    reps = [_Rep(1)]
    issues = [
        _Issue(rep_number=1, issue_type="knee_valgus"),
        _Issue(rep_number=1, issue_type="tempo"),
    ]
    assert compute_form_score(reps, issues) == 60.0


def test_issue_on_unknown_rule_id_is_ignored_not_crashed():
    reps = [_Rep(1)]
    issues = [_Issue(rep_number=1, issue_type="not_a_real_rule")]
    # Unknown rule id contributes to no weight bucket -> still a clean 100.
    assert compute_form_score(reps, issues) == 100.0


def test_duplicate_issues_on_same_rep_same_rule_do_not_double_count():
    # 2 reps, rep 1 has TWO "depth" issues logged (e.g. two frames within the
    # rep) -> should still only mark rep 1 as failing depth once.
    reps = [_Rep(1), _Rep(2)]
    issues = [
        _Issue(rep_number=1, issue_type="depth"),
        _Issue(rep_number=1, issue_type="depth"),
    ]
    assert compute_form_score(reps, issues) == 82.5


def test_dict_shaped_reps_and_issues_also_work():
    reps = [{"rep_number": 1}, {"rep_number": 2}]
    issues = [{"rep_number": 1, "issue_type": "depth"}]
    assert compute_form_score(reps, issues) == 82.5


def test_is_within_tolerance_accepts_close_score():
    reps = [_Rep(1), _Rep(2)]
    issues = [_Issue(rep_number=1, issue_type="depth")]  # true score 82.5
    ok, server_score = is_within_tolerance(81.0, reps, issues)  # within +/-2
    assert ok is True
    assert server_score == 82.5


def test_is_within_tolerance_rejects_far_score():
    reps = [_Rep(1), _Rep(2)]
    issues = [_Issue(rep_number=1, issue_type="depth")]  # true score 82.5
    ok, server_score = is_within_tolerance(50.0, reps, issues)
    assert ok is False
    assert server_score == 82.5


def test_is_within_tolerance_boundary_exact():
    reps = [_Rep(1)]  # clean -> 100.0
    ok_at_boundary, _ = is_within_tolerance(98.0, reps, [])  # exactly -2
    ok_past_boundary, _ = is_within_tolerance(97.99, reps, [])  # just past -2
    assert ok_at_boundary is True
    assert ok_past_boundary is False


def test_app_imports_and_starts_cleanly():
    """Smoke test standing in for `uvicorn app.main:app` — importing the
    app module wires routers/CORS without raising, and the resulting ASGI
    app is usable via TestClient. Deliberately NOT entered as a `with`
    block: that would run the real lifespan (`Base.metadata.create_all`
    against the default file-based engine) and touch backend/data/app.db
    from a test, which every other test in this suite avoids via the
    `client` fixture's dependency override."""
    from fastapi.testclient import TestClient

    from app.main import app

    smoke_client = TestClient(app)
    resp = smoke_client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}
