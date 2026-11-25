# Week 4 : Integration, Testing and Hardening

## Task

Connect the modules and test the complete teacher–student workflows.

## What I did

- Connected the teacher dashboard to attendance, PulseMeter, quizzes, forum,
  and analytics APIs.
- Checked Socket.io events for attendance and live activities.
- Fixed cross-module API contract issues.
- Added and ran backend, web, and Flutter tests.
- Checked security basics: JWT validation, role checks, parameterised SQL,
  rate limits, and CORS.
- Verified the deployed system against the four end-to-end test cases.

## Results

- Backend: 213 tests passed.
- Web: 29 tests passed.
- Flutter: 13 tests passed.
- End-to-end test cases: 28 steps passed.

## Problem I hit

Some screens worked locally but failed against the deployed backend because
of environment differences and cold starts.

## Solution

I tested against the deployed Render/Vercel URLs, added explicit API base URL
configuration, and documented the deployment requirements.

## What I learned

Integration testing finds problems that unit tests cannot. The same code can
behave differently when the database, cache, and network are real.