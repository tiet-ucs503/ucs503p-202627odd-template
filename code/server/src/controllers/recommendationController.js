import Problem from "../models/Problem.js";
import ProblemMastery from "../models/ProblemMastery.js";
import PatternMastery from "../models/PatternMastery.js";

/**
 * GET /api/recommendations
 * Recommends fresh problems based on user's weakest patterns.
 */
export const getRecommendations = async (req, res, next) => {
  try {
    const userId = req.user.userId;

    // 1. Identify Weakest Patterns
    // Fetch all user patterns, sort by mastery ascending, take the bottom 3
    const weakPatterns = await PatternMastery.find({ userId })
      .sort({ mastery: 1 })
      .limit(3);

    if (!weakPatterns || weakPatterns.length === 0) {
      return res.status(200).json({ recommendations: [] });
    }

    // 2. Identify Solved Problems
    const solvedRecords = await ProblemMastery.find({ userId }).select("problemId");
    const solvedProblemIds = solvedRecords.map(record => record.problemId);

    // 3. Match & Select Problems
    const recommendations = [];

    for (const patternRecord of weakPatterns) {
      const patternName = patternRecord.pattern;
      
      // Determine target difficulty based on pattern mastery
      let targetDifficulty;
      if (patternRecord.mastery < 50) {
        targetDifficulty = "Easy";
      } else if (patternRecord.mastery < 80) {
        targetDifficulty = "Medium";
      } else {
        targetDifficulty = "Hard";
      }

      // Query global Problem collection
      // Find problems matching the pattern, excluding solved problems
      // Using difficulty as a ranking signal
      let matchedProblems = await Problem.find({
        patterns: patternName,
        _id: { $nin: solvedProblemIds },
        difficulty: targetDifficulty
      }).limit(10); // fetch a few to randomize

      // If strict difficulty match yields nothing, fallback to any difficulty
      if (matchedProblems.length === 0) {
        matchedProblems = await Problem.find({
          patterns: patternName,
          _id: { $nin: solvedProblemIds }
        }).limit(10);
      }

      if (matchedProblems.length > 0) {
        // Randomly pick 1-2 problems from the matched pool to keep it fresh
        const numToPick = Math.min(matchedProblems.length, 2);
        const shuffled = matchedProblems.sort(() => 0.5 - Math.random());
        const selected = shuffled.slice(0, numToPick);

        selected.forEach(problem => {
          recommendations.push({
            problem: {
              id: problem._id,
              leetcodeId: problem.leetcodeId,
              title: problem.title,
              titleSlug: problem.titleSlug,
              difficulty: problem.difficulty,
              patterns: problem.patterns
            },
            targetPattern: patternName,
            patternMastery: patternRecord.mastery,
            reason: `Targeting your weakest pattern (${patternName} - ${Math.round(patternRecord.mastery)}% Mastery)`
          });
        });
      }
    }

    res.status(200).json({ recommendations });
  } catch (error) {
    next(error);
  }
};
