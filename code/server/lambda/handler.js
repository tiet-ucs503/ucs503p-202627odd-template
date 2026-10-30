// lambda/handler.js — serverless entry point for the background classifier
require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/User");
const { processUser } = require("../utils/processor");
const { pingScoringService } = require("../utils/scoring");
const { reconcileFeedback } = require("../utils/feedback");
// ... inside the handler, before the user loop:

// Reuse the DB connection across warm invocations (serverless best practice)
let conn = null;
async function connectDB() {
    if (conn && mongoose.connection.readyState === 1) {
        return conn; // already connected (warm start) — reuse
    }
    conn = await mongoose.connect(process.env.MONGODB_URI);
    return conn;
}

// The handler — this is what the cloud scheduler triggers
exports.handler = async (event) => {
    try {
        await connectDB();
        await pingScoringService();

        const users = await User.find({ connected: true });
        console.log(`[lambda] cycle start — ${users.length} connected user(s)`);

        const results = [];
        for (const user of users) {
            const r = await processUser(user);
            results.push({ email: user.email, ...r });
        }
        for (const user of users) {
            try { await reconcileFeedback(user); }
            catch (e) { console.error("reconcile failed for", user.email, e.message); }
        }

        console.log("[lambda] cycle complete", JSON.stringify(results));

        return {
            statusCode: 200,
            body: JSON.stringify({ processed: results.length, results }),
        };
    } catch (err) {
        console.error("[lambda] cycle error:", err.message);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: err.message }),
        };
    }
    // Note: we do NOT disconnect mongoose — keeping it open lets warm
    // invocations reuse the connection, which is the serverless pattern.
};