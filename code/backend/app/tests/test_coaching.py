"""
Tests for AI Coaching service and API router.
"""
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.schemas import CoachingAnalyzeRequest, CoachingBaselineIn, CoachingIssueIn, CoachingMetricsIn
from app.services.coaching import (
    KNOWN_RULE_IDS,
    SAFETY_DISCLAIMER,
    _validate_llm_response,
    analyze_session_coaching,
)


# ---------------------------------------------------------------------------
# Deterministic coaching service tests
# ---------------------------------------------------------------------------

def test_coaching_service_torso_lean_with_baseline():
    req = CoachingAnalyzeRequest(
        exercise="squat",
        form_score=75.0,
        rep_count=6,
        issues=[CoachingIssueIn(type="torso_lean", count=3, severity="medium")],
        metrics=CoachingMetricsIn(average_rom=82.0, average_tempo=3.1),
        personalized_baseline=CoachingBaselineIn(
            knee_bottom_angle=91.0,
            typical_torso_lean=14.0,
            femur_to_torso=1.08,
            confidence=0.93,
        ),
    )

    resp = analyze_session_coaching(req)

    assert resp.primary_issue == "torso_lean"
    assert "14" in resp.explanation or "torso lean" in resp.explanation.lower()
    assert len(resp.recommendations) <= 3
    assert len(resp.recommendations) >= 1
    assert "safety" in resp.safety_note.lower() or "medical" in resp.safety_note.lower()
    assert len(resp.retrieved_guidance) > 0
    assert resp.retrieved_guidance[0].relevance_score > 0.5
    # Fix 1: source metadata
    assert resp.source == "deterministic"
    assert resp.model is None


def test_coaching_service_depth_issue():
    req = CoachingAnalyzeRequest(
        exercise="squat",
        form_score=68.0,
        rep_count=8,
        issues=[CoachingIssueIn(type="depth", count=4, severity="high")],
        metrics=CoachingMetricsIn(average_rom=65.0, average_tempo=2.8),
        personalized_baseline=CoachingBaselineIn(
            knee_bottom_angle=88.0,
            confidence=0.90,
        ),
    )

    resp = analyze_session_coaching(req)

    assert resp.primary_issue == "depth"
    assert "depth" in resp.explanation.lower() or "shallow" in resp.explanation.lower()
    assert len(resp.recommendations) <= 3
    assert any("depth" in r.lower() or "squat" in r.lower() for r in resp.recommendations)
    assert resp.source == "deterministic"


def test_coaching_service_clean_set():
    req = CoachingAnalyzeRequest(
        exercise="squat",
        form_score=98.0,
        rep_count=10,
        issues=[],
        metrics=CoachingMetricsIn(average_rom=95.0, average_tempo=3.0),
    )

    resp = analyze_session_coaching(req)

    assert resp.primary_issue is None
    assert "strong" in resp.summary.lower() or "consistency" in resp.summary.lower()
    assert len(resp.recommendations) <= 3
    assert resp.source == "deterministic"


def test_coaching_service_zero_reps():
    req = CoachingAnalyzeRequest(
        exercise="squat",
        form_score=100.0,
        rep_count=0,
        issues=[],
    )
    resp = analyze_session_coaching(req)
    assert "zero" in resp.summary.lower()
    assert resp.source == "deterministic"


def test_coaching_service_knee_valgus_issue():
    req = CoachingAnalyzeRequest(
        exercise="squat",
        form_score=70.0,
        rep_count=5,
        issues=[CoachingIssueIn(type="knee_valgus", count=3, severity="high")],
    )
    resp = analyze_session_coaching(req)
    assert resp.primary_issue == "knee_valgus"
    assert "valgus" in resp.explanation.lower() or "knee" in resp.explanation.lower()


def test_coaching_service_tempo_issue():
    req = CoachingAnalyzeRequest(
        exercise="squat",
        form_score=80.0,
        rep_count=6,
        issues=[CoachingIssueIn(type="tempo", count=2, severity="medium")],
        metrics=CoachingMetricsIn(average_tempo=1.2),
    )
    resp = analyze_session_coaching(req)
    assert resp.primary_issue == "tempo"
    assert "tempo" in resp.explanation.lower() or "rushed" in resp.explanation.lower()


def test_coaching_service_multi_issue_picks_highest_severity():
    req = CoachingAnalyzeRequest(
        exercise="squat",
        form_score=60.0,
        rep_count=8,
        issues=[
            CoachingIssueIn(type="depth", count=2, severity="low"),
            CoachingIssueIn(type="torso_lean", count=4, severity="high"),
        ],
    )
    resp = analyze_session_coaching(req)
    assert resp.primary_issue == "torso_lean"


