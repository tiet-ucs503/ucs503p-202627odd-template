# 03: Incomplete and Duplicate Squat Repetitions

**Author:** Divjot Singh  
**Roll No.:** 1024031026  
**Module:** Squat Repetition State Machine  

## Error:

A frame-by-frame threshold could count warmup movement as a squat, count one repetition more than once, or count an incomplete final descent.

## Relevant Context

A squat cycle moves from an upright standing position through descent into bottom depth, followed by ascent back to standing. The detector must recognize that progression across consecutive frames while ignoring jitter and shallow knee bends.

## Key Observation

Repetition counting requires hysteresis and memory of movement direction. A single threshold cannot distinguish whether the lifter is entering a squat or returning from one.

## Solution

The repetition detector was structured as a finite state machine:

```text
STANDING → DESCENDING → BOTTOM → ASCENDING → STANDING
```

The state machine requires a knee angle below the downward threshold (for example, 100 degrees) to enter the bottom phase, and a knee angle above the upward threshold (for example, 160 degrees) to complete the repetition.

State transitions are evaluated sequentially:

```javascript
if (state === "STANDING" && knee_angle < down_threshold) {
    state = "DESCENDING"
}

if (state === "DESCENDING" && knee_angle <= bottom_threshold) {
    state = "BOTTOM"
}

if (state === "BOTTOM" && knee_angle > up_threshold) {
    state = "ASCENDING"
}

if (state === "ASCENDING" && knee_angle > up_threshold) {
    state = "STANDING"
    reps.push(current_rep)
}
```

The real implementation also requires stable transitions for a minimum number of frames and records `start_ms`, `bottom_ms`, `end_ms`, `min_angle_deg`, and `peak_angle_deg` for each completed repetition. Replay fixtures are passed through the same pipeline as camera frames, making the counts reproducible without a live camera.

## Because

Separate down and up thresholds prevent oscillation around one boundary. Requiring a complete return to standing excludes truncated movements, while allowing shallow cycles to be counted preserves the distinction between volume and form quality.
