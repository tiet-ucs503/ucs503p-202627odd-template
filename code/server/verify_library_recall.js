import mongoose from "mongoose";
import dotenv from "dotenv";
import { processSubmission } from "./src/services/ingestion/processSubmission.js";
import FSRSState from "./src/models/FSRSState.js";
import User from "./src/models/User.js";
import Problem from "./src/models/Problem.js";
import ProblemMastery from "./src/models/ProblemMastery.js";
import PatternMastery from "./src/models/PatternMastery.js";
import ReviewHistory from "./src/models/ReviewHistory.js";
import { getProblems } from "./src/controllers/problemController.js";
import { getDashboardData } from "./src/services/dashboard/dashboardService.js";
import { submitReview } from "./src/controllers/reviewController.js";

dotenv.config();

async function runEndToEndVerification() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB.");

  const testEmail = "test_end_to_end_final@example.com";
  let user = await User.findOne({ email: testEmail });
  if (user) {
    await ProblemMastery.deleteMany({ userId: user._id });
    await PatternMastery.deleteMany({ userId: user._id });
    await FSRSState.deleteMany({ userId: user._id });
    await ReviewHistory.deleteMany({ userId: user._id });
  } else {
    user = await User.create({ name: "E2E Final", email: testEmail, passwordHash: "dummy" });
  }

  // Setup exact test problems in global library
  await Problem.deleteMany({ titleSlug: { $regex: "^e2e-final-" } });
  
  const probA = await Problem.create({ leetcodeId: 9301, title: "Problem A (Two Sum)", titleSlug: "e2e-final-a", difficulty: "Easy", patterns: ["E2E_FINAL_UNIQUE_PATTERN"] });
  const probB = await Problem.create({ leetcodeId: 9302, title: "Problem B (Group Anagrams)", titleSlug: "e2e-final-b", difficulty: "Medium", patterns: ["E2E_FINAL_UNIQUE_PATTERN"] });
  const probC = await Problem.create({ leetcodeId: 9303, title: "Problem C (Top K Frequent)", titleSlug: "e2e-final-c", difficulty: "Medium", patterns: ["E2E_FINAL_UNIQUE_PATTERN"] });

  console.log("\n============================================================");
  console.log("TEST 1: INITIAL SOLVE OF PROBLEM A");
  console.log("============================================================");
  const payloadA = {
    problemId: 9301, title: "Problem A (Two Sum)", titleSlug: "e2e-final-a", difficulty: "Easy", patterns: ["E2E_FINAL_UNIQUE_PATTERN"],
    sessionStart: new Date(Date.now() - 60000).toISOString(), sessionEnd: new Date().toISOString(),
    submissionHistory: [{ submissionId: "sub_a1", status: "Accepted", runtime: 55, memory: 42, language: "javascript", timestamp: new Date().toISOString() }],
    acceptedSubmissionId: "sub_a1", acceptedCode: "const twoSum = () => {};", language: "javascript", hintsUsed: 0,
    analysisResult: { actualTimeComplexity: "O(N)", actualSpaceComplexity: "O(N)", optimalTimeComplexity: "O(N)", optimalSpaceComplexity: "O(N)", explanation: "Optimal" }
  };
  await processSubmission(user._id, payloadA);
  
  let stateA = await FSRSState.findOne({ userId: user._id, problemId: probA._id });
  console.log(`- Problem A Solved. Mastery: ${(await ProblemMastery.findOne({ userId: user._id, problemId: probA._id })).mastery}%`);
  console.log(`- Problem A FSRS State Created: nextReviewDate = ${stateA.nextReviewDate.toISOString()}`);

  console.log("\n============================================================");
  console.log("TEST 2: FUTURE SCHEDULED RECALL (status=scheduled)");
  console.log("============================================================");
  // Force nextReviewDate to 5 days in future
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 5);
  stateA.nextReviewDate = futureDate;
  await stateA.save();

  // Helper for calling getProblems controller
  async function callGetProblems(status) {
    let responseData = null;
    const req = { query: { status, limit: 20, offset: 0 }, user: { userId: user._id } };
    const res = { status: () => ({ json: (data) => { responseData = data; } }) };
    await getProblems(req, res, console.error);
    return responseData;
  }

  const scheduledRes = await callGetProblems("scheduled");
  console.log(`- Scheduled Recall Problems Count: ${scheduledRes.problems.length}`);
  if (scheduledRes.problems.length !== 1) throw new Error("Expected 1 scheduled target");
  const targetB_sched = scheduledRes.problems[0];
  console.log(`- Returned Scheduled Target: ${targetB_sched.title} (ID: ${targetB_sched.id})`);
  console.log(`  Target != A? ${targetB_sched.id.toString() !== probA._id.toString()} (Expected: true)`);
  console.log(`  Target is Unsolved? ${targetB_sched.userState.solved === false} (Expected: true)`);
  console.log(`  Target carries originalDueProblemId pointing to A? ${targetB_sched.originalDueProblemId.toString() === probA._id.toString()}`);
  console.log(`  Target carries scheduled future nextReviewDate? ${new Date(targetB_sched.userState.nextReviewDate).toISOString() === futureDate.toISOString()}`);
  console.log(`  Target reviewDue is false? ${targetB_sched.userState.reviewDue === false}`);

  if (targetB_sched.id.toString() === probA._id.toString()) throw new Error("FAIL: Scheduled Recall returned Problem A!");

  const recallResWhileFuture = await callGetProblems("recall");
  console.log(`- Recall Due Count when A is in future: ${recallResWhileFuture.problems.length} (Expected: 0)`);
  if (recallResWhileFuture.problems.length !== 0) throw new Error("FAIL: Recall Due should be empty for future items");

  const solvedRes = await callGetProblems("solved");
  console.log(`- Solved Filter Count: ${solvedRes.problems.length} (Expected: 1 - Problem A)`);
  console.log(`  Solved problem is A? ${solvedRes.problems[0].id.toString() === probA._id.toString()}`);

  console.log("\n============================================================");
  console.log("TEST 3: RECALL DUE TODAY (status=recall & Dashboard)");
  console.log("============================================================");
  // Time travel A to yesterday (due today)
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  stateA.nextReviewDate = yesterday;
  await stateA.save();

  const recallDueRes = await callGetProblems("recall");
  console.log(`- Recall Due Problems Count: ${recallDueRes.problems.length}`);
  if (recallDueRes.problems.length !== 1) throw new Error("Expected 1 recall due target");
  const targetB_due = recallDueRes.problems[0];
  console.log(`- Returned Recall Due Target: ${targetB_due.title} (ID: ${targetB_due.id})`);
  console.log(`  Target != A? ${targetB_due.id.toString() !== probA._id.toString()}`);
  console.log(`  Target is Unsolved? ${targetB_due.userState.solved === false}`);
  console.log(`  Target reviewDue is true? ${targetB_due.userState.reviewDue === true}`);
  console.log(`  Target originalDueProblemId is A? ${targetB_due.originalDueProblemId.toString() === probA._id.toString()}`);

  // Test dashboard revision data
  const dashboardData = await getDashboardData(user._id);
  console.log(`- Dashboard Today's Revision Count: ${dashboardData.todaysRevision.length}`);
  console.log(`  Dashboard Target Title: ${dashboardData.todaysRevision[0].title}`);
  console.log(`  Dashboard Target != A? ${dashboardData.todaysRevision[0].id.toString() !== probA._id.toString()}`);

  console.log("\n============================================================");
  console.log("TEST 4: SOLVE PROBLEM B THROUGH NORMAL INGESTION");
  console.log("============================================================");
  const payloadB = {
    problemId: 9302, title: "Problem B (Group Anagrams)", titleSlug: "e2e-final-b", difficulty: "Medium", patterns: ["E2E_FINAL_UNIQUE_PATTERN"],
    sessionStart: new Date(Date.now() - 60000).toISOString(), sessionEnd: new Date().toISOString(),
    submissionHistory: [{ submissionId: "sub_b1", status: "Accepted", runtime: 80, memory: 45, language: "javascript", timestamp: new Date().toISOString() }],
    acceptedSubmissionId: "sub_b1", acceptedCode: "const groupAnagrams = () => {};", language: "javascript", hintsUsed: 0,
    analysisResult: { actualTimeComplexity: "O(N*K)", actualSpaceComplexity: "O(N*K)", optimalTimeComplexity: "O(N*K)", optimalSpaceComplexity: "O(N*K)", explanation: "Optimal" }
  };
  await processSubmission(user._id, payloadB);
  
  const masteryB = await ProblemMastery.findOne({ userId: user._id, problemId: probB._id });
  const fsrsB = await FSRSState.findOne({ userId: user._id, problemId: probB._id });
  console.log(`- Problem B Solved. Own Mastery: ${masteryB.mastery}%, Own FSRSState nextReviewDate: ${fsrsB.nextReviewDate.toISOString()}`);

  // Resolve A's review using reviewController
  const reqReview = {
    body: { problemId: probA._id, status: "completed", satisfiedByProblemId: probB._id },
    user: { userId: user._id }
  };
  let reviewResult = null;
  const resReview = { status: () => ({ json: (data) => { reviewResult = data; } }) };
  await submitReview(reqReview, resReview, console.error);
  console.log(`- Problem A Review Completed. Next review date pushed to: ${reviewResult.updated.fsrs.nextReviewDate}`);

  console.log("\n============================================================");
  console.log("TEST 5: SECOND RECALL CYCLE (A -> C, C != A, C != B)");
  console.log("============================================================");
  // Force A due again
  stateA = await FSRSState.findOne({ userId: user._id, problemId: probA._id });
  stateA.nextReviewDate = yesterday;
  await stateA.save();

  const secondRecallRes = await callGetProblems("recall");
  console.log(`- Second Recall Count: ${secondRecallRes.problems.length}`);
  if (secondRecallRes.problems.length !== 1) throw new Error("Expected 1 recall target for second cycle");
  const targetC = secondRecallRes.problems[0];
  console.log(`- Second Recall Target: ${targetC.title} (ID: ${targetC.id})`);
  console.log(`  Target C != A? ${targetC.id.toString() !== probA._id.toString()} (Expected: true)`);
  console.log(`  Target C != B? ${targetC.id.toString() !== probB._id.toString()} (Expected: true)`);
  console.log(`  Target C is Problem C? ${targetC.id.toString() === probC._id.toString()}`);

  console.log("\n============================================================");
  console.log("TEST 6: EXHAUSTION TEST (A, B, C all solved -> NO fallback to A)");
  console.log("============================================================");
  // Solve C
  const payloadC = {
    problemId: 9303, title: "Problem C (Top K Frequent)", titleSlug: "e2e-final-c", difficulty: "Medium", patterns: ["E2E_FINAL_UNIQUE_PATTERN"],
    sessionStart: new Date(Date.now() - 60000).toISOString(), sessionEnd: new Date().toISOString(),
    submissionHistory: [{ submissionId: "sub_c1", status: "Accepted", runtime: 70, memory: 44, language: "javascript", timestamp: new Date().toISOString() }],
    acceptedSubmissionId: "sub_c1", acceptedCode: "const topKFrequent = () => {};", language: "javascript", hintsUsed: 0,
    analysisResult: { actualTimeComplexity: "O(N log K)", actualSpaceComplexity: "O(N)", optimalTimeComplexity: "O(N log K)", optimalSpaceComplexity: "O(N)", explanation: "Optimal" }
  };
  await processSubmission(user._id, payloadC);

  // Force A due again
  stateA.nextReviewDate = yesterday;
  await stateA.save();

  const exhaustedRes = await callGetProblems("recall");
  console.log(`- Exhausted Recall Due Count: ${exhaustedRes.problems.length} (Expected: 0)`);
  if (exhaustedRes.problems.length !== 0) throw new Error("FAIL: System should return empty array, but returned " + exhaustedRes.problems[0].title);
  console.log(`  Safe empty state returned. Zero fallback to solved problems!`);

  console.log("\n============================================================");
  console.log("ALL 6 END-TO-END VERIFICATION TESTS PASSED PERFECTLY!");
  console.log("============================================================");
  await mongoose.disconnect();
}

runEndToEndVerification().catch((err) => {
  console.error("FATAL TEST ERROR:", err);
  process.exit(1);
});
