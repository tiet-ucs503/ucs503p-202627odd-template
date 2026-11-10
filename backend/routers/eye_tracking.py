import base64
import logging
import os
import threading
import time
from functools import lru_cache
from typing import Dict, List, Optional

import cv2
import numpy as np
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

import models
from ml.eye_tracker import EyeTracker, ensure_model
from routers.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/eye-track",
    tags=["eye-tracking"],
)

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
MAX_IMAGE_B64_CHARS = 5_000_000      # ~3.7 MB of image data
MAX_HISTORY = 50
SESSION_TTL_SECONDS = 30 * 60        # evict sessions idle for 30 minutes
CLEANUP_INTERVAL_SECONDS = 60        # run eviction at most once a minute
FALLBACK_RISK = 0.70
DEFAULT_CORRECT = 1
DEFAULT_RESPONSE_TIME_S = 15.0

# /simulate is a testing/demo tool. Enabled by default for interactive demo testing.
ENABLE_SIMULATION = os.getenv("ENABLE_EYE_SIMULATION", "true").lower() == "true"

VALID_STATES = {"Focused", "Drifting", "Impulsive", "Overwhelmed"}

STATE_DEFAULTS: Dict[str, Dict[str, float]] = {
    "Focused":     {"blink_rate": 18.0, "pupil_dilation": 5.0,   "fixation_duration": 450.0,  "saccade_rate": 1.5, "gaze_stability": 0.95},
    "Drifting":    {"blink_rate": 35.0, "pupil_dilation": -5.0,  "fixation_duration": 120.0,  "saccade_rate": 4.5, "gaze_stability": 0.45},
    "Impulsive":   {"blink_rate": 42.0, "pupil_dilation": 20.0,  "fixation_duration": 80.0,   "saccade_rate": 7.0, "gaze_stability": 0.55},
    "Overwhelmed": {"blink_rate": 8.0,  "pupil_dilation": 35.0,  "fixation_duration": 1200.0, "saccade_rate": 0.6, "gaze_stability": 0.80},
}


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------
class FramePayload(BaseModel):
    user_id: int = 1
    image_base64: str = Field(..., max_length=MAX_IMAGE_B64_CHARS)  # Data URL or raw base64 (JPEG/PNG)
    # Optional real task signals, so the LSTM isn't fed constants.
    correct: Optional[int] = None
    response_time_s: Optional[float] = None


class SimulatePayload(BaseModel):
    user_id: int = 1
    state: str  # "Focused" | "Drifting" | "Impulsive" | "Overwhelmed"
    blink_rate: Optional[float] = None
    pupil_dilation: Optional[float] = None


# ---------------------------------------------------------------------------
# Session state
# ---------------------------------------------------------------------------
@lru_cache(maxsize=1)
def _get_model_path() -> str:
    """Resolve/download the model once per process instead of once per user."""
    return ensure_model()


