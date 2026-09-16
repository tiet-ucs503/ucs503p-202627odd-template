// Dedicated Logbook & Analytics View for session history and technique flaw analysis in Black & Red theme.
import { useEffect, useState } from "react";
import { getDashboardSummary } from "@/api/dashboardApi.js";
import { getSessions } from "@/api/sessionApi.js";

export default function HistoryView({ onNavigate }) {
  const [summary, setSummary] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      try {
        const [sumRes, sessRes] = await Promise.allSettled([
          getDashboardSummary(),
          getSessions({ limit: 20 }),
        ]);
        if (!mounted) return;
        if (sumRes.status === "fulfilled") setSummary(sumRes.value);
        if (sessRes.status === "fulfilled") setSessions(sessRes.value || []);
      } catch (_) {
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadData();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="history-container" data-testid="history-view">
      {/* Header */}
      <div className="section-header-wrap" style={{ marginBottom: "1.25rem" }}>
        <div>
          <h2 className="section-title">
            <span>Training Logbook & Biomechanical Analytics</span>
          </h2>
          <p className="subtitle" style={{ fontSize: "0.9rem", marginTop: "0.25rem" }}>
            Historical workout sessions, recurring form flaw analysis, and form score trends
          </p>
        </div>
        <span className="section-tag">Performance Archive</span>
      </div>

      {/* High-Impact Metric Cards */}
      <div className="dashboard-grid">
        <div className="stat-card">
          <div className="stat-card-top">
            <span className="card-label">Total Sessions</span>
            <span className="stat-icon-wrap">
            </span>
          </div>
          <span className="card-value">
            {summary?.total_sessions ?? sessions.length ?? 0}
          </span>
          <span className="stat-meta">Completed workouts</span>
        </div>

        <div className="stat-card">
          <div className="stat-card-top">
            <span className="card-label">Total Reps</span>
            <span className="stat-icon-wrap">
            </span>
          </div>
          <span className="card-value">
            {summary?.total_reps ?? 0}
          </span>
          <span className="stat-meta">Deep squat reps</span>
        </div>

        <div className="stat-card accent-card">
          <div className="stat-card-top">
            <span className="card-label">Average Score</span>
            <span className="stat-icon-wrap" style={{ color: "var(--red-primary)", borderColor: "var(--red-border)" }}>
            </span>
          </div>
          <span className="card-value">
            {summary?.avg_form_score != null ? `${Math.round(summary.avg_form_score)}%` : "—"}
          </span>
          <span className="stat-meta text-accent">
            {summary?.avg_form_score != null ? "Biomechanical average" : "No sessions yet"}
          </span>
        </div>

        <div className="stat-card">
          <div className="stat-card-top">
            <span className="card-label">Best Form Score</span>
            <span className="stat-icon-wrap">
            </span>
          </div>
          <span className="card-value">
            {summary?.best_form_score != null ? `${Math.round(summary.best_form_score)}%` : "—"}
          </span>
          <span className="stat-meta">
            {summary?.best_form_score != null ? "Personal best set" : "No sessions yet"}
          </span>
        </div>
      </div>

      {/* Detailed Analysis & Logs */}
      <div className="dashboard-sections">
        {summary?.most_common_issues?.length > 0 && (
          <div className="section-card ai-focus-card" data-testid="ai-dashboard-focus" style={{ gridColumn: "1 / -1", background: "var(--bg-card)", border: "1px solid var(--border-medium)", borderRadius: "var(--radius-md)", padding: "1.5rem", marginBottom: "1.5rem" }}>
            <div className="section-card-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.85rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <h3 style={{ fontFamily: "var(--font-display)", fontSize: "1.25rem", color: "#fff" }}>AI Coaching Diagnosis</h3>
              </div>
              <span className="section-tag">Kinematic Feedback</span>
            </div>
            <p style={{ margin: 0, fontSize: "0.95rem", lineHeight: "1.5", color: "var(--text-secondary)" }}>
              Your primary recurring kinematic deviation is{" "}
              <strong style={{ color: "var(--red-primary)" }}>{summary.most_common_issues[0].issue_type.replace("_", " ")}</strong> (
              {summary.most_common_issues[0].count} occurrences). Focus on approved corrective
              drills (tempo pauses, box squats) and keep your joint flexion within calibrated baseline angles.
            </p>
          </div>
        )}

        <div className="section-card" style={{ background: "var(--bg-card)", border: "1px solid var(--border-medium)", borderRadius: "var(--radius-md)", padding: "1.5rem", marginBottom: "1.5rem" }}>
          <div className="section-card-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "0.65rem" }}>
            <h3 style={{ fontFamily: "var(--font-display)", fontSize: "1.25rem", color: "#fff" }}>Technique Flaws Breakdown</h3>
            <span className="section-tag">Priority Cues</span>
          </div>
          {summary?.most_common_issues?.length > 0 ? (
            <ul className="common-issues-list" data-testid="common-issues-list">
              {summary.most_common_issues.map((issue, idx) => (
                <li key={idx} className="issue-row">
                  <div className="issue-info">
                    <span className="issue-name">
                      {issue.issue_type.replace("_", " ")}
                    </span>
                    <span className="issue-count">
                      {issue.count} flagged
                    </span>
                  </div>
                  <div className="issue-bar-wrap">
                    <div
                      className="issue-bar"
                      style={{ width: `${Math.min(100, issue.count * 25)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty-state-box" style={{ textAlign: "center", padding: "2rem" }}>
              <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>Clean technique! No recurring form deviations recorded.</p>
            </div>
          )}
        </div>

        <div className="section-card" style={{ background: "var(--bg-card)", border: "1px solid var(--border-medium)", borderRadius: "var(--radius-md)", padding: "1.5rem" }}>
          <div className="section-card-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "0.65rem" }}>
            <h3 style={{ fontFamily: "var(--font-display)", fontSize: "1.25rem", color: "#fff" }}>Recent Session History</h3>
            <span className="section-tag">Performance Log</span>
          </div>
          {sessions.length > 0 ? (
            <div className="sessions-list" data-testid="sessions-history-list" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {sessions.map((s) => (
                <div key={s.id} className="session-row" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.85rem 1rem", background: "#0d0d0d", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-sm)" }}>
                  <div className="session-info">
                    <span className="session-exercise" style={{ display: "block", color: "#fff", fontWeight: 700, fontFamily: "var(--font-condensed)", fontSize: "0.95rem" }}>
                      {s.exercise.toUpperCase()} SET
                    </span>
                    <span className="session-date" style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                      {new Date(s.started_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <div className="session-stats" style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                    <span className="session-reps" style={{ color: "var(--text-secondary)", fontSize: "0.88rem" }}>{s.rep_count} reps</span>
                    <span className="session-score-pill" style={{ background: "var(--red-dim)", color: "var(--red-primary)", border: "1px solid var(--red-border)", padding: "0.25rem 0.65rem", borderRadius: "var(--radius-xs)", fontWeight: 700, fontFamily: "var(--font-mono)", fontSize: "0.88rem" }}>
                      {Math.round(s.form_score)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state-box" style={{ textAlign: "center", padding: "2rem" }}>
              <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
                No sessions recorded yet. Start a workout in the Rep & Set Counter to log your sets!
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
