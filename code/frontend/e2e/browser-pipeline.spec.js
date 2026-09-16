import { test, expect } from "@playwright/test";
import { authenticatePage } from "./test-helpers.js";

test.describe("Browser-side AnalysisPipeline Execution", () => {
  test.beforeEach(async ({ page }) => {
    await authenticatePage(page);
  });
  test("replays real-squat-good fixture in the browser and produces exactly 2 full-depth reps", async ({
    page,
  }) => {
    await page.goto("/");

    const result = await page.evaluate(async () => {
      const { AnalysisPipeline } = await import("/src/pipeline/AnalysisPipeline.js");
      const { ReplayFrameSource } = await import("/src/pipeline/ReplayFrameSource.js");
      const goodFixture = await fetch("/src/fixtures/real-squat-good.json").then((r) => r.json());

      const pipeline = new AnalysisPipeline();
      const source = new ReplayFrameSource(goodFixture);

      let frame;
      let lastResult = null;
      const completedReps = [];

      while ((frame = source.next()) !== null) {
        lastResult = pipeline.processFrame(frame.landmarks, frame.timestampMs);
        if (lastResult.metrics) {
          completedReps.push(lastResult.metrics);
        }
      }

      return {
        finalRepCount: lastResult?.repCount ?? 0,
        completedRepsCount: completedReps.length,
        firstRepMetrics: completedReps[0] ?? null,
      };
    });

    expect(result.finalRepCount).toBe(2);
    expect(result.completedRepsCount).toBe(2);
    expect(result.firstRepMetrics).not.toBeNull();
    expect(result.firstRepMetrics.durationSeconds).toBeGreaterThan(0.5);
    expect(result.firstRepMetrics.romValue).toBeGreaterThan(30);
  });

  test("replays real-squat-shallow fixture in the browser, counts 3 reps, and triggers depth feedback cue", async ({
    page,
  }) => {
    await page.goto("/");

    const result = await page.evaluate(async () => {
      const { AnalysisPipeline } = await import("/src/pipeline/AnalysisPipeline.js");
      const { ReplayFrameSource } = await import("/src/pipeline/ReplayFrameSource.js");
      const shallowFixture = await fetch("/src/fixtures/real-squat-shallow.json").then((r) => r.json());

      const pipeline = new AnalysisPipeline();
      const source = new ReplayFrameSource(shallowFixture);

      let frame;
      let lastResult = null;
      let depthCueTriggered = false;
      let recordedCue = null;

      while ((frame = source.next()) !== null) {
        lastResult = pipeline.processFrame(frame.landmarks, frame.timestampMs);
        if (lastResult.feedback?.activeCue) {
          depthCueTriggered = true;
          recordedCue = lastResult.feedback.activeCue;
        }
      }

      return {
        finalRepCount: lastResult?.repCount ?? 0,
        depthCueTriggered,
        recordedCue,
      };
    });

    // Per GROUND_TRUTH.md and Week 3/4 specs:
    // Shallow fixture has 3 completed half-squat reps
    expect(result.finalRepCount).toBe(3);
    expect(result.depthCueTriggered).toBe(true);
    expect(result.recordedCue).toContain("Squat deeper");
  });

  test("pipeline reset clears rep counter and machine state", async ({ page }) => {
    await page.goto("/");

    const isReset = await page.evaluate(async () => {
      const { AnalysisPipeline } = await import("/src/pipeline/AnalysisPipeline.js");
      const { ReplayFrameSource } = await import("/src/pipeline/ReplayFrameSource.js");
      const goodFixture = await fetch("/src/fixtures/real-squat-good.json").then((r) => r.json());

      const pipeline = new AnalysisPipeline();
      const source = new ReplayFrameSource(goodFixture);

      let frame;
      while ((frame = source.next()) !== null) {
        pipeline.processFrame(frame.landmarks, frame.timestampMs);
      }

      const countBefore = pipeline.machine.repCount;
      pipeline.reset();
      const countAfter = pipeline.machine.repCount;
      const stateAfter = pipeline.machine.state;

      return {
        countBefore,
        countAfter,
        stateAfter,
      };
    });

    expect(isReset.countBefore).toBe(2);
    expect(isReset.countAfter).toBe(0);
    expect(isReset.stateAfter).toBe("STANDING");
  });
});
