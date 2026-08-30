import ProblemMastery from "../../models/ProblemMastery.js";
import SolvingSession from "../../models/SolvingSession.js";
import PatternMastery from "../../models/PatternMastery.js";
import FSRSState from "../../models/FSRSState.js";
import Problem from "../../models/Problem.js";
import { getProblemsOverdue } from "../fsrs/scheduler.js";
import {
  getStrongPatterns,
  getWeakPatterns,
} from "../mastery/patternMastery.js";
import { selectRecallTargets } from "../fsrs/recallSelector.js";

/**
 * Get complete dashboard data for a user
 */
export async function getDashboardData(userId) {
  // Total solved problems
  const totalSolved = await ProblemMastery.countDocuments({ userId });

  // Total attempted (solving sessions)
  const totalAttempted = await SolvingSession.countDocuments({ userId });

  // Patterns covered
  const patternsCovered = await PatternMastery.countDocuments({
    userId,
    totalProblemsAttempted: { $gt: 0 },
  });

  // Today's revision (due problems + overdue)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // We should include ALL problems whose nextReviewDate is < tomorrow
  const dueToday = await FSRSState.find({
    userId,
    nextReviewDate: {
      $lt: tomorrow, // Includes past (overdue) and today
    },
  })
    .populate({
      path: "problemId",
      select: "title difficulty patterns",
    })
    .lean();

  const resolvedTargets = await selectRecallTargets(dueToday, userId);
  
  const todayRecall = resolvedTargets.map(target => ({
    id: target.problem._id,
    title: target.problem.title,
    titleSlug: target.problem.titleSlug,
    difficulty: target.problem.difficulty,
    patterns: target.problem.patterns,
    masteryScore: 0, // Unsolved
    patternsWithMastery: target.patternsWithMastery,
    reviewDue: true,
    originalDueProblemId: target.originalDueProblemId,
  }));

  // Weak and strong patterns
  const weakPatterns = await getWeakPatterns(userId, 3);
  const strongPatterns = await getStrongPatterns(userId, 3);

  // Compute average mastery across all solved problems
  const allMasteries = await ProblemMastery.find({ userId }).select("mastery");
  const averageMastery = allMasteries.length > 0
    ? Math.round(allMasteries.reduce((sum, m) => sum + (m.mastery || 0), 0) / allMasteries.length)
    : 0;

  // Total unique patterns in DB
  const uniquePatterns = await Problem.distinct("patterns");
  const totalPatterns = uniquePatterns.length || 1;

  return {
    stats: {
      totalSolved,
      totalAttempted,
      patternsCovered,
      patternsAttempted: patternsCovered,
      totalPatterns,
      duePatternsCount: todayRecall.length,
      reviewDue: todayRecall.length,
      averageMastery,
    },
    todaysRevision: todayRecall,
    weakPatterns,
    strongPatterns,
  };
}

/**
 * Get stats only (lighter weight)
 */
export async function getDashboardStats(userId) {
  const totalSolved = await ProblemMastery.countDocuments({ userId });
  const totalAttempted = await SolvingSession.countDocuments({ userId });
  const patternsCovered = await PatternMastery.countDocuments({
    userId,
    totalProblemsAttempted: { $gt: 0 },
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const reviewDue = await FSRSState.countDocuments({
    userId,
    nextReviewDate: {
      $lt: tomorrow, // Overdue + due today
    },
  });

  return {
    totalSolved,
    totalAttempted,
    patternsCovered,
    reviewDue,
  };
}
