from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.dependencies.auth import get_current_user
from app.dependencies.db import get_db
from app.models.user import User
from app.schemas.follow import FollowCreate, FollowPublic
from app.services import follow_service

router = APIRouter(prefix="/api/follows", tags=["follows"])


@router.post("", response_model=FollowPublic, status_code=status.HTTP_201_CREATED)
def follow_user(
    data: FollowCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return follow_service.follow_user(
        db, follower_id=current_user.id, followed_id=data.followed_id
    )


@router.delete("/{followed_id}", status_code=status.HTTP_204_NO_CONTENT)
def unfollow_user(
    followed_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    follow_service.unfollow_user(
        db, follower_id=current_user.id, followed_id=followed_id
    )
    return None
