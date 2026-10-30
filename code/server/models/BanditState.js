// models/BanditState.js — one LinUCB state per user, persisted in MongoDB.
// A is a d x d matrix, b is a d-vector; both stored as plain arrays.
const mongoose = require("mongoose");

const banditStateSchema = new mongoose.Schema(
    {
        googleId: { type: String, required: true, unique: true, index: true },
        d: { type: Number, required: true },       // context dimension
        A: { type: [[Number]], required: true },   // d x d
        b: { type: [Number], required: true },     // d
        n: { type: Number, default: 0 },           // number of updates applied
    },
    { timestamps: true }
);

module.exports = mongoose.model("BanditState", banditStateSchema);