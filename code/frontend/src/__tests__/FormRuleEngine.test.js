import { describe, it, expect } from "vitest";
import { FormRuleEngine } from "../analysis/FormRuleEngine";

describe("FormRuleEngine", () => {
  const engine = new FormRuleEngine();

  it("should fail depth rule if minAngleDeg is too high", () => {
    const rep = { minAngleDeg: 100 }; // threshold is 90
    const results = engine.evaluate(rep);
    const depthRule = results.find((r) => r.ruleId === "depth");
    expect(depthRule.pass).toBe(false);
  });

  it("should pass depth rule if minAngleDeg is sufficient", () => {
    const rep = { minAngleDeg: 80 }; // threshold is 90
    const results = engine.evaluate(rep);
    const depthRule = results.find((r) => r.ruleId === "depth");
    expect(depthRule.pass).toBe(true);
  });

  // Fix 3: Personalized depth with correct logic (no Math.min bug)
  it("should use calibrated depth with tolerance and safety floor", () => {
    const customEngine = new FormRuleEngine();
    // Calibrated bottom = 85°. Target = 85 + 5 = 90. Max(90, 70) = 90.
    customEngine.setBaseline({ rom: { kneeBottom: 85, kneeStanding: 165 } });
    expect(customEngine.evaluate({ minAngleDeg: 91 }).find((r) => r.ruleId === "depth").pass).toBe(false);
    expect(customEngine.evaluate({ minAngleDeg: 89 }).find((r) => r.ruleId === "depth").pass).toBe(true);
  });

  it("should allow shallower calibrated depth (95°)", () => {
    const customEngine = new FormRuleEngine();
    // Calibrated bottom = 95°. Target = 95 + 5 = 100. Max(100, 70) = 100.
    customEngine.setBaseline({ rom: { kneeBottom: 95, kneeStanding: 170 } });
    // Rep at 98° should pass (98 <= 100).
    expect(customEngine.evaluate({ minAngleDeg: 98 }).find((r) => r.ruleId === "depth").pass).toBe(true);
    // Rep at 102° should fail (102 > 100).
    expect(customEngine.evaluate({ minAngleDeg: 102 }).find((r) => r.ruleId === "depth").pass).toBe(false);
  });

  it("should handle very deep calibrated depth (110°)", () => {
    const customEngine = new FormRuleEngine();
    // Calibrated bottom = 110°. Target = 110 + 5 = 115. Max(115, 70) = 115.
    customEngine.setBaseline({ rom: { kneeBottom: 110, kneeStanding: 175 } });
    expect(customEngine.evaluate({ minAngleDeg: 112 }).find((r) => r.ruleId === "depth").pass).toBe(true);
  });

  it("should enforce safety floor on extremely deep calibration", () => {
    const customEngine = new FormRuleEngine();
    // Calibrated bottom = 60°. Target = 60 + 5 = 65. Max(65, 70) = 70.
    customEngine.setBaseline({ rom: { kneeBottom: 60, kneeStanding: 170 } });
    const result = customEngine.evaluate({ minAngleDeg: 68 }).find((r) => r.ruleId === "depth");
    expect(result.pass).toBe(true); // 68 <= 70 (clamped to safety floor)
  });

  // Fix 4: Limb ratio affects torso lean tolerance
  it("should use calibrated torso lean with tolerance", () => {
    const customEngine = new FormRuleEngine();
    customEngine.setBaseline({
      rom: { kneeBottom: 85, typicalTorsoLean: 15 },
      angleStats: { typical_torso_lean: 15 },
    });
    // Default tolerance = 3, so max allowed = 15 + 3 = 18.
    expect(customEngine.evaluate({ minAngleDeg: 80, torsoLeanMax: 17 }).find((r) => r.ruleId === "torso_lean").pass).toBe(true);
    expect(customEngine.evaluate({ minAngleDeg: 80, torsoLeanMax: 19 }).find((r) => r.ruleId === "torso_lean").pass).toBe(false);
  });

  it("should grant extra torso lean tolerance for long-femur athletes", () => {
    const customEngine = new FormRuleEngine();
    customEngine.setBaseline({
      rom: { kneeBottom: 85, typicalTorsoLean: 15 },
      angleStats: { typical_torso_lean: 15 },
      limbRatios: { femurToTorso: 1.12 }, // Long femur
    });
    // Base tolerance 3 + long-femur bonus 2 = 5. Max allowed = 15 + 5 = 20.
    expect(customEngine.evaluate({ minAngleDeg: 80, torsoLeanMax: 19 }).find((r) => r.ruleId === "torso_lean").pass).toBe(true);
    expect(customEngine.evaluate({ minAngleDeg: 80, torsoLeanMax: 21 }).find((r) => r.ruleId === "torso_lean").pass).toBe(false);
  });

  it("should never exceed torso lean safety ceiling regardless of ratios", () => {
    const customEngine = new FormRuleEngine();
    customEngine.setBaseline({
      rom: { kneeBottom: 85, typicalTorsoLean: 33 },
      angleStats: { typical_torso_lean: 33 },
      limbRatios: { femurToTorso: 1.20 }, // Very long femur
    });
    // 33 + 3 + 2 = 38, but capped at safetyCeiling=35.
    const result = customEngine.evaluate({ minAngleDeg: 80, torsoLeanMax: 36 }).find((r) => r.ruleId === "torso_lean");
    expect(result.pass).toBe(false); // 36 > 35 (safety ceiling)
    expect(result.threshold).toBe(35);
  });

  it("should use default maxAngleDeg when no baseline is set", () => {
    const defaultEngine = new FormRuleEngine();
    // Default maxAngleDeg = 20
    expect(defaultEngine.evaluate({ minAngleDeg: 80, torsoLeanMax: 19 }).find((r) => r.ruleId === "torso_lean").pass).toBe(true);
    expect(defaultEngine.evaluate({ minAngleDeg: 80, torsoLeanMax: 21 }).find((r) => r.ruleId === "torso_lean").pass).toBe(false);
  });
});

describe("calculateFormScore", () => {
  it("should return 100 for 0 reps or perfect set", async () => {
    const { calculateFormScore } = await import("../analysis/FormRuleEngine.js");
    expect(calculateFormScore([], [])).toBe(100.0);
    expect(calculateFormScore([{ repNumber: 1 }], [])).toBe(100.0);
  });

  it("should compute exact pass rates matching backend formula", async () => {
    const { calculateFormScore } = await import("../analysis/FormRuleEngine.js");
    const reps = [{ repNumber: 1 }, { repNumber: 2 }];
    const issues = [{ repNumber: 1, issueType: "depth" }];
    // Weights: depth 0.35, knee_valgus 0.25, torso_lean 0.25, tempo 0.15
    // depth pass-rate: 1/2 = 0.5. Others: 2/2 = 1.0.
    // Score: 0.35 * 0.5 + 0.25 * 1 + 0.25 * 1 + 0.15 * 1 = 0.175 + 0.65 = 0.825 -> 82.5%
    const score = calculateFormScore(reps, issues);
    expect(score).toBe(82.5);
  });
});
