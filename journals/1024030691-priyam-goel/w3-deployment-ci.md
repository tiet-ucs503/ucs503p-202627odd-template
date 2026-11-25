# Week 3 : Deployment and CI/CD

## Task

Make the project deployable and keep the build repeatable.

## What I built

- Next.js web deployment on Vercel.
- Express and Socket.io backend hosted on Render.
- PostgreSQL on Neon and Redis on Upstash.
- Android test builds distributed through Firebase App Distribution.
- GitHub Actions pipeline for backend tests, web tests/build, and Flutter
  analysis/tests/APK.
- Environment variable examples for backend and web.

## Problem I hit

The Android build failed on CI because of Gradle and Android SDK/NDK version
mismatches.

## Solution

I pinned the Gradle, Android Gradle Plugin, Java, and NDK versions in the CI
workflow and Android project files. I also added the required Android SDK
setup steps before the Flutter build.

## What I learned

Deployment is part of the project, not something added at the end. A build
that only works on one laptop is not a reliable submission.