// Canvas rendering for pose landmarks and skeleton lines.
import { POSE_LANDMARKS } from "@shared/exercise-config/landmarks.js";

// Skeleton connections connecting key joints.
const SKELETON_CONNECTIONS = [
  ["LEFT_SHOULDER", "RIGHT_SHOULDER"],
  ["LEFT_SHOULDER", "LEFT_ELBOW"],
  ["LEFT_ELBOW", "LEFT_WRIST"],
  ["RIGHT_SHOULDER", "RIGHT_ELBOW"],
  ["RIGHT_ELBOW", "RIGHT_WRIST"],
  ["LEFT_SHOULDER", "LEFT_HIP"],
  ["RIGHT_SHOULDER", "RIGHT_HIP"],
  ["LEFT_HIP", "RIGHT_HIP"],
  ["LEFT_HIP", "LEFT_KNEE"],
  ["LEFT_KNEE", "LEFT_ANKLE"],
  ["RIGHT_HIP", "RIGHT_KNEE"],
  ["RIGHT_KNEE", "RIGHT_ANKLE"],
];

const DOT_RADIUS = 4;
const DOT_COLOR = "#4ade80";
const LINE_COLOR = "#4ade80";
const LINE_WIDTH = 2;
const MIN_VISIBILITY = 0.5;

// Draws skeleton lines and landmark dots on the canvas context.
export function drawPose(ctx, landmarks, width, height) {
  if (!ctx || !Array.isArray(landmarks) || landmarks.length === 0) return;

  // Draw skeleton connections.
  ctx.save();
  ctx.strokeStyle = LINE_COLOR;
  ctx.lineWidth = LINE_WIDTH;

  for (const [aName, bName] of SKELETON_CONNECTIONS) {
    const a = landmarks[POSE_LANDMARKS[aName]];
    const b = landmarks[POSE_LANDMARKS[bName]];
    if (!a || !b) continue;
    if ((a.visibility ?? 1) < MIN_VISIBILITY || (b.visibility ?? 1) < MIN_VISIBILITY) continue;

    ctx.beginPath();
    ctx.moveTo(a.x * width, a.y * height);
    ctx.lineTo(b.x * width, b.y * height);
    ctx.stroke();
  }

  // Draw landmark dots.
  ctx.fillStyle = DOT_COLOR;
  for (const lm of landmarks) {
    if (!lm || (lm.visibility ?? 1) < MIN_VISIBILITY) continue;
    ctx.beginPath();
    ctx.arc(lm.x * width, lm.y * height, DOT_RADIUS, 0, 2 * Math.PI);
    ctx.fill();
  }

  ctx.restore();
}
