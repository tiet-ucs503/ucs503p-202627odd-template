"""Per-user dashboard summary + trends. Always scoped to the current JWT user."""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session as DBSession

from app.database import get_db
from app.models import Session as SessionModel, User
from app.schemas import DashboardSummaryResponse, DashboardTrendsResponse
from app.security import get_current_user
from app.services.aggregation import compute_summary, compute_trend_points

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

VALID_METRICS = {"form_score", "rom", "tempo", "reps"}


def _user_sessions(db: DBSession, user_id: str) -> list[SessionModel]:
    return db.query(SessionModel).filter(SessionModel.user_id == user_id).all()


@router.get("/summary", response_model=DashboardSummaryResponse)
def dashboard_summary(
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    sessions = _user_sessions(db, current_user.id)
    return compute_summary(sessions)


@router.get("/trends", response_model=DashboardTrendsResponse)
def dashboard_trends(
    metric: str = Query(...),
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    if metric not in VALID_METRICS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"metric must be one of {sorted(VALID_METRICS)}",
        )

    sessions = _user_sessions(db, current_user.id)
    points = compute_trend_points(sessions, metric)
    return {"metric": metric, "points": points}
