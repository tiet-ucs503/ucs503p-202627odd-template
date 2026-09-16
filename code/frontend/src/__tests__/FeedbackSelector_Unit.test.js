import { describe, it, expect, vi } from "vitest";
import { FeedbackSelector } from "../analysis/FeedbackSelector.js";

describe("FeedbackSelector", () => {
    it("should prioritize high severity cues", () => {
        const selector = new FeedbackSelector(0); // No debounce
        const rules = [
            { ruleId: "low", pass: false, severity: "low", cue: "Low cue" },
            { ruleId: "high", pass: false, severity: "high", cue: "High cue" }
        ];

        const feedback = selector.select(rules);
        expect(feedback.activeCue).toBe("High cue");
        expect(feedback.severity).toBe("high");
    });

    it("should honor debounce duration", () => {
        const selector = new FeedbackSelector(1000);
        const rules1 = [{ ruleId: "high", pass: false, severity: "high", cue: "High cue" }];
        const rules2 = [{ ruleId: "low", pass: false, severity: "low", cue: "Low cue" }];

        selector.select(rules1); // Sets High cue

        // Immediate selection should still return High cue due to debounce
        const feedback = selector.select(rules2);
        expect(feedback.activeCue).toBe("High cue");
    });
});
