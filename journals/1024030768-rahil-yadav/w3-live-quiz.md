# Week 3 : Live Quiz Scoring and Leaderboard

## Task

Build the live MCQ quiz flow with time-weighted scoring.

## What I built

- Quiz and question authoring with WIDE and NARROW scoring modes.
- Server-authoritative question start and end timestamps.
- Answer submission with timing and score calculation.
- Answer-reveal distributions.
- Cumulative live leaderboard.

## Scoring formula

For a correct answer, the remaining-time fraction is:

`f = max(0, min(1, (T - t) / T))`

- WIDE mode: `300 + 700 * f`
- NARROW mode: `700 + 300 * f`
- Incorrect answer: `0`

## Problem I hit

Client clocks cannot be trusted for fair scoring.

## Solution

The backend stores `started_at_ms` and `ends_at_ms` in
`activity_question_states`. Response time is measured on the server, and
the correct option is not sent to the student until reveal.

## What I learned

If timing affects marks, the server must own the clock.
