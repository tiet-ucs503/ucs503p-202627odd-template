/**
 * Mastery Scoring & Normalization
 * Converts raw solving metrics into normalized 0-100 component scores
 */

/**
 * Calculate Solution Efficiency (0-100)
 * Based on user's actual TC/SC vs optimal TC/SC
 * Perfect match = 100, worse = lower
 */
export function calculateSolutionEfficiency(
  actualTimeComplexity,
  actualSpaceComplexity,
  optimalTimeComplexity,
  optimalSpaceComplexity,
) {
  let score = 100;

  // If complexities match optimal, full score
  if (actualTimeComplexity === optimalTimeComplexity) {
    // Good time complexity
  } else {
    // Penalize for non-optimal time complexity
    // Simple heuristic: reduce by 20-40% depending on worse-ness
    score -= 30;
  }

  if (actualSpaceComplexity === optimalSpaceComplexity) {
    // Good space complexity
  } else {
    // Penalize for non-optimal space complexity
    score -= 10;
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Calculate Time Complexity Score (0-100)
 * Compare user's TC against optimal TC
 */
export function calculateTimeComplexityScore(userTC, optimalTC) {
  // Simple scoring: if they match, 100
  // If worse, penalize proportionally
  if (userTC === optimalTC) {
    return 100;
  }

  // Heuristic: if worse, 60-80 range
  return 75;
}

/**
 * Calculate Submissions Until Success Score (0-100)
 * Fewer submissions = higher score
 * Formula: 100 - (count - 1) * 20
 */
export function calculateSubmissionsScore(submissionCount) {
  if (submissionCount <= 1) {
    return 100;
  }

  const penalty = (submissionCount - 1) * 20;
  return Math.max(0, 100 - penalty);
}

/**
 * Calculate Time Taken Score (0-100)
 * Normalize against difficulty-based expectations
 * Easy: 5m, Medium: 15m, Hard: 30m
 */
export function calculateTimeTakenScore(totalSeconds, difficulty) {
  const minutes = totalSeconds / 60;

  let baseline;
  switch (difficulty) {
    case "Easy":
      baseline = 5;
      break;
    case "Medium":
      baseline = 15;
      break;
    case "Hard":
      baseline = 30;
      break;
    default:
      baseline = 15;
  }

  // If solved in <= baseline, full score
  if (minutes <= baseline) {
    return 100;
  }

  // Scale down: every 2x baseline = 50% score reduction
  const ratio = minutes / baseline;
  const score = 100 / ratio;

  return Math.max(0, Math.min(100, score));
}

/**
 * Calculate Hints Used Score (0-100)
 * Each hint reduces score by 15%
 * Formula: 100 - (hintsCount * 15)
 */
export function calculateHintsUsedScore(hintsCount) {
  const penalty = hintsCount * 15;
  return Math.max(0, 100 - penalty);
}

/**
 * Calculate Final Problem Mastery (0-100)
 * Weighted average of all components
 * Weights: SE 25%, TC 25%, SUS 20%, TT 15%, HU 15%
 */
export function calculateFinalMastery(components) {
  const {
    solutionEfficiency,
    timeComplexity,
    submissionsUntilSuccess,
    timeTaken,
    hintsUsed,
  } = components;

  const mastery =
    solutionEfficiency * 0.25 +
    timeComplexity * 0.25 +
    submissionsUntilSuccess * 0.2 +
    timeTaken * 0.15 +
    hintsUsed * 0.15;

  return Math.round(mastery);
}

/**
 * FSRS Rating Mapping (0-100 mastery → 1-4 rating)
 */
export function masteryToFsrsRating(mastery) {
  if (mastery < 40) return 1; // Learn
  if (mastery < 60) return 2; // Moderate
  if (mastery < 80) return 3; // Good
  return 4; // Excellent
}
