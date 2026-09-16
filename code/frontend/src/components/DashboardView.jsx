// Athlete Performance Dashboard: Minimalist stealth black command center.
import { useEffect, useState } from "react";
import { getDashboardSummary } from "@/api/dashboardApi.js";
import { getSessions } from "@/api/sessionApi.js";

export default function DashboardView({ onNavigate }) {
  const [summary, setSummary] = useState(null);
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      try {
        const [sumRes, sessRes] = await Promise.allSettled([
          getDashboardSummary(),
          getSessions({ limit: 5 }),
        ]);
        if (!mounted) return;
        if (sumRes.status === "fulfilled") setSummary(sumRes.value);
        if (sessRes.status === "fulfilled") setSessions(sessRes.value || []);
      } catch (_) {}
    }

    loadData();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="dashboard-container" data-testid="dashboard-view">
      {/* Minimalist Hero Banner */}
      <section className="hero-banner" data-testid="hero-banner">
        <div className="hero-content">
          <div className="hero-brand-tag">
            <span>AI KINEMATICS // SQUAT FORM ANALYZER</span>
          </div>

          <h1 className="hero-title">
            IT'S ALL ABOUT WHAT YOU CAN ACHIEVE
          </h1>

          <p className="hero-subtitle">
            Empower yourself to make the changes you need to make. Real-time computer vision joint tracking, parallel depth validation, and instant biomechanical feedback.
          </p>

          <div className="hero-actions">
            <button
              type="button"
              className="hero-cta-btn"
              onClick={() => onNavigate && onNavigate("workout")}
              data-testid="hero-btn-start"
            >
              LET'S GET STARTED
            </button>
            <button
              type="button"
              className="hero-secondary-btn"
              onClick={() => onNavigate && onNavigate("calibration")}
            >
              Calibrate Biomechanics
            </button>
          </div>
        </div>
      </section>

      {/* Performance Metrics Snapshot Cards */}
      <section className="snapshot-metrics-section">
        <div className="section-header-wrap">
          <h2 className="section-title">
            <span>Performance Snapshot</span>
          </h2>
          <span className="section-tag">Live Telemetry</span>
        </div>

        <div className="dashboard-grid">
          <div className="stat-card">
            <div className="stat-card-top">
              <span className="card-label">Total Workouts</span>
              <span className="stat-icon-wrap">
              </span>
            </div>
            <span className="card-value" data-testid="stat-total-sessions">
              {summary?.total_sessions ?? sessions.length ?? 0}
            </span>
            <span className="stat-meta">Completed workout sessions</span>
          </div>

          <div className="stat-card">
            <div className="stat-card-top">
              <span className="card-label">Total Reps</span>
              <span className="stat-icon-wrap">
              </span>
            </div>
            <span className="card-value" data-testid="stat-total-reps">
              {summary?.total_reps ?? 0}
            </span>
            <span className="stat-meta">Analyzed squat reps</span>
          </div>

          <div className="stat-card accent-card">
            <div className="stat-card-top">
              <span className="card-label">Average Score</span>
              <span className="stat-icon-wrap">
              </span>
            </div>
            <span className="card-value" data-testid="stat-avg-score">
              {summary?.avg_form_score != null ? `${Math.round(summary.avg_form_score)}%` : "—"}
            </span>
            <span className="stat-meta">
              {summary?.avg_form_score != null ? "Form precision average" : "Ready for first set"}
            </span>
          </div>
        </div>
      </section>

      {/* Workout Stations (Direct Access Portals) */}
      <section className="portal-stations-section">
        <div className="section-header-wrap">
          <h2 className="section-title">
            <span>Training Stations</span>
          </h2>
          <span className="section-tag">Direct Access</span>
        </div>

        <div className="quick-actions-grid">
          <div className="action-sketch-card">
            <div className="action-sketch-top">
              <div className="action-sketch-icon">
              </div>
              <div className="action-sketch-content">
                <h4>Rep & Set Counting Lab</h4>
                <p>
                  High-speed live camera studio with automated rep counting, depth analysis, and active joint HUD.
                </p>
              </div>
            </div>
            <button
              type="button"
              className="btn btn-primary action-sketch-btn"
              onClick={() => onNavigate && onNavigate("workout")}
              data-testid="btn-launch-workout"
            >
              Open Rep & Set Counter
            </button>
          </div>

          <div className="action-sketch-card">
            <div className="action-sketch-top">
              <div className="action-sketch-icon">
              </div>
              <div className="action-sketch-content">
                <h4>Biomechanics Calibration</h4>
                <p>
                  Fine-tune personal limb ratios, baseline depth threshold, and joint baseline angles.
                </p>
              </div>
            </div>
            <button
              type="button"
              className="btn btn-secondary action-sketch-btn"
              onClick={() => onNavigate && onNavigate("calibration")}
              data-testid="btn-launch-calibration"
            >
              Open Calibration Desk
            </button>
          </div>

          <div className="action-sketch-card">
            <div className="action-sketch-top">
              <div className="action-sketch-icon">
              </div>
              <div className="action-sketch-content">
                <h4>Training Logbook & Analytics</h4>
                <p>
                  In-depth history of completed sets, recurring flaw frequencies, and form score trends.
                </p>
              </div>
            </div>
            <button
              type="button"
              className="btn btn-secondary action-sketch-btn"
              onClick={() => onNavigate && onNavigate("history")}
              data-testid="btn-launch-history"
            >
              View Full Logbook
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
