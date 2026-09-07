"""
Basic PII redaction before sending document text to a public LLM API.
This is a lightweight, demoable mitigation for the 'no auth / public API' scope.
Not a substitute for full anonymization - documented as a known limitation.
"""

import re

PATTERNS = {
    "AADHAAR": re.compile(r"\b\d{4}\s?\d{4}\s?\d{4}\b"),
    "PAN": re.compile(r"\b[A-Z]{5}[0-9]{4}[A-Z]\b"),
    "PHONE": re.compile(r"\b(?:\+91[\s-]?)?[6-9]\d{9}\b"),
    "EMAIL": re.compile(r"\b[\w.+-]+@[\w-]+\.[\w.-]+\b"),
}


def redact_pii(text: str, user: dict = None):
    """
    Replace common PII patterns with placeholders.
    If an authenticated user dictionary is supplied, also dynamically redacts the
    citizen's personal name and email so NO user details ever leak to public LLMs.
    Returns (redacted_text, count).
    """
    redacted = text
    total_count = 0

    # 1. Redact authenticated citizen's personal details first if logged in
    if user and isinstance(user, dict):
        # Redact authenticated citizen's personal phone number in all common formats
        raw_phone = str(user.get("phone") or user.get("mobile") or "").strip()
        phone_digits = re.sub(r"\D", "", raw_phone)
        if len(phone_digits) >= 10:
            ten_digits = phone_digits[-10:]
            d1, d2 = ten_digits[:5], ten_digits[5:]
            # Matches +91 9876543210, +91-9876543210, 919876543210, 9876543210, 98765 43210, 98765-43210
            phone_regex = re.compile(
                rf"(?:\+?91[\s-]?)?{re.escape(ten_digits)}|(?:\+?91[\s-]?)?{re.escape(d1)}[\s-]{re.escape(d2)}",
                re.IGNORECASE
            )
            redacted, n = phone_regex.subn("[REDACTED_CITIZEN_PHONE]", redacted)
            total_count += n

        user_email = (user.get("email") or "").strip()
        if user_email:
            email_pattern = re.compile(re.escape(user_email), re.IGNORECASE)
            redacted, n = email_pattern.subn("[REDACTED_CITIZEN_EMAIL]", redacted)
            total_count += n

        user_name = (user.get("name") or "").strip()
        if user_name and len(user_name) > 2:
            name_pattern = re.compile(r"\b" + re.escape(user_name) + r"\b", re.IGNORECASE)
            redacted, n = name_pattern.subn("[REDACTED_CITIZEN_NAME]", redacted)
            total_count += n
            # Also redact first name if distinctive (>3 chars)
            name_parts = [p for p in user_name.split() if len(p) > 3]
            for part in name_parts:
                part_pattern = re.compile(r"\b" + re.escape(part) + r"\b", re.IGNORECASE)
                redacted, pn = part_pattern.subn("[REDACTED_CITIZEN_NAME]", redacted)
                total_count += pn

    # 2. Standard Indian PII redaction
    for label, pattern in PATTERNS.items():
        redacted, n = pattern.subn(f"[REDACTED_{label}]", redacted)
        total_count += n

    return redacted, total_count
