import mongoose from "mongoose";
import Problem from "../models/Problem.js";
import ProblemMastery from "../models/ProblemMastery.js";
import PatternMastery from "../models/PatternMastery.js";
import AcceptedSolution from "../models/AcceptedSolution.js";
import FSRSState from "../models/FSRSState.js";
import { selectRecallTargets } from "../services/fsrs/recallSelector.js";

/**
 * GET /api/problems
 * Get problem library with user-specific state
 * Supports filtering by: difficulty, pattern, status, search
 * Supports pagination: limit, offset
 */
export const getProblems = async (req, res, next) => {
  try {
    const {
      difficulty,
      pattern,
      status,
      search,
      limit = 20,
      offset = 0,
    } = req.query;
    const userId = req.user.userId;

    // Build filter
    let filter = {};
    if (difficulty) filter.difficulty = difficulty;
    if (pattern) filter.patterns = pattern;
    if (search) {
      const cleanSearch = search.replace(/^#/, "").trim();
      const isNum = !isNaN(cleanSearch) && cleanSearch !== "";
      if (isNum) {
        filter.$or = [
          { title: { $regex: search, $options: "i" } },
          { leetcodeId: parseInt(cleanSearch) }
        ];
      } else {
        filter.title = { $regex: search, $options: "i" };
      }
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Apply status filter directly to DB query for accurate pagination & instant display
    // EXCEPT for 'recall', which requires a complex secondary lookup. We'll handle 'recall' separately.
    let isRecallMode = false;
    let recallResolvedTargets = [];
    
    // 1. Solved: Problems already solved by user
    if (status === "solved") {
      const masteries = await ProblemMastery.find({ userId }).select("problemId");
      const solvedIds = masteries.map((m) => m.problemId);
      filter._id = { $in: solvedIds };
    // 2. Unsolved: Problems not yet solved by user
    } else if (status === "unsolved") {
      const masteries = await ProblemMastery.find({ userId }).select("problemId");
      const solvedIds = masteries.map((m) => m.problemId);
      filter._id = { $nin: solvedIds };
    // 3. Recall Due: New unsolved targets (B) generated from FSRS triggers due today
    } else if (status === "recall") {
      isRecallMode = true;
      const dueToday = await FSRSState.find({
        userId,
        nextReviewDate: { $lt: tomorrow },
      })
      .populate({
        path: "problemId",
        select: "title difficulty patterns",
      })
      .lean();
      
      recallResolvedTargets = await selectRecallTargets(dueToday, userId);
      const recallIds = recallResolvedTargets.map((target) => target.problem._id);
      filter._id = { $in: recallIds.length > 0 ? recallIds : ["000000000000000000000000"] };
    // 4. Scheduled Recall: New unsolved targets (B) generated from future FSRS schedules
    } else if (status === "scheduled") {
      isRecallMode = true;
      const futureScheduled = await FSRSState.find({
        userId,
        nextReviewDate: { $gte: tomorrow },
      })
      .populate({
        path: "problemId",
        select: "title difficulty patterns",
      })
      .lean();
      
      recallResolvedTargets = await selectRecallTargets(futureScheduled, userId);
      const recallIds = recallResolvedTargets.map((target) => target.problem._id);
      filter._id = { $in: recallIds.length > 0 ? recallIds : ["000000000000000000000000"] };
    }

    // Get total count for exact pagination
    const total = await Problem.countDocuments(filter);

    // Get paginated problems
    const problems = await Problem.find(filter)
      .skip(parseInt(offset))
      .limit(parseInt(limit));

    // Get user's problem masteries for this page
    const problemIds = problems.map((p) => p._id);
    const masteries = await ProblemMastery.find({
      userId,
      problemId: { $in: problemIds },
    });

    const masteriesByProblemId = {};
    masteries.forEach((m) => {
      masteriesByProblemId[m.problemId.toString()] = m;
    });

    // Get FSRS states for this page
    const fsrsStates = await FSRSState.find({
      userId,
      problemId: { $in: problemIds },
    });

    const fsrsByProblemId = {};
    fsrsStates.forEach((f) => {
      fsrsByProblemId[f.problemId.toString()] = f;
    });

    // Create lookup for recall targets if in recall mode
    const recallTargetLookup = {};
    if (isRecallMode) {
      recallResolvedTargets.forEach(target => {
        recallTargetLookup[target.problem._id.toString()] = target;
      });
    }

    // Combine
    const combined = problems.map((p) => {
      let isReviewDue = false;
      let nextRevDate = null;
      let originalDueId = null;
      
      const pIdStr = p._id.toString();
      if (isRecallMode && recallTargetLookup[pIdStr]) {
         const targetInfo = recallTargetLookup[pIdStr];
         originalDueId = targetInfo.originalDueProblemId;
         nextRevDate = targetInfo.nextReviewDate || null;
         isReviewDue = nextRevDate ? new Date(nextRevDate) < tomorrow : false;
      } else {
         isReviewDue = fsrsByProblemId[pIdStr] && new Date(fsrsByProblemId[pIdStr].nextReviewDate) < tomorrow;
         nextRevDate = fsrsByProblemId[pIdStr]?.nextReviewDate || null;
      }

      return {
        id: p._id,
        leetcodeId: p.leetcodeId,
        title: p.title,
        titleSlug: p.titleSlug,
        difficulty: p.difficulty,
        patterns: p.patterns,
        userState: masteriesByProblemId[pIdStr]
          ? {
              solved: true,
              mastery: masteriesByProblemId[pIdStr].mastery,
              reviewDue: isReviewDue,
              nextReviewDate: nextRevDate,
            }
          : {
              solved: false,
              mastery: null,
              reviewDue: isReviewDue,
              nextReviewDate: nextRevDate,
            },
        // Include the crucial link back to A if this is B
        ...(originalDueId && { originalDueProblemId: originalDueId })
      };
    });

    res.status(200).json({
      problems: combined,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/problems/:id
 * Get problem details with user-specific data
 */
export const getProblem = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid problem ID format" });
    }

    // Get problem
    const problem = await Problem.findById(id);
    if (!problem) {
      return res.status(404).json({ message: "Problem not found" });
    }

    // Get user's mastery for this problem
    const mastery = await ProblemMastery.findOne({
      userId,
      problemId: id,
    });

    // Get accepted solution and analysis
    const acceptedSolution = await AcceptedSolution.findOne({
      userId,
      problemId: id,
    });

    // Get FSRS state
    const fsrsState = await FSRSState.findOne({
      userId,
      problemId: id,
    });

    // Get pattern masteries for each pattern on this problem
    const patternsWithMastery = [];
    for (const patternName of problem.patterns) {
      const patternMastery = await PatternMastery.findOne({
        userId,
        pattern: patternName,
      });

      patternsWithMastery.push({
        name: patternName,
        cumulativeMastery: patternMastery?.mastery ?? 0,
        totalProblems: patternMastery?.totalProblemsAttempted ?? 0,
        solvedProblems: patternMastery?.totalProblemsSolved ?? 0,
      });
    }

    res.status(200).json({
      problem: {
        id: problem._id,
        leetcodeId: problem.leetcodeId,
        title: problem.title,
        titleSlug: problem.titleSlug,
        difficulty: problem.difficulty,
        patterns: problem.patterns,
      },
      userState: mastery
        ? {
            solved: true,
            mastery: mastery.mastery,
            masteryBreakdown: mastery.components,
            solvingData: {
              timeTakenSeconds: mastery.totalTimeSeconds,
              timeTaken: mastery.totalTimeSeconds ? `${Math.floor(mastery.totalTimeSeconds / 60)}m ${mastery.totalTimeSeconds % 60}s` : "—",
              submissions: mastery.totalSubmissions,
              hintsUsed: mastery.hintsUsedCount,
              runtime: acceptedSolution?.runtime != null ? `${acceptedSolution.runtime} ms` : "—",
              memory: acceptedSolution?.memory != null ? `${acceptedSolution.memory} MB` : "—",
              solvedAt: mastery.solvedAt,
            },
            acceptedSolution: acceptedSolution
              ? {
                  language: acceptedSolution.language,
                  runtime: acceptedSolution.runtime,
                  memory: acceptedSolution.memory,
                  code: acceptedSolution.code,
                  analysis: acceptedSolution.analysisResult,
                }
              : null,
            fsrs: fsrsState
              ? {
                  rating: fsrsState.rating,
                  nextReviewDate: fsrsState.nextReviewDate,
                  interval: fsrsState.intervalDays,
                  intervalDays: fsrsState.intervalDays,
                  easeFactor: fsrsState.easeFactor ?? 2.5,
                  reviewDue: fsrsState.nextReviewDate <= new Date(),
                }
              : null,
            patternsWithMastery,
          }
        : null,
    });
  } catch (error) {
    next(error);
  }
};
