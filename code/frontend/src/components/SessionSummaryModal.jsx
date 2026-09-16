import React, { useState, useEffect } from "react";
import { saveSession } from "@/api/sessionApi.js";
import { getBaseline } from "@/api/calibrationApi.js";
import { analyzeCoaching, formatCoachingPayload } from "@/api/coachingApi.js";

export default function SessionSummaryModal({ summary, onClose, onSaved }) {
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);
  const [isSaveError, setIsSaveError] = useState(false);

  // AI Coaching RAG state
  const [coaching, setCoaching] = useState(null);
  const [loadingCoaching, setLoadingCoaching] = useState(false);
  const [coachingError, setCoachingError] = useState(null);
  const [showSources, setShowSources] = useState(false);

  useEffect(() => {
    let active = true;

    async function fetchCoachingBreakdown() {
      if (!summary) return;
      setLoadingCoaching(true);
      setCoachingError(null);

      try {
        let baseline = null;
        try {
          const res = await getBaseline();
          if (res && res.limb_ratios) baseline = res;
        } catch (_) {}

        const payload = formatCoachingPayload(summary, baseline);
        const coachingResult = await analyzeCoaching(payload);
        if (active) {
          setCoaching(coachingResult);
        }
      } catch (err) {
        if (active) {
          setCoachingError(err.message || "Failed to load AI coaching analysis");
        }
      } finally {
        if (active) {
          setLoadingCoaching(false);
        }
      }
    }

    fetchCoachingBreakdown();

    return () => {
      active = false;
    };
  }, [summary]);

  if (!summary) return null;
  const score = Math.round(summary.formScore || 0);

  async function handleSave() {
    setSaving(true);
    setSaveStatus(null);
    setIsSaveError(false);
    try {
      await saveSession(summary);
      setSaveStatus("Session saved to profile!");
      if (onSaved) onSaved();
    } catch (err) {
      setIsSaveError(true);
      setSaveStatus(`Save failed: ${err.message || "Failed to save session"}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" data-testid="session-summary-modal">
      <div className="modal-card modal-summary-card">
        <div className="modal-header">
          <div className="modal-title-wrap">
            <span className="modal-eyebrow">Workout Complete</span>
            <h2>Squat Set Summary</h2>
          </div>
          <button className="btn-close" onClick={onClose} data-testid="btn-close-summary" aria-label="Close">
            &times;
          </button>
        </div>

        {/* Circular score display */}
        <div className="score-hero">
          <div className="radial-score-ring">
            <svg viewBox="0 0 100 100" className="radial-svg">
              <circle cx="50" cy="50" r="42" className="radial-bg" />
              <circle
                cx="50"
                cy="50"
                r="42"
                className="radial-fill"
                style={{ strokeDashoffset: 264 - (264 * score) / 100 }}
              />
            </svg>
            <div className="radial-content">
              <span className="radial-number" data-testid="summary-score">{score}%</span>
              <span className="radial-label">FORM SCORE</span>
            </div>
          </div>
        </div>

        <div className="summary-stats-grid">
          <div className="summary-stat-box">
            <span className="stat-label">Exercise</span>
            <strong className="stat-value" data-testid="summary-exercise">{summary.exercise?.toUpperCase()}</strong>
          </div>
          <div className="summary-stat-box">
            <span className="stat-label">Total Reps</span>
            <strong className="stat-value" data-testid="summary-reps">{summary.repCount}</strong>
          </div>
          <div className="summary-stat-box">
            <span className="stat-label">Duration</span>
            <strong className="stat-value" data-testid="summary-duration">{Math.round(summary.durationSeconds)}s</strong>
          </div>
          <div className="summary-stat-box">
            <span className="stat-label">Rating</span>
            <strong className="stat-value">{score >= 80 ? "Excellent" : score >= 60 ? "Good" : "Needs Work"}</strong>
          </div>
        </div>

        {summary.formIssues?.length > 0 ? (
          <div className="summary-feedback-section">
            <span className="section-title">Detected Kinematic Cues</span>
            <ul className="feedback-chip-list">
              {summary.formIssues.map((issue, idx) => (
                <li key={idx} className={`feedback-chip severity-${issue.severity}`}>
                  <span>Rep {issue.repNumber}: {issue.issueType}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="feedback-clean-card">
            <span>Flawless set! Depth and posture met every kinematic target.</span>
          </div>
        )}

        {/* AI Coaching RAG Breakdown Section */}
        <div className="ai-coaching-section" data-testid="ai-coaching-section">
          <div className="ai-coaching-header">
            <div className="ai-coaching-title-wrap">
              <div className="ai-badge-icon">
              </div>
              <div>
                <h3 className="ai-coaching-title">AI Biomechanics Coach</h3>
                <span className="ai-coaching-sub">Evidence-grounded personalized analysis</span>
              </div>
            </div>
            {coaching?.primary_issue && (
              <span className="primary-issue-chip" data-testid="coaching-primary-issue">
                Focus: {coaching.primary_issue.replace("_", " ")}
              </span>
            )}
            {coaching?.source && (
              <span className={`source-badge ${coaching.source}`} data-testid="coaching-source-badge">
                {coaching.source === "llm" ? `${coaching.model || "LLM"}` : "Deterministic Analysis"}
              </span>
            )}
          </div>

          {loadingCoaching && (
            <div className="ai-coaching-loading" data-testid="ai-coaching-loading">
              <div className="spinner" />
              <span>Retrieving approved biomechanics guidance & synthesizing personalized cues...</span>
            </div>
          )}

          {coachingError && (
            <div className="ai-coaching-error" data-testid="ai-coaching-error">
              <span>{coachingError}</span>
            </div>
          )}

          {coaching && !loadingCoaching && (
            <div className="ai-coaching-content" data-testid="ai-coaching-content">
              {/* Summary & Biomechanical Explanation */}
              <div className="coaching-explanation-card">
                <p className="coaching-summary-text" data-testid="coaching-summary">{coaching.summary}</p>
                <p className="coaching-detail-text" data-testid="coaching-explanation">{coaching.explanation}</p>
              </div>

              {/* Actionable Corrective Drills */}
              {coaching.recommendations?.length > 0 && (
                <div className="coaching-recs-block">
                  <span className="block-label">Actionable Corrective Drills</span>
                  <ul className="coaching-recs-list" data-testid="coaching-recommendations">
                    {coaching.recommendations.map((rec, idx) => (
                      <li key={idx} className="coaching-rec-item">
                        <div className="rec-bullet-icon">
                        </div>
                        <span className="rec-text">{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Next Session Goal */}
              {coaching.next_session_goal && (
                <div className="coaching-goal-card" data-testid="coaching-goal">
                  <div className="goal-icon">
                  </div>
                  <div className="goal-info">
                    <span className="goal-label">Next Session Target</span>
                    <strong className="goal-text">{coaching.next_session_goal}</strong>
                  </div>
                </div>
              )}

              {/* Retrieved Evidence Passages Accordion */}
              {coaching.retrieved_guidance?.length > 0 && (
                <div className="coaching-evidence-accordion">
                  <button
                    type="button"
                    className="btn-toggle-evidence"
                    onClick={() => setShowSources(!showSources)}
                    data-testid="btn-toggle-sources"
                  >
                    <span>Approved Guidance References ({coaching.retrieved_guidance.length})</span>
                  </button>

                  {showSources && (
                    <div className="evidence-passages-list" data-testid="retrieved-passages-list">
                      {coaching.retrieved_guidance.map((item, idx) => (
                        <div key={idx} className="evidence-passage-card">
                          <div className="evidence-card-header">
                            <strong className="evidence-title">{item.title}</strong>
                            <span className="evidence-score-badge">
                              {Math.round(item.relevance_score * 100)}% match
                            </span>
                          </div>
                          <p className="evidence-body">{item.passage}</p>
                          <span className="evidence-source-id">Source: {item.source_id}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Safety & Medical Disclaimer Note */}
              {coaching.safety_note && (
                <div className="coaching-safety-banner" data-testid="coaching-safety">
                  <span>{coaching.safety_note}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {saveStatus && (
          <p
            className={`save-status ${isSaveError ? "status-error" : "status-success"}`}
            data-testid="save-status"
          >
            {saveStatus}
          </p>
        )}

        <div className="modal-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving}
            data-testid="btn-save-session"
          >
            {saving ? "Saving..." : "Save to Cloud"}
          </button>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
