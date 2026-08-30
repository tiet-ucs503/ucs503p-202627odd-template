import PatternMastery from "../../models/PatternMastery.js";
import ProblemMastery from "../../models/ProblemMastery.js";
import Problem from "../../models/Problem.js";

/**
 * Update pattern mastery for a user
 * Called after problem mastery is calculated
 * Aggregates all problem masteries for this user + pattern
 */
export async function updatePatternMastery(userId, pattern) {
  // Find all problems with this pattern
  const problemsWithPattern = await Problem.find({ patterns: pattern }).select(
    "_id",
  );
  const problemIds = problemsWithPattern.map((p) => p._id);

  if (problemIds.length === 0) {
    return null; // Pattern has no problems
  }

  // Find all problem masteries for this user on these problems
  const problemMasteries = await ProblemMastery.find({
    userId,
    problemId: { $in: problemIds },
  });

  // Aggregate stats
  const totalAttempted = problemIds.length;
  const totalSolved = problemMasteries.length;

  // Calculate average mastery
  const avgMastery =
    totalSolved > 0
      ? Math.round(
          problemMasteries.reduce((sum, pm) => sum + pm.mastery, 0) /
            totalSolved,
        )
      : 0;

  // Average components
  const avgComponents = {
    solutionEfficiency: 0,
    timeComplexity: 0,
    submissionsUntilSuccess: 0,
    timeTaken: 0,
    hintsUsed: 0,
  };

  if (totalSolved > 0) {
    Object.keys(avgComponents).forEach((key) => {
      avgComponents[key] = Math.round(
        problemMasteries.reduce((sum, pm) => sum + pm.components[key], 0) /
          totalSolved,
      );
    });
  }

  // Update or create pattern mastery record
  const patternMasteryRecord = await PatternMastery.findOneAndUpdate(
    { userId, pattern },
    {
      totalProblemsAttempted: totalAttempted,
      totalProblemsSolved: totalSolved,
      mastery: avgMastery,
      components: avgComponents,
    },
    { upsert: true, new: true },
  );

  return patternMasteryRecord;
}

/**
 * Update all patterns for a user after problem mastery changes
 */
export async function updateUserPatterns(userId, problemId) {
  // Get the problem to find its patterns
  const problem = await Problem.findById(problemId);
  if (!problem) return [];

  // Update mastery for each pattern
  const results = [];
  for (const pattern of problem.patterns) {
    const result = await updatePatternMastery(userId, pattern);
    if (result) results.push(result);
  }

  return results;
}

/**
 * Get all pattern masteries for a user
 */
export async function getUserPatternMasteries(userId) {
  return PatternMastery.find({ userId }).sort({ mastery: -1 });
}

/**
 * Get specific pattern mastery for a user
 */
export async function getPatternMastery(userId, pattern) {
  return PatternMastery.findOne({ userId, pattern });
}

/**
 * Get weak patterns (lowest mastery)
 */
export async function getWeakPatterns(userId, limit = 3) {
  return PatternMastery.find({ userId }).sort({ mastery: 1 }).limit(limit);
}

/**
 * Get strong patterns (highest mastery)
 */
export async function getStrongPatterns(userId, limit = 3) {
  return PatternMastery.find({ userId }).sort({ mastery: -1 }).limit(limit);
}

/**
 * Get patterns with attempted problems
 */
export async function getPatternsCovered(userId) {
  return PatternMastery.countDocuments({
    userId,
    totalProblemsAttempted: { $gt: 0 },
  });
}
