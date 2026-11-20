import secrets

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models
import schemas
from config import settings
from database import get_db
from deps import current_user
from security import create_access_token, hash_password, verify_password
from services.google_auth import verify_google_credential

router = APIRouter(prefix="/auth", tags=["auth"])

_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no 0/O/1/I, easy to read aloud


def new_link_code(db: Session) -> str:
    """A short code only the student's own account shows; a guardian needs it to link."""
    while True:
        code = "SPIDER-" + "".join(secrets.choice(_CODE_ALPHABET) for _ in range(6))
        if not db.query(models.User).filter_by(link_code=code).first():
            return code


def _token_response(user: models.User) -> schemas.TokenResponse:
    return schemas.TokenResponse(
        access_token=create_access_token(user.id),
        user=schemas.UserOut.model_validate(user),
    )


@router.post("/register", response_model=schemas.TokenResponse, status_code=201)
def register(payload: schemas.RegisterRequest, db: Session = Depends(get_db)):
    email = payload.email.lower().strip()
    if db.query(models.User).filter_by(email=email).first():
        raise HTTPException(status_code=409, detail="An account with this email already exists.")

    user = models.User(
        name=payload.name.strip(),
        email=email,
        password_hash=hash_password(payload.password),
        role=payload.role,
        link_code=new_link_code(db) if payload.role == "student" else None,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return _token_response(user)


@router.post("/login", response_model=schemas.TokenResponse)
def login(payload: schemas.LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter_by(email=payload.email.lower().strip()).first()
    # Same message for "no such account" and "wrong password", so the form
    # cannot be used to discover which emails are registered.
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect email or password.")
    return _token_response(user)


@router.post("/google", response_model=schemas.TokenResponse)
def google_login(payload: schemas.GoogleLoginRequest, db: Session = Depends(get_db)):
    """
    "Sign in with Google". The credential is checked with Google's library
    (services/google_auth.py). Then, in this order:

    1. An account already signed in with this Google account: sign it in.
    2. An account with the same email: link it to Google and sign it in. Google
       has confirmed the person owns that address; their password keeps working.
    3. Otherwise, create a new account with the role chosen on the sign-up tab.

    Demo accounts can never be reached this way.
    """
    if not settings.google_client_id:
        raise HTTPException(status_code=404, detail="Google sign-in is not set up on this server.")
    identity = verify_google_credential(payload.credential)
    if identity is None:
        raise HTTPException(status_code=401, detail="Google sign-in could not be verified. Please try again.")

    user = db.query(models.User).filter_by(google_sub=identity["sub"]).first()
    if user is None:
        user = db.query(models.User).filter_by(email=identity["email"]).first()
        if user is not None:
            if user.is_demo:
                raise HTTPException(status_code=403, detail="Demo accounts cannot be used with Google sign-in.")
            if user.google_sub is not None:  # the email belongs to an account linked to a different Google account
                raise HTTPException(status_code=409, detail="This email is already linked to another Google account.")
            user.google_sub = identity["sub"]
            db.commit()
            db.refresh(user)
    if user is None:
        if payload.role is None:
            raise HTTPException(
                status_code=404,
                detail="No MathVerse account uses this Google address yet. Choose Create account, pick your role, "
                       "then continue with Google.",
            )
        user = models.User(
            name=identity["name"][:80],
            email=identity["email"],
            # No password is set for a Google account. This random one is never shown,
            # so the account can be reached only through Google.
            password_hash=hash_password(secrets.token_urlsafe(32)),
            role=payload.role,
            link_code=new_link_code(db) if payload.role == "student" else None,
            google_sub=identity["sub"],
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    return _token_response(user)


@router.get("/me", response_model=schemas.UserOut)
def me(user: models.User = Depends(current_user)):
    return user


@router.post("/demo/{role}", response_model=schemas.TokenResponse)
def demo_login(role: schemas.Role, db: Session = Depends(get_db)):
    """
    One-click login for the seeded demo accounts.

    - Does nothing unless DEMO_MODE=true (default false): returns 404.
    - Only ever returns an account with is_demo=True, created by `python seed.py --demo`.
    - Never creates an account and never returns a real user's token.
    """
    if not settings.demo_mode:
        raise HTTPException(status_code=404, detail="Not found")
    user = (
        db.query(models.User)
        .filter_by(role=role, is_demo=True)
        .order_by(models.User.id)
        .first()
    )
    if user is None:
        raise HTTPException(
            status_code=404,
            detail="Demo accounts have not been created. Run `python seed.py --demo`.",
        )
    return _token_response(user)
