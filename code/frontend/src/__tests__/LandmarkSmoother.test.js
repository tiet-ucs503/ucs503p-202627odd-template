import { describe, it, expect, beforeEach } from "vitest";
import { LandmarkSmoother } from "@/pose/LandmarkSmoother.js";
import { LANDMARK_COUNT } from "@shared/exercise-config/landmarks.js";

// Deterministic pseudo-jitter offsets (no Math.random -> reproducible test).
const JITTER = [0.05, -0.04, 0.03, -0.06, 0.02, -0.03, 0.05, -0.05, 0.01, -0.02];

function makeFrame(baseX = 0.5, jitterOffset = 0, visibility = 0.9) {
  const frame = new Array(LANDMARK_COUNT);
  for (let i = 0; i < LANDMARK_COUNT; i++) {
    frame[i] = { x: baseX + jitterOffset, y: 0.5, z: 0, visibility };
  }
  return frame;
}

function variance(values) {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
}

describe("LandmarkSmoother", () => {
  let smoother;

  beforeEach(() => {
    smoother = new LandmarkSmoother({ alpha: 0.3 });
  });

  it("passes the first frame through unchanged (seeds state)", () => {
    const frame = makeFrame(0.5, JITTER[0]);
    const out = smoother.smooth(frame);
    expect(out[0].x).toBeCloseTo(frame[0].x, 10);
    expect(out[0].y).toBeCloseTo(frame[0].y, 10);
    expect(out[0].stale).toBe(false);
  });

  it("reduces frame-to-frame variance vs raw input on a jittery synthetic sequence", () => {
    const rawXs = [];
    const smoothedXs = [];
    for (const offset of JITTER) {
      const frame = makeFrame(0.5, offset);
      rawXs.push(frame[0].x);
      const out = smoother.smooth(frame);
      smoothedXs.push(out[0].x);
    }
    expect(variance(smoothedXs)).toBeLessThan(variance(rawXs));
  });

  it("holds the last good value on a whole-frame dropout, never emitting NaN, and marks it stale", () => {
    const good1 = makeFrame(0.5, 0);
    const good2 = makeFrame(0.6, 0);
    smoother.smooth(good1);
    const afterGood2 = smoother.smooth(good2);

    const afterDropout = smoother.smooth([]); // whole-frame dropout
    expect(afterDropout.length).toBe(LANDMARK_COUNT);
    for (const lm of afterDropout) {
      expect(Number.isNaN(lm.x)).toBe(false);
      expect(Number.isNaN(lm.y)).toBe(false);
      expect(Number.isNaN(lm.z)).toBe(false);
      expect(lm.stale).toBe(true);
      expect(lm.visibility).toBe(0);
    }
    // held position == last good smoothed position, not a fresh value
    expect(afterDropout[0].x).toBeCloseTo(afterGood2[0].x, 10);
  });

  it("returns [] for a dropout frame with no prior state at all", () => {
    const out = smoother.smooth([]);
    expect(out).toEqual([]);
  });

  it("holds a single low-visibility landmark while other landmarks keep updating", () => {
    const good = makeFrame(0.5, 0, 0.9);
    smoother.smooth(good);

    const mixed = makeFrame(0.6, 0, 0.9);
    mixed[25] = { x: 0.9, y: 0.9, z: 0, visibility: 0.1 }; // LEFT_KNEE, low confidence
    const out = smoother.smooth(mixed);

    expect(out[25].stale).toBe(true);
    expect(out[25].x).toBeCloseTo(0.5, 10); // held from the first good frame
    expect(out[25].visibility).toBeCloseTo(0.1, 10); // reports real current confidence
    expect(out[0].stale).toBe(false); // unaffected landmark kept updating
  });

  it("keeps output length LANDMARK_COUNT on a dropout even when some landmarks were never seen (no index shift)", () => {
    // First frame: LEFT_KNEE (25) is low-confidence, so its state slot stays
    // null (never seeded). A subsequent whole-frame dropout must NOT drop that
    // slot — a shifted array would feed the wrong joint downstream.
    const first = makeFrame(0.5, 0, 0.9);
    first[25] = { x: 0.9, y: 0.9, z: 0, visibility: 0.1 }; // LEFT_KNEE low-vis
    smoother.smooth(first);

    const afterDropout = smoother.smooth([]); // whole-frame dropout
    expect(afterDropout.length).toBe(LANDMARK_COUNT);
    for (let i = 0; i < LANDMARK_COUNT; i++) {
      expect(afterDropout[i]).toBeDefined();
      expect(Number.isNaN(afterDropout[i].x)).toBe(false);
      expect(afterDropout[i].stale).toBe(true);
      expect(afterDropout[i].visibility).toBe(0);
    }
    // The never-seen landmark is a zero placeholder; a seen one holds its value.
    expect(afterDropout[25].x).toBe(0);
    expect(afterDropout[0].x).toBeCloseTo(0.5, 10);
  });

  it("passes a low-visibility landmark through on the very first frame rather than emitting NaN", () => {
    const first = makeFrame(0.5, 0, 0.9);
    first[27] = { x: 0.42, y: 0.7, z: 0, visibility: 0.05 }; // LEFT_ANKLE low-vis, never-seen
    const out = smoother.smooth(first);
    expect(out[27].stale).toBe(true);
    expect(Number.isNaN(out[27].x)).toBe(false);
    expect(out[27].x).toBeCloseTo(0.42, 10); // raw passthrough, not NaN, not held
    expect(out[27].visibility).toBeCloseTo(0.05, 10);
  });

  it("with alpha=1, behaves as passthrough for visible frames", () => {
    const alwaysResponsive = new LandmarkSmoother({ alpha: 1 });
    const f1 = makeFrame(0.5, 0);
    const f2 = makeFrame(0.9, 0);
    const out1 = alwaysResponsive.smooth(f1);
    const out2 = alwaysResponsive.smooth(f2);
    expect(out1[0].x).toBeCloseTo(0.5, 10);
    expect(out2[0].x).toBeCloseTo(0.9, 10);
  });

  it("reset() clears state so the next frame seeds fresh (passthrough) again", () => {
    smoother.smooth(makeFrame(0.5, 0));
    smoother.smooth(makeFrame(0.9, 0));
    smoother.reset();
    const out = smoother.smooth(makeFrame(0.2, 0));
    expect(out[0].x).toBeCloseTo(0.2, 10);
    expect(out[0].stale).toBe(false);
  });

  it("rejects an invalid alpha", () => {
    expect(() => new LandmarkSmoother({ alpha: 0 })).toThrow();
    expect(() => new LandmarkSmoother({ alpha: 1.1 })).toThrow();
    expect(() => new LandmarkSmoother({ alpha: -0.5 })).toThrow();
  });
});
