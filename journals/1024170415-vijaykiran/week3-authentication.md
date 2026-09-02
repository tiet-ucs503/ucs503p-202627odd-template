# Week 3 : Authentication

# Implementing JWT Authentication APIs

## Goal:

Implement authentication endpoints (`/api/auth/register`, `/api/auth/login`) and secure middleware.

## Relevant Context

The backend requires a secure way to authenticate users and verify roles (admin vs customer vs worker). Passwords must not be stored in plaintext.

## Key Observation

Using `bcryptjs` is necessary to hash passwords before saving them in the database, and `jsonwebtoken` (JWT) is required for stateless authentication across the React frontend and Node backend.

## Solution

- Installed `bcryptjs` and `jsonwebtoken`.
- Implemented `middleware/authMiddleware.js` for token verification (`protect`) and role-based access control (`authorize`).
- Implemented `controllers/authController.js` to handle registration and login logic, generating a token upon success.
- Created `routes/authRoutes.js` and mounted the authentication routes in `server.js` at `/api/auth`.

