# main.py -- Vigilante scoring microservice (baseline classifier)

import json
import numpy as np
import joblib
from scipy.sparse import hstack, csr_matrix
from fastapi import FastAPI
from pydantic import BaseModel
from typing import List, Union

from features import clean, eng_features, ENG_NAMES


# --- Load all artifacts ONCE at startup ---

MODEL_DIR = "models"

model = joblib.load(f"{MODEL_DIR}/vigilante_baseline_model.pkl")
subj_vec = joblib.load(f"{MODEL_DIR}/vigilante_subject_vectorizer.pkl")
snip_vec = joblib.load(f"{MODEL_DIR}/vigilante_snippet_vectorizer.pkl")
scaler = joblib.load(f"{MODEL_DIR}/vigilante_scaler.pkl")

with open(f"{MODEL_DIR}/vigilante_baseline_metadata.json") as f:
    META = json.load(f)

AUTOMATED = META["automated_patterns"]
PROMO_WORDS = META["promo_words"]

DISPLAY_THRESHOLD = META.get("display_threshold", 0.4)
ARCHIVE_THRESHOLD = META.get("archive_threshold", 0.2)


app = FastAPI(
    title="Vigilante Scoring Service",
    version="1.0"
)


# --- Request / response shapes ---

class Email(BaseModel):
    sender: str
    subject: str = ""
    snippet: str = ""
    gmail_labels: Union[List[str], str] = ""
    account: str = "personal"


def score_one(e: Email) -> float:
    """Return the importance probability (0..1) for one email."""

    eng = np.array([
        eng_features(
            e.sender,
            e.subject,
            e.snippet,
            e.gmail_labels,
            e.account,
            AUTOMATED,
            PROMO_WORDS
        )
    ], dtype=float)

    x = hstack([
        csr_matrix(scaler.transform(eng)),
        subj_vec.transform([clean(e.subject)]),
        snip_vec.transform([clean(e.snippet)]),
    ]).tocsr()

    return float(model.predict_proba(x)[0, 1])


def decision(score: float) -> str:
    if score < ARCHIVE_THRESHOLD:
        return "archive"

    if score < DISPLAY_THRESHOLD:
        return "low_priority"

    return "important"


@app.get("/health")
def health():
    return {
        "status": "ok",
        "features": len(ENG_NAMES)
    }


@app.post("/score")
def score(email: Email):
    s = score_one(email)

    return {
        "score": round(s, 4),
        "decision": decision(s),
        "display_threshold": DISPLAY_THRESHOLD,
        "archive_threshold": ARCHIVE_THRESHOLD,
    }


@app.post("/score-batch")
def score_batch(emails: List[Email]):
    out = []

    for e in emails:
        s = score_one(e)
        out.append({
            "score": round(s, 4),
            "decision": decision(s)
        })

    return {
        "results": out,
        "count": len(out)
    }