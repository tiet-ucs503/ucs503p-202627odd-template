"""
Cross-field session-payload validation that Pydantic's per-field constraints
can't express alone (Pydantic already enforces presence of required fields
and single-field numeric ranges like `form_score in [0,100]` via
`Field(ge=..., le=...)` in app/schemas.py — this module adds the checks that
span multiple fields).

Raises `fastapi.HTTPException(422, detail=<descriptive message>)` on the
first failure found.
"""
from fastapi import HTTPException, status

from app.schemas import SessionCreateRequest
from app.services.form_score import is_within_tolerance


def validate_session_payload(payload: SessionCreateRequest) -> float:
    """Validates `payload`; returns the server-recomputed form_score on
    success (callers should persist this value, not the client's raw one,
    since it's already been proven to agree within tolerance)."""

    if payload.rep_count != len(payload.reps):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                f"rep_count ({payload.rep_count}) does not match the number "
                f"of reps provided ({len(payload.reps)})"
            ),
        )

    if payload.started_at >= payload.ended_at:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="started_at must be earlier than ended_at",
        )

    measured_duration = (payload.ended_at - payload.started_at).total_seconds()
    if abs(payload.duration_seconds - measured_duration) > 2.0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="duration_seconds does not match the session timestamps",
        )

    for rep in payload.reps:
        if rep.rep_number < 1:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"rep_number must be >= 1 (got {rep.rep_number})",
            )

    rep_numbers = [rep.rep_number for rep in payload.reps]
    if rep_numbers != list(range(1, payload.rep_count + 1)):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="rep_number values must be unique and sequential starting at 1",
        )

    rep_number_set = set(rep_numbers)
    for issue in payload.form_issues:
        if issue.rep_number not in rep_number_set:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=(
                    f"form_issues references rep_number {issue.rep_number} "
                    "which is not present in reps"
                ),
            )

    ok, server_score = is_within_tolerance(payload.form_score, payload.reps, payload.form_issues)
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                f"form_score ({payload.form_score}) does not match the "
                f"server-recomputed score ({server_score}) within tolerance"
            ),
        )

    return server_score
