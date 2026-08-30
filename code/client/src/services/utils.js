// ──────────────────────────────────────────────
// CPRecal — Utility Functions
// ──────────────────────────────────────────────

export const PATTERNS = [
  'Arrays & Hashing',
  'Math & Geometry',
  'Dynamic Programming',
  '2D DP',
  'Sorting',
  'Graphs',
  'Advanced Graphs',
  'Greedy',
  'Binary Search',
  'Database',
  'Bit Manipulation',
  'Trees',
  'Prefix Sum',
  'Two Pointers',
  'Heap / Priority Queue',
  'Simulation',
  'Counting',
  'Stack',
  'Sliding Window',
  'Enumeration',
  'Design',
  'Backtracking',
  'Number Theory',
  'Union-Find',
  'Linked List'
].sort();

/**
 * Generates a LeetCode URL from a title slug
 * @param {string} titleSlug - The LeetCode problem title slug
 * @returns {string} The full LeetCode URL
 */
export const getLeetCodeUrl = (titleSlug) => {
  return `https://leetcode.com/problems/${titleSlug}/`;
};

/**
 * Formats a due date into a human-readable relative string
 * @param {string|Date} date - The nextReviewDate
 * @returns {string} E.g., 'Due today', 'Due tomorrow', 'Due in 3 days', 'Overdue'
 */
export const formatDueDate = (date) => {
  if (!date) return '';
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const target = new Date(date);
  const targetMidnight = new Date(target);
  targetMidnight.setHours(0, 0, 0, 0);

  if (targetMidnight < today) {
    return 'Overdue';
  } else if (targetMidnight.getTime() === today.getTime()) {
    return 'Due today';
  } else if (targetMidnight.getTime() === tomorrow.getTime()) {
    return 'Due tomorrow';
  } else {
    const diffTime = targetMidnight - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return `Due in ${diffDays} days`;
  }
};
