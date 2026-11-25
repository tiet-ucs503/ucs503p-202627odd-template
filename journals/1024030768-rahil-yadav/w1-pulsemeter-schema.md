# Week 1 : PulseMeter Schema and Teacher Authoring

## Task

Add the data model and teacher-facing authoring flow for PulseMeter
activities.

## What I built

- `live_activities`, `pulsemeters`, `pulsemeter_responses`, and
`word_cloud_mutes` tables.
- JSONB configuration for word-cloud, MCQ, and rating-scale activities.
- Partial unique index to allow only one active activity per classroom.
- `POST /pulsemeters` and `GET /pulsemeters` routes.
- `CreatePulseMeterDialog` and `PulseMeterAuthoringView` on the teacher
dashboard.

## Problem I hit

Two activities could be launched in the same classroom if two requests
arrived at the same time.

## Solution

I added a partial unique index on `live_activities(classroom_id)` where
`status = 'ACTIVE'`. The database now enforces the one-active rule instead
of relying only on application checks.

## What I learned

Some rules are safer when they live in the database. A check in the UI can
be bypassed or raced, but a unique index cannot.
