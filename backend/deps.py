"""Shared FastAPI dependencies: who is calling, and what they may see."""
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

import models
from database import get_db
from security import decode_access_token

_bearer = HTTPBearer(auto_error=False)


def current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
    db: Session = Depends(get_db),
) -> models.User:
    """The logged-in user, taken from the bearer token. 401 if missing or invalid."""
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Please sign in.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if credentials is None:
        raise unauthorized
    user_id = decode_access_token(credentials.credentials)
    if user_id is None:
        raise unauthorized
    user = db.get(models.User, user_id)
    if user is None:
        raise unauthorized
    return user


def require_role(*roles: str):
    """Dependency factory: 403 unless the caller has one of the given roles."""

    def _check(user: models.User = Depends(current_user)) -> models.User:
        if user.role not in roles:
            raise HTTPException(status_code=403, detail="Your account cannot do this.")
        return user

    return _check


require_student = require_role("student")
require_guardian = require_role("parent", "teacher")


def student_for_viewer(
    student_id: int,
    user: models.User = Depends(current_user),
    db: Session = Depends(get_db),
) -> models.User:
    """
    Returns the student whose data is being requested, if the caller may see it:
    the student themself, or a parent/teacher linked to that student.
    """
    forbidden = HTTPException(status_code=403, detail="You do not have access to this student.")
    if user.role == "student":
        if user.id != student_id:
            raise forbidden
        return user

    link = (
        db.query(models.GuardianLink)
        .filter_by(guardian_id=user.id, student_id=student_id)
        .first()
    )
    if link is None:
        raise forbidden
    student = db.get(models.User, student_id)
    if student is None or student.role != "student":
        raise forbidden
    return student
