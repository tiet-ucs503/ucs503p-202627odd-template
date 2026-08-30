// ==UserScript==
// @name         CPRecal - LeetCode Submission Tracker
// @namespace    CPRecal
// @version      3.0.0
// @description  Tracks LeetCode solving sessions and submits data to CPRecal backend for mastery scoring and spaced repetition.
// @match        https://leetcode.com/problems/*
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      localhost
// @connect      CPRecal.api
// @run-at       document-idle
// ==/UserScript==

(function () {
  "use strict";

  // ─────────────────────────────────────────────────────────────────────────────
  // CONFIG — Update BACKEND_URL to your deployed backend when ready
  // ─────────────────────────────────────────────────────────────────────────────
  const BACKEND_URL = "http://localhost:5000";
  const GRAPHQL_ENDPOINT = "https://leetcode.com/graphql/";
  const WIDGET_POS_KEY = "CPRecal_widget_pos";
  const FRONTEND_URL = "http://localhost:5173";

  // ─────────────────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────────────────
  function log(...args) {
    console.log("%c[CPRecal]", "color:#22c55e;font-weight:bold;", ...args);
  }

  function getTitleSlugFromUrl() {
    const match = window.location.pathname.match(/\/problems\/([^/]+)/);
    return match ? match[1] : null;
  }

  async function graphql(query, variables, operationName) {
    const res = await fetch(GRAPHQL_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ query, variables, operationName }),
    });
    if (!res.ok) throw new Error(`GraphQL request failed: ${res.status}`);
    return res.json();
  }

  function isFinalAccepted(sub) {
    if (sub.statusDisplay) return sub.statusDisplay === "Accepted";
    return sub.status === 10;
  }

  function isPending(sub) {
    return (
      sub.isPending === "Pending" ||
      sub.statusDisplay === "(processing)" ||
      sub.statusDisplay == null
    );
  }

  function statusLabel(sub) {
    if (isFinalAccepted(sub)) return "Accepted";
    if (isPending(sub)) return "Pending";
    return sub.statusDisplay || `status_${sub.status}`;
  }

  function formatDuration(totalSeconds) {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = String(str ?? "—");
    return div.innerHTML;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // GRAPHQL QUERIES
  // ─────────────────────────────────────────────────────────────────────────────
  const SUBMISSION_LIST_QUERY = `
    query submissionList($offset: Int!, $limit: Int!, $lastKey: String, $questionSlug: String!) {
      questionSubmissionList(
        offset: $offset limit: $limit lastKey: $lastKey questionSlug: $questionSlug
      ) {
        lastKey
        hasNext
        submissions {
          id title titleSlug status statusDisplay lang langName
          runtime timestamp url isPending memory
        }
      }
    }
  `;

  const SUBMISSION_DETAILS_QUERY = `
    query submissionDetails($submissionId: Int!) {
      submissionDetails(submissionId: $submissionId) {
        runtime memory code statusCode
        question { questionId titleSlug }
        lang { name verboseName }
      }
    }
  `;

  const QUESTION_DATA_QUERY = `
    query questionData($titleSlug: String!) {
      question(titleSlug: $titleSlug) {
        questionId questionFrontendId title titleSlug difficulty topicTags { name slug }
      }
    }
  `;

  async function getSubmissionList(titleSlug) {
    const result = await graphql(
      SUBMISSION_LIST_QUERY,
      { questionSlug: titleSlug, offset: 0, limit: 20, lastKey: null },
      "submissionList"
    );
    return result?.data?.questionSubmissionList?.submissions ?? [];
  }

  async function getSubmissionDetails(submissionId) {
    const result = await graphql(
      SUBMISSION_DETAILS_QUERY,
      { submissionId: Number(submissionId) },
      "submissionDetails"
    );
    return result?.data?.submissionDetails ?? null;
  }

  async function getProblemMetadata(titleSlug) {
    const result = await graphql(
      QUESTION_DATA_QUERY,
      { titleSlug },
      "questionData"
    );
    const q = result?.data?.question;
    if (!q) return null;
    return {
      questionId: q.questionId,
      frontendId: q.questionFrontendId,
      title: q.title,
      slug: q.titleSlug,
      difficulty: q.difficulty,
      tags: (q.topicTags || []).map((t) => t.name),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // BACKEND API CALLS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Call the backend to analyze code complexity using Gemini LLM.
   * The API key stays server-side — never exposed in this script.
   */
  async function analyzeCodeWithBackend({ code, problemTitle, difficulty, language, titleSlug }) {
    log("Requesting LLM analysis from backend...");

    const res = await fetch(`${BACKEND_URL}/api/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include", // sends the JWT cookie automatically
      body: JSON.stringify({ code, problemTitle, difficulty, language, titleSlug }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Analysis failed: ${res.status}`);
    }

    const analysis = await res.json();
    log("Analysis received:", analysis);
    return analysis;
  }

  /**
   * Calculate solution efficiency score (0–100) from complexity comparison.
   * Mirrors the formula in the backend's scoring.js for display purposes.
   */
  function calcEfficiencyScore(actualTC, optimalTC, actualSC, optimalSC) {
    let score = 100;
    if (actualTC !== optimalTC) score -= 30;
    if (actualSC !== optimalSC) score -= 10;
    return Math.max(0, score);
  }

  /**
   * Submit solving data to CPRecal backend ingestion endpoint.
   */
  async function submitToBackend(payload) {
    log("Submitting solving data to CPRecal backend...", payload);

    const res = await fetch(`${BACKEND_URL}/api/ingestion/submission`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include", // sends JWT cookie automatically
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));

      // Handle not-logged-in gracefully
      if (res.status === 401) {
        throw new Error("Not logged into CPRecal. Please login at the dashboard first.");
      }

      throw new Error(err.message || `Submission failed: ${res.status}`);
    }

    const result = await res.json();
    log("Submission result:", result);
    return result;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // WIDGET UI
  // ─────────────────────────────────────────────────────────────────────────────
  const Widget = (function () {
    let root, header, body, minimizeBtn, bubble;
    let collapsed = false;

    function injectStyles() {
      if (document.getElementById("cr-styles")) return;
      const style = document.createElement("style");
      style.id = "cr-styles";
      style.textContent = `
        #cr-widget {
          position: fixed; top: 20px; right: 20px; width: 360px; max-width: calc(100vw - 40px);
          background: #1c1c26; color: #e6e6ef;
          border: 1px solid #2e2e3a; border-radius: 12px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.5);
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          font-size: 13px; z-index: 999999; overflow: hidden; user-select: none;
        }
        #cr-widget * { box-sizing: border-box; }
        #cr-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 10px 12px;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          color: #fff; cursor: grab; font-weight: 700; font-size: 14px;
        }
        #cr-header:active { cursor: grabbing; }
        #cr-header-left { display: flex; align-items: center; gap: 7px; }
        #cr-header-version { font-size: 10px; opacity: 0.7; font-weight: 400; margin-top: 1px; }
        #cr-min-btn {
          background: rgba(255,255,255,0.2); border: none; color: #fff;
          width: 22px; height: 22px; border-radius: 6px; cursor: pointer;
          font-weight: 700; font-size: 16px; line-height: 1; display: flex;
          align-items: center; justify-content: center;
        }
        #cr-min-btn:hover { background: rgba(255,255,255,0.35); }
        #cr-body { padding: 13px; user-select: text; max-height: 600px; overflow-y: auto; }
        #cr-body::-webkit-scrollbar { width: 4px; }
        #cr-body::-webkit-scrollbar-thumb { background: #3a3a4a; border-radius: 2px; }
        .cr-row { display: flex; justify-content: space-between; margin-bottom: 7px; align-items: flex-start; gap: 8px; }
        .cr-label { color: #9a9aad; flex-shrink: 0; }
        .cr-value { font-weight: 600; text-align: right; word-break: break-word; }
        .cr-tag {
          display: inline-block; background: #2e2e3a; padding: 2px 8px;
          border-radius: 6px; margin: 2px 3px 0 0; font-size: 11px;
        }
        .cr-divider { border-top: 1px solid #2e2e3a; margin: 10px 0; }
        .cr-pulse {
          display: inline-block; width: 8px; height: 8px; border-radius: 50%;
          background: #facc15; margin-right: 6px;
          animation: cr-pulse-anim 1.4s infinite;
        }
        @keyframes cr-pulse-anim { 0%,100% { opacity:1; } 50% { opacity:0.25; } }
        .cr-status-row { display: flex; align-items: center; margin-bottom: 10px; }
        #cr-site-link {
          display: block; text-align: center; margin-top: 10px; padding: 9px;
          background: #2e2e3a; border-radius: 8px; font-weight: 600;
          color: #4ade80; text-decoration: none;
        }
        #cr-site-link:hover { background: #3a3a4a; }
        .cr-field { margin-bottom: 10px; }
        .cr-field label { display: block; margin-bottom: 4px; color: #c7c7d6; font-size: 12px; }
        .cr-field input {
          width: 100%; padding: 7px 9px; border-radius: 7px;
          border: 1px solid #3a3a48; background: #12121a; color: #e6e6ef; font-size: 13px;
        }
        .cr-field input:focus { outline: none; border-color: #22c55e; }
        #cr-submit-btn {
          width: 100%; padding: 10px; border: none; border-radius: 8px;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          color: #0b0b0f; font-weight: 700; cursor: pointer; font-size: 13px; margin-top: 4px;
          transition: opacity 0.15s;
        }
        #cr-submit-btn:hover:not(:disabled) { opacity: 0.88; }
        #cr-submit-btn:disabled { background: #3a3a48; color: #8a8a99; cursor: default; }
        #cr-bubble {
          position: fixed; top: 20px; right: 20px; width: 44px; height: 44px;
          border-radius: 50%; background: linear-gradient(135deg, #22c55e, #16a34a);
          color: #fff; font-weight: 700; font-size: 11px; display: none;
          align-items: center; justify-content: center; cursor: pointer;
          z-index: 999999; box-shadow: 0 6px 20px rgba(34,197,94,0.4);
          user-select: none;
        }
        .cr-success-banner {
          font-weight: 700; color: #4ade80; margin-bottom: 10px;
          display: flex; align-items: center; gap: 6px; font-size: 15px;
        }
        .cr-analysis-box {
          background: #12121a; border: 1px solid #2e2e3a;
          border-radius: 9px; padding: 11px; margin-bottom: 11px;
        }
        .cr-analysis-loading { display: flex; align-items: center; gap: 7px; color: #c7c7d6; font-size: 12px; }
        .cr-score-pill {
          display: inline-block; padding: 2px 10px; border-radius: 999px;
          font-weight: 700; font-size: 11px; margin-left: 6px;
        }
        .cr-score-high { background: #14532d; color: #4ade80; }
        .cr-score-mid  { background: #4a3b0a; color: #facc15; }
        .cr-score-low  { background: #4c1d1d; color: #f87171; }
        .cr-explanation { color: #c7c7d6; font-size: 12px; margin-top: 7px; line-height: 1.5; }
        .cr-rich-card {
          background: #171722; border: 1px solid #282836;
          border-radius: 8px; padding: 8px 10px; margin-top: 6px;
        }
        .cr-rich-title {
          font-size: 11px; font-weight: 700; text-transform: uppercase;
          letter-spacing: 0.04em; margin-bottom: 3px; display: block;
        }
        .cr-rich-text { font-size: 11.5px; color: #c7c7d6; line-height: 1.4; }
        .cr-submitted-msg { text-align: center; padding: 10px 0; }
        .cr-submitted-msg .cr-big { font-size: 28px; }
        .cr-submitted-msg .cr-title { font-weight: 700; color: #4ade80; font-size: 15px; margin: 6px 0 4px; }
        .cr-submitted-msg .cr-sub { color: #9a9aad; font-size: 12px; }
        .cr-mastery-ring {
          display: flex; align-items: center; justify-content: center;
          flex-direction: column; margin: 12px 0;
        }
        .cr-mastery-num { font-size: 32px; font-weight: 800; color: #4ade80; }
        .cr-mastery-label { font-size: 11px; color: #9a9aad; text-transform: uppercase; letter-spacing: .05em; }
        .cr-error-msg { color: #f87171; font-size: 12px; text-align: center; padding: 6px 0; }
      `;
      document.head.appendChild(style);
    }

    function buildDom() {
      if (document.getElementById("cr-widget")) return;

      root = document.createElement("div");
      root.id = "cr-widget";

      header = document.createElement("div");
      header.id = "cr-header";
      header.innerHTML = `
        <div id="cr-header-left">
          🧠 CPRecal
          <span id="cr-header-version">v3.0</span>
        </div>
        <button id="cr-min-btn" title="Minimize">–</button>
      `;

      body = document.createElement("div");
      body.id = "cr-body";

      root.appendChild(header);
      root.appendChild(body);
      document.body.appendChild(root);

      bubble = document.createElement("div");
      bubble.id = "cr-bubble";
      bubble.title = "Reopen CPRecal";
      bubble.textContent = "CR";
      document.body.appendChild(bubble);

      minimizeBtn = header.querySelector("#cr-min-btn");
      minimizeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        setCollapsed(true);
      });

      bubble.addEventListener("click", () => {
        if (!moved) setCollapsed(false);
      });

      makeDraggable();
      restorePosition();
    }

    let moved = false;

    function setCollapsed(value) {
      collapsed = value;
      root.style.display = collapsed ? "none" : "block";
      bubble.style.display = collapsed ? "flex" : "none";
    }

    function makeDraggable() {
      let dragging = false, draggedEl = null;
      let offsetX = 0, offsetY = 0;
      let lastX = null, lastY = null;

      function startDrag(el, e) {
        dragging = true; draggedEl = el; moved = false;
        const rect = el.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;
        document.body.style.userSelect = "none";
      }

      header.addEventListener("mousedown", (e) => {
        if (e.target === minimizeBtn) return;
        startDrag(root, e);
      });

      bubble.addEventListener("mousedown", (e) => startDrag(bubble, e));

      window.addEventListener("mousemove", (e) => {
        if (!dragging || !draggedEl) return;
        moved = true;
        const w = draggedEl.offsetWidth, h = draggedEl.offsetHeight;
        const x = Math.min(Math.max(0, e.clientX - offsetX), window.innerWidth - w);
        const y = Math.min(Math.max(0, e.clientY - offsetY), window.innerHeight - h);
        lastX = x; lastY = y;
        root.style.cssText += `left:${x}px;top:${y}px;right:auto;`;
        bubble.style.cssText += `left:${x}px;top:${y}px;right:auto;`;
      });

      window.addEventListener("mouseup", () => {
        if (!dragging) return;
        dragging = false;
        document.body.style.userSelect = "";
        if (moved && lastX !== null) savePosition(lastX, lastY);
        draggedEl = null;
      });
    }

    function savePosition(x, y) {
      try {
        const raw = JSON.stringify({ left: x, top: y });
        if (typeof GM_setValue === "function") GM_setValue(WIDGET_POS_KEY, raw);
        else localStorage.setItem(WIDGET_POS_KEY, raw);
      } catch (_) {}
    }

    function restorePosition() {
      try {
        const raw = typeof GM_getValue === "function"
          ? GM_getValue(WIDGET_POS_KEY, null)
          : localStorage.getItem(WIDGET_POS_KEY);
        if (!raw) return;
        const pos = JSON.parse(raw);
        root.style.cssText += `left:${pos.left}px;top:${pos.top}px;right:auto;`;
        bubble.style.cssText += `left:${pos.left}px;top:${pos.top}px;right:auto;`;
      } catch (_) {}
    }

    function renderWaiting(problem) {
      const tagsHtml = (problem?.tags ?? [])
        .map((t) => `<span class="cr-tag">${escapeHtml(t)}</span>`)
        .join("") || `<span style="color:#9a9aad">—</span>`;

      body.innerHTML = `
        <div class="cr-status-row">
          <span class="cr-pulse"></span>
          <span>Tracking your session…</span>
        </div>
        <div class="cr-divider"></div>
        <div class="cr-row">
          <span class="cr-label">Problem</span>
          <span class="cr-value">${escapeHtml(problem?.title)}</span>
        </div>
        <div class="cr-row">
          <span class="cr-label">Difficulty</span>
          <span class="cr-value">${escapeHtml(problem?.difficulty)}</span>
        </div>
        <div style="margin-top:6px;">${tagsHtml}</div>
        <a id="cr-site-link" href="${FRONTEND_URL}" target="_blank" rel="noopener">
          Open CPRecal Dashboard →
        </a>
      `;
    }

    function renderSuccess(sessionData, { onAnalyze, onSubmit }) {
      const { problem, solvingSession, submissions, acceptedDetails } = sessionData;
      const tagsHtml = (problem?.tags ?? [])
        .map((t) => `<span class="cr-tag">${escapeHtml(t)}</span>`)
        .join("") || `<span style="color:#9a9aad">—</span>`;

      const runtime = acceptedDetails?.runtime ?? "—";
      const memKB = acceptedDetails?.memory
        ? Math.round(acceptedDetails.memory / 1000) + " KB"
        : "—";

      body.innerHTML = `
        <div class="cr-success-banner">✅ Solved!</div>
        <div class="cr-row">
          <span class="cr-label">Problem</span>
          <span class="cr-value">${escapeHtml(problem?.title)}</span>
        </div>
        <div class="cr-row">
          <span class="cr-label">Difficulty</span>
          <span class="cr-value">${escapeHtml(problem?.difficulty)}</span>
        </div>
        <div style="margin-bottom:8px;">${tagsHtml}</div>
        <div class="cr-divider"></div>
        <div class="cr-row">
          <span class="cr-label">Time Taken</span>
          <span class="cr-value">${formatDuration(solvingSession.totalTimeSeconds)}</span>
        </div>
        <div class="cr-row">
          <span class="cr-label">Submissions Until Success</span>
          <span class="cr-value">${submissions.totalUntilSuccess}</span>
        </div>
        <div class="cr-row">
          <span class="cr-label">Runtime</span>
          <span class="cr-value">${runtime} ms</span>
        </div>
        <div class="cr-row">
          <span class="cr-label">Memory</span>
          <span class="cr-value">${memKB}</span>
        </div>
        <div class="cr-divider"></div>
        <div class="cr-analysis-box" id="cr-analysis-box">
          <div class="cr-analysis-loading">
            <span class="cr-pulse"></span>
            Analyzing with Gemini AI…
          </div>
        </div>
        <div class="cr-field">
          <label for="cr-input-hints">Hints Used</label>
          <input type="number" id="cr-input-hints" min="0" step="1" placeholder="e.g. 0" value="0"/>
        </div>
        <button id="cr-submit-btn" disabled>Analyzing…</button>
        <a id="cr-site-link" href="${FRONTEND_URL}" target="_blank" rel="noopener">
          Open CPRecal Dashboard →
        </a>
      `;

      const submitBtn = body.querySelector("#cr-submit-btn");
      let analysis = null;

      // Run analysis
      onAnalyze()
        .then((result) => {
          analysis = result;
          const box = body.querySelector("#cr-analysis-box");
          const eff = calcEfficiencyScore(
            result.actualTimeComplexity,
            result.optimalTimeComplexity,
            result.actualSpaceComplexity,
            result.optimalSpaceComplexity
          );
          const pillClass = eff >= 80 ? "cr-score-high" : eff >= 50 ? "cr-score-mid" : "cr-score-low";
          const pillLabel = eff >= 80 ? "Optimal" : eff >= 50 ? "Okay" : "Needs work";

          let richHtml = "";
          if (result.richAnalysis) {
            const ra = result.richAnalysis;
            if (ra.problemUnderstanding) {
              richHtml += `
                <div class="cr-rich-card">
                  <span class="cr-rich-title" style="color:#60a5fa;">📋 Requirements & Constraints</span>
                  <div class="cr-rich-text">${escapeHtml(ra.problemUnderstanding)}</div>
                </div>
              `;
            }
            if (ra.yourApproach || ra.correctness) {
              richHtml += `
                <div class="cr-rich-card">
                  <span class="cr-rich-title" style="color:#4ade80;">💡 Your Approach & Correctness</span>
                  <div class="cr-rich-text">
                    ${ra.yourApproach ? `<div>${escapeHtml(ra.yourApproach)}</div>` : ""}
                    ${ra.correctness ? `<div style="margin-top:4px;color:#a7f3d0;"><strong>Correctness:</strong> ${escapeHtml(ra.correctness)}</div>` : ""}
                  </div>
                </div>
              `;
            }
            if (ra.optimalApproach || ra.comparison) {
              richHtml += `
                <div class="cr-rich-card">
                  <span class="cr-rich-title" style="color:#facc15;">🎯 Optimal Strategy & Comparison</span>
                  <div class="cr-rich-text">
                    ${ra.optimalApproach ? `<div>${escapeHtml(ra.optimalApproach)}</div>` : ""}
                    ${ra.comparison ? `<div style="margin-top:4px;"><strong>Comparison:</strong> ${escapeHtml(ra.comparison)}</div>` : ""}
                  </div>
                </div>
              `;
            }
            if (ra.improvementSuggestions) {
              richHtml += `
                <div class="cr-rich-card" style="border-color:#1e3a8a;background:#0f172a;">
                  <span class="cr-rich-title" style="color:#93c5fd;">✨ Improvement Suggestions</span>
                  <div class="cr-rich-text" style="color:#bfdbfe;">${escapeHtml(ra.improvementSuggestions)}</div>
                </div>
              `;
            }
          }

          box.innerHTML = `
            <div class="cr-row">
              <span class="cr-label">Efficiency Score</span>
              <span class="cr-value">
                ${eff}/100
                <span class="cr-score-pill ${pillClass}">${pillLabel}</span>
              </span>
            </div>
            <div class="cr-row">
              <span class="cr-label">Your Complexity</span>
              <span class="cr-value" style="color:#60a5fa;">${escapeHtml(result.actualTimeComplexity)} | ${escapeHtml(result.actualSpaceComplexity)}</span>
            </div>
            <div class="cr-row">
              <span class="cr-label">Optimal Target</span>
              <span class="cr-value" style="color:#4ade80;">${escapeHtml(result.optimalTimeComplexity)} | ${escapeHtml(result.optimalSpaceComplexity)}</span>
            </div>
            ${richHtml ? richHtml : `<div class="cr-explanation">${escapeHtml(result.explanation)}</div>`}
          `;

          submitBtn.disabled = false;
          submitBtn.textContent = "Submit to CPRecal";
        })
        .catch((err) => {
          log("Analysis failed:", err.message);
          const box = body.querySelector("#cr-analysis-box");
          box.innerHTML = `<div class="cr-explanation" style="color:#f87171;">
            ⚠️ Analysis failed: ${escapeHtml(err.message)}<br>
            <span style="color:#9a9aad">You can still submit without analysis.</span>
          </div>`;
          submitBtn.disabled = false;
          submitBtn.textContent = "Submit to CPRecal";
        });

      // Submit handler
      submitBtn.addEventListener("click", () => {
        const hintsUsed = Number(body.querySelector("#cr-input-hints")?.value ?? 0);
        submitBtn.disabled = true;
        submitBtn.textContent = "Submitting…";
        onSubmit({ hintsUsed, analysis })
          .then((result) => renderSubmitted(result))
          .catch((err) => {
            submitBtn.disabled = false;
            submitBtn.textContent = "Retry Submit";
            const errDiv = body.querySelector(".cr-error-msg") || document.createElement("div");
            errDiv.className = "cr-error-msg";
            errDiv.textContent = `⚠️ ${err.message}`;
            submitBtn.insertAdjacentElement("afterend", errDiv);
          });
      });
    }

    function renderSubmitted(result) {
      const mastery = result?.problemMastery?.mastery ?? null;
      const nextReview = result?.fsrs?.nextReviewDate
        ? new Date(result.fsrs.nextReviewDate).toLocaleDateString()
        : null;

      body.innerHTML = `
        <div class="cr-submitted-msg">
          <div class="cr-big">🎉</div>
          <div class="cr-title">Submitted to CPRecal!</div>
          ${mastery !== null ? `
            <div class="cr-mastery-ring">
              <div class="cr-mastery-num">${mastery}</div>
              <div class="cr-mastery-label">Mastery Score</div>
            </div>
          ` : ""}
          ${nextReview ? `<div class="cr-sub">Next review: ${nextReview}</div>` : ""}
        </div>
        <a id="cr-site-link" href="${FRONTEND_URL}" target="_blank" rel="noopener">
          View on CPRecal Dashboard →
        </a>
      `;
    }

    function init() {
      injectStyles();
      buildDom();
    }

    return { init, renderWaiting, renderSuccess, setCollapsed };
  })();

  // ─────────────────────────────────────────────────────────────────────────────
  // SESSION STATE
  // ─────────────────────────────────────────────────────────────────────────────
  let currentTitleSlug = null;
  let sessionStartTime = null;
  let problem = null;
  let acceptedDetected = false;
  let pollInterval = null;
  let submissionHistory = [];
  
  // Track the latest submission ID seen at page load so we ignore old submissions
  let lastSeenTopId = null;

  // ─────────────────────────────────────────────────────────────────────────────
  // MAIN TRACKING LOGIC
  // ─────────────────────────────────────────────────────────────────────────────
  async function startSession() {
    const titleSlug = getTitleSlugFromUrl();
    if (!titleSlug || titleSlug === currentTitleSlug) return;

    // Clean up previous session
    if (pollInterval) clearInterval(pollInterval);
    acceptedDetected = false;
    submissionHistory = [];

    currentTitleSlug = titleSlug;
    sessionStartTime = new Date();

    log(`Session started: ${titleSlug} at ${sessionStartTime.toISOString()}`);

    // Fetch problem metadata
    try {
      problem = await getProblemMetadata(titleSlug);
      log("Problem metadata:", problem);
    } catch (e) {
      log("Failed to fetch problem metadata:", e.message);
      problem = { title: titleSlug, difficulty: "Unknown", tags: [], slug: titleSlug };
    }

    Widget.renderWaiting(problem);

    // Record the most recent submission at the start of the session so we don't trigger on old ones
    try {
      const initialSubs = await getSubmissionList(titleSlug);
      if (initialSubs && initialSubs.length > 0) {
        lastSeenTopId = initialSubs[0].id;
      } else {
        lastSeenTopId = null;
      }
    } catch (e) {
      log("Error fetching initial submissions:", e.message);
    }

    // Start polling for new submissions
    pollInterval = setInterval(() => pollSubmissions(), 4000);
  }

  async function pollSubmissions() {
    if (acceptedDetected) return;

    try {
      const subs = await getSubmissionList(currentTitleSlug);
      if (!subs || subs.length === 0) return;

      // Build submission history (only new submissions made AFTER lastSeenTopId)
      // Find the index of lastSeenTopId to only process newer ones
      const lastSeenIndex = subs.findIndex(s => s.id === lastSeenTopId);
      const newSubs = lastSeenIndex === -1 ? subs : subs.slice(0, lastSeenIndex);

      if (newSubs.length === 0) return;

      for (const sub of newSubs) {
        if (!isPending(sub) && !submissionHistory.some((h) => h.submissionId === String(sub.id))) {
          submissionHistory.push({
            submissionId: String(sub.id),
            status: statusLabel(sub),
            runtime: sub.runtime ? parseInt(sub.runtime) : null,
            memory: sub.memory ? parseInt(sub.memory) : null,
            language: sub.lang,
            timestamp: new Date(sub.timestamp * 1000).toISOString(),
          });
        }
      }

      // Check if the most recent new submission is Accepted
      const mostRecent = newSubs[0];
      if (mostRecent && !isPending(mostRecent)) {
        if (isFinalAccepted(mostRecent)) {
          acceptedDetected = true;
          clearInterval(pollInterval);
          await handleAccepted(mostRecent);
        } else {
          // If it's a wrong answer/TLE, update lastSeenTopId so we don't re-process it
          lastSeenTopId = mostRecent.id;
        }
      }
    } catch (e) {
      log("Polling error:", e.message);
    }
  }

  async function handleAccepted(acceptedSub) {
    const sessionEnd = new Date();
    const totalTimeSeconds = Math.round((sessionEnd - sessionStartTime) / 1000);

    log("Accepted! Fetching code details...");

    // Fetch full submission details (includes code)
    let acceptedDetails = null;
    try {
      acceptedDetails = await getSubmissionDetails(acceptedSub.id);
    } catch (e) {
      log("Failed to fetch submission details:", e.message);
    }

    const acceptedCode = acceptedDetails?.code ?? "";
    const language = acceptedDetails?.lang?.name ?? acceptedSub.lang ?? "unknown";

    // Ensure accepted submission is in history with correct status
    if (!submissionHistory.some((h) => h.submissionId === String(acceptedSub.id))) {
      submissionHistory.push({
        submissionId: String(acceptedSub.id),
        status: "Accepted",
        runtime: acceptedSub.runtime ? parseInt(acceptedSub.runtime) : (acceptedDetails?.runtime ? parseInt(acceptedDetails.runtime) : null),
        memory: acceptedSub.memory ? parseInt(acceptedSub.memory) : (acceptedDetails?.memory ? parseInt(acceptedDetails.memory) : null),
        language,
        timestamp: new Date(acceptedSub.timestamp * 1000).toISOString(),
      });
    }

    const sessionData = {
      problem,
      solvingSession: { startTime: sessionStartTime.toISOString(), endTime: sessionEnd.toISOString(), totalTimeSeconds },
      submissions: { history: submissionHistory, totalUntilSuccess: submissionHistory.length },
      acceptedDetails: {
        submissionId: String(acceptedSub.id),
        code: acceptedCode,
        language,
        runtime: acceptedSub.runtime ? parseInt(acceptedSub.runtime) : null,
        memory: acceptedSub.memory ? parseInt(acceptedSub.memory) : null,
      }
    };

    log("Session data ready:", sessionData);

    Widget.renderSuccess(sessionData, {
      // Called immediately to analyze with Gemini
      onAnalyze: () => analyzeCodeWithBackend({
        code: acceptedCode,
        problemTitle: problem?.title ?? currentTitleSlug,
        difficulty: problem?.difficulty ?? "Medium",
        language,
        titleSlug: currentTitleSlug,
      }),

      // Called when user clicks "Submit to CPRecal"
      onSubmit: ({ hintsUsed, analysis }) => {
        const payload = {
          problemId: parseInt(problem?.questionId ?? problem?.frontendId ?? 0),
          title: problem?.title ?? currentTitleSlug,
          titleSlug: currentTitleSlug,
          difficulty: problem?.difficulty ?? "Medium",
          patterns: problem?.tags ?? [],
          sessionStart: sessionStartTime.toISOString(),
          sessionEnd: sessionEnd.toISOString(),
          submissionHistory,
          acceptedSubmissionId: String(acceptedSub.id),
          acceptedCode,
          language,
          hintsUsed: parseInt(hintsUsed) || 0,
          analysisResult: analysis ?? {
            actualTimeComplexity: "Unknown",
            actualSpaceComplexity: "Unknown",
            optimalTimeComplexity: "Unknown",
            optimalSpaceComplexity: "Unknown",
            explanation: "Analysis was not available.",
          },
        };
        return submitToBackend(payload);
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // INIT & SPA NAVIGATION DETECTION
  // ─────────────────────────────────────────────────────────────────────────────
  Widget.init();

  // Initial page load
  startSession();

  // LeetCode is a SPA — watch for URL changes
  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      const slug = getTitleSlugFromUrl();
      if (slug && slug !== currentTitleSlug) {
        log("Navigation detected, starting new session...");
        startSession();
      }
    }
  }).observe(document.body, { childList: true, subtree: true });

  log("CPRecal extension v3.0 initialized ✓");
})();
