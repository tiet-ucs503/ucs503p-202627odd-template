/**
 * Seed script: Populate global Problem collection with LeetCode problems
 * Run from server directory: node seed.js
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import Problem from "./src/models/Problem.js";

dotenv.config();

const PROBLEMS = [
  {
    leetcodeId: 1,
    title: "Two Sum",
    titleSlug: "two-sum",
    difficulty: "Easy",
    patterns: ["Hash Map", "Two Pointers"],
  },
  {
    leetcodeId: 15,
    title: "3Sum",
    titleSlug: "3sum",
    difficulty: "Medium",
    patterns: ["Two Pointers", "Hash Map", "Sorting"],
  },
  {
    leetcodeId: 3,
    title: "Longest Substring Without Repeating Characters",
    titleSlug: "longest-substring-without-repeating-characters",
    difficulty: "Medium",
    patterns: ["Sliding Window", "Hash Map", "Two Pointers"],
  },
  {
    leetcodeId: 33,
    title: "Search in Rotated Sorted Array",
    titleSlug: "search-in-rotated-sorted-array",
    difficulty: "Medium",
    patterns: ["Binary Search", "Two Pointers"],
  },
  {
    leetcodeId: 4,
    title: "Median of Two Sorted Arrays",
    titleSlug: "median-of-two-sorted-arrays",
    difficulty: "Hard",
    patterns: ["Binary Search", "Divide and Conquer"],
  },
  {
    leetcodeId: 11,
    title: "Container With Most Water",
    titleSlug: "container-with-most-water",
    difficulty: "Medium",
    patterns: ["Two Pointers", "Greedy"],
  },
  {
    leetcodeId: 17,
    title: "Letter Combinations of a Phone Number",
    titleSlug: "letter-combinations-of-a-phone-number",
    difficulty: "Medium",
    patterns: ["Backtracking", "Hash Map"],
  },
  {
    leetcodeId: 19,
    title: "Remove Nth Node From End of List",
    titleSlug: "remove-nth-node-from-end-of-list",
    difficulty: "Medium",
    patterns: ["Linked List", "Two Pointers"],
  },
  {
    leetcodeId: 20,
    title: "Valid Parentheses",
    titleSlug: "valid-parentheses",
    difficulty: "Easy",
    patterns: ["Stack", "String"],
  },
  {
    leetcodeId: 21,
    title: "Merge Two Sorted Lists",
    titleSlug: "merge-two-sorted-lists",
    difficulty: "Easy",
    patterns: ["Linked List", "Two Pointers"],
  },
  {
    leetcodeId: 23,
    title: "Merge k Sorted Lists",
    titleSlug: "merge-k-sorted-lists",
    difficulty: "Hard",
    patterns: ["Linked List", "Heap / Priority Queue", "Divide and Conquer"],
  },
  {
    leetcodeId: 26,
    title: "Remove Duplicates from Sorted Array",
    titleSlug: "remove-duplicates-from-sorted-array",
    difficulty: "Easy",
    patterns: ["Two Pointers", "Array"],
  },
  {
    leetcodeId: 27,
    title: "Remove Element",
    titleSlug: "remove-element",
    difficulty: "Easy",
    patterns: ["Two Pointers", "Array"],
  },
  {
    leetcodeId: 28,
    title: "Find the Index of the First Occurrence in a String",
    titleSlug: "find-the-index-of-the-first-occurrence-in-a-string",
    difficulty: "Easy",
    patterns: ["Two Pointers", "String"],
  },
  {
    leetcodeId: 30,
    title: "Substring with Concatenation of All Words",
    titleSlug: "substring-with-concatenation-of-all-words",
    difficulty: "Hard",
    patterns: ["Hash Map", "Sliding Window", "String"],
  },
  {
    leetcodeId: 42,
    title: "Trapping Rain Water",
    titleSlug: "trapping-rain-water",
    difficulty: "Hard",
    patterns: ["Two Pointers", "Dynamic Programming", "Stack"],
  },
  {
    leetcodeId: 53,
    title: "Maximum Subarray",
    titleSlug: "maximum-subarray",
    difficulty: "Medium",
    patterns: ["Dynamic Programming", "Divide and Conquer"],
  },
  {
    leetcodeId: 55,
    title: "Jump Game",
    titleSlug: "jump-game",
    difficulty: "Medium",
    patterns: ["Greedy", "Dynamic Programming"],
  },
  {
    leetcodeId: 56,
    title: "Merge Intervals",
    titleSlug: "merge-intervals",
    difficulty: "Medium",
    patterns: ["Sorting", "Array"],
  },
  {
    leetcodeId: 62,
    title: "Unique Paths",
    titleSlug: "unique-paths",
    difficulty: "Medium",
    patterns: ["Dynamic Programming", "Math", "Combinatorics"],
  },
  {
    leetcodeId: 64,
    title: "Minimum Path Sum",
    titleSlug: "minimum-path-sum",
    difficulty: "Medium",
    patterns: ["Dynamic Programming"],
  },
  {
    leetcodeId: 70,
    title: "Climbing Stairs",
    titleSlug: "climbing-stairs",
    difficulty: "Easy",
    patterns: ["Dynamic Programming", "Math"],
  },
  {
    leetcodeId: 72,
    title: "Edit Distance",
    titleSlug: "edit-distance",
    difficulty: "Hard",
    patterns: ["Dynamic Programming", "String"],
  },
  {
    leetcodeId: 78,
    title: "Subsets",
    titleSlug: "subsets",
    difficulty: "Medium",
    patterns: ["Backtracking", "Bit Manipulation"],
  },
  {
    leetcodeId: 79,
    title: "Word Search",
    titleSlug: "word-search",
    difficulty: "Medium",
    patterns: ["Backtracking", "DFS"],
  },
  {
    leetcodeId: 94,
    title: "Binary Tree Inorder Traversal",
    titleSlug: "binary-tree-inorder-traversal",
    difficulty: "Easy",
    patterns: ["Tree", "Stack", "DFS"],
  },
  {
    leetcodeId: 100,
    title: "Same Tree",
    titleSlug: "same-tree",
    difficulty: "Easy",
    patterns: ["Tree", "DFS"],
  },
  {
    leetcodeId: 101,
    title: "Symmetric Tree",
    titleSlug: "symmetric-tree",
    difficulty: "Easy",
    patterns: ["Tree", "DFS", "BFS"],
  },
  {
    leetcodeId: 102,
    title: "Binary Tree Level Order Traversal",
    titleSlug: "binary-tree-level-order-traversal",
    difficulty: "Medium",
    patterns: ["Tree", "BFS", "Queue"],
  },
  {
    leetcodeId: 104,
    title: "Maximum Depth of Binary Tree",
    titleSlug: "maximum-depth-of-binary-tree",
    difficulty: "Easy",
    patterns: ["Tree", "DFS", "BFS"],
  },
  {
    leetcodeId: 105,
    title: "Construct Binary Tree from Preorder and Inorder Traversal",
    titleSlug: "construct-binary-tree-from-preorder-and-inorder-traversal",
    difficulty: "Medium",
    patterns: ["Tree", "Array", "Hash Map"],
  },
  {
    leetcodeId: 106,
    title: "Construct Binary Tree from Inorder and Postorder Traversal",
    titleSlug: "construct-binary-tree-from-inorder-and-postorder-traversal",
    difficulty: "Medium",
    patterns: ["Tree", "Array", "Hash Map"],
  },
  {
    leetcodeId: 110,
    title: "Balanced Binary Tree",
    titleSlug: "balanced-binary-tree",
    difficulty: "Easy",
    patterns: ["Tree", "DFS"],
  },
  {
    leetcodeId: 111,
    title: "Minimum Depth of Binary Tree",
    titleSlug: "minimum-depth-of-binary-tree",
    difficulty: "Easy",
    patterns: ["Tree", "DFS", "BFS"],
  },
  {
    leetcodeId: 112,
    title: "Path Sum",
    titleSlug: "path-sum",
    difficulty: "Easy",
    patterns: ["Tree", "DFS"],
  },
  {
    leetcodeId: 113,
    title: "Path Sum II",
    titleSlug: "path-sum-ii",
    difficulty: "Medium",
    patterns: ["Tree", "DFS", "Backtracking"],
  },
  {
    leetcodeId: 116,
    title: "Populating Next Right Pointers in Each Node",
    titleSlug: "populating-next-right-pointers-in-each-node",
    difficulty: "Medium",
    patterns: ["Tree", "BFS"],
  },
  {
    leetcodeId: 127,
    title: "Word Ladder",
    titleSlug: "word-ladder",
    difficulty: "Hard",
    patterns: ["BFS", "Graph", "Hash Map"],
  },
  {
    leetcodeId: 128,
    title: "Longest Consecutive",
    titleSlug: "longest-consecutive",
    difficulty: "Medium",
    patterns: ["Hash Map", "Union Find"],
  },
  {
    leetcodeId: 133,
    title: "Clone Graph",
    titleSlug: "clone-graph",
    difficulty: "Medium",
    patterns: ["Graph", "DFS", "BFS", "Hash Map"],
  },
  {
    leetcodeId: 138,
    title: "Copy List with Random Pointer",
    titleSlug: "copy-list-with-random-pointer",
    difficulty: "Medium",
    patterns: ["Linked List", "Hash Map"],
  },
  {
    leetcodeId: 141,
    title: "Linked List Cycle",
    titleSlug: "linked-list-cycle",
    difficulty: "Easy",
    patterns: ["Linked List", "Two Pointers"],
  },
  {
    leetcodeId: 142,
    title: "Linked List Cycle II",
    titleSlug: "linked-list-cycle-ii",
    difficulty: "Medium",
    patterns: ["Linked List", "Two Pointers", "Hash Map"],
  },
  {
    leetcodeId: 146,
    title: "LRU Cache",
    titleSlug: "lru-cache",
    difficulty: "Medium",
    patterns: ["Hash Map", "Linked List", "Design"],
  },
  {
    leetcodeId: 148,
    title: "Sort List",
    titleSlug: "sort-list",
    difficulty: "Medium",
    patterns: ["Linked List", "Sorting", "Divide and Conquer"],
  },
  {
    leetcodeId: 155,
    title: "Min Stack",
    titleSlug: "min-stack",
    difficulty: "Medium",
    patterns: ["Stack", "Design"],
  },
  {
    leetcodeId: 160,
    title: "Intersection of Two Linked Lists",
    titleSlug: "intersection-of-two-linked-lists",
    difficulty: "Easy",
    patterns: ["Linked List", "Two Pointers", "Hash Map"],
  },
  {
    leetcodeId: 162,
    title: "Find Peak Element",
    titleSlug: "find-peak-element",
    difficulty: "Medium",
    patterns: ["Binary Search"],
  },
  {
    leetcodeId: 169,
    title: "Majority Element",
    titleSlug: "majority-element",
    difficulty: "Easy",
    patterns: ["Array", "Hash Map", "Divide and Conquer"],
  },
  {
    leetcodeId: 200,
    title: "Number of Islands",
    titleSlug: "number-of-islands",
    difficulty: "Medium",
    patterns: ["DFS", "BFS", "Union Find"],
  },
  {
    leetcodeId: 206,
    title: "Reverse Linked List",
    titleSlug: "reverse-linked-list",
    difficulty: "Easy",
    patterns: ["Linked List", "Two Pointers", "Recursion"],
  },
];

async function seedProblems() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    console.log(`\nSeeding ${PROBLEMS.length} problems...`);

    // Clear existing problems
    const deleteResult = await Problem.deleteMany({});
    console.log(`🗑️  Cleared ${deleteResult.deletedCount} existing problems`);

    // Insert problems
    const result = await Problem.insertMany(PROBLEMS);
    console.log(`✅ Seeded ${result.length} problems successfully`);

    // Verify
    const count = await Problem.countDocuments();
    console.log(`📊 Total problems in database: ${count}`);

    // Show sample
    const sample = await Problem.findOne({ leetcodeId: 1 });
    console.log("\n📝 Sample problem:", sample);

    await mongoose.disconnect();
    console.log("\n✅ Disconnected from MongoDB");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding problems:", error.message);
    process.exit(1);
  }
}

seedProblems();