class UserTelemetrySession:
    def __init__(self, user_id: int):
        self.user_id = user_id
        self.lock = threading.Lock()  # EyeTracker keeps rolling state; serialize access
        self.tracker = EyeTracker(model_path=_get_model_path(), window_size=15)
        self.latest_result: Dict = {
            "attention_state": "Focused",
            "confidence": 0.85,
            "metrics": {
                "blink_rate": 18.0,
                "pupil_dilation": 5.0,
                "fixation_duration": 400.0,
                "saccade_rate": 1.8,
                "gaze_stability": 0.92,
            },
            "blink_count": 0,
            "avg_ear": 0.28,
        }
        # Question attempt history for Knowledge Tracing (NOT video frames)
        self.attempt_history: List[Dict] = []
        self.last_updated = time.time()

    def record_attempt(self, attempt_row: Dict) -> None:
        """Records an actual answered question attempt to the student's history."""
        with self.lock:
            self.attempt_history.append(attempt_row)
            if len(self.attempt_history) > MAX_HISTORY:
                self.attempt_history.pop(0)

    def update_with_frame(
        self,
        bgr_image: np.ndarray,
        correct: Optional[int] = None,
        response_time_s: Optional[float] = None,
    ) -> Dict:
        with self.lock:
            result = self.tracker.process_frame(bgr_image)
            self.latest_result = result
            self.last_updated = time.time()
            return result

    def set_simulated_state(
        self,
        state: str,
        blink_rate: Optional[float] = None,
        pupil_dilation: Optional[float] = None,
    ) -> None:
        with self.lock:
            m = dict(STATE_DEFAULTS[state])  # copy so overrides never leak into shared defaults
            if blink_rate is not None:
                m["blink_rate"] = blink_rate
            if pupil_dilation is not None:
                m["pupil_dilation"] = pupil_dilation

            self.latest_result = {
                "attention_state": state,
                "confidence": 0.92,
                "metrics": m,
                "blink_count": int(m["blink_rate"]),
                "avg_ear": 0.28,
            }
            self.last_updated = time.time()

    def get_lstm_sequence(self) -> List[Dict]:
        """
        Builds the sequence for the Deep Knowledge Tracing LSTM:
        Combines past answered questions with live cognitive telemetry.
        """
        with self.lock:
            state = self.latest_result.get("attention_state", "Focused")
            m = self.latest_result.get("metrics", {})
            current_snapshot = {
                "attention_state_eye": state,
                "eye_blink_rate": m.get("blink_rate", 18.0),
                "eye_pupil_dilation": m.get("pupil_dilation", 5.0),
                "eye_fixation_duration": m.get("fixation_duration", 400.0),
                "eye_saccade_rate": m.get("saccade_rate", 1.8),
                "eye_gaze_stability": m.get("gaze_stability", 0.92),
                "correct": 1,
                "response_time_s": 15.0,
            }
            if not self.attempt_history:
                return [current_snapshot]
            return list(self.attempt_history) + [current_snapshot]

    def snapshot(self) -> Dict:
        """Consistent copy of state for reading outside the lock."""
        with self.lock:
            return {
                "latest_result": self.latest_result,
                "history": list(self.attempt_history),
                "last_updated": self.last_updated,
            }


active_sessions: Dict[int, UserTelemetrySession] = {}
_sessions_lock = threading.Lock()
_last_cleanup = 0.0


def _evict_stale_sessions_locked(now: float) -> None:
    """Caller must hold _sessions_lock."""
    global _last_cleanup
    if now - _last_cleanup < CLEANUP_INTERVAL_SECONDS:
        return
    _last_cleanup = now
    stale = [uid for uid, s in active_sessions.items() if now - s.last_updated > SESSION_TTL_SECONDS]
    for uid in stale:
        del active_sessions[uid]
    if stale:
        logger.info("Evicted %d idle eye-tracking session(s)", len(stale))


def get_or_create_session(user_id: int) -> UserTelemetrySession:
    now = time.time()
    with _sessions_lock:
        _evict_stale_sessions_locked(now)
        session = active_sessions.get(user_id)
        if session is None:
            session = UserTelemetrySession(user_id)
            active_sessions[user_id] = session
        return session


def get_user_latest_telemetry(user_id: int) -> Dict:
    return get_or_create_session(user_id).snapshot()["latest_result"]


def get_user_eye_history(user_id: int) -> List[Dict]:
    return get_or_create_session(user_id).snapshot()["history"]


def record_question_attempt(user_id: int, attempt_record: Dict) -> None:
    """Stores an actual question attempt into the user's DKT session history."""
    get_or_create_session(user_id).record_attempt(attempt_record)


def _safe_predict(session: UserTelemetrySession) -> float:
    """LSTM inference that uses real question attempts plus live optical telemetry."""
    try:
        from ml.attention_model import predict_risk
        seq = session.get_lstm_sequence()
        return float(predict_risk(seq))
    except Exception:
        logger.exception("predict_risk failed; using fallback")
        return FALLBACK_RISK


