// Adapts live camera feed and pose estimator to the FrameSource interface.
export class CameraFrameSource {
  constructor(poseEstimator, videoEl) {
    this._estimator = poseEstimator;
    this._video = videoEl;
  }

  // Detects landmarks for the current live frame.
  next() {
    const timestampMs = performance.now();
    const landmarks = this._estimator.detectForVideo(this._video, timestampMs);
    return { landmarks, timestampMs };
  }
}
