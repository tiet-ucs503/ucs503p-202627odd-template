// utils/feedback.js — reconcile pass: resolve pending rows into labels, then (shadow mode)
// update BOTH the per-user bandit AND the per-sender memory from the honest signals.
// Drives no decisions — the global model still runs everything.
const Feedback = require("../models/Feedback");
const { getAuthClient } = require("./gmail");
const { google } = require("googleapis");
const { update, CONTEXT_DIM } = require("./bandit");
const { loadState, saveState } = require("./banditStore");
const { updateSenderStats } = require("./senderMemory");

const MIN_AGE_HOURS = 24;

// Honest signals only — exclude self-confirming "archived_untouched".
const GOLD = new Set(["starred", "read", "unarchived", "user_archived", "trashed", "deleted"]);

async function reconcileFeedback(user) {
    const auth = getAuthClient(user);
    const gmail = google.gmail({ version: "v1", auth });

    const cutoff = new Date(Date.now() - MIN_AGE_HOURS * 3600 * 1000);
    const pending = await Feedback.find({ googleId: user.googleId, outcome: "pending", scoredAt: { $lte: cutoff } }).limit(100);
    if (pending.length === 0) return;

    const bandit = await loadState(user.googleId, CONTEXT_DIM);
    let banditDirty = false;

    // learn from one honest, resolved row: update sender memory + the bandit
    const learn = async (fb, outcome, label) => {
        if (!GOLD.has(outcome) || (label !== 0 && label !== 1)) return;
        if (fb.sender) await updateSenderStats(user.googleId, fb.sender, label);
        if (Array.isArray(fb.context) && fb.context.length === bandit.d) {
            update(bandit, fb.context, label);   // uses the context as it was at scoring time
            banditDirty = true;
        }
    };

    for (const fb of pending) {
        let labels;
        try {
            const msg = await gmail.users.messages.get({ userId: "me", id: fb.messageId, format: "minimal" });
            labels = msg.data.labelIds || [];
        } catch (e) {
            if (e.code === 404) { await resolve(fb, "deleted", 0); await learn(fb, "deleted", 0); }
            continue;
        }

        const s = {
            unread: labels.includes("UNREAD"),
            starred: labels.includes("STARRED"),
            inInbox: labels.includes("INBOX"),
            inTrash: labels.includes("TRASH"),
        };
        const { outcome, label } = classify(fb, s);
        if (outcome) { await resolve(fb, outcome, label); await learn(fb, outcome, label); }
    }

    if (banditDirty) {
        await saveState(user.googleId, bandit);
        console.log(`[${user.email}] bandit updated — n=${bandit.n}`);
    }
}

function classify(fb, s) {
    if (fb.action === "archived") {
        if (s.inInbox) return { outcome: "unarchived", label: 1 };
        if (s.inTrash) return { outcome: "deleted", label: 0 };
        return { outcome: "archived_untouched", label: 0 };   // confounded — not fed to bandit/memory
    }
    if (s.starred) return { outcome: "starred", label: 1 };
    if (!s.unread && s.inInbox) return { outcome: "read", label: 1 };
    if (s.inTrash) return { outcome: "trashed", label: 0 };
    if (!s.inInbox) return { outcome: "user_archived", label: 0 };
    return { outcome: null, label: null };
}

async function resolve(fb, outcome, label) {
    fb.outcome = outcome;
    fb.label = label;
    fb.resolvedAt = new Date();
    await fb.save();
}

module.exports = { reconcileFeedback };