# ---------------------------------------------------------------------------
# Auth Dependencies
# ---------------------------------------------------------------------------
def verify_user_ownership(
    user_id: int,
    current_user: Optional[models.User] = Depends(get_current_user),
) -> models.User:
    """
    FastAPI dependency that checks whether the caller owns the specified user_id.
    - Requires an authenticated caller.
    - Matches student caller userId == user_id.
    - Permits authorized parents/teachers if user_id is their linked student.
    """
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required to access eye tracking telemetry."
        )
    if current_user.userId != user_id:
        if current_user.role in ["parent", "teacher"] and current_user.linked_student_id == user_id:
            return current_user
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied: caller does not own user_id={user_id}."
        )
    return current_user


def check_user_ownership(
    target_user_id: int,
    current_user: Optional[models.User],
) -> models.User:
    """Helper to enforce user ownership check for JSON payload bodies."""
    return verify_user_ownership(user_id=target_user_id, current_user=current_user)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@router.post("/frame")
def process_client_frame(
    payload: FramePayload,
    current_user: Optional[models.User] = Depends(get_current_user),
):
    """
    Receives a base64 image frame from the browser webcam,
    runs facial landmark & iris tracking, and updates cognitive state.
    Computes real-time LSTM risk prediction based on the rolling attention sequence.
    """
    check_user_ownership(payload.user_id, current_user)

    # Decode first: bad input is a client error, not a session/tracker failure.
    img_str = payload.image_base64.split(",", 1)[-1]
    try:
        img_bytes = base64.b64decode(img_str, validate=True)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid base64 encoding")

    frame = cv2.imdecode(np.frombuffer(img_bytes, np.uint8), cv2.IMREAD_COLOR)
    if frame is None:
        raise HTTPException(status_code=400, detail="Invalid image encoding")

    session = get_or_create_session(payload.user_id)

    try:
        result = session.update_with_frame(
            frame,
            correct=payload.correct,
            response_time_s=payload.response_time_s,
        )
        prob = _safe_predict(session)
        return {
            "success": True,
            "user_id": payload.user_id,
            "telemetry": result,
            "predicted_probability": round(prob, 3),
        }
    except Exception:
        logger.exception("Frame processing error for user %s", payload.user_id)
        snap = session.snapshot()
        return {
            "success": False,
            "error": "Frame processing failed",  # details are in server logs, not sent to the client
            "telemetry": snap["latest_result"],
            "predicted_probability": round(_safe_predict(session), 3),
        }


@router.get("/status/{user_id}")
def get_status(
    user_id: int,
    _authorized_user: models.User = Depends(verify_user_ownership),
):
    """Returns current real-time attention state & 5 eye tracking metrics."""
    snap = get_or_create_session(user_id).snapshot()
    return {
        "user_id": user_id,
        "telemetry": snap["latest_result"],
        "history_count": len(snap["history"]),
        "last_updated": snap["last_updated"],
    }


@router.post("/simulate")
def simulate_state(
    payload: SimulatePayload,
    current_user: Optional[models.User] = Depends(get_current_user),
):
    """Manual simulation of cognitive states (testing/demoing adaptive Gwen hints)."""
    check_user_ownership(payload.user_id, current_user)

    if not ENABLE_SIMULATION:
        raise HTTPException(status_code=404, detail="Not found")
    if payload.state not in VALID_STATES:
        raise HTTPException(
            status_code=422,
            detail=f"state must be one of {sorted(VALID_STATES)}",
        )

    session = get_or_create_session(payload.user_id)
    session.set_simulated_state(payload.state, payload.blink_rate, payload.pupil_dilation)
    snap = session.snapshot()
    return {
        "success": True,
        "message": f"User {payload.user_id} cognitive state set to {payload.state}",
        "telemetry": snap["latest_result"],
        "predicted_probability": round(_safe_predict(session), 3),
    }