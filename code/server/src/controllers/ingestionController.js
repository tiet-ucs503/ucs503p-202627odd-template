import { processSubmission } from "../services/ingestion/processSubmission.js";

/**
 * POST /api/ingestion/submission
 * Receive and process a solving submission from Tampermonkey extension
 *
 * Request body expected from extension:
 * {
 *   problemId: Number (LeetCode problem ID),
 *   title: String,
 *   titleSlug: String,
 *   difficulty: "Easy" | "Medium" | "Hard",
 *   patterns: [String],
 *   sessionStart: ISO string,
 *   sessionEnd: ISO string,
 *   submissionHistory: [{ submissionId, status, runtime, memory, timestamp, language }],
 *   acceptedSubmissionId: String (ID of accepted submission in history),
 *   acceptedCode: String (full source code),
 *   language: String,
 *   hintsUsed: Number,
 *   analysisResult: { actualTimeComplexity, actualSpaceComplexity, optimalTimeComplexity, optimalSpaceComplexity, explanation }
 * }
 */
export const receiveSubmission = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const payload = req.body;

    // Validate required fields
    const requiredFields = [
      "problemId",
      "title",
      "titleSlug",
      "difficulty",
      "patterns",
      "sessionStart",
      "sessionEnd",
      "submissionHistory",
      "acceptedSubmissionId",
      "acceptedCode",
      "language",
      "analysisResult",
    ];

    for (const field of requiredFields) {
      if (payload[field] === undefined || payload[field] === null) {
        return res.status(400).json({
          message: `Missing required field: ${field}`,
        });
      }
    }

    // Process the submission through entire pipeline
    const result = await processSubmission(userId, payload);

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/ingestion/health
 * Health check for ingestion endpoint
 */
export const ingestionHealth = async (req, res) => {
  res.status(200).json({
    status: "ok",
    message: "CPRecal ingestion endpoint is running",
    timestamp: new Date().toISOString(),
  });
};
