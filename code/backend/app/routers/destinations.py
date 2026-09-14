from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.dependencies.db import get_db
from app.schemas.destination import DestinationMinimal, DestinationPublic
from app.schemas.post import PostPublic
from app.schemas.user import UserMinimal
from app.services import destination_service

router = APIRouter(prefix="/api/destinations", tags=["destinations"])


@router.get("", response_model=list[DestinationMinimal])
def search_destinations(search: str | None = Query(default=None), db: Session = Depends(get_db)):
    return destination_service.search_destinations(db, query=search or "")


@router.get("/{destination_id}", response_model=DestinationPublic)
def get_destination(destination_id: int, db: Session = Depends(get_db)):
    return destination_service.get_destination(db, destination_id)


@router.get("/{destination_id}/posts", response_model=list[PostPublic])
def get_destination_posts(destination_id: int, db: Session = Depends(get_db)):
    return destination_service.get_posts_for_destination(db, destination_id)


@router.get("/{destination_id}/travelers", response_model=list[UserMinimal])
def get_destination_travelers(destination_id: int, db: Session = Depends(get_db)):
    return destination_service.get_travelers_for_destination(db, destination_id)
