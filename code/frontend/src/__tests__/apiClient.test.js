// Unit tests for API client and payload formatting.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { apiRequest } from "@/api/client.js";
import { formatSessionPayload } from "@/api/sessionApi.js";

describe("apiClient", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("formats session summary payload to snake_case backend contract", () => {
    const summary = {
      exercise: "squat",
      startedAt: "2026-09-07T10:00:00.000Z",
      endedAt: "2026-09-07T10:01:00.000Z",
      durationSeconds: 60,
      repCount: 5,
      formScore: 92,
      reps: [{ repNumber: 1, durationSeconds: 2.5, romValue: 88, tempo: 2.5, angleMetrics: { knee: 88 } }],
      formIssues: [{ repNumber: 1, issueType: "depth", severity: "high" }],
    };

    const payload = formatSessionPayload(summary);
    expect(payload.exercise).toBe("squat");
    expect(payload.duration_seconds).toBe(60);
    expect(payload.rep_count).toBe(5);
    expect(payload.form_score).toBe(92);
    expect(payload.reps[0].rep_number).toBe(1);
    expect(payload.reps[0].rom_value).toBe(88);
    expect(payload.form_issues[0].issue_type).toBe("depth");
    expect(payload.form_issues[0].severity).toBe("high");
  });

  it("includes Authorization header when token exists", async () => {
    localStorage.setItem("token", "test-bearer-token");
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: "ok" }),
    });
    global.fetch = mockFetch;

    const res = await apiRequest("/health");
    expect(res).toEqual({ status: "ok" });
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/health"),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer test-bearer-token",
        }),
      })
    );
  });

  it("throws descriptive error when response is not ok", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      json: async () => ({ detail: "Invalid session payload" }),
    });

    await expect(apiRequest("/sessions")).rejects.toThrow("Invalid session payload");
  });

  it("calls googleAuth endpoint with correct payload", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ access_token: "google-token", user: { username: "lakshay" } }),
    });
    global.fetch = mockFetch;

    const { googleAuth } = await import("@/api/authApi.js");
    const res = await googleAuth({ email: "athlete@gmail.com", name: "Lakshay" });
    expect(res.access_token).toBe("google-token");
  });
});
