# AlgoRecall Backend

Node.js + Express + MongoDB REST API for the AlgoRecall DSA revision platform.

## Architecture

```text
React Frontend
      |
      | REST / JSON
      v
Express API
      |
      +-- Authentication
      +-- Question Management
      +-- Revision Management
      +-- Scheduling Engine
      +-- Daily Recommendation
      +-- Analytics
      |
      v
MongoDB Atlas
```

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create `.env`

Copy `.env.example` to `.env` and provide:

```env
PORT=3000
MONGODB_URI=your_mongodb_atlas_connection_string
JWT_SECRET=your_secret
```

### 3. Start development server

```bash
npm run dev
```

The API will run at:

```text
http://localhost:3000
```

## Main endpoints

### Authentication

```text
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me
```

### Questions

```text
POST   /api/questions
GET    /api/questions
GET    /api/questions/:id
PUT    /api/questions/:id
DELETE /api/questions/:id
```

`GET /api/questions` supports:

```text
?topic=Arrays
?difficulty=Medium
?platform=LeetCode
?confidence=2
?status=due
?status=upcoming
?search=two
```

### Revision

```text
POST /api/revisions/:questionId
GET  /api/revisions/history/all
```

Revision body:

```json
{
  "confidence": 4
}
```

### Dashboard

```text
GET /api/dashboard/due-today
GET /api/dashboard/recommendation
GET /api/dashboard/analytics
GET /api/dashboard/heatmap
```

## Authentication

Protected endpoints require:

```text
Authorization: Bearer <JWT>
```

## Deterministic scheduling

AlgoRecall does not use machine learning for its recommendation engine.

### Priority

```text
Priority =
    0.40 × Confidence Need
  + 0.25 × Difficulty
  + 0.25 × Revision Recency
  + 0.10 × Revision Frequency
```

### Base intervals

| Confidence | Base interval |
|---|---:|
| 1 | 1 day |
| 2 | 2 days |
| 3 | 4 days |
| 4 | 7 days |
| 5 | 14 days |

Difficulty modifies the interval:

| Difficulty | Multiplier |
|---|---:|
| Easy | 1.2 |
| Medium | 1.0 |
| Hard | 0.7 |

The daily recommendation is the highest-priority question among questions that are due.

## Frontend integration

The current frontend template sends these question fields:

```json
{
  "title": "Two Sum",
  "topic": "Arrays",
  "difficulty": "Easy",
  "platform": "LeetCode",
  "link": "https://leetcode.com/..."
}
```

The backend also supports:

```text
confidence
dateSolved
```

If these are omitted when a question is created, confidence defaults to 3 and the solved date defaults to the current date.
