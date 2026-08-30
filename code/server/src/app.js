import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/authRoutes.js";
import problemRoutes from "./routes/problemRoutes.js";
import patternRoutes from "./routes/patternRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import reviewRoutes from "./routes/reviewRoutes.js";
import ingestionRoutes from "./routes/ingestionRoutes.js";
import analyzeRoutes from "./routes/analyzeRoutes.js";
import recommendationRoutes from "./routes/recommendationRoutes.js";

const app = express();

// Enable CORS for client origin + Tampermonkey extension (runs on leetcode.com)
const allowedOrigins = [
  process.env.CLIENT_URL || "http://localhost:5173",
  "https://leetcode.com",
  "https://www.leetcode.com",
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (server-to-server, curl, Postman)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error(`CORS: origin '${origin}' not allowed`));
    },
    credentials: true,
  }),
);

// Body and Cookie Parsers
app.use(express.json());
app.use(cookieParser());

// Health Check Endpoint
app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "CPRecal API",
  });
});

// Auth Routes
app.use("/api/auth", authRoutes);

// Problem Library Routes
app.use("/api/problems", problemRoutes);

// Pattern Dashboard Routes
app.use("/api/patterns", patternRoutes);

// Dashboard Routes
app.use("/api/dashboard", dashboardRoutes);

// Review Routes
app.use("/api/reviews", reviewRoutes);

// Ingestion Routes (Extension)
app.use("/api/ingestion", ingestionRoutes);

// Recommendations Routes
app.use("/api/recommendations", recommendationRoutes);

// LLM Code Analysis (Extension calls this to analyze accepted code)
app.use("/api/analyze", analyzeRoutes);

// 404 Handler for unhandled routes
app.use("*", (req, res) => {
  res.status(404).json({ message: `Route ${req.originalUrl} not found.` });
});

// Centralized Error Handling Middleware
app.use((err, req, res, next) => {
  console.error("[Error]", err);

  // Handle Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res
      .status(409)
      .json({ message: `An account with this ${field} already exists.` });
  }

  // Handle Mongoose validation errors
  if (err.name === "ValidationError") {
    const messages = Object.values(err.errors).map((val) => val.message);
    return res.status(400).json({ message: messages.join(", ") });
  }

  const statusCode = err.statusCode || 500;
  return res.status(statusCode).json({
    message: err.message || "Internal Server Error",
  });
});

export default app;
