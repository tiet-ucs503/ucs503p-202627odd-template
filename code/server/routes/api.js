// routes/api.js — JSON API for the React frontend
const express = require("express");
const { google } = require("googleapis");
const User = require("../models/User");
const { getAuthClient, fetchRecentEmails } = require("../utils/gmail");
const { scoreEmails } = require("../utils/scoring");

const router = express.Router();

function requireAuth(req, res, next) {
    if (!req.session.userId) {
        return res.status(401).json({ error: "not_authenticated" });
    }
    next();
}

// GET /api/status — is the user connected?
router.get("/status", async (req, res) => {
    if (!req.session.userId) return res.json({ connected: false });
    const user = await User.findById(req.session.userId);
    res.json({ connected: !!user?.connected, email: user?.email });
});

// GET /api/emails — the prioritized inbox (scored, sorted)
router.get("/emails", requireAuth, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        if (!user) return res.status(401).json({ error: "user_not_found" });

        let emails = await fetchRecentEmails(user, 20);
        emails = await scoreEmails(emails);
        emails.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

        res.json({ email: user.email, emails });
    } catch (err) {
        console.error("API /emails error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/archived — emails Vigilante archived (tagged with the label)
router.get("/archived", requireAuth, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        if (!user) return res.status(401).json({ error: "user_not_found" });

        const auth = getAuthClient(user);
        const gmail = google.gmail({ version: "v1", auth });

        // find messages with our label
        const list = await gmail.users.messages.list({
            userId: "me",
            maxResults: 30,
            q: "label:Vigilante/Archived",
        });

        const messages = list.data.messages || [];
        const emails = [];
        for (const msg of messages) {
            const detail = await gmail.users.messages.get({
                userId: "me",
                id: msg.id,
                format: "metadata",
                metadataHeaders: ["From", "Subject"],
            });
            const headers = detail.data.payload?.headers || [];
            const getHeader = (name) =>
                headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || "";
            emails.push({
                id: detail.data.id,
                sender: getHeader("From"),
                subject: getHeader("Subject"),
                snippet: detail.data.snippet || "",
            });
        }

        res.json({ emails });
    } catch (err) {
        console.error("API /archived error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/restore/:id — restore an archived email to the inbox
router.post("/restore/:id", requireAuth, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        if (!user) return res.status(401).json({ error: "user_not_found" });

        const auth = getAuthClient(user);
        const gmail = google.gmail({ version: "v1", auth });

        // find the Vigilante/Archived label id
        const labelsRes = await gmail.users.labels.list({ userId: "me" });
        const label = (labelsRes.data.labels || []).find(
            (l) => l.name === "Vigilante/Archived"
        );

        await gmail.users.messages.modify({
            userId: "me",
            id: req.params.id,
            requestBody: {
                addLabelIds: ["INBOX"],
                removeLabelIds: label ? [label.id] : [],
            },
        });

        res.json({ success: true });
    } catch (err) {
        console.error("API /restore error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;