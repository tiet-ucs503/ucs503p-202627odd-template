"""
AI Coaching Service.

Combines structured session metrics, personalized calibration baselines, and
retrieved authoritative biomechanics guidance into schema-validated coaching advice.
Supports LLM generation when configured with seamless deterministic fallback.
"""
from __future__ import annotations

import json
import logging
import os
import re
from typing import Any

import httpx

from app.config import get_settings
from app.knowledge.retriever import BiomechanicsKnowledgeRetriever, get_retriever
from app.schemas import (
    CoachingAnalyzeRequest,
    CoachingAnalyzeResponse,
    RetrievedGuidanceItem,
)

logger = logging.getLogger("coaching")

SAFETY_DISCLAIMER = (
    "Stop and seek qualified medical or physical therapy advice if movement causes pain. "
    "Form analysis is an educational feedback tool, not medical advice."
)

# Only these rule IDs are valid for primary_issue.
KNOWN_RULE_IDS = {"depth", "torso_lean", "knee_valgus", "tempo"}

# Patterns that indicate unsafe medical claims an LLM should never make.
_UNSAFE_PATTERNS = re.compile(
    r"\b(diagnos|guarantee|cure[sd]?|torn ligament|fracture|surgery)\b",
    re.IGNORECASE,
)


def _format_deterministic_coaching(
    request: CoachingAnalyzeRequest,
    retrieved_items: list[RetrievedGuidanceItem],
    passages_raw: list[Any],
) -> CoachingAnalyzeResponse:
    """
    Generates deterministic, grounded coaching advice matching schema exactly.
    Guarantees conservative coaching, zero hallucinated metrics, and max 3 recommendations.
    """
    issues = request.issues
    form_score = round(request.form_score, 1)
    rep_count = request.rep_count

    avg_tempo = request.metrics.average_tempo
    typical_lean = request.personalized_baseline.typical_torso_lean if request.personalized_baseline else None
    knee_bottom = request.personalized_baseline.knee_bottom_angle if request.personalized_baseline else None
    femur_torso = request.personalized_baseline.femur_to_torso if request.personalized_baseline else None

    # Determine primary issue
    primary_issue: str | None = None
    if issues:
        severity_rank = {"high": 3, "medium": 2, "low": 1}
        sorted_issues = sorted(
            issues,
            key=lambda x: (severity_rank.get(x.severity.lower(), 1), x.count),
            reverse=True,
        )
        primary_issue = sorted_issues[0].type

    # Build Summary
    if not primary_issue or form_score >= 90:
        if rep_count > 0:
            summary = (
                f"Your squat set of {rep_count} reps demonstrated strong technical consistency, "
                f"achieving a {form_score}% form score."
            )
        else:
            summary = "Session recorded with zero active repetitions."
    else:
        issue_label = primary_issue.replace("_", " ")
        summary = (
            f"Your squat set completed {rep_count} reps with a {form_score}% form score, "
            f"primarily affected by {issue_label}."
        )

    # Build Explanation
    explanation_parts: list[str] = []
    if primary_issue == "torso_lean":
        issue_obj = next((i for i in issues if i.type == "torso_lean"), None)
        count_str = f"on {issue_obj.count} reps" if issue_obj else "during the set"
        if typical_lean is not None:
            explanation_parts.append(
                f"Your torso lean noticeably exceeded your calibrated baseline of {typical_lean}° {count_str}."
            )
        else:
            explanation_parts.append(f"Excessive forward torso lean was detected {count_str}.")

        if femur_torso and femur_torso > 1.05:
            explanation_parts.append(
                f"Given your longer femur proportion (ratio: {femur_torso}), your body naturally hinges forward; "
                f"maintain strong 360° core bracing to prevent thoracic collapse."
            )
        else:
            explanation_parts.append(
                "This typically happens when hip drive outpaces knee extension, shifting load onto the lumbar spine."
            )

    elif primary_issue == "depth":
        issue_obj = next((i for i in issues if i.type == "depth"), None)
        count_str = f"on {issue_obj.count} reps" if issue_obj else "during the set"
        if knee_bottom is not None:
            explanation_parts.append(
                f"Squat depth was shallow {count_str}, reversing before reaching your calibrated depth angle of {knee_bottom}°."
            )
        else:
            explanation_parts.append(
                f"Squat depth did not consistently reach parallel {count_str}."
            )
        explanation_parts.append(
            "Achieving depth with controlled hip descent ensures full quad and glute engagement."
        )

    elif primary_issue == "knee_valgus":
        issue_obj = next((i for i in issues if i.type == "knee_valgus"), None)
        count_str = f"on {issue_obj.count} reps" if issue_obj else "during the set"
        explanation_parts.append(
            f"Inward knee cave (dynamic valgus) occurred {count_str} during the ascent phase."
        )
        explanation_parts.append(
            "This suggests underactive glute medius stabilizers or foot arch collapse under load."
        )

    elif primary_issue == "tempo":
        explanation_parts.append(
            f"Descent tempo was rushed{' (avg: ' + str(round(avg_tempo, 1)) + 's)' if avg_tempo else ''}, "
            "sacrificing muscular control for passive bounce."
        )
    else:
        explanation_parts.append(
            "Every repetition satisfied biomechanical rules with steady depth, stable knee tracking, and an upright torso."
        )

    explanation = " ".join(explanation_parts)

    # Build Recommendations (Max 3)
    recommendations: list[str] = []
    for p in passages_raw:
        for rec in p.recommendations:
            if rec not in recommendations and len(recommendations) < 3:
                recommendations.append(rec)

    if len(recommendations) < 1:
        if primary_issue == "torso_lean":
            recommendations = [
                "Practice paused goblet squats with a lighter load to reinforce thoracic extension.",
                "Cue 'driving traps into the bar' on the ascent to keep your chest elevated.",
            ]
        elif primary_issue == "depth":
            recommendations = [
                "Incorporate box squats set to your parallel depth threshold to build positional awareness.",
                "Perform banded ankle dorsiflexion rocks before loading the squat.",
            ]
        elif primary_issue == "knee_valgus":
            recommendations = [
                "Warm up with mini-band squats to prime glute medius hip external rotation.",
                "Actively screw your feet into the floor to maintain strong knee tracking over toes.",
            ]
        else:
            recommendations = [
                "Maintain your current technical consistency while progressively adding volume.",
                "Keep a steady 3-second controlled descent on all warmup and working sets.",
            ]

    recommendations = recommendations[:3]

    # Next Session Goal
    if primary_issue == "torso_lean":
        if typical_lean is not None:
            next_session_goal = f"Keep torso lean within 3° of your calibrated {typical_lean}° baseline across all reps."
        else:
            next_session_goal = "Maintain an upright chest and firm brace through the entire bottom turnaround."
    elif primary_issue == "depth":
        if knee_bottom is not None:
            next_session_goal = f"Reach your calibrated {knee_bottom}° inflection target on every working rep."
        else:
            next_session_goal = "Ensure hip crease reaches the knee level on each repetition before initiating ascent."
    elif primary_issue == "knee_valgus":
        next_session_goal = "Keep knees tracking directly in line with your second toe from bottom to top."
    elif primary_issue == "tempo":
        next_session_goal = "Control each descent to a full 3-second count before driving up explosively."
    else:
        next_session_goal = "Maintain today's technical precision while increasing set volume by 1 rep."

    return CoachingAnalyzeResponse(
        summary=summary,
        primary_issue=primary_issue,
        explanation=explanation,
        recommendations=recommendations,
        next_session_goal=next_session_goal,
        safety_note=SAFETY_DISCLAIMER,
        retrieved_guidance=retrieved_items,
        source="deterministic",
        model=None,
    )


