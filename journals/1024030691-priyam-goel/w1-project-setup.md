# Week 1 : Project Setup and Architecture

## Task

Set up the ClassPulse repository and the base architecture for the project.

## What I built

- Monorepo with `backend/`, `web/`, and `mobile/`.
- Express backend with a `/health` endpoint.
- PostgreSQL and Redis connection layer.
- Shared Material Design 3 tokens for web and mobile.
- Initial web dashboard and Flutter app shells.
- Base database schema for users, courses, classrooms, enrollments,
  sessions, and attendance records.

## Problem I hit

The three parts of the project needed to be developed separately but still
use the same data model and design system.

## Solution

I kept one repository with three clear folders and one shared specification.
The backend owns the database schema, and both clients use the same API
contracts and colour/typography tokens.

## What I learned

A clear folder structure and shared contracts save a lot of time later. Most
integration problems come from unclear boundaries, not from missing features.