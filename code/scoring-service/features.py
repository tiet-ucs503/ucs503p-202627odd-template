# features.py -- reproduces the EXACT feature extraction from training.
# Do not "improve" or reorder anything here. The model depends on it.

import re

# Invisible padding characters Gmail injects into snippets; stripped before use.
INVISIBLE = r"[\u034f\u200c\u200d\u200b\u00ad\u2060\ufeff\u180e\u3164\u2800]+"

def clean(t):
    """Strip invisible chars and collapse whitespace. Matches training."""
    if t is None:
        return ""
    t = re.sub(INVISIBLE, " ", str(t))
    return re.sub(r"\s+", " ", t).strip()

def split_sender(s):
    """Return (local_part, domain) from a sender string, lowercased."""
    s = str(s).lower()
    m = re.search(r"[\w.\-+]+@[\w.\-]+", s)
    addr = m.group(0) if m else s
    return addr.partition("@")[0], addr.partition("@")[2]

# The engineered-feature order MUST be exactly this (12 features):
ENG_NAMES = ["is_automated", "is_reply", "has_unsub", "is_promo_cat",
             "is_social_cat", "is_personal_cat", "is_updates_cat",
             "subject_len", "snippet_len", "has_number",
             "promo_count", "is_college"]

def eng_features(sender, subject, snippet, gmail_labels, account,
                 AUTOMATED, PROMO_WORDS):
    """Build the 12 engineered features for one email. Order-critical."""
    subj = clean(subject).lower()
    snip = clean(snippet).lower()
    sender_l = str(sender).lower()
    local, domain = split_sender(sender_l)

    # gmail_labels may arrive as a list (from JSON) or a comma-joined string.
    if isinstance(gmail_labels, list):
        labels = " ".join(gmail_labels).upper()
    else:
        labels = str(gmail_labels).upper()

    text = subj + " " + snip

    return [
        int(any(a in local or a in domain for a in AUTOMATED)),  # is_automated
        int(subj.startswith(("re:", "fwd:", "fw:"))),            # is_reply
        0,                                                       # has_unsub
        int("CATEGORY_PROMOTIONS" in labels),                   # is_promo_cat
        int("CATEGORY_SOCIAL" in labels),                       # is_social_cat
        int("CATEGORY_PERSONAL" in labels),                     # is_personal_cat
        int("CATEGORY_UPDATES" in labels),                      # is_updates_cat
        len(subj),                                               # subject_len
        len(snip),                                               # snippet_len
        int(bool(re.search(r"\d", subj))),                       # has_number
        sum(1 for w in PROMO_WORDS if w in text),                # promo_count
        int(str(account).lower().startswith("college")),        # is_college
    ]