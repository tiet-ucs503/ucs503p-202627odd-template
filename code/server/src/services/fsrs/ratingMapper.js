import { masteryToFsrsRating } from "../mastery/scoring.js";

/**
 * Map mastery score (0-100) to FSRS rating (1-4)
 * 0-39   → 1 (Learn - frequent review)
 * 40-59  → 2 (Moderate - needs practice)
 * 60-79  → 3 (Good - regular review)
 * 80-100 → 4 (Excellent - spaced review)
 */
export function getMasteryRating(mastery) {
  return masteryToFsrsRating(mastery);
}

/**
 * Get rating label
 */
export function getRatingLabel(rating) {
  const labels = {
    1: "Learn",
    2: "Moderate",
    3: "Good",
    4: "Excellent",
  };
  return labels[rating] || "Unknown";
}

/**
 * Get recommended review interval based on rating
 * (Simplified FSRS - can be enhanced later)
 */
export function getInitialInterval(rating) {
  const intervals = {
    1: 1, // Learn: 1 day
    2: 3, // Moderate: 3 days
    3: 7, // Good: 7 days
    4: 14, // Excellent: 14 days
  };
  return intervals[rating] || 1;
}
