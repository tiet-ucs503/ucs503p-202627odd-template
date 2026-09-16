// Unit tests for CalibrationEngine limb ratios, ROM, and torso lean calculations.
import { describe, it, expect } from "vitest";
import { CalibrationEngine, euclideanDistance } from "@/analysis/CalibrationEngine.js";
import { POSE_LANDMARKS } from "@shared/exercise-config/landmarks.js";

describe("CalibrationEngine", () => {
  it("calculates euclidean distance correctly", () => {
    const p1 = { x: 0, y: 0 };
    const p2 = { x: 3, y: 4 };
    expect(euclideanDistance(p1, p2)).toBe(5);
  });

  it("computes limb ratios from standing frames", () => {
    const engine = new CalibrationEngine();

    // Fabricate standing pose frame
    const frame = Array(33).fill({ x: 0, y: 0, z: 0, visibility: 1 });
    frame[POSE_LANDMARKS.LEFT_SHOULDER] = { x: 0.5, y: 0.2, z: 0, visibility: 1 };
    frame[POSE_LANDMARKS.LEFT_HIP] = { x: 0.5, y: 0.4, z: 0, visibility: 1 }; // torso = 0.2
    frame[POSE_LANDMARKS.LEFT_KNEE] = { x: 0.5, y: 0.6, z: 0, visibility: 1 }; // femur = 0.2 (ratio = 1.0)
    frame[POSE_LANDMARKS.LEFT_ANKLE] = { x: 0.5, y: 0.78, z: 0, visibility: 1 }; // shin = 0.18 (ratio = 0.9)

    engine.addStandingFrame(frame);
    const ratios = engine.computeLimbRatios();
    expect(ratios.femurToTorso).toBe(1.0);
    expect(ratios.shinToTorso).toBe(0.9);
  });

  it("generates complete UserBaseline object", () => {
    const engine = new CalibrationEngine();
    const frame = Array(33).fill({ x: 0, y: 0, z: 0, visibility: 1 });
    frame[POSE_LANDMARKS.LEFT_SHOULDER] = { x: 0.5, y: 0.2, z: 0, visibility: 1 };
    frame[POSE_LANDMARKS.LEFT_HIP] = { x: 0.5, y: 0.4, z: 0, visibility: 1 };
    frame[POSE_LANDMARKS.LEFT_KNEE] = { x: 0.5, y: 0.6, z: 0, visibility: 1 };
    frame[POSE_LANDMARKS.LEFT_ANKLE] = { x: 0.5, y: 0.8, z: 0, visibility: 1 };

    engine.addStandingFrame(frame);
    engine.addBottomFrame(frame);

    const baseline = engine.generateBaseline();
    expect(baseline.limbRatios).toBeDefined();
    expect(baseline.rom).toBeDefined();
    expect(baseline.angleStats).toBeDefined();
    expect(typeof baseline.calibratedAt).toBe("string");
  });

  // Fix 5: Torso lean calibration
  it("computes typical torso lean from bottom frames", () => {
    const engine = new CalibrationEngine();

    // Frame with an upright torso (shoulder directly above hip) — near 0° lean
    const uprightFrame = Array(33).fill({ x: 0, y: 0, z: 0, visibility: 0 });
    uprightFrame[POSE_LANDMARKS.LEFT_SHOULDER] = { x: 0.5, y: 0.2, z: 0, visibility: 1.0 };
    uprightFrame[POSE_LANDMARKS.LEFT_HIP] = { x: 0.5, y: 0.5, z: 0, visibility: 1.0 };
    engine.addBottomFrame(uprightFrame);

    const lean = engine.computeTorsoLean();
    expect(lean).not.toBeNull();
    // Upright torso should have near-zero lean
    expect(lean).toBeLessThan(5);
  });

  it("computes non-zero torso lean for forward-leaning frames", () => {
    const engine = new CalibrationEngine();

    // Frame with forward lean — shoulder ahead of hip horizontally
    const leanFrame = Array(33).fill({ x: 0, y: 0, z: 0, visibility: 0 });
    leanFrame[POSE_LANDMARKS.LEFT_SHOULDER] = { x: 0.6, y: 0.2, z: 0, visibility: 1.0 };
    leanFrame[POSE_LANDMARKS.LEFT_HIP] = { x: 0.5, y: 0.5, z: 0, visibility: 1.0 };
    engine.addBottomFrame(leanFrame);

    const lean = engine.computeTorsoLean();
    expect(lean).not.toBeNull();
    expect(lean).toBeGreaterThan(5); // Definitely leaning
  });

  it("rejects low-visibility frames from torso lean calculation", () => {
    const engine = new CalibrationEngine();

    // Frame with low visibility shoulder
    const badFrame = Array(33).fill({ x: 0, y: 0, z: 0, visibility: 0.1 });
    badFrame[POSE_LANDMARKS.LEFT_SHOULDER] = { x: 0.6, y: 0.2, z: 0, visibility: 0.2 };
    badFrame[POSE_LANDMARKS.LEFT_HIP] = { x: 0.5, y: 0.5, z: 0, visibility: 0.9 };
    engine.addBottomFrame(badFrame);

    const lean = engine.computeTorsoLean();
    expect(lean).toBeNull(); // Should reject frame
  });

  it("includes typicalTorsoLean in generated baseline", () => {
    const engine = new CalibrationEngine();

    const frame = Array(33).fill({ x: 0, y: 0, z: 0, visibility: 0 });
    frame[POSE_LANDMARKS.LEFT_SHOULDER] = { x: 0.55, y: 0.2, z: 0, visibility: 1.0 };
    frame[POSE_LANDMARKS.LEFT_HIP] = { x: 0.5, y: 0.5, z: 0, visibility: 1.0 };
    frame[POSE_LANDMARKS.LEFT_KNEE] = { x: 0.5, y: 0.7, z: 0, visibility: 1.0 };
    frame[POSE_LANDMARKS.LEFT_ANKLE] = { x: 0.5, y: 0.9, z: 0, visibility: 1.0 };

    engine.addStandingFrame(frame);
    engine.addBottomFrame(frame);

    const baseline = engine.generateBaseline();
    // Torso lean should now be in both rom and angleStats
    expect(baseline.rom.typicalTorsoLean).toBeDefined();
    expect(baseline.rom.typicalTorsoLean).toBeGreaterThan(0);
    expect(baseline.angleStats.typical_torso_lean).toBeDefined();
    expect(baseline.angleStats.typical_torso_lean).toBe(baseline.rom.typicalTorsoLean);
  });

  it("returns null torso lean when no bottom frames are added", () => {
    const engine = new CalibrationEngine();
    expect(engine.computeTorsoLean()).toBeNull();
  });
});
