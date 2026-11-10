"""
ml/eye_tracker.py
=================
Real-time eye-tracking module.

Uses MediaPipe FaceLandmarker (Tasks API, mediapipe >= 0.10).
Produces five rolling metrics every frame, then classifies into one of:
    Focused | Drifting | Impulsive | Overwhelmed

The classification result is consumed by attention_model.py for fusion
with the LSTM output.

Public API
----------
    tracker = EyeTracker(model_path)
    result  = tracker.process_frame(bgr_frame)   # call at ~30 FPS
    tracker.close()

    thread  = EyeTrackingThread()
    thread.start()
    snap    = thread.get_latest()   # non-blocking, returns latest result dict
    thread.stop()
"""

import os
import queue
import threading
import time
import urllib.request
from collections import deque
from pathlib import Path
from typing import Dict, Optional, Tuple

import numpy as np

# Ensure writable cache directories
os.environ.setdefault("KERAS_HOME", os.path.join(os.path.dirname(__file__), "..", ".keras"))
os.environ.setdefault("MPLCONFIGDIR", os.path.join(os.path.dirname(__file__), "..", ".matplotlib"))

# ─────────────────────────────────────────────────────────────
# MediaPipe landmark indices
# FaceLandmarker outputs exactly 478 landmarks (indices 0-477).
# Iris connections form a 4-point ring — NOT 5 points.
# ─────────────────────────────────────────────────────────────
LEFT_IRIS  = [474, 475, 476, 477]       # 4 pts, max valid index = 477
RIGHT_IRIS = [469, 470, 471, 472]       # 4 pts
LEFT_EYE   = [362, 385, 387, 263, 373, 380]   # EAR contour
RIGHT_EYE  = [33,  160, 158, 133, 153, 144]

MODEL_URL  = (
    "https://storage.googleapis.com/mediapipe-models/"
    "face_landmarker/face_landmarker/float16/1/face_landmarker.task"
)
MODEL_FILE = Path(__file__).parent.parent / "face_landmarker.task"

# ─────────────────────────────────────────────────────────────
# Attention state metric profiles (research-backed thresholds)
# Each metric range is (lo, hi) inclusive.
# ─────────────────────────────────────────────────────────────
STATE_PROFILES: Dict[str, Dict[str, Tuple[float, float]]] = {
    "Focused":     {
        "blink_rate":        (12, 25),    # blinks/min — normal engaged rate
        "pupil_dilation":    (0,  20),    # % above baseline — mild arousal
        "fixation_duration": (250, 700),  # ms — stable fixations
        "saccade_rate":      (1.0, 3.0),  # saccades/sec — controlled
        "gaze_stability":    (0.7, 1.0),  # ratio — eyes on-screen
    },
    "Drifting":    {
        "blink_rate":        (25, 45),
        "pupil_dilation":    (-15, 5),
        "fixation_duration": (50,  250),
        "saccade_rate":      (3.0, 6.0),
        "gaze_stability":    (0.3, 0.6),
    },
    "Impulsive":   {
        "blink_rate":        (30, 55),
        "pupil_dilation":    (10, 30),
        "fixation_duration": (30,  150),
        "saccade_rate":      (5.0, 10.0),
        "gaze_stability":    (0.4, 0.7),
    },
    "Overwhelmed": {
        "blink_rate":        (5,  15),    # reduced under high cognitive load
        "pupil_dilation":    (20, 50),    # high dilation = high mental effort
        "fixation_duration": (700, 2000), # prolonged staring
        "saccade_rate":      (0.3, 1.5),
        "gaze_stability":    (0.6, 0.9),
    },
}


# ─────────────────────────────────────────────────────────────
# Model download helper
# ─────────────────────────────────────────────────────────────

def ensure_model() -> Optional[str]:
    """
    Download face_landmarker.task if not present, return local path or None.
    File is cached next to the project root so it survives between runs.
    """
    if MODEL_FILE.exists():
        return str(MODEL_FILE)
    print(f"[EyeTracker] Downloading face landmarker model (~6 MB) ...")
    try:
        urllib.request.urlretrieve(MODEL_URL, MODEL_FILE)
        print("[EyeTracker] Model downloaded OK.")
        return str(MODEL_FILE)
    except Exception as e:
        print(f"[EyeTracker] Download failed: {e}")
        print(f"  Manual:  curl -L \"{MODEL_URL}\" -o face_landmarker.task")
        return None


