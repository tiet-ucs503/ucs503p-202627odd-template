// Squat exercise configuration.

// Driving joint angles for squat analysis.
const drivingAngles = [
  { id: "knee_left", points: ["LEFT_HIP", "LEFT_KNEE", "LEFT_ANKLE"], plane: "2d" },
  { id: "knee_right", points: ["RIGHT_HIP", "RIGHT_KNEE", "RIGHT_ANKLE"], plane: "2d" },
];

// Composite bilateral angle averaging both knees or falling back to the visible leg.
const compositeAngles = [
  { id: "knee", from: ["knee_left", "knee_right"] },
];

// State definitions for rep cycle.
const states = [
  { name: "STANDING", enterWhen: { signal: "knee", op: ">", value: 155, hysteresis: 7.5, minFrames: 3 } },
  { name: "DESCENDING", enterWhen: { signal: "knee", op: "<", value: 155, hysteresis: 7.5, minFrames: 3 } },
  { name: "BOTTOM", enterWhen: { signal: "knee", op: "<", value: 140, hysteresis: 7.5, minFrames: 3 } },
  { name: "ASCENDING", enterWhen: { signal: "knee", op: ">", value: 140, hysteresis: 7.5, minFrames: 3 } },
];

export const squatConfig = {
  id: "squat",
  label: "Squat",
  displayName: "Squat",
  enabled: true,
  drivingAngles,
  compositeAngles,
  verification: { dominantMotion: "hip_knee", minAmplitudeDeg: 20 },
  states,
  repCycle: ["STANDING", "DESCENDING", "BOTTOM", "ASCENDING"],
  repCycleThresholds: {
    signal: "knee",
    downThresholdDeg: 140,
    upThresholdDeg: 155,
    minFrames: 3,
  },
  rules: {
    depth: { enabled: true, minAngleDeg: 90, tolerance: 5, safetyFloor: 70, cue: "Squat deeper - hips below knees" },
    torso_lean: { enabled: true, maxAngleDeg: 20, tolerance: 3, safetyCeiling: 35, cue: "Keep torso more upright" },
  },
  tempoBounds: { minSec: 0.5, maxSec: 12 },
  scoreWeights: {
    depth: 0.35,
    knee_valgus: 0.25,
    torso_lean: 0.25,
    tempo: 0.15,
  },
  visibilityThreshold: 0.5,
};

export default squatConfig;
