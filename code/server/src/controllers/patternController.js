import PatternMastery from "../models/PatternMastery.js";
import Problem from "../models/Problem.js";
import ProblemMastery from "../models/ProblemMastery.js";
import FSRSState from "../models/FSRSState.js";
import {
  getWeakPatterns,
  getStrongPatterns,
} from "../services/mastery/patternMastery.js";

/**
 * GET /api/patterns
 * Get all patterns with user mastery
 */
export const getPatterns = async (req, res, next) => {
  try {
    const userId = req.user.userId;

    // Get all pattern masteries for user
    const patterns = await PatternMastery.find({ userId }).sort({
      mastery: -1,
    }).lean();

    // Get all scheduled problems in FSRS
    const allScheduled = await FSRSState.find({ userId })
      .populate("problemId", "patterns")
      .lean();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const duePatternSet = new Set();
    const earliestReviewByPattern = {};

    allScheduled.forEach((state) => {
      if (state.problemId && state.problemId.patterns && state.nextReviewDate) {
        const reviewDate = new Date(state.nextReviewDate);
        const isDue = reviewDate < tomorrow;

        state.problemId.patterns.forEach((pat) => {
          if (isDue) {
            duePatternSet.add(pat);
          }
          
          // Track earliest upcoming date for each pattern
          if (!earliestReviewByPattern[pat] || reviewDate < earliestReviewByPattern[pat]) {
            earliestReviewByPattern[pat] = reviewDate;
          }
        });
      }
    });

    const patternsWithRecall = patterns.map((p) => ({
      ...p,
      recallDue: duePatternSet.has(p.pattern),
      nextReviewDate: earliestReviewByPattern[p.pattern] || null,
    }));

    // Get weak and strong patterns
    const weakPatterns = await getWeakPatterns(userId, 3);
    const strongPatterns = await getStrongPatterns(userId, 3);

    res.status(200).json({
      patterns: patternsWithRecall,
      weakPatterns,
      strongPatterns,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/patterns/:patternName
 * Get pattern details with problems
 */
export const getPattern = async (req, res, next) => {
  try {
    const { patternName } = req.params;
    const userId = req.user.userId;

    // Decode URL-encoded pattern name
    const decodedPattern = decodeURIComponent(patternName);

    // Get pattern mastery for user
    const patternMastery = await PatternMastery.findOne({
      userId,
      pattern: decodedPattern,
    });

    if (!patternMastery) {
      return res
        .status(404)
        .json({ message: "Pattern not found for this user" });
    }

    // Get all problems with this pattern
    const problems = await Problem.find({ patterns: decodedPattern });

    // Get user's mastery for each problem
    const problemIds = problems.map((p) => p._id);
    const masteries = await ProblemMastery.find({
      userId,
      problemId: { $in: problemIds },
    });

    const masteriesByProblemId = {};
    masteries.forEach((m) => {
      masteriesByProblemId[m.problemId] = m;
    });

    // Combine
    const problemsWithMastery = problems.map((p) => ({
      id: p._id,
      title: p.title,
      difficulty: p.difficulty,
      patterns: p.patterns,
      userMastery: masteriesByProblemId[p._id]?.mastery ?? null,
      solved: masteriesByProblemId[p._id] ? true : false,
    }));

    res.status(200).json({
      pattern: {
        name: decodedPattern,
        mastery: patternMastery.mastery,
        masteryBreakdown: patternMastery.components,
        totalProblemsAttempted: patternMastery.totalProblemsAttempted,
        totalProblemsSolved: patternMastery.totalProblemsSolved,
      },
      problems: problemsWithMastery,
    });
  } catch (error) {
    next(error);
  }
};
