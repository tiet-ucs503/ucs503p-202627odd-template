"""
Sends the sign-up verification code by email.

With SMTP_HOST set (for example Gmail: smtp.gmail.com, port 587, an app
password), a real email is sent. Without it, the code is printed in the backend
terminal, so the app can still be tried on one machine. Only Python's standard
library is used.
"""
import logging
import smtplib
from email.message import EmailMessage

from config import settings

log = logging.getLogger("mathverse.mailer")

_TIMEOUT_SECONDS = 10


def email_is_configured() -> bool:
    return bool(settings.smtp_host and settings.mail_from)


def _message(to: str, name: str, code: str) -> EmailMessage:
    msg = EmailMessage()
    msg["Subject"] = f"Your MathVerse code: {code}"
    msg["From"] = f"MathVerse <{settings.mail_from}>"
    msg["To"] = to
    msg.set_content(
        f"Hi {name},\n\n"
        f"Your MathVerse verification code is: {code}\n\n"
        "Enter it in the sign-up window to finish creating your account. "
        "The code expires in 15 minutes.\n\n"
        "If you did not sign up for MathVerse, you can ignore this email.\n"
    )
    return msg


def deliver(msg: EmailMessage) -> None:
    """Hand one message to the SMTP server. Tests replace this function."""
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=_TIMEOUT_SECONDS) as smtp:
        smtp.starttls()
        if settings.smtp_user:
            smtp.login(settings.smtp_user, settings.smtp_password)
        smtp.send_message(msg)


def send_verification_code(to: str, name: str, code: str) -> bool:
    """True when the code reached the person (or the terminal); False if sending failed."""
    if not email_is_configured():
        print(f"\n[MathVerse] Email is not set up. Verification code for {to}: {code}\n", flush=True)
        return True
    try:
        deliver(_message(to, name, code))
        return True
    except (OSError, smtplib.SMTPException) as exc:  # network down, wrong password, rejected address
        log.warning("Could not send the verification email: %s", exc.__class__.__name__)
        return False
