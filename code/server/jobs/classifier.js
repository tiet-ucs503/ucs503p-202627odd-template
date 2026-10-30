// jobs/classifier.js — the background loop that runs for all users on a schedule
const cron = require("node-cron");
const User = require("../models/User");
const { processUser } = require("../utils/processor");

let isRunning = false; // prevents overlapping runs

async function runCycle() {
    // If the previous cycle is still going, skip this one
    if (isRunning) {
        console.log("[job] previous cycle still running, skipping");
        return;
    }
    isRunning = true;

    try {
        const users = await User.find({ connected: true });
        console.log(`[job] cycle start — ${users.length} connected user(s)`);

        for (const user of users) {
            await processUser(user);
        }

        console.log("[job] cycle complete");
    } catch (err) {
        console.error("[job] cycle error:", err.message);
    } finally {
        isRunning = false;
    }
}

function startClassifierJob() {
    // Run every 2 minutes
    cron.schedule("*/2 * * * *", runCycle);
    console.log("Background classifier job scheduled (every 2 minutes)");
}

module.exports = { startClassifierJob, runCycle };