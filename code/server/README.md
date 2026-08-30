# CPRecal Backend Setup & Implementation Guide

**Last Updated:** 2026-08-18  
**Status:** Production-Ready (Phase 1-5 Complete)

---

## Quick Start

### 1. Install Dependencies

```bash
cd server
npm install
```

### 2. Environment Setup

Create `.env` file in `server/` directory:

```env
# MongoDB
MONGODB_URI=mongodb://localhost:27017/cprecal

# Server
PORT=3001
NODE_ENV=development

# JWT
JWT_SECRET=your-super-secret-key-change-this-in-production
JWT_EXPIRES_IN=7d

# CORS
CLIENT_URL=http://localhost:5173
```

### 3. Start MongoDB

```bash
# If using local MongoDB
mongod

# Or use MongoDB Atlas connection string instead
```

### 4. Seed Global Problems

```bash
node scripts/seedProblems.js
```

Output:

```
✅ Seeded 50 problems successfully
📊 Total problems in database: 50
```

### 5. Start Server

```bash
npm start
# Server running on http://localhost:3001
```

### 6. Verify Backend

```bash
curl http://localhost:3001/api/health
# Response: { "status": "ok", "service": "CPRecal API" }
```

---

## Architecture Overview

### Data Model

```
Global Data (Shared):
├── Problem (title, difficulty, patterns, description)

User-Specific Data (Scoped by userId):
├── SolvingSession (start, end, duration)
├── Submission (submission attempt record)
├── AcceptedSolution (first accepted submission with code + analysis)
├── ProblemMastery (calculated score: 0-100)
├── PatternMastery (aggregated from problems: 0-100)
├── FSRSState (scheduling: rating 1-4, next review date)
└── ReviewHistory (audit trail)
```

### Critical Security Rule

**Every user-specific query MUST use:**

```javascript
{
  userId: req.user.userId;
}
```

**NEVER trust:**

- `req.body.userId`
- `req.query.userId`
- URL parameters for user selection

**Always extract from JWT:**

```javascript
const userId = req.user.userId; // From auth middleware
```

---

## API Endpoints

### Authentication

```
POST   /api/auth/register       (public)
POST   /api/auth/login          (public)
GET    /api/auth/me             (authenticated)
POST   /api/auth/logout         (public)
```

### Problems (Problem Library)

```
GET    /api/problems            (authenticated)
  Query: ?difficulty=Easy&pattern=Two%20Pointers&status=solved&search=two&limit=20&offset=0
  Response: { problems: [...], total, limit, offset }

GET    /api/problems/:id        (authenticated)
  Response: { problem: {...}, userState: {...} }
```

### Patterns (Pattern Mastery)

```
GET    /api/patterns            (authenticated)
  Response: { patterns: [...], weakPatterns: [...], strongPatterns: [...] }

GET    /api/patterns/:patternName (authenticated)
  Response: { pattern: {...}, problems: [...] }
```

### Dashboard

```
GET    /api/dashboard           (authenticated)
  Response: { stats: {...}, todaysRevision: [...], weakPatterns: [...], strongPatterns: [...] }

GET    /api/dashboard/stats     (authenticated, lightweight)
  Response: { totalSolved, totalAttempted, patternsCovered, reviewDue }
```

### Reviews & FSRS

```
POST   /api/reviews             (authenticated)
  Body: { problemId, status: "completed" | "skipped" | "failed" }
  Response: { success: true, updated: {...} }

GET    /api/reviews/due         (authenticated)
  Response: { reviews: [...], count }
```

### Ingestion (Extension)

```
POST   /api/ingestion/submission (authenticated)
  Body: { problemId, title, titleSlug, difficulty, patterns, sessionStart, sessionEnd, submissionHistory, acceptedSubmissionId, acceptedCode, language, hintsUsed, analysisResult }
  Response: { success: true, problemMastery: {...}, fsrs: {...}, session: {...} }

GET    /api/ingestion/health    (public)
  Response: { status: "ok", message: "..." }
```

---

## Mastery Calculation Formula

Final Mastery = Weighted Average of Components (0-100)

```
mastery = (SE × 0.25) + (TC × 0.25) + (SUS × 0.20) + (TT × 0.15) + (HU × 0.15)

Where:
  SE  = Solution Efficiency (25%)
       ├─ Compare user's actual TC/SC vs optimal TC/SC
       └─ Perfect match = 100, worse = lower

  TC  = Time Complexity (25%)
       ├─ Score user's time complexity vs optimal
       └─ Match = 100, worse = 60-80

  SUS = Submissions Until Success (20%)
       ├─ Formula: 100 - (count - 1) × 20
       └─ 1 submission = 100, 2+ = lower

  TT  = Time Taken (15%)
       ├─ Normalize against difficulty expectations
       ├─ Easy: 5m, Medium: 15m, Hard: 30m
       └─ Within baseline = 100, slower = lower

  HU  = Hints Used (15%)
       ├─ Formula: 100 - (hintsCount × 15)
       └─ 0 hints = 100, 1 hint = 85, 2+ = lower
```

