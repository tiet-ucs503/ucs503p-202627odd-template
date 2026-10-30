// utils/gmail.js — builds an authenticated Gmail client for a user
const { google } = require("googleapis");
const User = require("../models/User");

// Create an OAuth client loaded with a user's stored tokens
function getAuthClient(user) {
    const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
    );

    oauth2Client.setCredentials({
        refresh_token: user.refreshToken,
        access_token: user.accessToken,
        expiry_date: user.tokenExpiry ? user.tokenExpiry.getTime() : null,
    });

    // When the library auto-refreshes the access token, save the new one
    oauth2Client.on("tokens", async (tokens) => {
        const update = {};
        if (tokens.access_token) update.accessToken = tokens.access_token;
        if (tokens.expiry_date) update.tokenExpiry = new Date(tokens.expiry_date);
        if (Object.keys(update).length) {
            await User.findByIdAndUpdate(user._id, update);
        }
    });

    return oauth2Client;
}

// Fetch the most recent inbox emails for a user
async function fetchRecentEmails(user, maxResults = 20) {
    const auth = getAuthClient(user);
    const gmail = google.gmail({ version: "v1", auth });

    // Step 1: list recent message IDs from the inbox
    const listRes = await gmail.users.messages.list({
        userId: "me",
        labelIds: ["INBOX"],
        maxResults,
    });

    const messages = listRes.data.messages || [];
    const emails = [];

    // Step 2: fetch each message's details
    for (const msg of messages) {
        const detail = await gmail.users.messages.get({
            userId: "me",
            id: msg.id,
            format: "metadata",
            metadataHeaders: ["From", "Subject", "List-Unsubscribe"],
        });

        const headers = detail.data.payload?.headers || [];
        const getHeader = (name) =>
            headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || "";

        emails.push({
            id: detail.data.id,
            sender: getHeader("From"),
            subject: getHeader("Subject"),
            snippet: detail.data.snippet || "",
            unsubscribe: getHeader("List-Unsubscribe"),
            gmail_labels: detail.data.labelIds || [],
        });
    }

    return emails;
}
// Get the CURRENT historyId of the mailbox (used to seed a new user's checkpoint)
async function getCurrentHistoryId(user) {
    const auth = getAuthClient(user);
    const gmail = google.gmail({ version: "v1", auth });
    const profile = await gmail.users.getProfile({ userId: "me" });
    return profile.data.historyId;
}

// Fetch NEW messages since a given historyId (the checkpoint)
async function fetchNewSince(user, startHistoryId) {
    const auth = getAuthClient(user);
    const gmail = google.gmail({ version: "v1", auth });

    let newMessageIds = [];
    let latestHistoryId = startHistoryId;
    let pageToken = undefined;

    do {
        const res = await gmail.users.history.list({
            userId: "me",
            startHistoryId: startHistoryId,
            historyTypes: ["messageAdded"], // only care about new mail
            pageToken,
        });

        // Track the newest historyId Gmail reports
        if (res.data.historyId) latestHistoryId = res.data.historyId;

        const history = res.data.history || [];
        for (const h of history) {
            const added = h.messagesAdded || [];
            for (const m of added) {
                // only inbox messages (skip sent, drafts, etc.)
                if (m.message.labelIds && m.message.labelIds.includes("INBOX")) {
                    newMessageIds.push(m.message.id);
                }
            }
        }

        pageToken = res.data.nextPageToken;
    } while (pageToken);

    // De-duplicate (Gmail can list the same message more than once)
    newMessageIds = [...new Set(newMessageIds)];

    // Fetch full details for each new message (reuse the same extraction as before)
    const emails = [];
    for (const id of newMessageIds) {
        const detail = await gmail.users.messages.get({
            userId: "me",
            id,
            format: "metadata",
            metadataHeaders: ["From", "Subject", "List-Unsubscribe"],
        });
        const headers = detail.data.payload?.headers || [];
        const getHeader = (name) =>
            headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || "";

        emails.push({
            id: detail.data.id,
            sender: getHeader("From"),
            subject: getHeader("Subject"),
            snippet: detail.data.snippet || "",
            unsubscribe: getHeader("List-Unsubscribe"),
            gmail_labels: detail.data.labelIds || [],
        });
    }

    return { emails, latestHistoryId };
}

module.exports = { getAuthClient, fetchRecentEmails, getCurrentHistoryId, fetchNewSince };



