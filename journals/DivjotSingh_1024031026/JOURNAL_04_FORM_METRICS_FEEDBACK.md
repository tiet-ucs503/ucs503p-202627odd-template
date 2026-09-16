# 04: Form Rules, Metrics, and Unstable Feedback

**Author:** Divjot Singh  
**Roll No.:** 1024031026  
**Module:** Biomechanics Form Rules, Metrics Engine & Feedback Selection  

## Error:

The application could count repetitions correctly while still failing to distinguish poor depth, excessive torso lean, or uncontrolled tempo. Multiple simultaneous cues could also flicker rapidly on screen.

## Relevant Context

Completed repetitions contain angle histories and timestamps. These are consumed by the form-rule engine, metrics engine, and feedback selector.

## Key Observation

Repetition detection should define when a rep happened; form analysis should decide how well it was performed. Combining those responsibilities makes shallow but complete movements disappear from the workout record.

## Solution

The system evaluates completed repetitions using configuration-driven rules for depth and torso lean, then computes duration, ROM, and tempo. Tempo is the descent-to-ascent ratio:

```text
tempo = descent duration / ascent duration
```

Feedback is ranked by severity and debounced for 1500 milliseconds. Only the highest-priority active cue is displayed at a time.

The rules are read from exercise configuration rather than duplicated inside the evaluation engine:

```javascript
const rules = {
    depth: {
        min_angle_deg: 90,
        severity: "high",
        cue: "Squat deeper - hips below knees",
    },
    torso_lean: {
        max_angle_deg: 20,
        severity: "medium",
        cue: "Keep torso more upright",
    },
}
```

The repetition metrics are derived from the recorded segment:

```javascript
const duration_seconds = (end_ms - start_ms) / 1000
const rom_value = peak_angle_deg - min_angle_deg
const tempo = (bottom_ms - start_ms) / (end_ms - bottom_ms)
```

The feedback selector sorts failed rules by severity and keeps the active cue until the debounce interval expires. This prevents a high-priority warning from being replaced immediately by a lower-priority warning caused by a noisy frame.

## Because

Separating rules from the state machine keeps the system extensible. Configuration-driven thresholds avoid magic numbers, while severity ranking and debouncing provide one stable correction instead of competing or flickering messages.
