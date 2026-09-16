from app.services.form_score import DEFAULT_SCORE_WEIGHTS

RULE_IDS = list(DEFAULT_SCORE_WEIGHTS)


def _single_rep_payload(day: int, failing_rules: list[str], rom_value: float = 100.0, tempo: float = 2.0):
    """One session, one rep, `rep_count`-matching, with `failing_rules` (a
    subset of RULE_IDS) each contributing exactly one FormIssue on rep 1.
    Since there's only 1 rep, each rule's pass-rate is 0 or 1, so the
    server-recomputed score is exactly `100 * sum(weight of passing rules)` —
    computed here the same way form_score.py does, so it's always within
    tolerance."""
    passing_weight = sum(w for rule, w in DEFAULT_SCORE_WEIGHTS.items() if rule not in failing_rules)
    score = round(passing_weight * 100, 4)
    started_at = f"2026-01-{day:02d}T10:00:00Z"
    ended_at = f"2026-01-{day:02d}T10:05:00Z"
    payload = {
        "exercise": "squat",
        "started_at": started_at,
        "ended_at": ended_at,
        "duration_seconds": 300.0,
        "rep_count": 1,
        "form_score": score,
        "reps": [
            {"rep_number": 1, "duration_seconds": 3.0, "rom_value": rom_value, "tempo": tempo, "angle_metrics": {}}
        ],
        "form_issues": [{"rep_number": 1, "issue_type": r, "severity": "high"} for r in failing_rules],
    }
    return payload, score


# Sessions 1..6, in ascending started_at order. Chosen so recent scores are
# clearly higher than earlier ones (verifies "up" direction) and issue types
# have distinct counts (verifies most_common_issues).
SEQUENCE = [
    RULE_IDS,  # s1: fail everything -> score 0
    ["knee_valgus", "torso_lean", "tempo"],  # s2: pass depth only
    ["depth", "torso_lean", "tempo"],  # s3: pass knee_valgus only
    [],  # s4: fail nothing -> 100
    ["tempo"],  # s5: pass depth, knee_valgus, torso_lean
    ["knee_valgus"],  # s6: pass depth, torso_lean, tempo
]


def _seed_sessions(client, headers):
    scores = []
    for day, failing_rules in enumerate(SEQUENCE, start=1):
        payload, score = _single_rep_payload(day, failing_rules)
        resp = client.post("/api/sessions", json=payload, headers=headers)
        assert resp.status_code == 201, resp.text
        scores.append(score)
    return scores


def test_summary_aggregates_and_improvement(client, auth_headers):
    scores = _seed_sessions(client, auth_headers)
    # scores == [0.0, 35.0, 25.0, 100.0, 85.0, 75.0]

    resp = client.get("/api/dashboard/summary", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()

    assert body["total_sessions"] == 6
    assert body["total_reps"] == 6
    assert body["best_form_score"] == max(scores)
    assert body["recent_form_score"] == scores[-1]
    assert round(body["avg_form_score"], 4) == round(sum(scores) / len(scores), 4)
    assert body["avg_rom"] == 100.0
    assert body["avg_tempo"] == 2.0

    window = 3
    recent_mean = sum(scores[-window:]) / window
    previous_mean = sum(scores[-2 * window : -window]) / window
    expected_delta = round(recent_mean - previous_mean, 4)

    assert body["improvement"]["window"] == window
    assert body["improvement"]["delta"] == expected_delta
    assert body["improvement"]["direction"] == "up"  # recent (100,85,75) >> previous (0,35,25)

    issue_counts = {item["issue_type"]: item["count"] for item in body["most_common_issues"]}
    assert issue_counts == {"tempo": 4, "knee_valgus": 3, "torso_lean": 3, "depth": 2}


def test_trends_ordered_and_correct(client, auth_headers):
    scores = _seed_sessions(client, auth_headers)

    resp = client.get("/api/dashboard/trends", params={"metric": "form_score"}, headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["metric"] == "form_score"
    values = [p["value"] for p in body["points"]]
    assert values == scores
    dates = [p["date"] for p in body["points"]]
    assert dates == sorted(dates)

    reps_resp = client.get("/api/dashboard/trends", params={"metric": "reps"}, headers=auth_headers)
    assert [p["value"] for p in reps_resp.json()["points"]] == [1] * 6

    rom_resp = client.get("/api/dashboard/trends", params={"metric": "rom"}, headers=auth_headers)
    assert [p["value"] for p in rom_resp.json()["points"]] == [100.0] * 6

    tempo_resp = client.get("/api/dashboard/trends", params={"metric": "tempo"}, headers=auth_headers)
    assert [p["value"] for p in tempo_resp.json()["points"]] == [2.0] * 6


def test_trends_invalid_metric_rejected(client, auth_headers):
    resp = client.get("/api/dashboard/trends", params={"metric": "bogus"}, headers=auth_headers)
    assert resp.status_code == 400


def test_dashboard_scoped_to_current_user_only(client, register_user):
    token_a, _ = register_user(username="dash_a")
    token_b, _ = register_user(username="dash_b")
    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}

    _seed_sessions(client, headers_a)

    summary_b = client.get("/api/dashboard/summary", headers=headers_b).json()
    assert summary_b["total_sessions"] == 0

    summary_a = client.get("/api/dashboard/summary", headers=headers_a).json()
    assert summary_a["total_sessions"] == 6


def test_empty_state_returns_sane_zeros_not_500(client, auth_headers):
    resp = client.get("/api/dashboard/summary", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["total_sessions"] == 0
    assert body["total_reps"] == 0
    assert body["best_form_score"] is None
    assert body["recent_form_score"] is None
    assert body["avg_form_score"] is None
    assert body["avg_rom"] is None
    assert body["avg_tempo"] is None
    assert body["improvement"] == {"direction": "flat", "delta": 0.0, "window": 0}
    assert body["most_common_issues"] == []

    trends_resp = client.get("/api/dashboard/trends", params={"metric": "form_score"}, headers=auth_headers)
    assert trends_resp.status_code == 200
    assert trends_resp.json()["points"] == []