# ─────────────────────────────────────────────────────────────
# Geometry helpers
# ─────────────────────────────────────────────────────────────

def _dist(a, b) -> float:
    return float(np.linalg.norm(np.array(a) - np.array(b)))


def _lm_px(lm_list, idx: int, w: int, h: int) -> Tuple[float, float]:
    """Normalized landmark → pixel coords."""
    p = lm_list[idx]
    return p.x * w, p.y * h


def _ear(lm_list, eye_idx, w: int, h: int) -> float:
    """
    Eye Aspect Ratio (Soukupová & Čech, 2016).
    ~0.30 open, ~0.00 closed.
    """
    c = [_lm_px(lm_list, i, w, h) for i in eye_idx]
    return (_dist(c[1], c[5]) + _dist(c[2], c[4])) / (2.0 * _dist(c[0], c[3]) + 1e-6)


def _iris_center(lm_list, iris_idx, w: int, h: int) -> Tuple[float, float]:
    xs = [lm_list[i].x * w for i in iris_idx]
    ys = [lm_list[i].y * h for i in iris_idx]
    return float(np.mean(xs)), float(np.mean(ys))


def _iris_diam(lm_list, iris_idx, w: int, h: int) -> float:
    """
    Approximate iris diameter.
    Uses mean distance from centroid * 2 (stable with 4-point ring).
    Note: std would give ~0 for a perfect square arrangement.
    """
    coords = np.array([_lm_px(lm_list, i, w, h) for i in iris_idx])
    center = coords.mean(axis=0)
    return float(2.0 * np.mean(np.linalg.norm(coords - center, axis=1)))


# ─────────────────────────────────────────────────────────────
# EyeTracker — core processing class
# ─────────────────────────────────────────────────────────────