def _call_gemini_llm(
    prompt: str,
    api_key: str,
    model: str = "gemini-1.5-flash",
) -> dict[str, Any] | None:
    """Calls Gemini REST API with structured JSON output schema."""
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
    headers = {"Content-Type": "application/json"}
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "responseMimeType": "application/json",
            "temperature": 0.2,
        },
    }

    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.post(url, headers=headers, json=payload)
            if resp.status_code != 200:
                logger.warning("Gemini API error %d: %s", resp.status_code, resp.text)
                return None
            data = resp.json()
            candidates = data.get("candidates", [])
            if not candidates:
                return None
            text = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "")
            return json.loads(text)
    except Exception as exc:
        logger.warning("LLM request failed, falling back to deterministic: %s", exc)
        return None


def _validate_llm_response(raw: dict[str, Any]) -> dict[str, Any] | None:
    """Validates LLM output as untrusted input. Returns cleaned dict or None on failure."""
    # primary_issue must be a known rule ID or null
    pi = raw.get("primary_issue")
    if pi is not None and pi not in KNOWN_RULE_IDS:
        logger.warning("LLM returned unknown primary_issue '%s', rejecting", pi)
        return None

    # Recommendations must be 1–3 non-empty strings
    recs = raw.get("recommendations")
    if not isinstance(recs, list) or len(recs) < 1:
        logger.warning("LLM returned invalid recommendations, rejecting")
        return None
    cleaned_recs = [r for r in recs if isinstance(r, str) and r.strip()]
    if len(cleaned_recs) < 1:
        logger.warning("LLM returned empty recommendations, rejecting")
        return None
    cleaned_recs = cleaned_recs[:3]

    # Safety note must be present
    safety = raw.get("safety_note")
    if not isinstance(safety, str) or not safety.strip():
        safety = SAFETY_DISCLAIMER

    # Reject medical diagnoses and guarantees in any text field
    for field in ("summary", "explanation", "next_session_goal"):
        val = raw.get(field, "")
        if isinstance(val, str) and _UNSAFE_PATTERNS.search(val):
            logger.warning("LLM response contains unsafe medical language in '%s', rejecting", field)
            return None
    for rec in cleaned_recs:
        if _UNSAFE_PATTERNS.search(rec):
            logger.warning("LLM recommendation contains unsafe medical language, rejecting")
            return None

    # summary and explanation must be non-empty strings
    summary = raw.get("summary")
    explanation = raw.get("explanation")
    next_goal = raw.get("next_session_goal")
    if not isinstance(summary, str) or not summary.strip():
        return None
    if not isinstance(explanation, str) or not explanation.strip():
        return None
    if not isinstance(next_goal, str) or not next_goal.strip():
        return None

    return {
        "summary": summary,
        "primary_issue": pi,
        "explanation": explanation,
        "recommendations": cleaned_recs,
        "next_session_goal": next_goal,
        "safety_note": safety,
    }


