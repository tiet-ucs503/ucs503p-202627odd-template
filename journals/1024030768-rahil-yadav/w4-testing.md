# Week 4 : Testing and Fixing Live Activities

## Task

Test PulseMeter and quiz flows and fix the issues found.

## What I checked

- One active activity per classroom.
- Duplicate PulseMeter responses are rejected.
- Duplicate quiz answers are rejected.
- Expired quiz questions reject late answers.
- Correct answers are hidden until reveal.
- Leaderboard order matches stored scores.

## Tests

- `backend/test/liveActivities.test.js`
- `backend/test/pulsemeters.test.js`
- `backend/test/quizzes.test.js`
- `backend/test/profanityFilter.test.js`

## Problem I hit

The quiz screen could show a stale question if the teacher moved quickly.

## Solution

I changed the student client to read the latest question state from the
server and accept answers only for the latest started question.

## What I learned

Real-time screens need to treat the server as the source of truth, not the
last message they happened to receive.