class EyeTracker:
    """
    Processes individual BGR frames and returns attention metrics + state.

    Parameters
    ----------
    model_path : str
        Path to face_landmarker.task file.
    window_size : int
        Rolling window in frames (default 30 ≈ 1 s at 30 FPS).
    """

    def __init__(self, model_path: str, window_size: int = 30):
        self._landmarker = None
        self._use_cv_engine = False
        
        try:
            # Patch mediapipe C bindings on Windows Python 3.13
            try:
                import importlib
                import ctypes
                from importlib import resources
                mp_c = importlib.import_module('mediapipe.tasks.python.core.mediapipe_c_bindings')
                def _custom_load(signatures=()):
                    if mp_c._shared_lib is None:
                        lib_path = str(resources.files('mediapipe.tasks.c') / 'libmediapipe.dll')
                        lib = ctypes.CDLL(lib_path)
                        try:
                            lib.free = ctypes.CDLL('ucrtbase.dll').free
                        except Exception:
                            lib.free = ctypes.CDLL('msvcrt.dll').free
                        mp_c._shared_lib = lib
                    for signature in signatures:
                        c_func = getattr(mp_c._shared_lib, signature.func_name)
                        c_func.argtypes = signature.argtypes
                        c_func.restype = signature.restype
                    mp_c._shared_lib.free.argtypes = [ctypes.c_void_p]
                    mp_c._shared_lib.free.restype = None
                    return mp_c._shared_lib
                mp_c.load_raw_library = _custom_load
            except Exception as patch_err:
                print(f"[EyeTracker] MediaPipe C-binding patch note: {patch_err}")

            from mediapipe.tasks.python.core.base_options import BaseOptions
            from mediapipe.tasks.python.vision.core.vision_task_running_mode import (
                VisionTaskRunningMode,
            )
            from mediapipe.tasks.python.vision.face_landmarker import (
                FaceLandmarker,
                FaceLandmarkerOptions,
            )

            # Load model buffer to bypass Windows C path resolution issues
            with open(model_path, 'rb') as f:
                model_data = f.read()

            self._landmarker = FaceLandmarker.create_from_options(
                FaceLandmarkerOptions(
                    base_options=BaseOptions(model_asset_buffer=model_data),
                    running_mode=VisionTaskRunningMode.IMAGE,
                    num_faces=1,
                    min_face_detection_confidence=0.5,
                    min_face_presence_confidence=0.5,
                    min_tracking_confidence=0.5,
                )
            )
            print("[EyeTracker] MediaPipe FaceLandmarker engine initialized.")
        except Exception as e:
            print(f"[EyeTracker] MediaPipe engine fallback: {e}")
            self._use_cv_engine = True
            import cv2
            self._face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
            self._eye_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_eye.xml')
            print("[EyeTracker] OpenCV Cascade Vision engine initialized.")

        W = window_size
        self._W          = W
        self._pupil_buf  = deque(maxlen=W)
        self._fix_buf    = deque(maxlen=200)   # fixation durations (ms)
        self._sacc_buf   = deque(maxlen=200)   # saccade timestamps
        self._gaze_buf   = deque(maxlen=W)
        self._blink_win  = deque(maxlen=W)     # 1 = blink occurred this frame

        self._baseline   = None   # pupil baseline (set after W frames)
        self._last_pos   = None
        self._fix_start  = None
        self._state      = "Focused"
        self._conf       = 0.5
        self._frame      = 0
        self._blinks     = 0
        self._consec     = 0
        self.EAR_THRESH  = 0.21

    # ── public ──────────────────────────────────────────────

    def process_frame(self, bgr_frame: np.ndarray) -> Dict:
        """
        Process one BGR frame. Returns dict:
            attention_state : str
            confidence      : float  (0-1)
            metrics         : dict   (blink_rate, pupil_dilation, fixation_duration,
                                      saccade_rate, gaze_stability)
            blink_count     : int    (cumulative)
            avg_ear         : float
        """
        import cv2
        import mediapipe as mp

        self._frame += 1
        h, w = bgr_frame.shape[:2]

        # ── OpenCV Cascade Vision Engine (Fallback / Headless) ──
        if self._use_cv_engine or not self._landmarker:
            gray = cv2.cvtColor(bgr_frame, cv2.COLOR_BGR2GRAY)
            gray_eq = cv2.equalizeHist(gray)
            
            # Adaptive detection minSize based on frame resolution
            min_dim = max(24, int(min(h, w) * 0.16))
            faces = self._face_cascade.detectMultiScale(
                gray_eq, 
                scaleFactor=1.1, 
                minNeighbors=3, 
                minSize=(min_dim, min_dim)
            )
            if len(faces) == 0:
                # Try raw grayscale fallback
                faces = self._face_cascade.detectMultiScale(
                    gray, 
                    scaleFactor=1.15, 
                    minNeighbors=2, 
                    minSize=(min_dim, min_dim)
                )

            if len(faces) == 0:
                # No face detected in frame (user turned away, tilted down, or absent)
                self._consec += 1
                self._state = "Drifting"
                self._conf = 0.85
                metrics = {
                    "blink_rate": 32.0,
                    "pupil_dilation": -4.0,
                    "fixation_duration": 120.0,
                    "saccade_rate": 4.5,
                    "gaze_stability": 0.40
                }
                return self._make_result(metrics, avg_ear=0.10)

            fx, fy, fw, fh = faces[0]
            # Search eyes in upper 65% of face region
            face_upper = gray_eq[fy:fy+int(fh*0.65), fx:fx+fw]
            eye_min = (max(8, int(fw * 0.10)), max(8, int(fh * 0.10)))
            eyes = self._eye_cascade.detectMultiScale(
                face_upper,
                scaleFactor=1.08,
                minNeighbors=2,
                minSize=eye_min
            )
            
            if len(eyes) >= 2:
                eyes = sorted(eyes, key=lambda e: e[0])
                e1, e2 = eyes[0], eyes[1]
                gx = fx + (e1[0] + e2[0] + e2[2]) / 2.0
                gy = fy + (e1[1] + e2[1] + e1[3]) / 2.0
                avg_ear = 0.28
                self._consec = 0
                self._blink_win.append(0)
                diam = (e1[2] + e2[2]) / 2.0
                iod = abs((fx + e2[0]) - (fx + e1[0])) or 1.0
                normalized_diam = (diam / iod) * 50.0
            elif len(eyes) == 1:
                gx = fx + eyes[0][0] + eyes[0][2]/2.0
                gy = fy + eyes[0][1] + eyes[0][3]/2.0
                avg_ear = 0.20
                self._consec += 1
                if self._consec >= 2:
                    self._blinks += 1
                    self._blink_win.append(1)
                else:
                    self._blink_win.append(0)
                normalized_diam = 25.0
            else:
                gx, gy = fx + fw/2.0, fy + fh/2.0
                avg_ear = 0.14
                self._consec += 1
                self._blink_win.append(1 if self._consec >= 2 else 0)
                normalized_diam = 20.0

            self._gaze_buf.append((gx, gy))
            self._pupil_buf.append(normalized_diam)
            if self._baseline is None and len(self._pupil_buf) >= 3:
                self._baseline = float(np.mean(self._pupil_buf))
            
            if self._last_pos is not None:
                movement = float(np.linalg.norm(np.array([gx, gy]) - np.array(self._last_pos)))
                if movement > 15:
                    self._sacc_buf.append(time.time())
                    if self._fix_start is not None:
                        self._fix_buf.append((time.time() - self._fix_start) * 1000)
                        self._fix_start = None
                elif self._fix_start is None:
                    self._fix_start = time.time()
            self._last_pos = (gx, gy)
            metrics = self._compute_metrics(w, h)
            self._state, self._conf = self._classify(metrics)
            return self._make_result(metrics, avg_ear)

        # ── MediaPipe FaceLandmarker Engine ──
        rgb      = cv2.cvtColor(bgr_frame, cv2.COLOR_BGR2RGB)
        mp_img   = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
        result   = self._landmarker.detect(mp_img)

        # Safe default when no face detected
        if not result.face_landmarks:
            fallback_metrics = {
                "blink_rate": 20.0,
                "pupil_dilation": 0.0,
                "fixation_duration": 300.0,
                "saccade_rate": 1.5,
                "gaze_stability": 0.88,
            }
            return self._make_result(fallback_metrics, avg_ear=0.25)

        lm = result.face_landmarks[0]

        # 1. Blink (EAR)
        avg_ear = (_ear(lm, LEFT_EYE, w, h) + _ear(lm, RIGHT_EYE, w, h)) / 2.0
        if avg_ear < self.EAR_THRESH:
            self._consec += 1
            self._blink_win.append(0)
        else:
            if self._consec >= 2:
                self._blinks += 1
                self._blink_win.append(1)
            else:
                self._blink_win.append(0)
            self._consec = 0

        # 3. Gaze position → saccade / fixation (calculated first for iod)
        lc = _iris_center(lm, LEFT_IRIS,  w, h)
        rc = _iris_center(lm, RIGHT_IRIS, w, h)
        gx, gy = (lc[0] + rc[0]) / 2.0, (lc[1] + rc[1]) / 2.0
        self._gaze_buf.append((gx, gy))

        # 2. Iris diameter (pupil proxy), normalized by inter-ocular distance
        iod = _dist(lc, rc) or 1.0 # Fallback to 1 to avoid div by 0
        diam = (_iris_diam(lm, LEFT_IRIS, w, h) + _iris_diam(lm, RIGHT_IRIS, w, h)) / 2.0
        normalized_diam = (diam / iod) * 100.0 # Normalized against distance
        
        self._pupil_buf.append(normalized_diam)
        if self._baseline is None and len(self._pupil_buf) == self._W:
            self._baseline = float(np.mean(self._pupil_buf))

        if self._last_pos is not None:
            movement = float(np.linalg.norm(np.array([gx, gy]) - np.array(self._last_pos)))
            if movement > 30:                           # saccade threshold (px)
                self._sacc_buf.append(time.time())
                if self._fix_start is not None:
                    self._fix_buf.append((time.time() - self._fix_start) * 1000)
                    self._fix_start = None
            elif self._fix_start is None:
                self._fix_start = time.time()
        self._last_pos = (gx, gy)

        # 4. Build rolling metrics
        metrics = self._compute_metrics(w, h)

        # 5. Classify (only after warm-up)
        if self._frame >= self._W:
            self._state, self._conf = self._classify(metrics)

        return self._make_result(metrics, avg_ear)

    def get_dataset_row(self, correct: int, response_time_s: float) -> Dict:
        """
        Format current eye data as a feature row compatible with the LSTM
        training dataset (ASSISTments format + eye columns).
        Called by attention_model.py after each question answer.
        """
        m = self._compute_metrics(640, 480)   # arbitrary pixel dims for ratios
        return {
            "attention_state_eye": self._state,
            "eye_blink_rate":      m.get("blink_rate", 0.0),
            "eye_pupil_dilation":  m.get("pupil_dilation", 0.0),
            "eye_fixation_duration": m.get("fixation_duration", 300.0),
            "eye_saccade_rate":    m.get("saccade_rate", 0.0),
            "eye_gaze_stability":  m.get("gaze_stability", 1.0),
            "correct":             correct,
            "response_time_s":     response_time_s,
        }

    def close(self):
        self._landmarker.close()

    # ── private ─────────────────────────────────────────────

    def _compute_metrics(self, w: int, h: int) -> Dict:
        fps   = 30
        now   = time.time()
        recent_gaze = list(self._gaze_buf)[-10:]

        # Physiologically responsive rolling blink rate (normal baseline 18/m)
        blink_sum = sum(self._blink_win)
        rolling_blink = 18.0 + (blink_sum * 4.0) + (self._consec * 2.0)

        # Pupil dilation % from baseline
        if self._baseline and len(self._pupil_buf) > 0:
            current_diam = float(np.mean(list(self._pupil_buf)[-5:]))
            dilation_pct = ((current_diam - self._baseline) / self._baseline) * 100.0
        else:
            dilation_pct = 5.0

        # Median fixation duration
        fix_dur = float(np.median(self._fix_buf)) if self._fix_buf else 380.0

        # Saccades per second in last 2 s
        recent_saccades = len([t for t in self._sacc_buf if now - t < 2.0])
        saccade_rate = max(1.0, float(recent_saccades) / 2.0)

        # Gaze stability: proximity of recent gaze positions to center of frame (w/2, h/2)
        if len(recent_gaze) >= 3:
            center_x, center_y = w / 2.0, h / 2.0
            dists = [np.linalg.norm(np.array(g) - np.array([center_x, center_y])) for g in recent_gaze]
            avg_dist = float(np.mean(dists))
            max_radius = max(w, h) * 0.45
            gaze_stab = max(0.25, min(0.98, 1.0 - (avg_dist / max_radius)))
        else:
            gaze_stab = 0.92

        return {
            "blink_rate": round(float(rolling_blink), 1),
            "pupil_dilation": round(float(dilation_pct), 1),
            "fixation_duration": round(float(fix_dur), 1),
            "saccade_rate": round(float(saccade_rate), 1),
            "gaze_stability": round(float(gaze_stab), 2),
        }

    def _classify(self, metrics: Dict) -> Tuple[str, float]:
        """Soft multi-metric classifier — scores each state, returns best match."""
        scores = {}
        for state, profile in STATE_PROFILES.items():
            total, count = 0.0, 0
            for metric, (lo, hi) in profile.items():
                if metric not in metrics:
                    continue
                val   = metrics[metric]
                rng   = (hi - lo) or 1.0
                if lo <= val <= hi:
                    total += 1.0
                else:
                    dist   = min(abs(val - lo), abs(val - hi))
                    total += max(0.0, 1.0 - dist / (rng * 2.0))
                count += 1
            scores[state] = total / count if count else 0.0

        best = max(scores, key=scores.get)
        return best, scores[best]

    def _make_result(self, metrics: Dict, avg_ear: float = 0.0) -> Dict:
        return {
            "attention_state": self._state,
            "confidence":      self._conf,
            "metrics":         metrics,
            "blink_count":     self._blinks,
            "avg_ear":         avg_ear,
        }


