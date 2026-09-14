from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.dependencies.auth import get_current_user
from app.dependencies.db import get_db
from app.models.user import User
from app.schemas.auth import UserPublic
from app.schemas.user import UserMinimal, UserProfile, UserUpdate
from app.services import follow_service
from app.services.user_service import get_user_profile, update_current_user

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("", response_model=list[UserMinimal])
def search_users(search: str | None = Query(default=None), db: Session = Depends(get_db)):
    return follow_service.search_users(db, query=search or "")


@router.get("/me", response_model=UserPublic)
def get_current_user_profile(current_user: User = Depends(get_current_user)):
    return current_user


@router.patch("/me", response_model=UserProfile, status_code=status.HTTP_200_OK)
def update_user_profile(
    payload: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = update_current_user(db, current_user, payload)
    return get_user_profile(db, user.id)


@router.get("/{user_id}", response_model=UserProfile)
def get_user_by_id(user_id: int, db: Session = Depends(get_db)):
    return get_user_profile(db, user_id)


@router.get("/{user_id}/followers", response_model=list[UserMinimal])
def get_followers(user_id: int, db: Session = Depends(get_db)):
    return follow_service.list_followers(db, user_id)


@router.get("/{user_id}/following", response_model=list[UserMinimal])
def get_following(user_id: int, db: Session = Depends(get_db)):
    return follow_service.list_following(db, user_id)
