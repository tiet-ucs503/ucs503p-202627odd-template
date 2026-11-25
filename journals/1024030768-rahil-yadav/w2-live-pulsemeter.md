# Week 2 : Live PulseMeter Session and Moderation

## Task

Make PulseMeter work as a live classroom activity.

## What I built

- One-click launch from an authored PulseMeter.
- Socket.io broadcast so students see the activity without refreshing.
- Live aggregation for word-cloud, MCQ, and rating-scale responses.
- Present-versus-responded analytics using the attendance session.
- Profanity filtering and teacher-controlled word-cloud mutes.

## Problem I hit

A PulseMeter can be launched before attendance is final, so the
participation denominator is not known yet.

## Solution

The live activity is marked `attendance_pending = TRUE`. When the
attendance session ends, pending activities for that classroom are linked
to the session and their analytics are recalculated.

## What I learned

A participation percentage is only meaningful when the denominator is
defined. The system needs to wait for attendance to settle.
