from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.models.follow import Follow
from app.models.user import User


def search_users(db: Session, query: str = "") -> list[User]:
    if not query:
        return db.query(User).all()
    pattern = f"%{query}%"
    return db.query(User).filter(
        or_(
            User.username.ilike(pattern),
            User.full_name.ilike(pattern)
        )
    ).all()


def follow_user(db: Session, follower_id: int, followed_id: int) -> Follow:
    if follower_id == followed_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot follow yourself"
        )
    
    target_user = db.query(User).filter(User.id == followed_id).first()
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    existing_follow = db.query(Follow).filter(
        Follow.follower_id == follower_id,
        Follow.followed_id == followed_id
    ).first()
    if existing_follow:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Already following this user"
        )
    
    follow = Follow(follower_id=follower_id, followed_id=followed_id)
    db.add(follow)
    db.commit()
    db.refresh(follow)
    return follow


def unfollow_user(db: Session, follower_id: int, followed_id: int) -> None:
    follow = db.query(Follow).filter(
        Follow.follower_id == follower_id,
        Follow.followed_id == followed_id
    ).first()
    if not follow:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Not currently following this user"
        )
    
    db.delete(follow)
    db.commit()


def list_followers(db: Session, user_id: int) -> list[User]:
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    return db.query(User).join(Follow, Follow.follower_id == User.id).filter(Follow.followed_id == user_id).all()


def list_following(db: Session, user_id: int) -> list[User]:
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    return db.query(User).join(Follow, Follow.followed_id == User.id).filter(Follow.follower_id == user_id).all()
