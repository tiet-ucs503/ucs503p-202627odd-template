from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.dependencies.auth import get_current_user
from app.dependencies.db import get_db
from app.models.user import User
from app.schemas.feed import FeedResponse
from app.services import feed_service

router = APIRouter(prefix="/api/feed", tags=["feed"])


@router.get("", response_model=FeedResponse)
def get_user_feed(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return feed_service.get_feed(
        db, user_id=current_user.id, skip=skip, limit=limit
    )