### FSRS Rating Mapping

```
Mastery    →    Rating    →    Interval
0-39       →      1       →    1 day (Learn)
40-59      →      2       →    3 days (Moderate)
60-79      →      3       →    7 days (Good)
80-100     →      4       →    14 days (Excellent)
```

---

## File Structure

```
server/src/
├── models/
│   ├── User.js                  ✅ existing
│   ├── Problem.js               ✅ NEW
│   ├── SolvingSession.js         ✅ NEW
│   ├── Submission.js             ✅ NEW
│   ├── AcceptedSolution.js       ✅ NEW
│   ├── ProblemMastery.js         ✅ NEW
│   ├── PatternMastery.js         ✅ NEW
│   ├── FSRSState.js              ✅ NEW
│   └── ReviewHistory.js          ✅ NEW
│
├── services/
│   ├── mastery/
│   │   ├── scoring.js            ✅ NEW (formulas)
│   │   ├── problemMastery.js     ✅ NEW (calculate & save)
│   │   └── patternMastery.js     ✅ NEW (aggregate)
│   ├── fsrs/
│   │   ├── ratingMapper.js       ✅ NEW (0-100 → 1-4)
│   │   └── scheduler.js          ✅ NEW (FSRS scheduling)
│   ├── dashboard/
│   │   └── dashboardService.js   ✅ NEW (dashboard stats)
│   └── ingestion/
│       └── processSubmission.js  ✅ NEW (end-to-end flow)
│
├── controllers/
│   ├── authController.js         ✅ existing
│   ├── problemController.js      ✅ NEW
│   ├── patternController.js      ✅ NEW
│   ├── dashboardController.js    ✅ NEW
│   ├── reviewController.js       ✅ NEW
│   └── ingestionController.js    ✅ NEW
│
├── routes/
│   ├── authRoutes.js             ✅ existing
│   ├── problemRoutes.js          ✅ NEW
│   ├── patternRoutes.js          ✅ NEW
│   ├── dashboardRoutes.js        ✅ NEW
│   ├── reviewRoutes.js           ✅ NEW
│   └── ingestionRoutes.js        ✅ NEW
│
├── middleware/
│   ├── auth.js                   ✅ existing
│   └── errorHandler.js           ✅ in app.js
│
├── config/
│   ├── db.js                     ✅ existing
│   └── cookieConfig.js           ✅ existing
│
├── app.js                        ✅ UPDATED (new routes added)
└── server.js                     ✅ existing

scripts/
└── seedProblems.js               ✅ NEW (populates 50 problems)
```

---

## Testing the Backend

### 1. Test Health Check

```bash
curl http://localhost:3001/api/health
```

### 2. Register User

```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "password": "password123"
  }' \
  -c cookies.txt
```

### 3. Login

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }' \
  -c cookies.txt
```

### 4. Get Problems (with auth)

```bash
curl -b cookies.txt http://localhost:3001/api/problems
```

### 5. Get Dashboard (with auth)

```bash
curl -b cookies.txt http://localhost:3001/api/dashboard
```

### 6. Submit a Solving Session (Extension Integration)

```bash
curl -X POST http://localhost:3001/api/ingestion/submission \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "problemId": 1,
    "title": "Two Sum",
    "titleSlug": "two-sum",
    "difficulty": "Easy",
    "patterns": ["Hash Map", "Two Pointers"],
    "sessionStart": "2026-08-18T10:00:00Z",
    "sessionEnd": "2026-08-18T10:08:23Z",
    "submissionHistory": [
      {
        "submissionId": "abc123",
        "status": "Wrong Answer",
        "runtime": null,
        "memory": null,
        "timestamp": "2026-08-18T10:01:00Z",
        "language": "Python3"
      },
      {
        "submissionId": "abc124",
        "status": "Accepted",
        "runtime": 76,
        "memory": 42.4,
        "timestamp": "2026-08-18T10:08:23Z",
        "language": "Python3"
      }
    ],
    "acceptedSubmissionId": "abc124",
    "acceptedCode": "class Solution:\n    def twoSum(self, nums, target):\n        seen = {}\n        for i, num in enumerate(nums):\n            comp = target - num\n            if comp in seen:\n                return [seen[comp], i]\n            seen[num] = i",
    "language": "Python3",
    "hintsUsed": 0,
    "analysisResult": {
      "actualTimeComplexity": "O(n)",
      "actualSpaceComplexity": "O(n)",
      "optimalTimeComplexity": "O(n)",
      "optimalSpaceComplexity": "O(n)",
      "explanation": "Uses a hash map to store complements, achieving optimal linear time."
    }
  }'
