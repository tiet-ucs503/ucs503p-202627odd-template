import { describe, it, expect, beforeEach } from "vitest";
import { SquatStateMachine } from "../analysis/SquatStateMachine.js";
import { squatConfig } from "@shared/exercise-config/squat.config.js";

// Subclass for testing to easily mock the angle signal
class MockSquatStateMachine extends SquatStateMachine {
  constructor(config) {
    super(config);
    this.mockAngle = 180;
  }

  _resolveSignal() {
    return this.mockAngle;
  }

  setAngle(angle) {
    this.mockAngle = angle;
  }
}

describe("SquatStateMachine Detailed Transitions", () => {
  let machine;

  beforeEach(() => {
    machine = new MockSquatStateMachine(squatConfig);
  });

  it("should transition from STANDING to DESCENDING", () => {
    machine.reset();
    expect(machine.state).toBe("STANDING");

    // Feed angles: Standing (180) -> Descent (<155) -> DESCENDING
    machine.setAngle(180);
    machine.update({ landmarks: new Array(33).fill({ x: 0, y: 0, z: 0, visibility: 1 }), timestampMs: 0 });
    machine.update({ landmarks: new Array(33).fill({ x: 0, y: 0, z: 0, visibility: 1 }), timestampMs: 33 });
    machine.update({ landmarks: new Array(33).fill({ x: 0, y: 0, z: 0, visibility: 1 }), timestampMs: 66 });

    machine.setAngle(150); // Below 155 threshold
    machine.update({ landmarks: new Array(33).fill({ x: 0, y: 0, z: 0, visibility: 1 }), timestampMs: 99 });
    machine.update({ landmarks: new Array(33).fill({ x: 0, y: 0, z: 0, visibility: 1 }), timestampMs: 132 });
    machine.update({ landmarks: new Array(33).fill({ x: 0, y: 0, z: 0, visibility: 1 }), timestampMs: 165 }); // Commits after minFrames (3)

    expect(machine.state).toBe("DESCENDING");
  });

  it("should dynamically update thresholds from calibrated baseline ROM", () => {
    machine.updateThresholds({ downThresholdDeg: 125, upThresholdDeg: 160 });
    expect(machine._down).toBe(125);
    expect(machine._up).toBe(160);
  });
});
