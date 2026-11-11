// utils/processor.js — fetch → score → DECIDE (global or bandit) → explore/archive → log → checkpoint
//
// BANDIT DECISIONS ARE OFF BY DEFAULT. With BANDIT_LIVE unset/false this behaves EXACTLY like
// shadow mode (global model decides, bandit only learns). Set BANDIT_LIVE=true in the Lambda env
// vars — no redeploy needed — to let the bandit drive archiving, guarded by safety rails.
const { google } = require("googleapis");
const User = require("../models/User");
const { getAuthClient, getCurrentHistoryId, fetchNewSince } = require("./gmail");
const { scoreEmails } = require("./scoring");
const Feedback = require("../models/Feedback");
const { buildContext, predict, CONTEXT_DIM } = require("./bandit");
const { loadState } = require("./banditStore");
const { normalizeSender, categoryOf, isBulk, getSenderEngagement } = require("./senderMemory");

const ARCHIVE_THRESHOLD = parseFloat(process.env.ARCHIVE_THRESHOLD || "0.2");
const EXPLORE_MIN = parseFloat(process.env.EXPLORE_MIN || "0.1");
const EXPLORE_RATE = parseFloat(process.env.EXPLORE_RATE || "0.3");

// --- Bandit decision controls (all OFF-safe) ---
const BANDIT_LIVE = process.env.BANDIT_LIVE === "true";                 // master switch (default OFF)
const MIN_LEARNED = parseInt(process.env.BANDIT_MIN_N || "30", 10);     // per-user training floor
const HIGH_CONFIDENCE = parseFloat(process.env.HIGH_CONFIDENCE || "0.6");   // never hide a clearly-important email

const clamp = (v) => Math.max(0, Math.min(1, v));

async function getArchiveLabelId(gmail) {
    const res = await gmail.users.labels.list({ userId: "me" });
    const existing = (res.data.labels || []).find((l) => l.name === "Vigilante/Archived");
    if (existing) return existing.id;
    const created = await gmail.users.labels.create({
        userId: "me",
        requestBody: { name: "Vigilante/Archived", labelListVisibility: "labelShow", messageListVisibility: "show" },
    });
    return created.data.id;
}

async function archiveEmail(user, messageId) {
    const auth = getAuthClient(user);
    const gmail = google.gmail({ version: "v1", auth });
    const labelId = await getArchiveLabelId(gmail);
    await gmail.users.messages.modify({ userId: "me", id: messageId, requestBody: { removeLabelIds: ["INBOX"], addLabelIds: [labelId] } });
}

// NOTE: predictedScore ALWAYS logs the GLOBAL model's score, even when the bandit drove the
// decision — so the measurement can always compare global-vs-bandit honestly.
async function logFeedback(user, email, globalScore, action, explored, extra) {
    try {
        await Feedback.updateOne(
            { googleId: user.googleId, messageId: email.id },
            {
                $setOnInsert: {
                    googleId: user.googleId,
                    messageId: email.id,
                    threadId: email.threadId || null,
                    predictedScore: globalScore,        // always the global score
                    action,
                    explored: !!explored,
                    sender: extra.sender,
                    category: extra.category,
                    context: extra.context,
                    features: email.features || null,
                    scoredAt: new Date(),
                },
            },
            { upsert: true }
        );
    } catch (err) {
        console.error(`[${user.email}] feedback log failed for ${email.id}:`, err.message);
    }
}

async function processUser(user) {
    try {
        if (!user.lastHistoryId) {
            const currentId = await getCurrentHistoryId(user);
            user.lastHistoryId = currentId;
            await user.save();
            console.log(`[${user.email}] seeded checkpoint at ${currentId}`);
            return { seeded: true, processed: 0 };
        }

        let result;
        try {
            result = await fetchNewSince(user, user.lastHistoryId);
        } catch (err) {
            if (err.code === 404 || String(err).includes("historyId")) {
                const currentId = await getCurrentHistoryId(user);
                user.lastHistoryId = currentId;
                await user.save();
                console.log(`[${user.email}] checkpoint expired, re-seeded at ${currentId}`);
                return { reseeded: true, processed: 0 };
            }
            throw err;
        }

        const { emails, latestHistoryId } = result;
        if (emails.length === 0) {
            if (latestHistoryId && latestHistoryId !== user.lastHistoryId) { user.lastHistoryId = latestHistoryId; await user.save(); }
            return { processed: 0 };
        }

        const scored = await scoreEmails(emails);

        // Load the user's bandit ONLY when it will actually drive decisions (no extra DB read in shadow mode).
        let bandit = null;
        if (BANDIT_LIVE) {
            try { bandit = await loadState(user.googleId, CONTEXT_DIM); }
            catch (e) { console.error(`[${user.email}] bandit load failed, using global:`, e.message); }
        }

        let archivedCount = 0, exploredCount = 0, banditDecisions = 0;
        for (const e of scored) {
            if (e.score === null) continue;

            const sender = normalizeSender(e.sender);
            const category = categoryOf(e.gmail_labels);
            const { rate, seenBefore } = await getSenderEngagement(user.googleId, sender);
            const context = buildContext(e.score, {
                senderEngagement: rate, senderSeenBefore: seenBefore, isBulk: isBulk(category, e.unsubscribe),
            });
            const extra = { sender, category, context };

            // --- Choose the score that drives the decision ---
            // Default: the proven global model. Bandit takes over ONLY when it is live, has learned
            // enough for this user, and the email is NOT already clearly important (a safety rail that
            // guarantees a high-confidence email is never hidden by an under-trained bandit).
            let decisionScore = e.score;
            if (BANDIT_LIVE && bandit && bandit.n >= MIN_LEARNED && e.score < HIGH_CONFIDENCE) {
                decisionScore = clamp(predict(bandit, context));
                banditDecisions++;
            }

            // --- Decide: keep / explore (keep visible) / archive ---
            if (decisionScore >= ARCHIVE_THRESHOLD) {
                await logFeedback(user, e, e.score, "kept", false, extra);
                continue;
            }
            const inBand = decisionScore >= EXPLORE_MIN && decisionScore < ARCHIVE_THRESHOLD;
            if (inBand && Math.random() < EXPLORE_RATE) {
                await logFeedback(user, e, e.score, "kept", true, extra);
                exploredCount++;
                continue;
            }
            await archiveEmail(user, e.id);
            archivedCount++;
            await logFeedback(user, e, e.score, "archived", false, extra);
        }

        user.lastHistoryId = latestHistoryId;
        await user.save();
        console.log(
            `[${user.email}] processed ${scored.length}, archived ${archivedCount}, explored ${exploredCount}` +
            (BANDIT_LIVE ? `, bandit-decided ${banditDecisions}` : "")
        );
        return { processed: scored.length, archived: archivedCount, explored: exploredCount, banditDecisions };
    } catch (err) {
        console.error(`[${user.email}] processing error:`, err.message);
        return { error: err.message };
    }
}

module.exports = { processUser };