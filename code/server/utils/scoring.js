// utils/scoring.js — sends emails to the Python scoring service
const axios = require("axios");

const SCORING_URL = process.env.SCORING_SERVICE_URL || "http://localhost:8000";

async function scoreEmails(emails) {
    const payload = emails.map((e) => ({
        sender: e.sender,
        subject: e.subject,
        snippet: e.snippet,
        gmail_labels: e.gmail_labels,
        account: "personal",
    }));

    // helper: one attempt with a 60s timeout (enough for a cold Render wake-up)
    async function attempt() {
        const res = await axios.post(`${SCORING_URL}/score-batch`, payload, {
            timeout: 60000, // 60 seconds
        });
        return res.data.results;
    }

    let results;
    try {
        results = await attempt();
    } catch (err) {
        // First call failed (likely Render cold start). Wait, then retry once — Render is awake now.
        console.warn("Scoring first attempt failed, retrying:", err.message);
        await new Promise((r) => setTimeout(r, 3000)); // wait 3s
        try {
            results = await attempt();
        } catch (err2) {
            console.error("Scoring failed after retry:", err2.message);
            // give up — return unscored so the loop doesn't crash
            return emails.map((e) => ({ ...e, score: null, decision: "unknown" }));
        }
    }

    return emails.map((e, i) => ({
        ...e,
        score: results[i].score,
        decision: results[i].decision,
    }));
}

// ping Render's health endpoint to keep it awake
async function pingScoringService() {
    try {
        await axios.get(`${SCORING_URL}/health`, { timeout: 10000 });
    } catch (err) {
        // ignore — this is just a keep-warm ping
    }
}

module.exports = { scoreEmails, pingScoringService };