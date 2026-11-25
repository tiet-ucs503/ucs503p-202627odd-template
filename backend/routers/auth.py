import secrets

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models
import schemas
from config import settings
from database import get_db
from deps import current_user
from security import create_access_token, hash_password, verify_password
from services import verification
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


@router.post("/register", response_model=schemas.VerificationPending, status_code=201)
def register(payload: schemas.RegisterRequest, db: Session = Depends(get_db)):
    """
    Creates the account unverified and emails a 6-digit code. No token is given
    until the code is entered (POST /auth/verify-email).
    """
    email = payload.email  # already trimmed and lower-cased by the schema
    user = db.query(models.User).filter_by(email=email).first()
    if user is not None and (user.email_verified or user.is_demo or user.google_sub):
        raise HTTPException(status_code=409, detail="An account with this email already exists.")

    link_code = None
    if payload.role == "student":
        link_code = user.link_code if user is not None and user.link_code else new_link_code(db)
    if user is None:
        user = models.User(email=email, email_verified=False, name=payload.name, role=payload.role,
                           password_hash=hash_password(payload.password), link_code=link_code)
        db.add(user)
    else:
        # An unconfirmed sign-up holds no data yet, so signing up again with the same
        # email simply replaces it (for example after a typo in the name or a lost code).
        user.name = payload.name
        user.password_hash = hash_password(payload.password)
        user.role = payload.role
        user.link_code = link_code

    sent = True
    if verification.seconds_until_resend(user) == 0:
        sent = verification.issue_code(user)
    db.commit()
    return schemas.VerificationPending(
        email=email, email_sent=sent, resend_after_seconds=verification.seconds_until_resend(user)
    )


@router.post("/verify-email", response_model=schemas.TokenResponse)
def verify_email(payload: schemas.VerifyEmailRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter_by(email=payload.email).first()
    if user is None:
        raise HTTPException(status_code=400, detail="No code is waiting for this email. Ask for a new one.")
    if user.email_verified:
        raise HTTPException(status_code=400, detail="This email is already verified. Please log in.")
    problem = verification.check_code(user, payload.code)
    if problem:
        db.commit()  # keep the count of wrong tries
        raise HTTPException(status_code=400, detail=problem)
    verification.mark_verified(user)
    db.commit()
    db.refresh(user)
    return _token_response(user)


@router.post("/resend-code", response_model=schemas.MessageOut)
def resend_code(payload: schemas.ResendCodeRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter_by(email=payload.email).first()
    if user is not None and not user.email_verified:
        wait = verification.seconds_until_resend(user)
        if wait:
            raise HTTPException(status_code=429, detail=f"Please wait {wait} seconds before asking for another code.")
        if not verification.issue_code(user):
            db.commit()
            raise HTTPException(status_code=503, detail="The email could not be sent right now. Please try again soon.")
        db.commit()
        wait = verification.seconds_until_resend(user)
    else:
        wait = int(verification.RESEND_COOLDOWN.total_seconds())
    # The same reply whether or not the address is waiting, so this cannot be
    # used to find out which emails have accounts.
    return schemas.MessageOut(
        message="If this email is waiting to be verified, a new code is on its way.", resend_after_seconds=wait
    )


@router.post("/login", response_model=schemas.TokenResponse)
def login(payload: schemas.LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter_by(email=payload.email).first()
    # Same message for "no such account" and "wrong password", so the form
    # cannot be used to discover which emails are registered.
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect email or password.")
    if not user.email_verified:
        # Only said after the right password, so it reveals nothing to a stranger.
        raise HTTPException(
            status_code=403, detail="Please verify your email first. Enter the code we sent, or ask for a new one."
        )
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
            if not user.email_verified:
                # An unconfirmed sign-up could have been made by anyone who typed this
                # address. Google has now proved who owns it, so whatever password that
                # sign-up set is discarded before the account is handed to the owner.
                user.password_hash = hash_password(secrets.token_urlsafe(32))
                verification.mark_verified(user)
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
