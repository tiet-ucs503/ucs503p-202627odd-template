import {
  calculateSolutionEfficiency,
  calculateTimeComplexityScore,
  calculateSubmissionsScore,
  calculateTimeTakenScore,
  calculateHintsUsedScore,
  calculateFinalMastery,
} from "./scoring.js";
import ProblemMastery from "../../models/ProblemMastery.js";

/**
 * Calculate complete problem mastery from raw submission data
 * Returns: { components, mastery }
 */
export async function calculateProblemMastery(submissionData) {
  const {
    actualTimeComplexity,
    actualSpaceComplexity,
    optimalTimeComplexity,
    optimalSpaceComplexity,
    totalSubmissions,
    totalTimeSeconds,
    hintsUsed = 0,
    difficulty,
  } = submissionData;

  // Calculate each component (0-100)
  const solutionEfficiency = calculateSolutionEfficiency(
    actualTimeComplexity,
    actualSpaceComplexity,
    optimalTimeComplexity,
    optimalSpaceComplexity,
  );

  const timeComplexity = calculateTimeComplexityScore(
    actualTimeComplexity,
    optimalTimeComplexity,
  );

  const submissionsUntilSuccess = calculateSubmissionsScore(totalSubmissions);

  const timeTaken = calculateTimeTakenScore(totalTimeSeconds, difficulty);

  const hintsUsedScore = calculateHintsUsedScore(hintsUsed);

  const components = {
    solutionEfficiency,
    timeComplexity,
    submissionsUntilSuccess,
    timeTaken,
    hintsUsed: hintsUsedScore,
  };

  // Calculate final mastery
  const mastery = calculateFinalMastery(components);

  return {
    components,
    mastery,
  };
}

/**
 * Save problem mastery to database
 */
export async function saveProblemMastery(userId, problemId, masteryData) {
  const {
    solvingSessionId,
    acceptedSubmissionId,
    totalSubmissions,
    solvedAt,
    hintsUsedCount,
    totalTimeSeconds,
    components,
    mastery,
  } = masteryData;

  const problemMasteryRecord = await ProblemMastery.findOneAndUpdate(
    { userId, problemId },
    {
      solvingSessionId,
      acceptedSubmissionId,
      totalSubmissions,
      solvedAt,
      components,
      mastery,
      hintsUsedCount,
      totalTimeSeconds,
    },
    { upsert: true, new: true },
  );

  return problemMasteryRecord;
}

/**
 * Get problem mastery for a user
 */
export async function getProblemMastery(userId, problemId) {
  return ProblemMastery.findOne({ userId, problemId });
}

/**
 * Get all problem masteries for a user, sorted by mastery
 */
export async function getUserProblemMasteries(userId, filter = {}) {
  return ProblemMastery.find({ userId, ...filter }).sort({ mastery: -1 });
}

/**
 * Get problems solved by user
 */
export async function getSolvedProblems(userId) {
  return ProblemMastery.find({ userId }).select("problemId mastery");
}

/**
 * Calculate average mastery for a user
 */
export async function getUserAverageMastery(userId) {
  const result = await ProblemMastery.aggregate([
    { $match: { userId: userId } },
    {
      $group: {
        _id: null,
        averageMastery: { $avg: "$mastery" },
        count: { $sum: 1 },
      },
    },
  ]);

  return result.length > 0
    ? { average: result[0].averageMastery, count: result[0].count }
    : { average: 0, count: 0 };
}
