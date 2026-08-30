import Problem from "../../models/Problem.js";
import SolvingSession from "../../models/SolvingSession.js";
import Submission from "../../models/Submission.js";
import AcceptedSolution from "../../models/AcceptedSolution.js";
import ReviewHistory from "../../models/ReviewHistory.js";
import {
  calculateProblemMastery,
  saveProblemMastery,
  getProblemMastery,
} from "../mastery/problemMastery.js";
import { updateUserPatterns } from "../mastery/patternMastery.js";
import { createOrUpdateFSRSState } from "../fsrs/scheduler.js";

/**
 * Process submission from Tampermonkey extension
 * This is the main end-to-end ingestion flow
 *
 * Steps:
 * 1. Find or create global Problem
 * 2. Create SolvingSession
 * 3. Create Submission records
 * 4. Create AcceptedSolution
 * 5. Calculate ProblemMastery
 * 6. Update PatternMastery
 * 7. Create/Update FSRSState
 * 8. Create ReviewHistory
 * 9. Return result
 */
export async function processSubmission(userId, submissionPayload) {
  const {
    problemId: leetcodeId,
    title,
    titleSlug,
    difficulty,
    patterns,
    sessionStart,
    sessionEnd,
    submissionHistory,
    acceptedSubmissionId,
    acceptedCode,
    language,
    hintsUsed = 0,
    analysisResult,
  } = submissionPayload;

  // Step 1: Find or create global Problem
  let problem = await Problem.findOne({ leetcodeId });
  if (!problem) {
    problem = await Problem.create({
      leetcodeId,
      title,
      titleSlug: titleSlug.toLowerCase(),
      difficulty,
      patterns,
    });
  }

  // Step 2: Create SolvingSession
  const session = await SolvingSession.create({
    userId,
    problemId: problem._id,
    startTime: new Date(sessionStart),
    endTime: new Date(sessionEnd),
    totalTimeSeconds: Math.round(
      (new Date(sessionEnd) - new Date(sessionStart)) / 1000,
    ),
  });

  // Step 3: Create Submission records for each attempt
  const submissions = [];
  for (const sub of submissionHistory) {
    const submission = await Submission.create({
      userId,
      problemId: problem._id,
      sessionId: session._id,
      submissionId: sub.submissionId,
      status: sub.status,
      runtime: sub.runtime,
      memory: sub.memory,
      language: sub.language || language,
      timestamp: new Date(sub.timestamp),
    });
    submissions.push(submission);
  }

  // Find accepted submission for reference
  const acceptedSub = submissions.find((s) => s.status === "Accepted");
  if (!acceptedSub) {
    throw new Error("No accepted submission found in submission history");
  }

  // Step 4: Upsert AcceptedSolution so repeated solves for the same problem
  // do not violate the unique userId+problemId constraint.
  const acceptedSolution = await AcceptedSolution.findOneAndUpdate(
    { userId, problemId: problem._id },
    {
      submissionId: acceptedSub._id,
      code: acceptedCode,
      language,
      runtime: acceptedSub.runtime,
      memory: acceptedSub.memory,
      analysisResult,
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    },
  );

  // Step 5: Calculate ProblemMastery
  const masteryResult = await calculateProblemMastery({
    actualTimeComplexity: analysisResult.actualTimeComplexity,
    actualSpaceComplexity: analysisResult.actualSpaceComplexity,
    optimalTimeComplexity: analysisResult.optimalTimeComplexity,
    optimalSpaceComplexity: analysisResult.optimalSpaceComplexity,
    totalSubmissions: submissions.length,
    totalTimeSeconds: session.totalTimeSeconds,
    hintsUsed,
    difficulty,
  });

  // Fetch existing ProblemMastery to record in ReviewHistory before updating
  const existingProblemMastery = await getProblemMastery(userId, problem._id);
  const previousMastery = existingProblemMastery ? existingProblemMastery.mastery : null;

  // Save ProblemMastery
  const problemMastery = await saveProblemMastery(userId, problem._id, {
    solvingSessionId: session._id,
    acceptedSubmissionId: acceptedSub._id,
    totalSubmissions: submissions.length,
    solvedAt: acceptedSub.timestamp,
    hintsUsedCount: hintsUsed,
    totalTimeSeconds: session.totalTimeSeconds,
    ...masteryResult,
  });

  // Step 6: Update PatternMastery for each pattern
  await updateUserPatterns(userId, problem._id);

  // Step 7: Create/Update FSRSState
  const fsrsState = await createOrUpdateFSRSState(
    userId,
    problem._id,
    problemMastery.mastery,
  );

  // Step 8: Create ReviewHistory
  await ReviewHistory.create({
    userId,
    problemId: problem._id,
    reviewedAt: new Date(),
    previousMastery: previousMastery,
    newMastery: problemMastery.mastery,
    fsrsRating: fsrsState.rating,
    status: "completed",
  });


  // Step 9: Return result with all calculated data
  return {
    success: true,
    problem: {
      id: problem._id,
      title: problem.title,
      difficulty: problem.difficulty,
    },
    problemMastery: {
      mastery: problemMastery.mastery,
      components: problemMastery.components,
    },
    fsrs: {
      rating: fsrsState.rating,
      nextReviewDate: fsrsState.nextReviewDate,
      intervalDays: fsrsState.intervalDays,
    },
    session: {
      totalTimeSeconds: session.totalTimeSeconds,
      submissions: submissions.length,
    },
  };
}
