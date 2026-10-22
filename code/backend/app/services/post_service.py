from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.destination import Destination
from app.models.post import Post
from app.schemas.post import PostCreate


def find_or_create_destination(db: Session, name: str) -> Destination:
    """Find existing destination by name (case-insensitive) or create a new one."""
    destination = db.query(Destination).filter(
        func.lower(Destination.name) == name.strip().lower()
    ).first()

    if destination is not None:
        return destination

    destination = Destination(name=name.strip())
    db.add(destination)
    db.flush()
    return destination


def create_post(db: Session, user_id: int, payload: PostCreate) -> Post:
    destination = find_or_create_destination(db, payload.destination_name)

    post = Post(
        user_id=user_id,
        destination_id=destination.id,
        content=payload.content,
        image_url=payload.image_url,
    )
    db.add(post)
    db.commit()
    db.refresh(post)
    return post


def get_post(db: Session, post_id: int) -> Post:
    post = db.query(Post).filter(Post.id == post_id).first()
    if post is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="post not found")
    return post


def list_posts(db: Session) -> list[Post]:
    return db.query(Post).order_by(Post.created_at.desc()).all()


def delete_post(db: Session, post_id: int, user_id: int) -> None:
    post = db.query(Post).filter(Post.id == post_id).first()
    if post is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="post not found")
    if post.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="not the post owner")

    db.delete(post)
    db.commit()