def test_coaching_service_missing_api_key_uses_deterministic():
    """Without an API key, coaching always falls back to deterministic."""
    req = CoachingAnalyzeRequest(
        exercise="squat",
        form_score=78.0,
        rep_count=5,
        issues=[CoachingIssueIn(type="torso_lean", count=2, severity="medium")],
    )
    with patch("app.services.coaching.get_settings") as mock_settings:
        mock_settings.return_value.gemini_api_key = ""
        mock_settings.return_value.coaching_model = "gemini-1.5-flash"
        resp = analyze_session_coaching(req)

    assert resp.source == "deterministic"
    assert resp.model is None


def test_coaching_service_llm_fallback_on_api_failure():
    """When LLM call fails, falls back to deterministic."""
    req = CoachingAnalyzeRequest(
        exercise="squat",
        form_score=78.0,
        rep_count=5,
        issues=[CoachingIssueIn(type="torso_lean", count=2, severity="medium")],
    )
    with patch("app.services.coaching.get_settings") as mock_settings, \
         patch("app.services.coaching._call_gemini_llm", return_value=None):
        mock_settings.return_value.gemini_api_key = "test-key"
        mock_settings.return_value.coaching_model = "gemini-1.5-flash"
        resp = analyze_session_coaching(req)

    assert resp.source == "deterministic"


def test_coaching_service_llm_success_returns_llm_source():
    """When LLM returns valid output, source is 'llm' with model name."""
    valid_llm_output = {
        "summary": "Good set with minor torso lean.",
        "primary_issue": "torso_lean",
        "explanation": "Your torso lean was slightly above baseline on 2 reps.",
        "recommendations": ["Practice goblet squats.", "Focus on bracing."],
        "next_session_goal": "Keep torso upright on all reps.",
        "safety_note": SAFETY_DISCLAIMER,
    }
    req = CoachingAnalyzeRequest(
        exercise="squat",
        form_score=78.0,
        rep_count=5,
        issues=[CoachingIssueIn(type="torso_lean", count=2, severity="medium")],
    )
    with patch("app.services.coaching.get_settings") as mock_settings, \
         patch("app.services.coaching._call_gemini_llm", return_value=valid_llm_output):
        mock_settings.return_value.gemini_api_key = "test-key"
        mock_settings.return_value.coaching_model = "gemini-2.0-flash"
        resp = analyze_session_coaching(req)

    assert resp.source == "llm"
    assert resp.model == "gemini-2.0-flash"
    assert resp.primary_issue == "torso_lean"


# ---------------------------------------------------------------------------
# LLM validation tests (Fix 6)
# ---------------------------------------------------------------------------

def test_validate_llm_response_accepts_valid():
    raw = {
        "summary": "Good set.",
        "primary_issue": "depth",
        "explanation": "Depth was consistent.",
        "recommendations": ["Go deeper."],
        "next_session_goal": "Hit parallel on all reps.",
        "safety_note": "Stop if pain.",
    }
    result = _validate_llm_response(raw)
    assert result is not None
    assert result["primary_issue"] == "depth"


def test_validate_llm_response_rejects_unknown_primary_issue():
    raw = {
        "summary": "Set complete.",
        "primary_issue": "invented_issue",
        "explanation": "Something happened.",
        "recommendations": ["Fix it."],
        "next_session_goal": "Do better.",
        "safety_note": "Be safe.",
    }
    assert _validate_llm_response(raw) is None


def test_validate_llm_response_accepts_null_primary_issue():
    raw = {
        "summary": "Clean set.",
        "primary_issue": None,
        "explanation": "All good.",
        "recommendations": ["Keep going."],
        "next_session_goal": "Add weight.",
        "safety_note": "Stop if pain.",
    }
    result = _validate_llm_response(raw)
    assert result is not None
    assert result["primary_issue"] is None


def test_validate_llm_response_clamps_recommendations_to_3():
    raw = {
        "summary": "Set done.",
        "primary_issue": "depth",
        "explanation": "Depth was off.",
        "recommendations": ["A", "B", "C", "D", "E"],
        "next_session_goal": "Improve.",
        "safety_note": "Be safe.",
    }
    result = _validate_llm_response(raw)
    assert result is not None
    assert len(result["recommendations"]) == 3


def test_validate_llm_response_rejects_empty_recommendations():
    raw = {
        "summary": "Set.",
        "primary_issue": "depth",
        "explanation": "Depth issue.",
        "recommendations": [],
        "next_session_goal": "Fix.",
        "safety_note": "Safe.",
    }
    assert _validate_llm_response(raw) is None


def test_validate_llm_response_rejects_non_string_recommendations():
    raw = {
        "summary": "Set.",
        "primary_issue": "depth",
        "explanation": "Depth.",
        "recommendations": [123, None, ""],
        "next_session_goal": "Fix.",
        "safety_note": "Safe.",
    }
    assert _validate_llm_response(raw) is None


