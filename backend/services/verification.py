"""
Email verification codes for password sign-ups.

A 6-digit code is emailed after sign-up. Only a keyed hash of it is stored. It
expires after 15 minutes and allows 5 wrong tries; after that a new code must be
requested, and a new code can be sent at most once a minute.
"""
import hashlib
import hmac
import secrets
from datetime import timedelta
from typing import Optional

import models
from config import settings
from models import utcnow
from services.mailer import send_verification_code

CODE_LIFETIME = timedelta(minutes=15)
RESEND_COOLDOWN = timedelta(seconds=60)
MAX_ATTEMPTS = 5


def _hash(code: str) -> str:
    return hmac.new(settings.jwt_secret.encode(), code.encode(), hashlib.sha256).hexdigest()


def seconds_until_resend(user: models.User) -> int:
    if user.verify_sent_at is None:
        return 0
    wait = (user.verify_sent_at + RESEND_COOLDOWN - utcnow()).total_seconds()
    return max(0, int(wait + 0.999))


def issue_code(user: models.User) -> bool:
    """Make a fresh code, store its hash and send it. Returns whether it was sent."""
    code = f"{secrets.randbelow(1_000_000):06d}"
    user.verify_code_hash = _hash(code)
    user.verify_expires_at = utcnow() + CODE_LIFETIME
    user.verify_sent_at = utcnow()
    user.verify_attempts = 0
    return send_verification_code(user.email, user.name, code)


def check_code(user: models.User, code: str) -> Optional[str]:
    """None if the code is right; otherwise the reason it was refused."""
    if user.verify_code_hash is None or user.verify_expires_at is None:
        return "No code is waiting for this email. Ask for a new one."
    if user.verify_expires_at < utcnow():
        return "This code has expired. Ask for a new one."
    if user.verify_attempts >= MAX_ATTEMPTS:
        return "Too many wrong tries. Ask for a new code."
    if not hmac.compare_digest(user.verify_code_hash, _hash(code)):
        user.verify_attempts += 1
        left = MAX_ATTEMPTS - user.verify_attempts
        return f"That code is not right. {left} {'try' if left == 1 else 'tries'} left." if left else \
            "Too many wrong tries. Ask for a new code."
    return None


def mark_verified(user: models.User) -> None:
    user.email_verified = True
    user.verify_code_hash = None
    user.verify_expires_at = None
    user.verify_attempts = 0
