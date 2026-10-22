from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.destination import Destination
from app.models.post import Post
from app.models.user import User
from app.schemas.user import UserProfile, UserUpdate


def get_user_profile(db: Session, user_id: int) -> UserProfile:
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="user not found")

    post_count = db.query(func.count(Post.id)).filter(Post.user_id == user_id).scalar()

    destinations_visited = (
        db.query(Destination)
        .join(Post, Post.destination_id == Destination.id)
        .filter(Post.user_id == user_id)
        .distinct()
        .all()
    )

    return UserProfile(
        id=user.id,
        username=user.username,
        full_name=user.full_name,
        bio=user.bio,
        profile_picture_url=user.profile_picture_url,
        post_count=post_count,
        destinations_visited=destinations_visited,
    )


def update_current_user(db: Session, user: User, payload: UserUpdate) -> User:
    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(user, field, value)

    db.commit()
    db.refresh(user)
    return user
