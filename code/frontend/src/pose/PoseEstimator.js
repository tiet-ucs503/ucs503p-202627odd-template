// Wrapper around @mediapipe/tasks-vision PoseLandmarker.
import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";

const WASM_FILESET_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm";

export class PoseEstimator {
  constructor(landmarker) {
    this._landmarker = landmarker;
  }

  static async create({ modelAssetPath = "/models/pose_landmarker_lite.task", numPoses = 1 } = {}) {
    let vision;
    try {
      vision = await FilesetResolver.forVisionTasks(WASM_FILESET_URL);
    } catch (err) {
      throw new Error(`PoseEstimator: failed to load MediaPipe WASM fileset: ${err.message}`);
    }

    let landmarker;
    try {
      landmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath },
        runningMode: "VIDEO",
        numPoses,
      });
    } catch (err) {
      throw new Error(
        `PoseEstimator: failed to load pose model at "${modelAssetPath}": ${err.message}`
      );
    }

    return new PoseEstimator(landmarker);
  }

  // Detects pose landmarks for the current video frame.
  detectForVideo(videoEl, timestampMs) {
    if (!this._landmarker) return [];

    const result = this._landmarker.detectForVideo(videoEl, timestampMs);
    const normalizedLandmarks = result?.landmarks?.[0];
    if (!normalizedLandmarks || normalizedLandmarks.length === 0) return [];

    return normalizedLandmarks.map((lm) => ({
      x: lm.x,
      y: lm.y,
      z: lm.z,
      visibility: lm.visibility ?? 0,
    }));
  }

  close() {
    if (this._landmarker) {
      this._landmarker.close();
      this._landmarker = null;
    }
  }
}
