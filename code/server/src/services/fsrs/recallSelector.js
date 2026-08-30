import ProblemMastery from "../../models/ProblemMastery.js";
import PatternMastery from "../../models/PatternMastery.js";
import Problem from "../../models/Problem.js";

/**
 * A -> B Recall Target Resolution Engine
 * 
 * CORE ARCHITECTURAL PRINCIPLE:
 * FSRS State acts as the TIMER / TRIGGER (Problem A, previously solved by user).
 * When A is due or scheduled, CPRecal dynamically selects a DIFFERENT, UNSOLVED
 * Problem B that exercises the same weak DSA pattern to reinforce understanding.
 * 
 * Target B requirements:
 * 1. B != A (never return the solved trigger problem)
 * 2. B is unsolved by the user (B not in user's ProblemMastery)
 * 3. B exercises the weakest pattern associated with Problem A
 * 4. Exhaustion rule: If no unsolved problems match the pattern, return an empty
 *    array; NEVER fall back to Problem A.
 * 
 * @param {Array} fsrsTriggers - Array of populated FSRSState documents (with problemId populated)
 * @param {String} userId - User ID to check masteries
 * @returns {Promise<Array>} - Array of resolved recall targets with originalDueProblemId & nextReviewDate
 */
export async function selectRecallTargets(fsrsTriggers, userId) {
  // Get all solved problem IDs
  const userMasteries = await ProblemMastery.find({ userId }).select("problemId");
  const solvedProblemIds = userMasteries.map((m) => m.problemId.toString());
  
  const selectedRecallProblemIds = new Set();
  const resolvedTargets = [];
  
  for (const dueProblem of fsrsTriggers) {
    if (!dueProblem.problemId || !dueProblem.problemId._id) {
      continue; // Skip if problem doesn't exist
    }

    const originalProblemId = dueProblem.problemId._id;

    // Get pattern masteries for this problem to identify the relevant/weakest pattern
    const patternsWithMastery = [];
    for (const pattern of dueProblem.problemId.patterns) {
      const patternMastery = await PatternMastery.findOne({
        userId,
        pattern,
      }).select("mastery");

      patternsWithMastery.push({
        name: pattern,
        cumulativeMastery: patternMastery?.mastery ?? 0,
      });
    }

    // Sort patterns by mastery ascending (weakest first)
    const sortedPatterns = [...patternsWithMastery].sort((a, b) => a.cumulativeMastery - b.cumulativeMastery);
    const relevantPattern = sortedPatterns.length > 0 ? sortedPatterns[0].name : null;
    const relevantMastery = sortedPatterns.length > 0 ? sortedPatterns[0].cumulativeMastery : 0;
    
    let selectedProblem = null;
    
    if (relevantPattern) {
      // Exclude solved problems, the original problem itself, and any problems already selected in this batch
      const excludeIds = [...solvedProblemIds, originalProblemId.toString(), ...Array.from(selectedRecallProblemIds)];
      
      // Determine target difficulty based on pattern mastery
      let targetDifficulty = "Easy";
      if (relevantMastery >= 50 && relevantMastery < 80) targetDifficulty = "Medium";
      else if (relevantMastery >= 80) targetDifficulty = "Hard";

      // 1. Try to find a matching problem with the target difficulty
      let candidateProblems = await Problem.find({
        patterns: relevantPattern,
        _id: { $nin: excludeIds },
        difficulty: targetDifficulty
      }).limit(10);
      
      // 2. Fallback to any difficulty if none found
      if (candidateProblems.length === 0) {
        candidateProblems = await Problem.find({
          patterns: relevantPattern,
          _id: { $nin: excludeIds }
        }).limit(10);
      }
      
      if (candidateProblems.length > 0) {
        // Shuffle and pick 1 to avoid showing the same one to every user
        selectedProblem = candidateProblems.sort(() => 0.5 - Math.random())[0];
        selectedRecallProblemIds.add(selectedProblem._id.toString());
      }
    }
    
    if (selectedProblem) {
      resolvedTargets.push({
        problem: selectedProblem,
        originalDueProblemId: originalProblemId,
        relevantPattern: relevantPattern,
        relevantMastery: relevantMastery,
        nextReviewDate: dueProblem.nextReviewDate,
        patternsWithMastery: [{
          name: relevantPattern,
          cumulativeMastery: relevantMastery
        }]
      });
    }
  }
  
  return resolvedTargets;
}
