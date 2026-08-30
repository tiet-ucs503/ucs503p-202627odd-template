import FSRSState from "../models/FSRSState.js";
import ProblemMastery from "../models/ProblemMastery.js";
import ReviewHistory from "../models/ReviewHistory.js";
import { updateAfterReview } from "../services/fsrs/scheduler.js";

/**
 * POST /api/reviews
 * Submit a review for a problem
 * Body: { problemId, status: "completed" | "skipped" | "failed" }
 */
export const submitReview = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { problemId, status, satisfiedByProblemId } = req.body;

    if (!problemId || !status) {
      return res.status(400).json({
        message: "Problem ID and status are required",
      });
    }

    if (!["completed", "skipped", "failed"].includes(status)) {
      return res.status(400).json({
        message: "Status must be completed, skipped, or failed",
      });
    }

    // Verify user has solved this problem
    const mastery = await ProblemMastery.findOne({
      userId,
      problemId,
    });

    if (!mastery) {
      return res.status(404).json({
        message: "Problem not found or not yet solved by this user",
      });
    }

    // Get current FSRS state
    const fsrsState = await FSRSState.findOne({
      userId,
      problemId,
    });

    if (!fsrsState) {
      return res.status(404).json({
        message: "FSRS state not found",
      });
    }

    // Update FSRS state
    const updatedFSRS = await updateAfterReview(userId, problemId, status);

    // Create review history
    await ReviewHistory.create({
      userId,
      problemId,
      reviewedAt: new Date(),
      previousMastery: mastery.mastery,
      newMastery: mastery.mastery, // Mastery doesn't change from review alone
      fsrsRating: updatedFSRS.rating,
      status,
      satisfiedByProblemId: satisfiedByProblemId || null,
    });

    res.status(200).json({
      success: true,
      updated: {
        mastery: mastery.mastery,
        fsrs: {
          rating: updatedFSRS.rating,
          nextReviewDate: updatedFSRS.nextReviewDate,
          intervalDays: updatedFSRS.intervalDays,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/reviews/due
 * Get problems due for review today
 */
export const getReviewsDue = async (req, res, next) => {
  try {
    const userId = req.user.userId;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const due = await FSRSState.find({
      userId,
      nextReviewDate: {
        $gte: today,
        $lt: tomorrow,
      },
    })
      .populate({
        path: "problemId",
        select: "title difficulty patterns",
      })
      .lean();

    const reviews = [];
    for (const item of due) {
      const mastery = await ProblemMastery.findOne({
        userId,
        problemId: item.problemId._id,
      }).select("mastery");

      reviews.push({
        id: item.problemId._id,
        title: item.problemId.title,
        difficulty: item.problemId.difficulty,
        patterns: item.problemId.patterns,
        masteryScore: mastery?.mastery ?? 0,
        fsrs: {
          rating: item.rating,
          nextReviewDate: item.nextReviewDate,
        },
      });
    }

    res.status(200).json({
      reviews,
      count: reviews.length,
    });
  } catch (error) {
    next(error);
  }
};
