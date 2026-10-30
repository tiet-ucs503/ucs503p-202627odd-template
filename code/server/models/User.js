// what we store about each connected user
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
    {
        // --- Identity (who this user is) ---
        googleId: { type: String, required: true, unique: true },
        email: { type: String, required: true },
        name: { type: String },

        // --- Tokens (the keys to their Gmail) ---
        refreshToken: { type: String, required: true }, // long-lived — keeps us connected forever
        accessToken: { type: String },                 // short-lived — auto-refreshed
        tokenExpiry: { type: Date },                    // when the access token expires

        // --- Checkpoint (so we never miss or re-process mail) ---
        lastHistoryId: { type: String },                 // Gmail's marker of last-processed point

        // --- Connection state ---
        connected: { type: Boolean, default: true },  // false if they revoke/disconnect
    },
    { timestamps: true } // auto-adds createdAt / updatedAt
);

module.exports = mongoose.model("User", userSchema);