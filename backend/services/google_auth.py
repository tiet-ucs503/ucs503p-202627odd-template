"""
Checks a "Sign in with Google" credential.

The browser shows Google's own sign-in button. When the person signs in, Google
hands the browser a signed ID token (a JWT). The browser passes it here, and
this module asks Google's official library to check it: the signature against
Google's public keys, that it was issued for *this* app's client ID, that it
has not expired, and that it came from Google. Only then is it trusted.

Nothing else about the person is fetched from Google, and no Google password is
ever seen by MathVerse.
"""
from typing import Optional, TypedDict

from config import settings


class GoogleIdentity(TypedDict):
    sub: str  # Google's permanent id for the account; never changes, never reused
    email: str
    name: str


def verify_google_credential(credential: str) -> Optional[GoogleIdentity]:
    """The verified identity in a Google ID token, or None if it is not valid for this app."""
    from google.auth.transport import requests as google_requests  # imported only when used
    from google.oauth2 import id_token

    try:
        info = id_token.verify_oauth2_token(credential, google_requests.Request(), settings.google_client_id)
    except ValueError:
        return None
    if info.get("iss") not in ("accounts.google.com", "https://accounts.google.com"):
        return None
    # An unverified address could belong to someone else; never link or create on it.
    if not info.get("email") or info.get("email_verified") is not True:
        return None
    email = str(info["email"]).lower().strip()
    return GoogleIdentity(sub=str(info["sub"]), email=email, name=str(info.get("name") or email.split("@")[0]))
