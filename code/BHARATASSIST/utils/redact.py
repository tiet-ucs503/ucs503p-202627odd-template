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


def redact_pii(text: str):
    """Replace common PII patterns with placeholders. Returns (redacted_text, count)."""
    redacted = text
    total_count = 0
    for label, pattern in PATTERNS.items():
        redacted, n = pattern.subn(f"[REDACTED_{label}]", redacted)
        total_count += n
    return redacted, total_count
