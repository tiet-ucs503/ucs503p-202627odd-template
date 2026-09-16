// 2D joint angle calculations from pose landmarks.
import { POSE_LANDMARKS } from "@shared/exercise-config/landmarks.js";

// Computes 2D joint angle in degrees formed by rays vertex->a and vertex->c.
export function jointAngle2D(a, vertex, c) {
  if (!a || !vertex || !c) return NaN;

  const v1x = a.x - vertex.x;
  const v1y = a.y - vertex.y;
  const v2x = c.x - vertex.x;
  const v2y = c.y - vertex.y;

  const mag1 = Math.hypot(v1x, v1y);
  const mag2 = Math.hypot(v2x, v2y);

  if (mag1 === 0 || mag2 === 0) return NaN;

  const dot = v1x * v2x + v1y * v2y;
  const cos = Math.min(1, Math.max(-1, dot / (mag1 * mag2)));

  return (Math.acos(cos) * 180) / Math.PI;
}

// Checks if landmark visibility meets threshold.
export function landmarkVisibleEnough(landmark, threshold = 0.5) {
  if (!landmark || typeof landmark.visibility !== "number") return false;
  return landmark.visibility >= threshold;
}

// Computes angles for a list of AngleDefs from landmarks.
export function computeAngles(landmarks, angleDefs) {
  const result = {};
  if (!Array.isArray(landmarks) || !Array.isArray(angleDefs)) return result;

  for (const def of angleDefs) {
    const [aName, vertexName, cName] = def.points;
    const aIdx = POSE_LANDMARKS[aName];
    const vIdx = POSE_LANDMARKS[vertexName];
    const cIdx = POSE_LANDMARKS[cName];

    if (aIdx === undefined || vIdx === undefined || cIdx === undefined) {
      result[def.id] = NaN;
      continue;
    }

    result[def.id] = jointAngle2D(landmarks[aIdx], landmarks[vIdx], landmarks[cIdx]);
  }

  return result;
}
