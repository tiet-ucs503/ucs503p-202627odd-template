import { describe, it, expect } from "vitest";
import { MetricsEngine } from "../analysis/MetricsEngine";

describe("MetricsEngine", () => {
  const engine = new MetricsEngine();

  it("should compute correct metrics for a simple rep", () => {
    const rep = {
      repNumber: 1,
      startMs: 1000,
      endMs: 3000,
      bottomMs: 2000,
      minAngleDeg: 80,
      peakAngleDeg: 140,
    };
    const metrics = engine.compute(rep);
    expect(metrics.durationSeconds).toBe(2.0);
    expect(metrics.romValue).toBe(60);
    expect(metrics.tempo).toBe(1.0); // 1s descent / 1s ascent
  });
});
