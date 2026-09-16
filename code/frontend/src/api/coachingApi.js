// AI Coaching RAG workflow API client.
import { apiRequest } from "./client.js";

/**
 * Formats client session summary and baseline into CoachingAnalyzeRequest.
 * Aggregates raw rep-level form issues into categorized counts with severity.
 */
export function formatCoachingPayload(summary, baseline = null, userGoal = null) {
  const reps = summary.reps || [];
  const rawIssues = summary.formIssues || summary.form_issues || [];

  // Aggregate issues by type
  const issueMap = new Map();
  const severityRank = { high: 3, medium: 2, low: 1 };

  for (const issue of rawIssues) {
    const itype = issue.issueType || issue.issue_type || "unknown";
    const isev = issue.severity || "medium";

    if (!issueMap.has(itype)) {
      issueMap.set(itype, { type: itype, count: 0, severity: isev });
    }
    const entry = issueMap.get(itype);
    entry.count += 1;
    if (severityRank[isev.toLowerCase()] > severityRank[entry.severity.toLowerCase()]) {
      entry.severity = isev;
    }
  }

  // Calculate average ROM and tempo
  let totalRom = 0;
  let totalTempo = 0;
  for (const r of reps) {
    totalRom += Number(r.romValue ?? r.rom_value ?? 0);
    totalTempo += Number(r.tempo ?? 0);
  }
  const avgRom = reps.length > 0 ? Number((totalRom / reps.length).toFixed(1)) : null;
  const avgTempo = reps.length > 0 ? Number((totalTempo / reps.length).toFixed(1)) : null;

  // Build personalized baseline if available
  let personalizedBaseline = null;
  if (baseline) {
    const lr = baseline.limbRatios || baseline.limb_ratios || {};
    const rom = baseline.rom || {};
    const stats = baseline.angleStats || baseline.angle_stats || {};

    personalizedBaseline = {
      knee_bottom_angle: rom.kneeBottom ?? rom.knee_bottom ?? null,
      knee_standing_angle: rom.kneeStanding ?? rom.knee_standing ?? null,
      typical_torso_lean: stats.typical_torso_lean ?? rom.typicalTorsoLean ?? null,
      femur_to_torso: lr.femurToTorso ?? lr.femur_to_torso ?? null,
      shin_to_torso: lr.shinToTorso ?? lr.shin_to_torso ?? null,
      confidence: 0.95,
    };
  }

  return {
    exercise: summary.exercise || "squat",
    form_score: Number(summary.formScore ?? summary.form_score ?? 100),
    rep_count: Number(summary.repCount ?? summary.rep_count ?? 0),
    issues: Array.from(issueMap.values()),
    metrics: {
      average_rom: avgRom,
      average_tempo: avgTempo,
      duration_seconds: summary.durationSeconds ?? summary.duration_seconds ?? 0,
    },
    personalized_baseline: personalizedBaseline,
    user_goal: userGoal,
  };
}

/**
 * Calls backend POST /api/coaching/analyze.
 */
export async function analyzeCoaching(payload) {
  return apiRequest("/coaching/analyze", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
