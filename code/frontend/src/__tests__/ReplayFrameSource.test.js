import { describe, it, expect } from "vitest";
import { ReplayFrameSource } from "@/pipeline/ReplayFrameSource.js";
import goodFixture from "@/fixtures/real-squat-good.json";
import shallowFixture from "@/fixtures/real-squat-shallow.json";

describe("ReplayFrameSource", () => {
  it("yields frames from real-squat-good.json in non-decreasing timestamp order", () => {
    const source = new ReplayFrameSource(goodFixture);
    let count = 0;
    let prevTs = -Infinity;
    let frame;
    while ((frame = source.next()) !== null) {
      expect(frame.timestampMs).toBeGreaterThanOrEqual(prevTs);
      prevTs = frame.timestampMs;
      count += 1;
    }
    expect(count).toBe(goodFixture.frames.length);
  });

  it("terminates with null once exhausted", () => {
    const source = new ReplayFrameSource(goodFixture);
    for (let i = 0; i < goodFixture.frames.length; i++) source.next();
    expect(source.next()).toBeNull();
    // calling again keeps returning null, doesn't throw or wrap around
    expect(source.next()).toBeNull();
  });

  it("reset() restarts the sequence from the beginning", () => {
    const source = new ReplayFrameSource(goodFixture);
    const first = source.next();
    source.next();
    source.next();
    source.reset();
    const afterReset = source.next();
    expect(afterReset).toEqual(first);
  });

  it("drives non-empty landmark frames for the good (no-dropout) fixture", () => {
    const source = new ReplayFrameSource(goodFixture);
    let nonEmptyCount = 0;
    let frame;
    while ((frame = source.next()) !== null) {
      if (frame.landmarks.length > 0) nonEmptyCount += 1;
    }
    // GROUND_TRUTH.md: real-squat-good.json has 213/213 frames detected, no dropout.
    expect(nonEmptyCount).toBe(goodFixture.frames.length);
  });

  it("passes real dropout frames through as empty/short landmark arrays (shallow fixture)", () => {
    const source = new ReplayFrameSource(shallowFixture);
    let dropoutCount = 0;
    let frame;
    while ((frame = source.next()) !== null) {
      if (frame.landmarks.length < 33) dropoutCount += 1;
    }
    // GROUND_TRUTH.md: real-squat-shallow.json has 537/539 detected -> 2 dropout frames.
    expect(dropoutCount).toBe(2);
  });

  it("emits timestampMs taken directly from frame.t (already milliseconds in these fixtures)", () => {
    const source = new ReplayFrameSource(goodFixture);
    const frame = source.next();
    expect(frame.timestampMs).toBe(goodFixture.frames[0].t);
    expect(frame.timestampMs).toBe(0);
  });
});
