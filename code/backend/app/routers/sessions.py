"""
Session CRUD (create/list/get). `user_id` is ALWAYS derived from the JWT via
`get_current_user` — never accepted from the request body — and every query
filters `WHERE user_id = current_user.id`, so a user can never read or create
data attributed to another user.
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session as DBSession

from app.database import get_db
from app.models import FormIssue, Rep, Session as SessionModel, User
from app.schemas import SessionCreateRequest, SessionListItem, SessionResponse
from app.security import get_current_user
from app.services.validation import validate_session_payload

router = APIRouter(prefix="/api/sessions", tags=["sessions"])


@router.post("", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
def create_session(
    payload: SessionCreateRequest,
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    server_score = validate_session_payload(payload)

    session = SessionModel(
        user_id=current_user.id,
        exercise=payload.exercise,
        started_at=payload.started_at,
        ended_at=payload.ended_at,
        duration_seconds=payload.duration_seconds,
        rep_count=payload.rep_count,
        form_score=server_score,
    )
    db.add(session)
    db.flush()  # assign session.id before attaching children

    for rep in payload.reps:
        db.add(
            Rep(
                session_id=session.id,
                rep_number=rep.rep_number,
                duration_seconds=rep.duration_seconds,
                rom_value=rep.rom_value,
                tempo=rep.tempo,
                angle_metrics=rep.angle_metrics,
            )
        )

    for issue in payload.form_issues:
        db.add(
            FormIssue(
                session_id=session.id,
                rep_number=issue.rep_number,
                issue_type=issue.issue_type,
                severity=issue.severity,
            )
        )

    db.commit()
    db.refresh(session)
    return session


@router.get("", response_model=list[SessionListItem])
def list_sessions(
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    return (
        db.query(SessionModel)
        .filter(SessionModel.user_id == current_user.id)
        .order_by(SessionModel.started_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )


@router.get("/{session_id}", response_model=SessionResponse)
def get_session(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    session = (
        db.query(SessionModel)
        .filter(SessionModel.id == session_id, SessionModel.user_id == current_user.id)
        .first()
    )
    if session is None:
        # Same 404 whether the id doesn't exist or belongs to someone else —
        # never leaks existence of another user's session.
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    return session
