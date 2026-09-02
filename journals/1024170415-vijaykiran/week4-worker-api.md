# Week 4 : Worker Registration

# Implementing Worker Profile APIs

## Goal:

Allow authenticated users with the 'worker' role to create and manage their service profiles.

## Relevant Context

Workers need to provide their service category, experience, hourly/visit charges, location, and phone number. When created, these profiles must default to a `pending` status so they don't appear in public search results until an Admin approves them.

## Key Observation

The API route must be secured using the JWT `protect` middleware and the `authorize('worker')` middleware to ensure customers cannot accidentally create worker profiles.

## Solution

- Created `controllers/workerController.js` to handle profile creation and retrieval.
- Ensured a user can only create one worker profile by checking the `userId`.
- Implemented `routes/workerRoutes.js` and mounted it at `/api/workers` in `server.js`.
- Configured the API to automatically set `status: "pending"` upon creation, satisfying the admin workflow requirement.

