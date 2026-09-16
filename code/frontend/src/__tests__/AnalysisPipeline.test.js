import { describe, it, expect } from "vitest";
import { AnalysisPipeline } from "../pipeline/AnalysisPipeline.js";
import { LANDMARK_COUNT } from "@shared/exercise-config/landmarks.js";

function makeMockLandmarks() {
    return new Array(LANDMARK_COUNT).fill(null).map(() => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.95 }));
}

describe("AnalysisPipeline Integration", () => {
  it("processes a frame and returns expected shape", () => {
    const pipeline = new AnalysisPipeline();
    const landmarks = makeMockLandmarks();
    const result = pipeline.processFrame(landmarks, 100);

    expect(result).toHaveProperty("state");
    expect(result).toHaveProperty("repCount");
    expect(result).toHaveProperty("feedback");
    expect(result).toHaveProperty("metrics");
  });
});