def test_validate_llm_response_replaces_empty_safety_note():
    raw = {
        "summary": "Set.",
        "primary_issue": "depth",
        "explanation": "Depth.",
        "recommendations": ["Fix it."],
        "next_session_goal": "Improve.",
        "safety_note": "",
    }
    result = _validate_llm_response(raw)
    assert result is not None
    assert result["safety_note"] == SAFETY_DISCLAIMER


def test_validate_llm_response_rejects_medical_language():
    raw = {
        "summary": "You have a torn ligament.",
        "primary_issue": "depth",
        "explanation": "This is diagnosed as an issue.",
        "recommendations": ["See a doctor."],
        "next_session_goal": "Get surgery.",
        "safety_note": "Be safe.",
    }
    assert _validate_llm_response(raw) is None


def test_validate_llm_response_rejects_empty_summary():
    raw = {
        "summary": "",
        "primary_issue": "depth",
        "explanation": "Depth.",
        "recommendations": ["Fix."],
        "next_session_goal": "Goal.",
        "safety_note": "Safe.",
    }
    assert _validate_llm_response(raw) is None


def test_validate_llm_response_rejects_medical_in_recommendations():
    raw = {
        "summary": "Set done.",
        "primary_issue": "depth",
        "explanation": "Depth was shallow.",
        "recommendations": ["You need surgery to fix this."],
        "next_session_goal": "Improve.",
        "safety_note": "Safe.",
    }
    assert _validate_llm_response(raw) is None


def test_coaching_service_malformed_llm_falls_back():
    """When LLM returns malformed output that fails validation, falls back to deterministic."""
    malformed_output = {
        "summary": "Set.",
        "primary_issue": "unknown_rule_xyz",
        "explanation": "Something.",
        "recommendations": ["Fix it."],
        "next_session_goal": "Goal.",
        "safety_note": "Safe.",
    }
    req = CoachingAnalyzeRequest(
        exercise="squat",
        form_score=78.0,
        rep_count=5,
        issues=[CoachingIssueIn(type="torso_lean", count=2, severity="medium")],
    )
    with patch("app.services.coaching.get_settings") as mock_settings, \
         patch("app.services.coaching._call_gemini_llm", return_value=malformed_output):
        mock_settings.return_value.gemini_api_key = "test-key"
        mock_settings.return_value.coaching_model = "gemini-1.5-flash"
        resp = analyze_session_coaching(req)

    assert resp.source == "deterministic"


# ---------------------------------------------------------------------------
# API endpoint tests
# ---------------------------------------------------------------------------

def test_coaching_api_endpoint(client: TestClient):
    payload = {
        "exercise": "squat",
        "form_score": 78.0,
        "rep_count": 8,
        "issues": [{"type": "torso_lean", "count": 3, "severity": "medium"}],
        "metrics": {"average_rom": 84.0, "average_tempo": 3.2},
        "personalized_baseline": {
            "knee_bottom_angle": 91.0,
            "typical_torso_lean": 14.0,
            "confidence": 0.93,
        },
        "user_goal": "strength",
    }

    res = client.post("/api/coaching/analyze", json=payload)
    assert res.status_code == 200
    data = res.json()

    assert data["primary_issue"] == "torso_lean"
    assert len(data["recommendations"]) <= 3
    assert len(data["retrieved_guidance"]) >= 1
    assert "safety_note" in data
    assert "next_session_goal" in data
    assert data["source"] == "deterministic"
    assert data["model"] is None


def test_coaching_api_with_authenticated_db_baseline(client: TestClient):
    # 1. Register and log in
    reg_res = client.post(
        "/api/auth/register",
        json={"username": "coachtest", "password": "password123", "email": "coach@test.com"},
    )
    assert reg_res.status_code == 201
    token = reg_res.json()["access_token"]
    auth_headers = {"Authorization": f"Bearer {token}"}

    # 2. Save baseline to profile
    calib_res = client.post(
        "/api/calibration",
        headers=auth_headers,
        json={
            "limb_ratios": {"femurToTorso": 1.12, "shinToTorso": 0.95},
            "rom": {"kneeStanding": 172.0, "kneeBottom": 89.0, "typicalTorsoLean": 16.0},
            "angle_stats": {"typical_torso_lean": 16.0},
        },
    )
    assert calib_res.status_code == 200

    # 3. Call coaching WITHOUT explicit baseline
    analyze_payload = {
        "exercise": "squat",
        "form_score": 72.0,
        "rep_count": 5,
        "issues": [{"type": "torso_lean", "count": 2, "severity": "medium"}],
        "metrics": {"average_rom": 80.0, "average_tempo": 3.0},
    }

    res = client.post("/api/coaching/analyze", headers=auth_headers, json=analyze_payload)
    assert res.status_code == 200
    data = res.json()

    # Verified that the calibrated baseline of 16° was incorporated
    assert "16" in data["explanation"] or "16" in data["next_session_goal"] or "calibrated" in data["explanation"]
    assert data["source"] == "deterministic"
