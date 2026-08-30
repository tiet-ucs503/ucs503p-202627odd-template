CPRecal — Complete Project Context & End-to-End Flow
Purpose: a single reference describing what CPRecal is, how data flows from LeetCode through the Tampermonkey extension and LLM analysis into the backend, how mastery and FSRS work, and what the frontend must display.
1. Product Definition
CPRecal (previously CodeRecall) is a personalized LeetCode learning, mastery, and recall system. It observes a user's solving behavior, analyzes the submitted code, calculates problem-level mastery, aggregates mastery at the DSA-pattern level, and schedules future reviews using FSRS.
2. High-Level Flow
LeetCode → Tampermonkey Extension → LLM Code Analysis → Extension UI → CPRecal Backend → MongoDB → Problem Mastery + Pattern Mastery + FSRS → React Frontend.
3. Exact Solving Flow
1. User opens a LeetCode problem.
2. Tampermonkey identifies problem metadata: problem ID, title, titleSlug, difficulty, and tags/patterns.
3. The extension tracks the solving session and total time taken.
4. The extension monitors submissions and records submission status/history.
5. When the user gets Accepted, the extension obtains the accepted code, language, runtime, memory, submission ID, and timestamp.
6. The extension sends the question name and accepted user code to an LLM for code analysis.
7. The LLM returns the user's actual time complexity and actual space complexity, plus optimal time/space complexity and an explanation.
8. The extension calculates/displays a Solution Efficiency score using the user's complexity versus the optimal complexity.
9. The extension shows the live result in the floating CPRecal widget.
10. The user can enter hints used manually.
11. The extension packages the raw solving data and analysis result and sends it to the authenticated CPRecal backend.
12. The backend calculates the final problem mastery score.
13. The backend stores the problem mastery and supporting user-specific data.
14. The problem mastery is converted into an FSRS rating.
15. FSRS calculates the next review date.
16. The backend stores the FSRS state/review information.
17. React fetches personalized dashboard, library, pattern, and problem-detail data.
4. Extension / LLM Responsibility Split
Tampermonkey collects LeetCode facts and displays the immediate result.
The LLM analyzes the user's accepted code. It receives the question name and user code.
The LLM should return structured complexity information rather than directly deciding CPRecal mastery.
The extension uses the returned actual TC/SC and optimal TC/SC to produce/display Solution Efficiency.
The backend remains the source of truth for final mastery, pattern aggregation, persistence, authentication, and FSRS.
5. Current Extension UI
The current floating UI shows a solved state and fields such as Problem, Difficulty, tags, Time Taken, Submissions Until Success, Runtime, Memory, Efficiency Score, Your Complexity, Optimal Complexity, Space, Hints Used, Submit to CPRecal, and Open CPRecal Dashboard. The screenshot provided by the user is a visual reference for this flow.
6. Raw Data Collected
Problem ID, title, titleSlug, difficulty, tags/patterns.
Session start/end time and total solving time.
Submission ID, status, runtime, memory, timestamp.
Number of submissions until Accepted.
Accepted submission ID, code, language, runtime, memory.
Hints used.
LLM analysis: actual TC, actual SC, optimal TC, optimal SC, explanation.
Solution Efficiency score.
7. Problem Mastery Calculation
Problem mastery answers: 'How well did this specific user perform on this specific problem?'
Solution Efficiency = 25% weight.
Time Complexity = 25% weight.
Number of Submissions = 20% weight.
Time Taken = 15% weight, with the expected benchmark depending on problem difficulty (Easy/Medium/Hard).
Hints Used = 15% weight.
The exact normalization/scoring formulas inside each component can evolve, but these are the current weights.
Final problem mastery is stored per user and per problem.
8. Problem Mastery vs Pattern Mastery
Problem mastery is one user's score for one specific problem.
Pattern mastery is the cumulative/aggregate mastery of that user for a specific DSA pattern.
Example: 3Sum problem mastery = 72%. Two Pointers pattern mastery could be 78%.
A problem may have multiple patterns. Each pattern shown on Problem Details should use the user's cumulative mastery for that pattern, not the problem's score.
Pattern mastery is shown in the Pattern Dashboard and can also be shown when hovering over a pattern/tag on Problem Details.
9. FSRS Flow
Final problem mastery is converted to an FSRS rating.
0–39 mastery → rating 1.
40–59 mastery → rating 2.
60–79 mastery → rating 3.
80–100 mastery → rating 4.
FSRS uses the rating and the user's review state/history to determine the next review date.
Due problems are surfaced in the Home Dashboard and revision flow.
FSRS data is user-specific.
10. Home Dashboard
Total solved problems.
Problems due today.
Patterns attempted.
A 'Today's Revision' area.
Today's Revision should show relevant problem information such as problem name, tags/patterns, cumulative pattern mastery, and review status.
Status should indicate whether the revision item is done or not done.
11. Problem Library
Contains the LeetCode problem library.
Search option.
Filters such as pattern, status, and other relevant problem attributes.
The library should distinguish global problem information from user-specific state such as solved status, mastery, and review state.
Exact filter set/UI can be refined from the previous project discussions.
12. Pattern Dashboard
Shows the user's cumulative mastery by DSA pattern.
Pattern mastery is calculated from that user's performance on relevant problems.
It should allow the user to understand which patterns are strong or weak.
The pattern dashboard is not the same as a list of individual problem scores.
13. Problem Details
Shows problem metadata and the user's individual problem mastery.
Shows solving information such as time taken, submission count, runtime, memory, code/analysis where appropriate.
Shows patterns/tags associated with the problem.
Hovering a pattern should show the user's cumulative mastery for that pattern.
Problem score and pattern score must remain clearly separated.
14. Authentication & Data Isolation
CPRecal is a normal authenticated application.
Every user-specific database record must belong to a CPRecal user.
User A must never access User B's solving sessions, submissions, mastery, pattern mastery, FSRS state, or review history.
Shared problem metadata can be global.
Backend authorization must determine the authenticated user; the frontend must not be trusted to choose another user's ID.
15. Database Concept
Shared Problem collection/data: problemId, title, titleSlug, difficulty, patterns/tags.
User-specific data can be represented through collections such as SolvingSession, Submission, AcceptedSolution, ProblemMastery, PatternMastery, FSRSState, ReviewHistory, and user-specific analysis/hint data.
User-specific records should reference userId.
Raw observations should be retained so derived mastery can be recalculated later.
16. Backend Responsibilities
Authentication and authorization.
Receive/validate extension data.
Store solving sessions and submissions.
Store accepted code and analysis.
Calculate problem mastery.
Calculate/update pattern mastery.
Manage FSRS state and review history.
Find due problems.
Provide dashboard API.
Provide problem library API.
Provide pattern dashboard API.
Provide problem detail API.
17. Important Rules
The extension is a collector/display layer, not the source of truth for mastery.
The LLM analyzes code; it does not need to own the CPRecall mastery algorithm.
Backend is the source of truth for persisted mastery and review state.
Problem mastery and pattern mastery are different metrics.
Shared problem metadata and user-specific performance must be separated.
All private API reads/writes must be scoped to the authenticated user.
The exact mastery normalization and pattern aggregation formulas are still implementation decisions unless explicitly finalized later.
