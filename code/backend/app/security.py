"""
JWT issuance/verification (python-jose) + the `get_current_user`
dependency every protected route depends on.

Security invariant enforced here: `get_current_user` is the ONLY source of
truth for "who is making this request." Routers must derive `user_id` from
this dependency and never from the request body/query string.
"""
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session as DBSession

from app.config import get_settings
from app.database import get_db
from app.models import User

# tokenUrl is just where /docs points its "try it out" login form at; the
# dependency itself accepts any bearer token regardless of how it was minted.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/google", auto_error=False)


def create_access_token(user_id: str) -> str:
    settings = get_settings()
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expire_minutes)
    payload = {"sub": user_id, "exp": expire}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> str:
    """Returns the user_id (`sub`) or raises HTTPException(401)."""
    settings = get_settings()
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError:
        raise credentials_error
    user_id = payload.get("sub")
    if not user_id:
        raise credentials_error
    return user_id


def get_current_user(
    token: str | None = Depends(oauth2_scheme),
    db: DBSession = Depends(get_db),
) -> User:
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user_id = decode_access_token(token)
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user
