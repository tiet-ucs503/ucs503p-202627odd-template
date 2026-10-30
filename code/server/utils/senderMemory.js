// utils/senderMemory.js — per-user, per-sender engagement memory + email signal helpers.
// This is what gives the bandit sender-level personalization: a running record of how
// each user has treated mail from each sender.
const SenderStats = require("../models/SenderStats");

// "Advisor Name <advisor@thapar.edu>" -> "advisor@thapar.edu"
function normalizeSender(from) {
    if (!from) return "unknown";
    const m = from.match(/<([^>]+)>/);
    const addr = (m ? m[1] : from).trim().toLowerCase();
    return addr || "unknown";
}

// Gmail category from the message's labelIds
function categoryOf(labels = []) {
    if (labels.includes("CATEGORY_PROMOTIONS")) return "promotions";
    if (labels.includes("CATEGORY_SOCIAL")) return "social";
    if (labels.includes("CATEGORY_UPDATES")) return "updates";
    if (labels.includes("CATEGORY_FORUMS")) return "forums";
    return "primary";
}

// bulk = promotional/social, or carries an unsubscribe header
function isBulk(category, unsubscribe) {
    return category === "promotions" || category === "social" || !!unsubscribe ? 1 : 0;
}

// Smoothed engagement rate for this (user, sender). Neutral 0.5 when we have no history.
async function getSenderEngagement(googleId, sender) {
    const doc = await SenderStats.findOne({ googleId, sender }).lean();
    if (!doc || !doc.seen) return { rate: 0.5, seenBefore: 0 };
    return { rate: (doc.engaged + 1) / (doc.seen + 2), seenBefore: 1 };
}

// recency weight for sender memory: lower than the bandit's, so sender taste adapts faster.
const SENDER_GAMMA = parseFloat(process.env.SENDER_GAMMA || "0.98");

// Record one resolved interaction with a sender, decaying old counts so recent behavior
// dominates. label 1 = engaged, 0 = dismissed.
async function updateSenderStats(googleId, sender, label) {
    const doc = await SenderStats.findOne({ googleId, sender });
    const g = SENDER_GAMMA;
    const seen = (doc && doc.seen ? doc.seen : 0) * g + 1;
    const engaged = (doc && doc.engaged ? doc.engaged : 0) * g + (label === 1 ? 1 : 0);
    const dismissed = (doc && doc.dismissed ? doc.dismissed : 0) * g + (label === 0 ? 1 : 0);
    await SenderStats.updateOne({ googleId, sender }, { $set: { seen, engaged, dismissed } }, { upsert: true });
}

module.exports = { normalizeSender, categoryOf, isBulk, getSenderEngagement, updateSenderStats };