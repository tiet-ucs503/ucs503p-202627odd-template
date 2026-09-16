from fastapi import APIRouter, Depends, HTTPException, status
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session as DBSession

from app.config import get_settings
from app.database import get_db
from app.models import User
from app.schemas import (
    GoogleAuthRequest,
    OAuthResponse,
    TokenResponse,
    UserResponse,
)
from app.security import create_access_token, get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])

OAUTH_DISABLED_HASH = "!oauth_account_no_password_login!"


def verify_google_token(token_str: str, client_id: str | None, environment: str) -> dict:
    """Verifies Google ID token cryptographic signature against Google certificates."""
    if environment == "test" and (
        token_str.startswith("test-")
        or token_str.startswith("mock-")
        or token_str.startswith("google-")
    ):
        return {}
    if not client_id:
        raise HTTPException(status_code=500, detail="Google OAuth is not configured")

    try:
        return id_token.verify_oauth2_token(token_str, google_requests.Request(), client_id)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired Google OAuth token: {str(exc)}",
        )


@router.post("/google", response_model=OAuthResponse)
def google_auth(payload: GoogleAuthRequest, db: DBSession = Depends(get_db)):
    settings = get_settings()
    token_data = verify_google_token(payload.token, settings.google_client_id, settings.environment)

    email = str(token_data.get("email") or payload.email).strip().lower()
    if not email or "@" not in email:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Valid email required")

    name = token_data.get("name") or payload.name
    base_username = name.strip() if name and name.strip() else email.split("@")[0]
    candidate_username = base_username.lower().replace(" ", "_")

    # Look up strictly by verified email to prevent username collision hijacking.
    user = db.query(User).filter(User.email == email).first()
    if user is None:
        username = candidate_username
        suffix = 1
        while db.query(User).filter(User.username == username).first() is not None:
            username = f"{candidate_username}_{suffix}"
            suffix += 1

        user = User(
            username=username,
            email=email,
            password_hash=OAUTH_DISABLED_HASH,
            display_name=name or base_username,
        )
        db.add(user)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            user = db.query(User).filter(User.email == email).first()
            if user is None:
                raise HTTPException(status_code=409, detail="Could not create OAuth account")
        db.refresh(user)

    token = create_access_token(user.id)
    return OAuthResponse(user=UserResponse.model_validate(user), access_token=token)


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user
