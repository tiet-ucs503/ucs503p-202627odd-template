// Coarse exercise verification gate for squat movements.
import { POSE_LANDMARKS, LANDMARK_COUNT } from "@shared/exercise-config/landmarks.js";
import { jointAngle2D, landmarkVisibleEnough } from "@/pose/angles.js";
import { RollingBuffer } from "@/analysis/RollingBuffer.js";

const LEG_TRIPLETS = [
  [POSE_LANDMARKS.LEFT_HIP, POSE_LANDMARKS.LEFT_KNEE, POSE_LANDMARKS.LEFT_ANKLE],
  [POSE_LANDMARKS.RIGHT_HIP, POSE_LANDMARKS.RIGHT_KNEE, POSE_LANDMARKS.RIGHT_ANKLE],
];

export class ExerciseVerifier {
  constructor({
    bufferCapacity = 30,
    visibilityThreshold = 0.5,
    visibleRatioThreshold = 0.7,
    angleRangeThreshold = 20,
  } = {}) {
    this.visibilityThreshold = visibilityThreshold;
    this.visibleRatioThreshold = visibleRatioThreshold;
    this.angleRangeThreshold = angleRangeThreshold;
    this._buffer = new RollingBuffer(bufferCapacity);
  }

  // Updates rolling buffer with current frame landmarks.
  update(landmarks) {
    const record = { visible: false, angle: NaN };

    if (Array.isArray(landmarks) && landmarks.length >= LANDMARK_COUNT) {
      const angles = [];
      for (const [hipIdx, kneeIdx, ankleIdx] of LEG_TRIPLETS) {
        const hip = landmarks[hipIdx];
        const knee = landmarks[kneeIdx];
        const ankle = landmarks[ankleIdx];
        const legVisible =
          landmarkVisibleEnough(hip, this.visibilityThreshold) &&
          landmarkVisibleEnough(knee, this.visibilityThreshold) &&
          landmarkVisibleEnough(ankle, this.visibilityThreshold);

        if (legVisible) {
          record.visible = true;
          const a = jointAngle2D(hip, knee, ankle);
          if (!Number.isNaN(a)) angles.push(a);
        }
      }

      if (angles.length > 0) {
        record.angle = angles.reduce((sum, a) => sum + a, 0) / angles.length;
      }
    }

    this._buffer.push(record);
  }

  // Returns current verification metrics, reason string, and boolean gate status.
  getStatus() {
    const records = this._buffer.toArray();

    if (records.length === 0) {
      return { verified: false, reason: "no frames observed yet", visibleRatio: 0, angleRange: 0 };
    }

    const visibleCount = records.filter((r) => r.visible).length;
    const visibleRatio = visibleCount / records.length;

    const angles = records.filter((r) => r.visible && !Number.isNaN(r.angle)).map((r) => r.angle);
    const angleRange = angles.length > 0 ? Math.max(...angles) - Math.min(...angles) : 0;

    if (visibleRatio < this.visibleRatioThreshold) {
      return {
        verified: false,
        reason: `lower body not visible enough (visibleRatio=${visibleRatio.toFixed(2)} < ${this.visibleRatioThreshold})`,
        visibleRatio,
        angleRange,
      };
    }

    if (angleRange < this.angleRangeThreshold) {
      return {
        verified: false,
        reason: `no meaningful knee-angle movement detected (angleRange=${angleRange.toFixed(1)} < ${this.angleRangeThreshold})`,
        visibleRatio,
        angleRange,
      };
    }

    return {
      verified: true,
      reason: "lower body visible and knee angle shows squat-like movement",
      visibleRatio,
      angleRange,
    };
  }

  // Resets the internal frame buffer.
  reset() {
    this._buffer.clear();
  }
}
