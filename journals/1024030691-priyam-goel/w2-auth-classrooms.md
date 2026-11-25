# Week 2 : Authentication and Classroom Management

## Task

Build login, role handling, classroom creation, joining, and the class roster.

## What I built

- Teacher and student signup/login with bcrypt password hashing.
- JWT-based authentication with role claims.
- Teacher invite-code gate for instructor registration.
- Middleware for `authenticateToken` and `requireRole`.
- Classroom creation from a fixed course catalogue.
- Unique six-character join codes and shareable join links.
- Student enrollment with duplicate prevention.
- Teacher roster view and classroom deletion.
- Student leave-classroom flow.

## Problem I hit

Students could try to join the same classroom twice, and two requests could
arrive at nearly the same time.

## Solution

I added a unique constraint on `(classroom_id, student_id)` in the
`enrollments` table. The database now prevents duplicate enrollment even if
the application check is bypassed by timing.

## What I learned

Role checks in the UI are not enough. The backend must check the JWT role and
ownership/enrollment on every protected route.