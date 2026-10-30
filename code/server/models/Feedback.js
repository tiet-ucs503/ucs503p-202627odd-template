// models/Feedback.js — one row per scored email. Now stores the sender, category, and
// the exact context vector used at scoring time, so learning is consistent and sender-aware.
const mongoose = require("mongoose");

const feedbackSchema = new mongoose.Schema(
    {
        googleId: { type: String, required: true, index: true },
        messageId: { type: String, required: true },
        threadId: { type: String },
        predictedScore: { type: Number, required: true },
        action: { type: String, required: true },   // "archived" | "kept"
        explored: { type: Boolean, default: false },
        sender: { type: String },                   // NEW: normalized sender address
        category: { type: String },                   // NEW: primary|promotions|social|updates|forums
        context: { type: [Number] },                 // NEW: bandit context vector at scoring time
        features: { type: Object },
        label: { type: Number, default: null },
        outcome: { type: String, default: "pending" },
        scoredAt: { type: Date, default: Date.now },
        resolvedAt: { type: Date },
    },
    { timestamps: true }
);
feedbackSchema.index({ googleId: 1, messageId: 1 }, { unique: true });

module.exports = mongoose.model("Feedback", feedbackSchema);