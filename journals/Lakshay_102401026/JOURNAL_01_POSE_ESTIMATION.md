# 01: Browser Pose Estimation and Camera Initialization

**Author:** Lakshay Gambhir  
**Roll No.:** 102401026  
**Module:** Video Capture & Pose Landmarker Pipeline  

## Error:

The application could fail to display a usable interface when camera access was denied, the pose model was missing, or the MediaPipe runtime failed to load.

## Relevant Context

The first implementation connected `getUserMedia`, MediaPipe PoseLandmarker, canvas rendering, and live joint-angle calculation inside the camera component. The browser camera and pose model have separate failure modes, so treating them as one initialization step made errors difficult to explain.

## Key Observation

Camera access, model initialization, and frame processing are independent operations. A camera can be available even when the pose model is not, and the interface should remain visible in both cases.

## Solution

The camera flow was separated into explicit states:

```text
requesting → running
requesting → denied
requesting → no-device
running → model-error
```

Camera initialization is completed first. MediaPipe is then initialized with its own error handling. The canvas dimensions are synchronized with the video’s intrinsic dimensions before normalized landmarks are drawn.

The pose-estimation boundary follows a small lifecycle:

```javascript
const pose_estimator = await PoseEstimator.create()
const result = pose_estimator.detectForVideo(video, timestamp_ms)
draw_landmarks(canvas, result.landmarks)
pose_estimator.close()
```

The camera loop only processes a frame when the video is ready and passes the timestamp into the pose estimator. Model-loading failures are stored as a dedicated UI state instead of being allowed to reject the entire component.

Normalized landmarks are converted to canvas coordinates only at draw time:

```javascript
const x = landmark.x * canvas.width
const y = landmark.y * canvas.height
```

This keeps the analysis data independent of the browser window size while allowing the overlay to match the actual video dimensions.

## Because

Separating camera and model state prevents a missing model from producing a blank screen. It also gives users a meaningful error message and keeps the application testable in browsers without a physical camera.
