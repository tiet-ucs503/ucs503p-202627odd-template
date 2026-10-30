// index.js — server entry point
require("dotenv").config();
const express = require("express");
const session = require("express-session");
const cookieParser = require("cookie-parser");
const path = require("path");
const connectDB = require("./config/db");
const authRoutes = require("./routes/auth");
const emailRoutes = require("./routes/emails");
const { startClassifierJob } = require("./jobs/classifier");
const cors = require("cors");
const app = express();
const apiRoutes = require("./routes/api");


// --- Connect to MongoDB ---
connectDB();

// --- Start the background classifier job ---
startClassifierJob();

// --- View engine (EJS) ---
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// --- Middleware ---
app.use(express.json());
app.use(cookieParser());

// --- Session (in-memory for now) ---
app.use(
    session({
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        cookie: { maxAge: 24 * 60 * 60 * 1000 }, // 1 day
    })
);

// --- CORS (allow the React frontend to call this API) ---
app.use(
    cors({
        origin: "http://localhost:3000", // the React dev server
        credentials: true,                // allow cookies/session across origins
    })
);

// --- Serve static files (CSS, images, etc.) ---
app.use(express.static(path.join(__dirname, "public")));

// --- Routes ---
app.use("/auth", authRoutes);
app.use("/emails", emailRoutes);
app.use("/api", apiRoutes);

// --- Home / health route ---
app.get("/", (req, res) => {
    res.send("Vigilante backend is running.");
});

// --- Start the server ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});