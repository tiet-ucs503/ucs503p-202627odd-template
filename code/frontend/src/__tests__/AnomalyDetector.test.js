// Unit tests for AnomalyDetector z-score and fatigue detection.
import { describe, it, expect } from "vitest";
import { AnomalyDetector } from "@/analysis/AnomalyDetector.js";

describe("AnomalyDetector", () => {
  const baseline = {
    angleStats: {
      knee: { mean: 90, std: 5 },
    },
  };

  it("passes normal reps within threshold", () => {
    const detector = new AnomalyDetector({ zThreshold: 2.0 });
    const result = detector.evaluateRep({ romValue: 92, tempo: 2.0 }, baseline);
    expect(result.hasAnomaly).toBe(false);
    expect(result.anomalies).toHaveLength(0);
  });

  it("flags ROM anomaly when z-score exceeds threshold", () => {
    const detector = new AnomalyDetector({ zThreshold: 2.0 });
    // romValue = 110 -> z = (110 - 90) / 5 = +4.0
    const result = detector.evaluateRep({ romValue: 110, tempo: 2.0 }, baseline);
    expect(result.hasAnomaly).toBe(true);
    expect(result.anomalies[0].type).toBe("ROM_ANOMALY");
    expect(result.anomalies[0].zScore).toBe(4.0);
  });

  it("flags fatigue detected across deteriorating reps", () => {
    const detector = new AnomalyDetector();
    detector.evaluateRep({ romValue: 85, tempo: 2.0 });
    detector.evaluateRep({ romValue: 88, tempo: 2.2 }); // Note: for squat depth, higher knee angle = shallower
    // Let's pass declining ROM values: 80, 70, 60 with tempo 2.0, 2.5, 3.5
    const d2 = new AnomalyDetector();
    d2.evaluateRep({ romValue: 90, tempo: 2.0 });
    d2.evaluateRep({ romValue: 80, tempo: 2.5 });
    const r3 = d2.evaluateRep({ romValue: 70, tempo: 3.2 });
    expect(r3.hasAnomaly).toBe(true);
    expect(r3.anomalies.some((a) => a.type === "FATIGUE_DETECTED")).toBe(true);
  });
});
