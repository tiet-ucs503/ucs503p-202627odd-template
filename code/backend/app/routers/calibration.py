"""USER_BASELINE upsert/fetch — the Week-7 personalization baseline."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session as DBSession

from app.database import get_db
from app.models import User, UserBaseline
from app.schemas import BaselineIn, BaselineOut
from app.security import get_current_user

router = APIRouter(prefix="/api/calibration", tags=["calibration"])


@router.post("", response_model=BaselineOut)
def upsert_calibration(
    payload: BaselineIn,
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    baseline = db.query(UserBaseline).filter(UserBaseline.user_id == current_user.id).first()
    if baseline is None:
        baseline = UserBaseline(user_id=current_user.id)
        db.add(baseline)

    baseline.limb_ratios = payload.limb_ratios
    baseline.rom = payload.rom
    baseline.angle_stats = payload.angle_stats
    baseline.calibrated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(baseline)
    return baseline


@router.get("", response_model=BaselineOut)
def get_calibration(
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    baseline = db.query(UserBaseline).filter(UserBaseline.user_id == current_user.id).first()
    if baseline is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No calibration baseline found")
    return baseline
