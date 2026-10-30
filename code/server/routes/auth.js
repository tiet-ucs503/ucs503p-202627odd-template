// routes/auth.js — the Google OAuth flow
const express = require("express");
const { google } = require("googleapis");
const User = require("../models/User");

const router = express.Router();

// --- Set up the OAuth2 client with your credentials ---
const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
);

// The permission we request: read + modify (needed to archive later)
const SCOPES = [
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
];

// --- Route 1: start the connection ---
// User visits /auth/google → we send them to Google's consent screen
router.get("/google", (req, res) => {
    const url = oauth2Client.generateAuthUrl({
        access_type: "offline",   // ← CRITICAL: makes Google return a refresh token
        prompt: "consent",         // ← forces consent so we always get a refresh token
        scope: SCOPES,
    });
    res.redirect(url);
});

// --- Route 2: the callback ---
// Google sends the user back here with a temporary code
router.get("/google/callback", async (req, res) => {
    try {
        const { code } = req.query;
        if (!code) {
            return res.render("error", { message: "No code received from Google." });
        }

        // Exchange the code for tokens
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);

        // Get the user's profile (email, name, id)
        const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
        const { data: profile } = await oauth2.userinfo.get();

        // Save or update the user in MongoDB
        const user = await User.findOneAndUpdate(
            { googleId: profile.id },
            {
                googleId: profile.id,
                email: profile.email,
                name: profile.name,
                // only overwrite refreshToken if Google sent a new one
                ...(tokens.refresh_token && { refreshToken: tokens.refresh_token }),
                accessToken: tokens.access_token,
                tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
                connected: true,
            },
            { upsert: true, new: true } // create if not exists
        );

        // Store the user id in the session (they're now "logged in")
        req.session.userId = user._id;

        // Show a success page confirming the connection
        res.render("success", {
            email: user.email,
            hasRefreshToken: !!user.refreshToken,
        });
    } catch (err) {
        console.error("OAuth callback error:", err.message);
        res.render("error", { message: err.message });
    }
});

// --- Route 3: check connection status ---
router.get("/status", async (req, res) => {
    if (!req.session.userId) return res.json({ connected: false });
    const user = await User.findById(req.session.userId);
    res.json({ connected: !!user?.connected, email: user?.email });
});

module.exports = router;