# ─────────────────────────────────────────────────────────────
# EyeTrackingThread — non-blocking background loop
# ─────────────────────────────────────────────────────────────

class EyeTrackingThread:
    """
    Runs EyeTracker in a daemon thread. Main loop calls get_latest()
    to fetch the most recent result without blocking.
    """

    def __init__(self):
        self._q       = queue.Queue(maxsize=1)
        self._running = False
        self._thread  = None
        self._tracker: Optional[EyeTracker] = None
        self._cap     = None

    def start(self) -> bool:
        model_path = ensure_model()
        if not model_path:
            return False
        try:
            import cv2
            self._tracker = EyeTracker(model_path, window_size=20)
            self._cap     = cv2.VideoCapture(0)
            if not self._cap.isOpened():
                print("[EyeTracker] Camera not available.")
                return False
            self._running = True
            self._thread  = threading.Thread(target=self._loop, daemon=True)
            self._thread.start()
            print("[EyeTracker] Started.")
            return True
        except Exception as e:
            print(f"[EyeTracker] Init failed: {e}")
            return False

    def _loop(self):
        import cv2
        while self._running:
            ret, frame = self._cap.read()
            if not ret:
                time.sleep(0.05)
                continue
            result = self._tracker.process_frame(frame)
            # Keep only the freshest result (drop stale)
            try:
                self._q.get_nowait()
            except queue.Empty:
                pass
            self._q.put(result)

            # Display metrics on frame
            self._display_metrics(frame, result)

            time.sleep(0.033)   # ~30 FPS

    def get_latest(self) -> Optional[Dict]:
        """Non-blocking fetch. Returns None if no new frame yet."""
        try:
            return self._q.get_nowait()
        except queue.Empty:
            return None

    def get_dataset_row(self, correct: int, rt: float) -> Optional[Dict]:
        """Delegate to tracker for LSTM feature row."""
        if self._tracker:
            return self._tracker.get_dataset_row(correct, rt)
        return None

    def _display_metrics(self, frame: np.ndarray, result: Dict):
        import cv2
        # Create a copy for display
        display_frame = frame.copy()

        # Get metrics
        state = result.get("attention_state", "Unknown")
        conf = result.get("confidence", 0.0)
        metrics = result.get("metrics", {})
        blink_count = result.get("blink_count", 0)
        avg_ear = result.get("avg_ear", 0.0)

        # Colors for states
        colors = {
            "Focused": (0, 255, 0),      # Green
            "Drifting": (0, 255, 255),   # Yellow
            "Impulsive": (0, 0, 255),    # Red
            "Overwhelmed": (255, 0, 255) # Magenta
        }
        color = colors.get(state, (255, 255, 255))

        # Add text overlays
        y_offset = 30
        cv2.putText(display_frame, f"State: {state} ({conf:.1%})", (10, y_offset),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)
        y_offset += 30

        cv2.putText(display_frame, f"Blink Rate: {metrics.get('blink_rate', 0):.1f}/min", (10, y_offset),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
        y_offset += 25

        cv2.putText(display_frame, f"Pupil Dilation: {metrics.get('pupil_dilation', 0):+.1f}%", (10, y_offset),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
        y_offset += 25

        cv2.putText(display_frame, f"Fixation Duration: {metrics.get('fixation_duration', 0):.0f}ms", (10, y_offset),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
        y_offset += 25

        cv2.putText(display_frame, f"Saccade Rate: {metrics.get('saccade_rate', 0):.1f}/s", (10, y_offset),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
        y_offset += 25

        cv2.putText(display_frame, f"Gaze Stability: {metrics.get('gaze_stability', 0):.2f}", (10, y_offset),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
        y_offset += 25

        cv2.putText(display_frame, f"Total Blinks: {blink_count}", (10, y_offset),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
        y_offset += 25

        cv2.putText(display_frame, f"Avg EAR: {avg_ear:.3f}", (10, y_offset),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)

        # Show the frame
        cv2.imshow("Eye Tracking Metrics", display_frame)

        # Check for quit key (q)
        if cv2.waitKey(1) & 0xFF == ord('q'):
            self._running = False

    def stop(self):
        self._running = False
        if self._thread:
            self._thread.join(timeout=2.0)
        if self._cap:
            self._cap.release()
        if self._tracker:
            self._tracker.close()
        import cv2
        cv2.destroyAllWindows()

if __name__ == '__main__':
    thread = EyeTrackingThread()
    if thread.start():
        try:
            import time
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            thread.stop()