def analyze_session_coaching(
    request: CoachingAnalyzeRequest,
    retriever: BiomechanicsKnowledgeRetriever | None = None,
) -> CoachingAnalyzeResponse:
    """
    Main entrypoint: retrieves guidance and synthesizes schema-validated coaching advice.
    """
    if retriever is None:
        retriever = get_retriever()

    # Step 1: Retrieve approved guidance passages
    issue_dicts = [i.model_dump() for i in request.issues]
    metrics_dict = request.metrics.model_dump()
    passages = retriever.retrieve(
        exercise=request.exercise,
        issues=issue_dicts,
        metrics=metrics_dict,
        user_goal=request.user_goal,
        top_k=3,
    )

    retrieved_items = [
        RetrievedGuidanceItem(
            source_id=p.source_id,
            title=p.title,
            relevance_score=p.relevance_score,
            passage=p.passage,
        )
        for p in passages
    ]

    # Step 2: Check for configured LLM
    settings = get_settings()
    api_key = settings.gemini_api_key or os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")

    if api_key:
        guidance_text = "\n\n".join(
            f"[{p.source_id}] {p.title}:\n{p.passage}" for p in retrieved_items
        )
        baseline_data = request.personalized_baseline.model_dump() if request.personalized_baseline else None
        prompt = f"""
You are an expert weightlifting biomechanics coach. You are evaluating structured workout metrics and personalized calibration baselines for a lifter.

RULES:
1. Explain measured results strictly grounded in the approved guidance below.
2. DO NOT diagnose any injury. Conservative coaching only.
3. DO NOT invent metrics or unsupported citations.
4. Provide AT MOST 3 actionable recommendations.
5. Emphasize safety and conservative progression.

RETRIEVED APPROVED GUIDANCE:
{guidance_text}

SESSION SUMMARY DATA:
- Exercise: {request.exercise}
- Form Score: {request.form_score} / 100
- Rep Count: {request.rep_count}
- Issues Detected: {issue_dicts}
- Metrics: {metrics_dict}
- Personalized Baseline: {baseline_data}
- Goal: {request.user_goal or "General squat mastery"}

Return a JSON object conforming precisely to:
{{
  "summary": "Concise 1-sentence summary of the set",
  "primary_issue": "primary issue name or null if clean",
  "explanation": "2-3 sentences explaining the biomechanics and relating to the user's baseline",
  "recommendations": ["Recommendation 1", "Recommendation 2", "Recommendation 3"],
  "next_session_goal": "Clear, measurable target for the next workout",
  "safety_note": "{SAFETY_DISCLAIMER}"
}}
"""
        llm_result = _call_gemini_llm(prompt, api_key, settings.coaching_model)
        if llm_result:
            validated = _validate_llm_response(llm_result)
            if validated:
                try:
                    return CoachingAnalyzeResponse(
                        **validated,
                        retrieved_guidance=retrieved_items,
                        source="llm",
                        model=settings.coaching_model,
                    )
                except Exception as exc:
                    logger.warning("LLM response schema validation failed: %s, falling back", exc)
            else:
                logger.warning("LLM response failed validation checks, falling back to deterministic")

    # Step 3: Fallback to deterministic grounded generator
    return _format_deterministic_coaching(request, retrieved_items, passages)
