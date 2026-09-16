// Session management and persistence API calls.
import { apiRequest } from "./client.js";

// Converts client session summary to backend schema format.
export function formatSessionPayload(summary) {
  return {
    exercise: summary.exercise || "squat",
    started_at: summary.startedAt || summary.started_at || new Date().toISOString(),
    ended_at: summary.endedAt || summary.ended_at || new Date().toISOString(),
    duration_seconds: summary.durationSeconds ?? summary.duration_seconds ?? 0,
    rep_count: summary.repCount ?? summary.rep_count ?? 0,
    form_score: summary.formScore ?? summary.form_score ?? 100,
    reps: (summary.reps || []).map((r) => ({
      rep_number: r.repNumber ?? r.rep_number ?? 1,
      duration_seconds: r.durationSeconds ?? r.duration_seconds ?? 0,
      rom_value: r.romValue ?? r.rom_value ?? 0,
      tempo: r.tempo ?? 0,
      angle_metrics: r.angleMetrics ?? r.angle_metrics ?? {},
    })),
    form_issues: (summary.formIssues || summary.form_issues || []).map((i) => ({
      rep_number: i.repNumber ?? i.rep_number ?? 1,
      issue_type: i.issueType ?? i.issue_type ?? "unknown",
      severity: i.severity ?? "low",
    })),
  };
}

export async function saveSession(summary) {
  const payload = formatSessionPayload(summary);
  return apiRequest("/sessions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getSessions({ limit = 50, offset = 0 } = {}) {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  return apiRequest(`/sessions?${params}`);
}

export async function getSessionById(id) {
  return apiRequest(`/sessions/${id}`);
}
