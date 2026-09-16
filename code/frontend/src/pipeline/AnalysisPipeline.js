// Orchestrates frame analysis: LandmarkSmoother -> SquatStateMachine -> FormRuleEngine -> MetricsEngine -> FeedbackSelector.
import { LandmarkSmoother } from "@/pose/LandmarkSmoother.js";
import { SquatStateMachine } from "@/analysis/SquatStateMachine.js";
import { FormRuleEngine } from "@/analysis/FormRuleEngine.js";
import { MetricsEngine } from "@/analysis/MetricsEngine.js";
import { FeedbackSelector } from "@/analysis/FeedbackSelector.js";
import { squatConfig } from "@shared/exercise-config/squat.config.js";

export class AnalysisPipeline {
  constructor() {
    this.smoother = new LandmarkSmoother();
    this.machine = new SquatStateMachine(squatConfig);
    this.ruleEngine = new FormRuleEngine(squatConfig);
    this.metricsEngine = new MetricsEngine();
    this.feedbackSelector = new FeedbackSelector();
  }

  // Configures pipeline with calibrated user baseline ROM thresholds.
  setBaseline(baseline) {
    if (!baseline?.rom) return;
    this.ruleEngine.setBaseline(baseline);

    const { kneeStanding, kneeBottom } = baseline.rom;
    if (typeof kneeStanding === "number" && typeof kneeBottom === "number") {
      const range = kneeStanding - kneeBottom;
      if (range > 15) {
        const upThresholdDeg = Math.round(kneeStanding - range * 0.2);
        const downThresholdDeg = Math.round(kneeStanding - range * 0.6);
        this.machine.updateThresholds({ downThresholdDeg, upThresholdDeg });
      }
    }
  }

  // Processes a frame and returns updated analysis state, rep count, feedback, metrics, and new issues.
  processFrame(landmarks, timestampMs) {
    const smoothed = this.smoother.smooth(landmarks);
    this.machine.update({ landmarks: smoothed, timestampMs });

    const reps = this.machine.getReps();
    const lastRep = reps[reps.length - 1];

    let feedback = { activeCue: null, severity: null };
    let metrics = null;
    let newIssues = [];

    if (lastRep && lastRep.endMs === timestampMs) {
      const ruleResults = this.ruleEngine.evaluate(lastRep);
      feedback = this.feedbackSelector.select(ruleResults);
      metrics = this.metricsEngine.compute(lastRep);
      newIssues = ruleResults
        .filter((r) => !r.pass)
        .map((r) => ({
          repNumber: lastRep.repNumber,
          issueType: r.ruleId,
          severity: r.severity || "medium",
        }));
    }

    return {
      state: this.machine.state,
      repCount: this.machine.repCount,
      feedback,
      metrics,
      newIssues,
    };
  }

  // Resets pipeline components.
  reset() {
    this.machine.reset();
    this.smoother.reset();
    this.feedbackSelector.reset?.();
  }
}

// Replays a fixture through a frame source and advances the state machine.
export function runSquatFixture(fixtureData, FrameSourceClass, machine) {
  const source = new FrameSourceClass(fixtureData);
  while (true) {
    const frame = source.next();
    if (!frame) break;
    machine.update({ landmarks: frame.landmarks, timestampMs: frame.timestampMs });
  }
  return machine;
}
