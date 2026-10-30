// routes/emails.js — fetch, score, and display a user's inbox
const express = require("express");
const User = require("../models/User");
const { fetchRecentEmails } = require("../utils/gmail");
const { scoreEmails } = require("../utils/scoring");

const router = express.Router();

function requireAuth(req, res, next) {
    if (!req.session.userId) {
        return res.redirect("/auth/google");
    }
    next();
}

// Decide the badge label/class from a score
function badgeFor(score) {
    if (score === null || score === undefined) {
        return { cls: "badge-unknown", text: "n/a", dimmed: false, display: "n/a" };
    }
    if (score >= 0.4) {
        return { cls: "badge-high", text: "Important", dimmed: false, display: score.toFixed(2) };
    }
    if (score >= 0.2) {
        return { cls: "badge-mid", text: "Low", dimmed: true, display: score.toFixed(2) };
    }
    return { cls: "badge-low", text: "Archive", dimmed: true, display: score.toFixed(2) };
}

router.get("/fetch", requireAuth, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        if (!user) return res.redirect("/auth/google");

        // 1. Fetch
        let emails = await fetchRecentEmails(user, 20);

        // 2. Score
        emails = await scoreEmails(emails);

        // 3. Sort by score (highest first)
        emails.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

        // 4. Attach badge info for the template
        emails = emails.map((e) => ({ ...e, badge: badgeFor(e.score) }));

        res.render("emails", { email: user.email, emails });
    } catch (err) {
        console.error("Fetch error:", err.message);
        res.render("error", { message: err.message });
    }
});
const { runCycle } = require("../jobs/classifier");

// GET /emails/run-cycle — manually trigger one background cycle (for testing)
router.get("/run-cycle", requireAuth, async (req, res) => {
    await runCycle();
    res.send("Cycle run — check the server console for results.");
});

module.exports = router;