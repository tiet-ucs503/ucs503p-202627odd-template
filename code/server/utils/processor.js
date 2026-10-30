// utils/processor.js — fetch → score → (archive | explore | keep) → log sender-aware context → checkpoint
const { google } = require("googleapis");
const User = require("../models/User");
const { getAuthClient, getCurrentHistoryId, fetchNewSince } = require("./gmail");
const { scoreEmails } = require("./scoring");
const Feedback = require("../models/Feedback");
const { buildContext } = require("./bandit");
const { normalizeSender, categoryOf, isBulk, getSenderEngagement } = require("./senderMemory");

const ARCHIVE_THRESHOLD = parseFloat(process.env.ARCHIVE_THRESHOLD || "0.2");
const EXPLORE_MIN = parseFloat(process.env.EXPLORE_MIN || "0.1");
const EXPLORE_RATE = parseFloat(process.env.EXPLORE_RATE || "0.3");

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

// Store the decision + the sender-aware context used to make it.
async function logFeedback(user, email, score, action, explored, extra) {
    try {
        await Feedback.updateOne(
            { googleId: user.googleId, messageId: email.id },
            {
                $setOnInsert: {
                    googleId: user.googleId,
                    messageId: email.id,
                    threadId: email.threadId || null,
                    predictedScore: score,
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

        let archivedCount = 0, exploredCount = 0;
        for (const e of scored) {
            if (e.score === null) continue;

            // --- build the sender-aware context (also stored for consistent learning) ---
            const sender = normalizeSender(e.sender);
            const category = categoryOf(e.gmail_labels);
            const { rate, seenBefore } = await getSenderEngagement(user.googleId, sender);
            const context = buildContext(e.score, {
                senderEngagement: rate,
                senderSeenBefore: seenBefore,
                isBulk: isBulk(category, e.unsubscribe),
            });
            const extra = { sender, category, context };

            // --- decision is still global-score based (shadow mode); bandit only learns for now ---
            if (e.score >= ARCHIVE_THRESHOLD) {
                await logFeedback(user, e, e.score, "kept", false, extra);
                continue;
            }
            const inBand = e.score >= EXPLORE_MIN && e.score < ARCHIVE_THRESHOLD;
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
        console.log(`[${user.email}] processed ${scored.length} new, archived ${archivedCount}, explored ${exploredCount}`);
        return { processed: scored.length, archived: archivedCount, explored: exploredCount };
    } catch (err) {
        console.error(`[${user.email}] processing error:`, err.message);
        return { error: err.message };
    }
}

module.exports = { processUser };