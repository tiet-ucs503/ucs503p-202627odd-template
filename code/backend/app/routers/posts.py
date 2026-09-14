from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.dependencies.auth import get_current_user
from app.dependencies.db import get_db
from app.models.user import User
from app.schemas.post import PostCreate, PostPublic
from app.services.post_service import create_post, delete_post, get_post, list_posts

router = APIRouter(prefix="/api/posts", tags=["posts"])


@router.post("", response_model=PostPublic, status_code=status.HTTP_201_CREATED)
def create_new_post(
    payload: PostCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    post = create_post(db, current_user.id, payload)
    return post


@router.get("", response_model=list[PostPublic])
def get_all_posts(db: Session = Depends(get_db)):
    return list_posts(db)


@router.get("/{post_id}", response_model=PostPublic)
def get_single_post(post_id: int, db: Session = Depends(get_db)):
    return get_post(db, post_id)


@router.delete("/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_single_post(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    delete_post(db, post_id, current_user.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
