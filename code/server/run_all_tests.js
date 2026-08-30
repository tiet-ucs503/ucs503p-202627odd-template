import fetch from 'node-fetch';

const API_BASE = 'http://localhost:5000/api';

async function runMasterSuite() {
  console.log("==================================================================");
  console.log("             CPRECAL COMPREHENSIVE END-TO-END TEST SUITE          ");
  console.log("==================================================================\n");

  let passed = 0;
  let failed = 0;

  function report(name, success, details = "") {
    if (success) {
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } else {
      console.log(`❌ [FAIL] ${name} — ${details}`);
      failed++;
    }
  }

  try {
    // 1. Health check
    const healthRes = await fetch(`${API_BASE}/ingestion/health`);
    const healthData = await healthRes.json();
    report("1. Backend Ingestion Health Check", healthRes.status === 200 && healthData.status === 'ok');

    // 2. Authentication flow
    const timestamp = Date.now();
    const userAEmail = `user_a_${timestamp}@test.com`;
    const userBEmail = `user_b_${timestamp}@test.com`;

    // Register User A
    const regARes = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'User A', email: userAEmail, password: 'password123' })
    });
    const tokenA = regARes.headers.get('set-cookie')?.match(/token=([^;]+)/)?.[1];
    report("2. User A Registration & JWT Cookie Generation", regARes.status === 201 && Boolean(tokenA));

    // Register User B
    const regBRes = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'User B', email: userBEmail, password: 'password123' })
    });
    const tokenB = regBRes.headers.get('set-cookie')?.match(/token=([^;]+)/)?.[1];
    report("3. User B Registration & JWT Cookie Generation", regBRes.status === 201 && Boolean(tokenB));

    // Verify /api/auth/me
    const meRes = await fetch(`${API_BASE}/auth/me`, {
      headers: { 'Cookie': `token=${tokenA}` }
    });
    const meData = await meRes.json();
    report("4. Authenticated /api/auth/me Session Hydration", meRes.status === 200 && meData.user?.email === userAEmail);

    // 5. LLM Code Analysis
    const sampleCode = `
class Solution:
    def twoSum(self, nums: list[int], target: int) -> list[int]:
        seen = {}
        for i, n in enumerate(nums):
            diff = target - n
            if diff in seen:
                return [seen[diff], i]
            seen[n] = i
        return []
    `.trim();

    const llmRes = await fetch(`${API_BASE}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': `token=${tokenA}` },
      body: JSON.stringify({
        code: sampleCode,
        problemTitle: "Two Sum",
        difficulty: "Easy",
        language: "python3"
      })
    });
    const llmData = await llmRes.json();
    report("5. Real Gemini LLM Code Analysis (/api/analyze)", llmRes.status === 200 && Boolean(llmData.actualTimeComplexity));

    // 6. Ingestion Pipeline for User A
    const ingestRes = await fetch(`${API_BASE}/ingestion/submission`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': `token=${tokenA}` },
      body: JSON.stringify({
        problemId: 1,
        title: "Two Sum",
        titleSlug: "two-sum",
        difficulty: "Easy",
        patterns: ["Arrays", "Hashing"],
        sessionStart: new Date(Date.now() - 180000).toISOString(),
        sessionEnd: new Date().toISOString(),
        submissionHistory: [{
          submissionId: "sub_ts_1",
          status: "Accepted",
          runtime: 45,
          memory: 14.1,
          language: "python3",
          timestamp: new Date().toISOString()
        }],
        acceptedSubmissionId: "sub_ts_1",
        acceptedCode: sampleCode,
        language: "python3",
        hintsUsed: 0,
        analysisResult: llmData
      })
    });
    const ingestData = await ingestRes.json();
    const problemAId = ingestData.problem?.id;
    report("6. Solving Session Ingestion & FSRS Scheduling (/api/ingestion/submission)", ingestRes.status === 201 && ingestData.success);

    // 7. Multi-User Isolation Check
    const dashBRes = await fetch(`${API_BASE}/dashboard`, {
      headers: { 'Cookie': `token=${tokenB}` }
    });
    const dashBData = await dashBRes.json();
    const userBisIsolated = dashBData.stats?.totalSolved === 0 && dashBData.stats?.patternsCovered === 0;
    report("7. Multi-User Data Isolation (User B cannot see User A's stats)", userBisIsolated);

    // 8. FSRS Spaced Repetition Review Submission
    const reviewRes = await fetch(`${API_BASE}/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': `token=${tokenA}` },
      body: JSON.stringify({
        problemId: problemAId,
        status: "completed"
      })
    });
    const reviewData = await reviewRes.json();
    report("8. Manual FSRS Review & Interval Progression (/api/reviews)", reviewRes.status === 200 && reviewData.success);

    // 9. Input Validation for Invalid ObjectIDs
    const badIdRes = await fetch(`${API_BASE}/problems/invalid-id-format`, {
      headers: { 'Cookie': `token=${tokenA}` }
    });
    const badIdData = await badIdRes.json();
    report("9. Backend ObjectId Input Validation (400 Bad Request)", badIdRes.status === 400 && badIdData.message === "Invalid problem ID format");

    // 10. Pattern Analytics
    const patternRes = await fetch(`${API_BASE}/patterns`, {
      headers: { 'Cookie': `token=${tokenA}` }
    });
    const patternData = await patternRes.json();
    report("10. Pattern Mastery Aggregation (/api/patterns)", patternRes.status === 200 && Array.isArray(patternData.patterns));

  } catch (err) {
    console.error("Critical Test Failure:", err);
    failed++;
  }

  console.log("\n==================================================================");
  console.log(`                     RESULTS: ${passed} PASSED, ${failed} FAILED              `);
  console.log("==================================================================");
}

runMasterSuite();
