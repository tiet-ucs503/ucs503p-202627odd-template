import { describe, it, expect } from "vitest";
import { FeedbackSelector } from "../analysis/FeedbackSelector.js";

describe("FeedbackSelector", () => {
  it("selects the highest priority failed rule", () => {
    const selector = new FeedbackSelector(0); // No debounce for immediate testing
    const ruleResults = [
      { pass: false, severity: "low", cue: "Low priority cue" },
      { pass: true, severity: "low", cue: "" },
      { pass: false, severity: "high", cue: "High priority cue" },
      { pass: false, severity: "medium", cue: "Medium priority cue" },
    ];

    const result = selector.select(ruleResults);
    expect(result.activeCue).toBe("High priority cue");
    expect(result.severity).toBe("high");
  });

  it("debounces cues correctly", () => {
    const selector = new FeedbackSelector(100); // 100ms debounce
    const ruleResultsHigh = [{ pass: false, severity: "high", cue: "High" }];
    const ruleResultsMedium = [{ pass: false, severity: "medium", cue: "Medium" }];

    // First call: selects high
    expect(selector.select(ruleResultsHigh).activeCue).toBe("High");
    // Immediately second call: still selects high despite medium being available and high priority
    expect(selector.select(ruleResultsMedium).activeCue).toBe("High");

    // Wait for debounce
    return new Promise(resolve => setTimeout(resolve, 150)).then(() => {
        // After debounce: selects medium
        expect(selector.select(ruleResultsMedium).activeCue).toBe("Medium");
    });
  });
});
