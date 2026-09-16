// Config-driven rep-counting finite state machine for squats.
import { LANDMARK_COUNT, POSE_LANDMARKS } from "@shared/exercise-config/landmarks.js";
import { computeAngles, landmarkVisibleEnough } from "@/pose/angles.js";

// Checks if all points of an angle definition meet visibility threshold.
function tripletVisible(landmarks, angleDef, visibilityThreshold) {
  return angleDef.points.every((name) => {
    const idx = POSE_LANDMARKS[name];
    if (idx === undefined) return false;
    return landmarkVisibleEnough(landmarks[idx], visibilityThreshold);
  });
}

export class SquatStateMachine {
  constructor(config, { visibilityThreshold } = {}) {
    if (!config || !Array.isArray(config.drivingAngles) || !config.repCycleThresholds) {
      throw new Error("SquatStateMachine: config must be an ExerciseConfig with drivingAngles + repCycleThresholds");
    }
    this.config = config;
    this.visibilityThreshold = visibilityThreshold ?? config.visibilityThreshold ?? 0.5;

    const { signal, downThresholdDeg, upThresholdDeg, minFrames } = config.repCycleThresholds;
    this._signal = signal;
    this._down = downThresholdDeg;
    this._up = upThresholdDeg;
    this._minFrames = minFrames;

    this._byId = new Map(config.drivingAngles.map((def) => [def.id, def]));
    this._composites = config.compositeAngles ?? [];

    const cycle = config.repCycle || ["STANDING", "DESCENDING", "BOTTOM", "ASCENDING"];
    this._startState = cycle[0];
    this._motionState = cycle[1];
    this._inflectionState = cycle[2];
    this._returnState = cycle[3];

    this.state = config.states?.[0]?.name ?? this._startState;
    this.repCount = 0;

    this._pendingTarget = null;
    this._pendingCount = 0;
    this._transitionLog = [];
    this._reps = [];

    this._resetInProgressRep();
  }

  // Resets in-progress rep tracking variables.
  _resetInProgressRep() {
    this._curStartMs = null;
    this._curMin = Infinity;
    this._curMinMs = null;
    this._curSeries = [];
  }

  // Resolves the composite driving angle for the current frame.
  _resolveSignal(landmarks) {
    const composite = this._composites.find((c) => c.id === this._signal);

    if (!composite) {
      const def = this._byId.get(this._signal);
      if (!def) return NaN;
      if (!tripletVisible(landmarks, def, this.visibilityThreshold)) return NaN;
      const raw = computeAngles(landmarks, [def]);
      return raw[def.id];
    }

    const visibleIds = composite.from.filter((id) => {
      const def = this._byId.get(id);
      return def && tripletVisible(landmarks, def, this.visibilityThreshold);
    });
    if (visibleIds.length === 0) return NaN;

    const defs = visibleIds.map((id) => this._byId.get(id));
    const raw = computeAngles(landmarks, defs);
    const values = visibleIds.map((id) => raw[id]).filter((v) => !Number.isNaN(v));
    if (values.length === 0) return NaN;

    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  // Determines next candidate state based on current angle and hysteresis thresholds.
  _decideTarget(state, angle) {
    const { _down: down, _up: up } = this;
    switch (state) {
      case "STANDING":
        return angle < up ? "DESCENDING" : "STANDING";
      case "DESCENDING":
        if (angle < down) return "BOTTOM";
        if (angle >= up) return "STANDING";
        return "DESCENDING";
      case "BOTTOM":
        return angle >= down ? "ASCENDING" : "BOTTOM";
      case "ASCENDING":
        if (angle >= up) return "STANDING";
        if (angle < down) return "BOTTOM";
        return "ASCENDING";
      default:
        return state;
    }
  }

  // Advances the state machine with one frame of landmarks.
  update({ landmarks, timestampMs }) {
    if (!Array.isArray(landmarks) || landmarks.length < LANDMARK_COUNT) {
      return;
    }

    const angle = this._resolveSignal(landmarks);
    if (Number.isNaN(angle)) {
      return;
    }

    // Track frame samples into active rep.
    if (this.state !== this._startState) {
      this._curSeries.push({ t: timestampMs, angle });
      if (angle < this._curMin) {
        this._curMin = angle;
        this._curMinMs = timestampMs;
      }
    }

    const target = this._decideTarget(this.state, angle);

    if (target === this.state) {
      this._pendingTarget = null;
      this._pendingCount = 0;
      return;
    }

    if (target === this._pendingTarget) {
      this._pendingCount += 1;
    } else {
      this._pendingTarget = target;
      this._pendingCount = 1;
    }

    if (this._pendingCount < this._minFrames) {
      return;
    }

    // Commit state transition.
    const fromState = this.state;
    this.state = target;
    this._pendingTarget = null;
    this._pendingCount = 0;
    this._transitionLog.push({ fromState, toState: target, timestampMs, kneeAngle: angle });

    if (target === this._motionState) {
      this._curStartMs = timestampMs;
      this._curMin = angle;
      this._curMinMs = timestampMs;
      this._curSeries = [{ t: timestampMs, angle }];
      return;
    }

    if (target === this._startState) {
      if (fromState === this._returnState) {
        this.repCount += 1;
        const seriesValues = this._curSeries.map((s) => s.angle);
        this._reps.push({
          repNumber: this.repCount,
          startMs: this._curStartMs,
          endMs: timestampMs,
          bottomMs: this._curMinMs,
          minAngleDeg: this._curMin,
          peakAngleDeg: seriesValues.length ? Math.max(...seriesValues) : angle,
          series: { [this._signal]: seriesValues },
        });
      }
      this._resetInProgressRep();
    }
  }

  // Returns a copy of the state transition history.
  getTransitionLog() {
    return this._transitionLog.slice();
  }

  // Returns a copy of completed reps.
  getReps() {
    return this._reps.slice();
  }

  // Updates rep detection thresholds dynamically from calibrated baseline ROM.
  updateThresholds({ downThresholdDeg, upThresholdDeg }) {
    if (typeof downThresholdDeg === "number" && !Number.isNaN(downThresholdDeg)) {
      this._down = downThresholdDeg;
    }
    if (typeof upThresholdDeg === "number" && !Number.isNaN(upThresholdDeg)) {
      this._up = upThresholdDeg;
    }
  }

  // Resets the state machine to initial standing state.
  reset() {
    this.state = this.config.states?.[0]?.name ?? this._startState;
    this.repCount = 0;
    this._pendingTarget = null;
    this._pendingCount = 0;
    this._transitionLog = [];
    this._reps = [];
    this._resetInProgressRep();
  }
}

export const ExerciseStateMachine = SquatStateMachine;
