// models/SenderStats.js — per-user, per-sender engagement memory.
// engagement_rate (smoothed) = (engaged + 1) / (seen + 2)
const mongoose = require("mongoose");

const senderStatsSchema = new mongoose.Schema(
    {
        googleId: { type: String, required: true },
        sender: { type: String, required: true },   // normalized address
        seen: { type: Number, default: 0 },        // resolved interactions
        engaged: { type: Number, default: 0 },        // read / star / reply / unarchive
        dismissed: { type: Number, default: 0 },        // user-archived / trashed / deleted
    },
    { timestamps: true }
);
senderStatsSchema.index({ googleId: 1, sender: 1 }, { unique: true });

module.exports = mongoose.model("SenderStats", senderStatsSchema);