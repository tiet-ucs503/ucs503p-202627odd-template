import { describe, it, expect } from "vitest";
import { ExerciseVerifier } from "@/analysis/ExerciseVerifier.js";
import { LandmarkSmoother } from "@/pose/LandmarkSmoother.js";
import { ReplayFrameSource } from "@/pipeline/ReplayFrameSource.js";
import { LANDMARK_COUNT, POSE_LANDMARKS } from "@shared/exercise-config/landmarks.js";
import goodFixture from "@/fixtures/real-squat-good.json";

/**
 * Tuning notes (see also ExerciseVerifier.js header comment):
 * Default bufferCapacity=30, visibleRatioThreshold=0.7, angleRangeThreshold=20deg.
 * Measured by direct simulation against the real fixtures (node script, not
 * committed) before picking these numbers:
 *   - real-squat-good.json (213 frames, 30fps, no dropout per GROUND_TRUTH.md):
 *     visibleRatio reaches 1.00 almost immediately; angleRange climbs to
 *     ~130-135deg during the first descent; verified flips true around
 *     frame ~43 (~1.4s in).
 *   - real-squat-shallow.json (539 frames, ~15fps, 2 dropout frames):
 *     visibleRatio recovers to 1.00 quickly after the early dropouts;
 *     angleRange peaks ~80-88deg (shallower squat, per its name); verified
 *     flips true around frame ~205-226, correctly staying false through
 *     the first ~6s non-squat arm-raise warmup mentioned in GROUND_TRUTH.md.
 * Both real numbers comfortably clear the 0.7 / 20deg thresholds, while a
 * static-standing or all-dropout sequence (see tests below) never does.
 */

function runFixtureThroughPipeline(fixtureJson, { alpha = 0.5 } = {}) {
  const source = new ReplayFrameSource(fixtureJson);
  const smoother = new LandmarkSmoother({ alpha });
  const verifier = new ExerciseVerifier();

  let verifiedAtFrame = -1;
  let frameIndex = 0;
  let lastStatus = null;
  let frame;
  while ((frame = source.next()) !== null) {
    const smoothed = smoother.smooth(frame.landmarks);
    verifier.update(smoothed);
    lastStatus = verifier.getStatus();
    if (verifiedAtFrame < 0 && lastStatus.verified) verifiedAtFrame = frameIndex;
    frameIndex += 1;
  }
  return { verifiedAtFrame, lastStatus, frameCount: frameIndex };
}

function makeStandingFrame() {
  // A full 33-landmark, fully-visible, straight-leg standing pose: hip
  // directly above knee directly above ankle (collinear -> ~180deg knee
  // angle), identical every frame (no movement).
  const frame = new Array(LANDMARK_COUNT).fill(null).map(() => ({
    x: 0.5,
    y: 0.5,
    z: 0,
    visibility: 0.95,
  }));
  frame[POSE_LANDMARKS.LEFT_HIP] = { x: 0.45, y: 0.3, z: 0, visibility: 0.95 };
  frame[POSE_LANDMARKS.LEFT_KNEE] = { x: 0.45, y: 0.6, z: 0, visibility: 0.95 };
  frame[POSE_LANDMARKS.LEFT_ANKLE] = { x: 0.45, y: 0.9, z: 0, visibility: 0.95 };
  frame[POSE_LANDMARKS.RIGHT_HIP] = { x: 0.55, y: 0.3, z: 0, visibility: 0.95 };
  frame[POSE_LANDMARKS.RIGHT_KNEE] = { x: 0.55, y: 0.6, z: 0, visibility: 0.95 };
  frame[POSE_LANDMARKS.RIGHT_ANKLE] = { x: 0.55, y: 0.9, z: 0, visibility: 0.95 };
  return frame;
}

describe("ExerciseVerifier", () => {
  it("reaches verified:true on the real squat fixture (real-squat-good.json)", () => {
    const { verifiedAtFrame, lastStatus, frameCount } = runFixtureThroughPipeline(goodFixture);

    expect(verifiedAtFrame).toBeGreaterThanOrEqual(0);
    expect(verifiedAtFrame).toBeLessThan(frameCount);
    expect(lastStatus.verified).toBe(true);
    expect(lastStatus.visibleRatio).toBeGreaterThanOrEqual(0.7);
    expect(lastStatus.angleRange).toBeGreaterThanOrEqual(20);
  });

  it("stays verified:false with a clear reason on a static standing sequence", () => {
    const verifier = new ExerciseVerifier();
    const smoother = new LandmarkSmoother({ alpha: 0.5 });
    let status;
    for (let i = 0; i < 40; i++) {
      const smoothed = smoother.smooth(makeStandingFrame());
      verifier.update(smoothed);
      status = verifier.getStatus();
    }
    expect(status.verified).toBe(false);
    expect(status.visibleRatio).toBeCloseTo(1, 5); // fully visible throughout
    expect(status.angleRange).toBeLessThan(20); // ~0deg, no movement
    expect(status.reason).toMatch(/movement/i);
  });

  it("stays verified:false with a clear reason on an all-dropout sequence", () => {
    const verifier = new ExerciseVerifier();
    let status;
    for (let i = 0; i < 40; i++) {
      verifier.update([]); // no pose detected, every frame
      status = verifier.getStatus();
    }
    expect(status.verified).toBe(false);
    expect(status.visibleRatio).toBe(0);
    expect(status.reason).toMatch(/visib/i);
  });

  it("does not crash on the real dropout frames in the shallow fixture and never reports NaN", async () => {
    const shallowFixture = await import("@/fixtures/real-squat-shallow.json");
    const { lastStatus } = runFixtureThroughPipeline(shallowFixture.default ?? shallowFixture);
    expect(Number.isNaN(lastStatus.visibleRatio)).toBe(false);
    expect(Number.isNaN(lastStatus.angleRange)).toBe(false);
  });

  it("getStatus() before any update() reports not-verified with a reason, not a crash", () => {
    const verifier = new ExerciseVerifier();
    const status = verifier.getStatus();
    expect(status.verified).toBe(false);
    expect(typeof status.reason).toBe("string");
  });

  it("reset() clears buffered history", () => {
    const verifier = new ExerciseVerifier();
    for (let i = 0; i < 10; i++) verifier.update(makeStandingFrame());
    verifier.reset();
    const status = verifier.getStatus();
    expect(status.visibleRatio).toBe(0);
  });
});
