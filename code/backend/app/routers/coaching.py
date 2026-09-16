from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session as DBSession

from app.database import get_db
from app.models import User, UserBaseline
from app.schemas import CoachingAnalyzeRequest, CoachingAnalyzeResponse, CoachingBaselineIn
from app.security import decode_access_token, oauth2_scheme
from app.rate_limit import enforce_coaching_rate_limit
from app.services.coaching import analyze_session_coaching

router = APIRouter(prefix="/api/coaching", tags=["coaching"])


def get_optional_user(
    token: str | None = Depends(oauth2_scheme),
    db: DBSession = Depends(get_db),
) -> User | None:
    """Extracts user if bearer token provided; returns None otherwise."""
    if not token:
        return None
    try:
        user_id = decode_access_token(token)
        return db.get(User, user_id)
    except HTTPException:
        raise


@router.post("/analyze", response_model=CoachingAnalyzeResponse)
def analyze_workout(
    payload: CoachingAnalyzeRequest,
    current_user: User | None = Depends(get_optional_user),
    db: DBSession = Depends(get_db),
    _rate_limit: None = Depends(enforce_coaching_rate_limit),
):
    """
    Evidence-grounded AI coaching analysis for a completed exercise set.
    Combines measured kinematics, user baseline calibration, and retrieved
    approved guidance to generate a schema-validated coaching breakdown.
    """
    # If athlete is logged in and baseline not provided in payload, inject from DB
    if current_user and not payload.personalized_baseline:
        baseline_record = (
            db.query(UserBaseline).filter(UserBaseline.user_id == current_user.id).first()
        )
        if baseline_record:
            lr = baseline_record.limb_ratios or {}
            rom = baseline_record.rom or {}
            stats = baseline_record.angle_stats or {}
            payload.personalized_baseline = CoachingBaselineIn(
                femur_to_torso=lr.get("femurToTorso") or lr.get("femur_to_torso"),
                shin_to_torso=lr.get("shinToTorso") or lr.get("shin_to_torso"),
                knee_bottom_angle=rom.get("kneeBottom") or rom.get("knee_bottom"),
                typical_torso_lean=(
                    stats.get("typical_torso_lean")
                    or rom.get("typicalTorsoLean")
                ),
                confidence=0.95,
            )

    return analyze_session_coaching(payload)
