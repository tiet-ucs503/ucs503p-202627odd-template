from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.models.destination import Destination
from app.models.post import Post
from app.models.user import User


def search_destinations(db: Session, query: str = "") -> list[Destination]:
    if not query:
        return db.query(Destination).all()
    pattern = f"%{query}%"
    return db.query(Destination).filter(
        or_(
            Destination.name.ilike(pattern),
            Destination.country.ilike(pattern)
        )
    ).all()


def get_destination(db: Session, destination_id: int) -> Destination:
    dest = db.query(Destination).filter(Destination.id == destination_id).first()
    if not dest:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Destination not found"
        )
    return dest


def get_posts_for_destination(db: Session, destination_id: int) -> list[Post]:
    get_destination(db, destination_id)
    return (
        db.query(Post)
        .filter(Post.destination_id == destination_id)
        .order_by(Post.created_at.desc())
        .all()
    )


def get_travelers_for_destination(db: Session, destination_id: int) -> list[User]:
    get_destination(db, destination_id)
    return (
        db.query(User)
        .join(Post, Post.user_id == User.id)
        .filter(Post.destination_id == destination_id)
        .distinct()
        .all()
    )
