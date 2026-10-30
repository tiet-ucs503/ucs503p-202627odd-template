// utils/banditStore.js — load/save a user's LinUCB state from MongoDB.
const BanditState = require("../models/BanditState");
const { newState } = require("./bandit");

// Load this user's state, or a fresh one if none exists yet.
// If the stored context dimension differs from the current d (because you added
// context features), start fresh so old and new vectors don't mix.
async function loadState(googleId, d) {
    const doc = await BanditState.findOne({ googleId }).lean();
    if (!doc || doc.d !== d) return newState(d);
    return { d: doc.d, A: doc.A, b: doc.b, n: doc.n };
}

async function saveState(googleId, state) {
    await BanditState.updateOne(
        { googleId },
        { $set: { d: state.d, A: state.A, b: state.b, n: state.n } },
        { upsert: true }
    );
}

module.exports = { loadState, saveState };