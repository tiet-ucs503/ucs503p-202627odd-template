import { describe, it, expect, vi } from "vitest";
import { formatCoachingPayload, analyzeCoaching } from "@/api/coachingApi.js";
import * as client from "@/api/client.js";

describe("coachingApi", () => {
  it("formats session summary and baseline into CoachingAnalyzeRequest", () => {
    const summary = {
      exercise: "squat",
      formScore: 78,
      repCount: 6,
      durationSeconds: 24,
      reps: [
        { repNumber: 1, romValue: 80, tempo: 3.0 },
        { repNumber: 2, romValue: 84, tempo: 3.2 },
      ],
      formIssues: [
        { repNumber: 1, issueType: "torso_lean", severity: "medium" },
        { repNumber: 2, issueType: "torso_lean", severity: "high" },
        { repNumber: 2, issueType: "depth", severity: "low" },
      ],
    };

    const baseline = {
      limbRatios: { femurToTorso: 1.08, shinToTorso: 0.92 },
      rom: { kneeStanding: 171, kneeBottom: 91, typicalTorsoLean: 14 },
      angleStats: { typical_torso_lean: 14 },
    };

    const payload = formatCoachingPayload(summary, baseline, "strength");

    expect(payload.exercise).toBe("squat");
    expect(payload.form_score).toBe(78);
    expect(payload.rep_count).toBe(6);
    expect(payload.user_goal).toBe("strength");

    // Issues aggregated
    expect(payload.issues.length).toBe(2);
    const torsoIssue = payload.issues.find((i) => i.type === "torso_lean");
    expect(torsoIssue.count).toBe(2);
    expect(torsoIssue.severity).toBe("high"); // Elevated to highest

    const depthIssue = payload.issues.find((i) => i.type === "depth");
    expect(depthIssue.count).toBe(1);

    // Metrics
    expect(payload.metrics.average_rom).toBe(82);
    expect(payload.metrics.average_tempo).toBe(3.1);

    // Baseline
    expect(payload.personalized_baseline.femur_to_torso).toBe(1.08);
    expect(payload.personalized_baseline.knee_bottom_angle).toBe(91);
    expect(payload.personalized_baseline.typical_torso_lean).toBe(14);
  });

  it("handles empty issues and null baseline gracefully", () => {
    const summary = {
      formScore: 100,
      repCount: 5,
    };

    const payload = formatCoachingPayload(summary, null);

    expect(payload.exercise).toBe("squat");
    expect(payload.form_score).toBe(100);
    expect(payload.rep_count).toBe(5);
    expect(payload.issues).toEqual([]);
    expect(payload.personalized_baseline).toBeNull();
  });

  it("calls analyzeCoaching via apiRequest", async () => {
    const mockResponse = {
      summary: "Good set",
      primary_issue: null,
      explanation: "Consistent depth",
      recommendations: ["Keep going"],
      next_session_goal: "Add weight",
      safety_note: "Discontinue if pain",
      retrieved_guidance: [],
    };

    const spy = vi.spyOn(client, "apiRequest").mockResolvedValueOnce(mockResponse);

    const payload = { exercise: "squat", form_score: 100, rep_count: 5 };
    const res = await analyzeCoaching(payload);

    expect(spy).toHaveBeenCalledWith("/coaching/analyze", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    expect(res).toEqual(mockResponse);

    spy.mockRestore();
  });
});
