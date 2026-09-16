# 02: Landmark Jitter, Dropout, and Index Stability

**Author:** Lakshay Gambhir  
**Roll No.:** 102401026  
**Module:** Landmark Temporal Smoothing & Visibility Filtering  

## Error:

Raw MediaPipe landmarks fluctuated between frames, and missing landmarks could produce invalid angles or shift landmark indexes during smoothing.

## Relevant Context

The analysis pipeline consumes coordinates for hips, knees, ankles, and shoulders to evaluate depth and torso lean. Camera noise and occlusion introduce high-frequency flutter, which can trigger premature state-machine transitions or distort minimum angle calculations.

## Key Observation

Raw coordinate noise must be filtered before angles are computed, not after. In addition, temporal smoothing must preserve absolute landmark positions by index rather than operating on a condensed list of visible points.

## Solution

An exponential moving average (EMA) smoother was added between pose estimation and angle calculation:

```text
smoothed = alpha * current + (1 - alpha) * previous
```

An alpha value of 0.6 balances responsiveness against noise reduction. Landmarks below the visibility threshold (0.5) retain their previous smoothed position for a short timeout window before being marked absent.

The smoother maintains a fixed-length array corresponding to the 33 standard pose indexes:

```javascript
function smoothLandmarks(raw_landmarks, previous_landmarks, alpha = 0.6) {
    return raw_landmarks.map((current, index) => {
        const prev = previous_landmarks[index]
        if (!prev || current.visibility < 0.5) {
            return prev || current
        }
        return {
            x: alpha * current.x + (1 - alpha) * prev.x,
            y: alpha * current.y + (1 - alpha) * prev.y,
            z: alpha * current.z + (1 - alpha) * prev.z,
            visibility: current.visibility,
        }
    })
}
```

Angles are only calculated when all three required landmarks meet the minimum confidence threshold:

```javascript
if (hip.visibility >= 0.5 && knee.visibility >= 0.5 && ankle.visibility >= 0.5) {
    knee_angle = calculate_angle(hip, knee, ankle)
}
```

## Because

Applying EMA per landmark index maintains frame-to-frame stability without introducing perceptible lag. Holding low-confidence landmarks momentarily prevents temporary dropouts from corrupting downstream state transitions.
