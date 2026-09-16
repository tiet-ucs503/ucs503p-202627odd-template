// Exponential moving average (EMA) smoother for pose landmarks.
import { LANDMARK_COUNT } from "@shared/exercise-config/landmarks.js";
import { landmarkVisibleEnough } from "@/pose/angles.js";

export class LandmarkSmoother {
  constructor({ alpha = 0.5, visibilityThreshold = 0.5 } = {}) {
    if (!(alpha > 0 && alpha <= 1)) {
      throw new Error(`LandmarkSmoother: alpha must be in (0,1], got ${alpha}`);
    }
    this.alpha = alpha;
    this.visibilityThreshold = visibilityThreshold;
    this._state = null;
  }

  // Smooths landmarks using EMA, holding position with stale flag during dropouts.
  smooth(landmarks) {
    const isFrameDropout = !Array.isArray(landmarks) || landmarks.length < LANDMARK_COUNT;

    if (isFrameDropout) {
      if (!this._state) return [];
      // Hold position, report 0 visibility for whole-frame dropout.
      return this._state.map((prev) =>
        prev
          ? { x: prev.x, y: prev.y, z: prev.z, visibility: 0, stale: true }
          : { x: 0, y: 0, z: 0, visibility: 0, stale: true }
      );
    }

    if (!this._state) {
      this._state = new Array(LANDMARK_COUNT).fill(null);
    }

    const out = new Array(LANDMARK_COUNT);
    for (let i = 0; i < LANDMARK_COUNT; i++) {
      const current = landmarks[i];
      const prev = this._state[i];
      const visibleEnough = landmarkVisibleEnough(current, this.visibilityThreshold);

      if (visibleEnough) {
        const smoothed = prev
          ? {
              x: this.alpha * current.x + (1 - this.alpha) * prev.x,
              y: this.alpha * current.y + (1 - this.alpha) * prev.y,
              z: this.alpha * current.z + (1 - this.alpha) * prev.z,
              visibility: current.visibility,
            }
          : {
              x: current.x,
              y: current.y,
              z: current.z,
              visibility: current.visibility,
            };
        this._state[i] = smoothed;
        out[i] = { ...smoothed, stale: false };
      } else if (prev) {
        // Hold last position when current visibility is low.
        out[i] = { x: prev.x, y: prev.y, z: prev.z, visibility: current?.visibility ?? 0, stale: true };
      } else {
        // Fallback for landmark never seen with good confidence.
        out[i] = {
          x: current?.x ?? 0,
          y: current?.y ?? 0,
          z: current?.z ?? 0,
          visibility: current?.visibility ?? 0,
          stale: true,
        };
      }
    }

    return out;
  }

  reset() {
    this._state = null;
  }
}
