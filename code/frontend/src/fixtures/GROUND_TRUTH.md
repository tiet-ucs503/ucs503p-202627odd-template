# Ground truth for real-squat fixtures

Both fixtures were produced by `tools/extract_landmarks.py` running MediaPipe
Pose (legacy `mp.solutions.pose`, `model_complexity=1`) frame-by-frame over a
real video (see `data/videos/SOURCES.md` for sources/licenses). Rep counts
below were derived independently of the app's rep-counter: a 2D knee angle
was computed per frame as the angle at the knee between hip(23/24),
knee(25/26), and ankle(27/28) landmarks (left/right averaged when both
detected), then reps were counted with a simple standing/deep state machine
(enter "deep" when angle drops below a threshold, close a rep when it rises
back above a higher "standing" threshold).

## real-squat-good.json

- Source: `squat-demo.webm` (Wikimedia Commons, CC BY 3.0 — FitnessScape)
- Frames: 213, fps: 30.0, duration: ~7.1s
- View: three-quarter/back view, barbell back squat, static camera
- Pose detection: 213/213 frames (100%) — no dropout
- Knee angle range: ~56.4° (deepest) to ~178.5° (standing)
- Derived rep count (deep threshold < 100°, standing threshold > 160°): **2 reps**
  (minima ~56.4°, ~65.5°)
- Stated count in source description: not specified (short demo clip, not a set)
- Caveats: very short clip (2 reps only); back/three-quarter view rather than
  pure side-on, but MediaPipe tracks it cleanly throughout.

## real-squat-shallow.json

- Source: `half-squat-cdc.webm` (Wikimedia Commons, public domain — US CDC),
  truncated to the first ~36s (see SOURCES.md — the source video cuts to an
  unrelated wall-sit segment after that, which was dropped)
- Frames: 539, fps: ~14.985 (downsampled from native ~29.97 fps), duration: ~36.0s
- View: front-facing, bodyweight half/partial squat, static camera
- Pose detection: 537/539 frames (~99.6%) — one single-frame dropout at ~16.6s
- Knee angle range: ~87.3° (deepest) to ~179.6° (standing) — i.e. this
  exercise is intentionally NOT as deep as a full squat (contrast with
  real-squat-good.json's ~56° minimum), consistent with it being a "half
  squat"
- Derived rep count (deep threshold < 150°, standing threshold > 165°): **3 reps**
  (minima ~87.3°, ~109.6°, ~94.2°)
- A 4th descent begins around t=32s (min ~89° at t=34.6s) but the clip is
  truncated mid-recovery (angle still ~140° at the last frame, t=35.9s) — this
  4th rep is correctly NOT counted as complete by the state machine, and was
  left in the fixture as trailing partial motion (not trimmed further).
- Stated count in source description: not specified (general "half squat"
  demo, no rep count claimed)
- Caveats: front-on camera view flattens the true sagittal knee angle
  somewhat compared to a side view, and there's a brief non-squat arm-raise
  warmup in the first ~6s of the clip (no dip below 150°, so it doesn't
  register as a rep).
