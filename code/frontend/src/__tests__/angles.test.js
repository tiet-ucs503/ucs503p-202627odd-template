import { describe, it, expect } from "vitest";
import { jointAngle2D, landmarkVisibleEnough, computeAngles } from "@/pose/angles.js";

describe("jointAngle2D", () => {
  it("returns ~180 degrees for a straight (collinear) limb", () => {
    const hip = { x: 0, y: 0 };
    const knee = { x: 0, y: 1 };
    const ankle = { x: 0, y: 2 };
    expect(jointAngle2D(hip, knee, ankle)).toBeCloseTo(180, 5);
  });

  it("returns ~90 degrees for a right angle", () => {
    const a = { x: 1, y: 0 };
    const vertex = { x: 0, y: 0 };
    const c = { x: 0, y: 1 };
    expect(jointAngle2D(a, vertex, c)).toBeCloseTo(90, 5);
  });

  it("returns 45 degrees for a known acute case", () => {
    const a = { x: 1, y: 0 };
    const vertex = { x: 0, y: 0 };
    const c = { x: 1, y: 1 };
    expect(jointAngle2D(a, vertex, c)).toBeCloseTo(45, 5);
  });

  it("returns 135 degrees for a known obtuse case", () => {
    const a = { x: 1, y: 0 };
    const vertex = { x: 0, y: 0 };
    const c = { x: -1, y: 1 };
    expect(jointAngle2D(a, vertex, c)).toBeCloseTo(135, 5);
  });

  it("returns NaN for a degenerate (zero-length) vector", () => {
    const vertex = { x: 0, y: 0 };
    const c = { x: 1, y: 1 };
    expect(jointAngle2D(vertex, vertex, c)).toBeNaN();
  });

  it("returns NaN when a point is missing", () => {
    const vertex = { x: 0, y: 0 };
    const c = { x: 1, y: 1 };
    expect(jointAngle2D(null, vertex, c)).toBeNaN();
  });
});

describe("landmarkVisibleEnough", () => {
  it("returns true when visibility is above the default threshold", () => {
    expect(landmarkVisibleEnough({ visibility: 0.9 })).toBe(true);
  });

  it("returns false when visibility is below the default threshold", () => {
    expect(landmarkVisibleEnough({ visibility: 0.2 })).toBe(false);
  });

  it("respects a custom threshold", () => {
    expect(landmarkVisibleEnough({ visibility: 0.6 }, 0.7)).toBe(false);
    expect(landmarkVisibleEnough({ visibility: 0.6 }, 0.5)).toBe(true);
  });

  it("returns false for missing landmarks or missing visibility", () => {
    expect(landmarkVisibleEnough(null)).toBe(false);
    expect(landmarkVisibleEnough({})).toBe(false);
  });
});

describe("computeAngles", () => {
  it("resolves landmark names via POSE_LANDMARKS and computes each angle", () => {
    // Build a 33-length landmark array; only hip/knee/ankle indices matter here.
    const landmarks = new Array(33).fill({ x: 0, y: 0 });
    landmarks[23] = { x: 0, y: 0 }; // LEFT_HIP
    landmarks[25] = { x: 0, y: 1 }; // LEFT_KNEE (vertex)
    landmarks[27] = { x: 0, y: 2 }; // LEFT_ANKLE

    const angleDefs = [
      { id: "leftKnee", points: ["LEFT_HIP", "LEFT_KNEE", "LEFT_ANKLE"], plane: "2d" },
    ];

    const result = computeAngles(landmarks, angleDefs);
    expect(result.leftKnee).toBeCloseTo(180, 5);
  });

  it("returns NaN for an unresolvable landmark name", () => {
    const landmarks = new Array(33).fill({ x: 0, y: 0 });
    const angleDefs = [
      { id: "bogus", points: ["NOT_A_LANDMARK", "LEFT_KNEE", "LEFT_ANKLE"], plane: "2d" },
    ];

    const result = computeAngles(landmarks, angleDefs);
    expect(result.bogus).toBeNaN();
  });

  it("returns an empty object for non-array inputs", () => {
    expect(computeAngles(null, [])).toEqual({});
    expect(computeAngles([], null)).toEqual({});
  });
});
