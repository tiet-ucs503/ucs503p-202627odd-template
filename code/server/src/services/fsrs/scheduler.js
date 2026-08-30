import FSRSState from "../../models/FSRSState.js";
import { getMasteryRating, getInitialInterval } from "./ratingMapper.js";

/**
 * Create or update FSRS state for a problem
 * Called after problem mastery is calculated
 */
export async function createOrUpdateFSRSState(userId, problemId, mastery) {
  const rating = getMasteryRating(mastery);
  
  // Check if FSRS state already exists
  const existingState = await FSRSState.findOne({ userId, problemId });

  if (existingState) {
    // Treat this as a "review" since they solved it again
    let newIntervalDays = existingState.intervalDays;
    let newEaseFactor = existingState.easeFactor || 2.5;

    // Adjust interval and easeFactor based on the new rating
    if (rating >= 3) {
      newIntervalDays = Math.ceil(existingState.intervalDays * newEaseFactor);
      newEaseFactor = Math.min(2.5, newEaseFactor + 0.1);
    } else if (rating === 2) {
      newIntervalDays = Math.ceil(existingState.intervalDays * 1.2);
    } else {
      newIntervalDays = getInitialInterval(rating);
      newEaseFactor = Math.max(1.3, newEaseFactor - 0.2);
    }

    const nextReviewDate = new Date();
    nextReviewDate.setDate(nextReviewDate.getDate() + newIntervalDays);

    return await FSRSState.findOneAndUpdate(
      { userId, problemId },
      {
        rating,
        nextReviewDate,
        intervalDays: newIntervalDays,
        easeFactor: newEaseFactor,
        $push: {
          reviewHistory: {
            reviewedAt: new Date(),
            rating,
            intervalBefore: existingState.intervalDays,
          },
        },
      },
      { new: true }
    );
  } else {
    // Brand new solve
    const intervalDays = getInitialInterval(rating);
    const nextReviewDate = new Date();
    nextReviewDate.setDate(nextReviewDate.getDate() + intervalDays);

    return await FSRSState.findOneAndUpdate(
      { userId, problemId },
      {
        rating,
        nextReviewDate,
        intervalDays,
        easeFactor: 2.5,
        reviewHistory: [], // Start fresh
      },
      { upsert: true, new: true }
    );
  }
}

/**
 * Get FSRS state for a problem
 */
export async function getFSRSState(userId, problemId) {
  return FSRSState.findOne({ userId, problemId });
}

/**
 * Get problems due for review today
 */
export async function getProblemasDueToday(userId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return FSRSState.find({
    userId,
    nextReviewDate: {
      $gte: today,
      $lt: tomorrow,
    },
  }).populate("problemId");
}

/**
 * Get all problems due for review (up to today)
 */
export async function getProblemsOverdue(userId) {
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  return FSRSState.find({
    userId,
    nextReviewDate: { $lte: today },
  }).populate("problemId");
}

/**
 * Update FSRS state after review
 * Called when user completes/skips a review
 */
export async function updateAfterReview(userId, problemId, reviewStatus) {
  const fsrsState = await FSRSState.findOne({ userId, problemId });

  if (!fsrsState) {
    throw new Error("FSRS state not found");
  }

  let newRating = fsrsState.rating;
  let newIntervalDays = fsrsState.intervalDays;
  let newEaseFactor = fsrsState.easeFactor;

  // Simple FSRS logic: adjust based on review status
  if (reviewStatus === "completed") {
    // User successfully reviewed: increase interval
    newIntervalDays = Math.ceil(fsrsState.intervalDays * newEaseFactor);
    newEaseFactor = Math.min(2.5, newEaseFactor + 0.1);
  } else if (reviewStatus === "failed") {
    // User failed: reset to initial interval
    newIntervalDays = getInitialInterval(newRating);
    newEaseFactor = Math.max(1.3, newEaseFactor - 0.2);
  } else if (reviewStatus === "skipped") {
    // User skipped: add 1 day and retry
    newIntervalDays = 1;
  }

  // Calculate new next review date
  const nextReviewDate = new Date();
  nextReviewDate.setDate(nextReviewDate.getDate() + newIntervalDays);

  // Update FSRS state
  const updatedState = await FSRSState.findOneAndUpdate(
    { userId, problemId },
    {
      rating: newRating,
      intervalDays: newIntervalDays,
      easeFactor: newEaseFactor,
      nextReviewDate,
      $push: {
        reviewHistory: {
          reviewedAt: new Date(),
          rating: newRating,
          intervalBefore: fsrsState.intervalDays,
        },
      },
    },
    { new: true },
  );

  return updatedState;
}

/**
 * Get count of problems due today
 */
export async function countProblemsDueToday(userId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return FSRSState.countDocuments({
    userId,
    nextReviewDate: {
      $gte: today,
      $lt: tomorrow,
    },
  });
}