```

---

## Multi-User Testing

### Test Data Isolation

1. **Create User A**

   ```bash
   Register: test-a@example.com
   ```

2. **User A Submits Problem**
   - Solve problem #1 (Two Sum) with mastery 92

3. **Create User B**

   ```bash
   Register: test-b@example.com
   ```

4. **Verify Isolation**
   - User A: GET /api/problems → shows problem #1 with mastery 92
   - User B: GET /api/problems → shows problem #1 with NO mastery (unsolved)

5. **Test Direct API Access**
   - User B cannot access User A's data even with direct ObjectId

---

## Frontend Integration

### The `api.js` service is now connected to real backend

**Before (Mock):**

```javascript
const USE_MOCK = true; // ❌ Old
```

**After (Real):**

```javascript
// All endpoints call real Express API ✅ New
```

No component changes needed — API contract is preserved!

---

## Common Issues & Solutions

### Issue: "Cannot connect to MongoDB"

**Solution:**

- Ensure MongoDB is running: `mongod`
- Check MONGODB_URI in .env
- If using MongoDB Atlas, verify connection string

### Issue: "401 Unauthorized" on protected endpoints

**Solution:**

- Must login first to get HTTP-only cookie
- Ensure credentials: 'include' is set in fetch (it is)
- JWT cookie must not be expired

### Issue: "Mastery not updating"

**Solution:**

- Check payload matches expected schema
- Verify ProblemMastery record created
- Check service logs for calculation errors

### Issue: "FSRS state not found"

**Solution:**

- FSRSState created automatically with ProblemMastery
- If missing, check ingestion endpoint logs

---

## Performance Optimization

### Indexes Created

All models have compound indexes on frequently queried fields:

- `{ userId: 1, problemId: 1 }` — Problem-specific queries
- `{ userId: 1 }` — User-wide queries
- `{ userId: 1, mastery: -1 }` — Leaderboard queries
- `{ userId: 1, nextReviewDate: 1 }` — FSRS scheduling

### Query Optimization Tips

- Use `.lean()` for read-only queries (faster)
- Limit result sets with `.limit()` and `.skip()`
- Use `.select()` to fetch only needed fields
- Avoid N+1 queries with `.populate()`

---

## Extension Integration (Tampermonkey)

The backend is ready for extension submissions at:

```
POST /api/ingestion/submission
```

**Extension should:**

1. Collect solving data on LeetCode problem page
2. Call LLM for code analysis
3. Send data to backend ingestion endpoint
4. Receive calculated mastery + FSRS state
5. Display result in widget

**Example flow** (already in extension script):

```javascript
const result = await fetch("/api/ingestion/submission", {
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(submissionPayload),
});
```

---

## Deployment Checklist

- [ ] MongoDB connection string set in production
- [ ] JWT_SECRET changed to strong random value
- [ ] NODE_ENV=production
- [ ] CORS origin updated to production client URL
- [ ] Error logging configured
- [ ] Database backups enabled
- [ ] API rate limiting added
- [ ] SSL/HTTPS enforced
- [ ] Indexes created (automatic via Mongoose)
- [ ] Test with real users (multi-user isolation verified)

---

## Next Steps (Phase 6+)

1. **Update Tampermonkey Extension**
   - Change backend endpoint from `api.coderecall.dev` to real backend
   - Test end-to-end: solve problem → extension → backend → dashboard

2. **Implement More Features**
   - Bulk problem import from LeetCode
   - User statistics & analytics
   - Problem recommendations based on weak patterns
   - Community features (leaderboards, etc)

3. **Optimize FSRS**
   - Implement full FSRS algorithm (currently simplified)
   - Allow customizable scheduling
   - Add review streak tracking

4. **Security Hardening**
   - Add rate limiting
   - Implement CSRF protection
   - Add input validation middleware
   - Encrypt sensitive data fields

---

## Support & Documentation

- **API Schema:** See individual controller files for endpoint documentation
- **Database Schemas:** See model files (\*.js in models/)
- **Implementation Plan:** See [IMPLEMENTATION_PLAN.md](../IMPLEMENTATION_PLAN.md)
- **Architecture:** See [CPRecal_Antigravity_Docs/](../CPRecal_Antigravity_Docs/)

---

**Everything is ready for testing! 🚀**
