/**
 * @vitest-environment jsdom
 */
import React from "react";
import "@testing-library/jest-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import SessionSummaryModal from "@/components/SessionSummaryModal.jsx";
import * as coachingApi from "@/api/coachingApi.js";
import * as calibrationApi from "@/api/calibrationApi.js";
import * as sessionApi from "@/api/sessionApi.js";

describe("SessionSummaryModal with AI Coaching RAG", () => {
  const mockSummary = {
    exercise: "squat",
    formScore: 78,
    repCount: 8,
    durationSeconds: 32,
    reps: [
      { repNumber: 1, romValue: 84, tempo: 3.2 },
      { repNumber: 2, romValue: 80, tempo: 3.1 },
    ],
    formIssues: [
      { repNumber: 1, issueType: "torso_lean", severity: "medium" },
      { repNumber: 2, issueType: "torso_lean", severity: "high" },
    ],
  };

  const mockCoachingResponse = {
    summary: "Your squat depth was consistent across most reps.",
    primary_issue: "torso_lean",
    explanation: "Your torso lean exceeded your calibrated baseline on three reps.",
    recommendations: ["Practice paused goblet squats with a lighter load."],
    next_session_goal: "Keep torso lean close to your calibrated baseline.",
    safety_note: "Stop and seek qualified advice if movement causes pain.",
    retrieved_guidance: [
      {
        source_id: "squat_torso_lean_bracing",
        title: "Torso Lean and Spinal Bracing",
        relevance_score: 0.92,
        passage: "Torso inclination during the squat is heavily governed by skeletal limb lengths.",
      },
    ],
    source: "deterministic",
    model: null,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(calibrationApi, "getBaseline").mockResolvedValue({
      limb_ratios: { femurToTorso: 1.08, shinToTorso: 0.92 },
      rom: { kneeBottom: 91, typicalTorsoLean: 14 },
    });
    vi.spyOn(coachingApi, "analyzeCoaching").mockResolvedValue(mockCoachingResponse);
  });

  it("renders summary modal with score and triggers AI Coaching breakdown", async () => {
    render(<SessionSummaryModal summary={mockSummary} onClose={() => {}} onSaved={() => {}} />);

    // Score display
    expect(screen.getByTestId("summary-score")).toHaveTextContent("78%");
    expect(screen.getByTestId("summary-reps")).toHaveTextContent("8");

    // Loading state initially
    expect(screen.getByTestId("ai-coaching-section")).toBeInTheDocument();

    // Awaits coaching response
    await waitFor(() => {
      expect(screen.getByTestId("coaching-summary")).toHaveTextContent(
        "Your squat depth was consistent across most reps."
      );
    });

    expect(screen.getByTestId("coaching-primary-issue")).toHaveTextContent("Focus: torso lean");
    expect(screen.getByTestId("coaching-explanation")).toHaveTextContent(
      "Your torso lean exceeded your calibrated baseline"
    );
    expect(screen.getByTestId("coaching-recommendations")).toHaveTextContent(
      "Practice paused goblet squats with a lighter load."
    );
    expect(screen.getByTestId("coaching-goal")).toHaveTextContent(
      "Keep torso lean close to your calibrated baseline."
    );
    expect(screen.getByTestId("coaching-safety")).toHaveTextContent(
      "Stop and seek qualified advice if movement causes pain."
    );
  });

  it("toggles retrieved guidance passages accordion", async () => {
    render(<SessionSummaryModal summary={mockSummary} onClose={() => {}} onSaved={() => {}} />);

    await waitFor(() => {
      expect(screen.getByTestId("btn-toggle-sources")).toBeInTheDocument();
    });

    expect(screen.queryByTestId("retrieved-passages-list")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("btn-toggle-sources"));
    expect(screen.getByTestId("retrieved-passages-list")).toBeInTheDocument();
    expect(screen.getByText("Torso Lean and Spinal Bracing")).toBeInTheDocument();
    expect(screen.getByText("92% match")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("btn-toggle-sources"));
    expect(screen.queryByTestId("retrieved-passages-list")).not.toBeInTheDocument();
  });

  it("handles save to cloud action", async () => {
    const saveSpy = vi.spyOn(sessionApi, "saveSession").mockResolvedValue({ id: "sess-123" });
    const onSavedMock = vi.fn();

    render(<SessionSummaryModal summary={mockSummary} onClose={() => {}} onSaved={onSavedMock} />);

    const saveBtn = screen.getByTestId("btn-save-session");
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(screen.getByTestId("save-status")).toHaveTextContent("Session saved to profile!");
    });
    expect(saveSpy).toHaveBeenCalledWith(mockSummary);
    expect(onSavedMock).toHaveBeenCalled();
  });

  it("displays source badge with deterministic label", async () => {
    render(<SessionSummaryModal summary={mockSummary} onClose={() => {}} onSaved={() => {}} />);

    await waitFor(() => {
      expect(screen.getByTestId("coaching-source-badge")).toBeInTheDocument();
    });
    expect(screen.getByTestId("coaching-source-badge")).toHaveTextContent("Deterministic Analysis");
  });
});
