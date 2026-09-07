# Week 02 — Lehar Arora (1024030419)

## Objective
Prototype citizen authentication using Google OAuth 2.0, evaluate usability for government portal context, and begin end-to-end endpoint verification.

## Work Completed
- **Google OAuth 2.0 Prototyping**:
  - Implemented initial Google OAuth sign-in flow for citizen access.
  - Configured client credentials and callback handlers in Flask.
- **Usability & Rubric Review**:
  - Tested Google Auth with mock users and gathered feedback on civic applicability.
  - Noted that rural and semi-urban Indian citizens frequently do not maintain Google accounts for accessing government-aided portals, and prefer mobile phone numbers.
- **API Testing & Smoke Tests**:
  - Created smoke tests for service listing, search queries, and details routes.
  - Verified IRT (Information Retrieval Time) tracking metrics.

## Problems Identified
- Google OAuth is not widely adopted for civic and government-aided services in India; mobile phone OTP verification is the de-facto standard across Digilocker, UMANG, and Parivahan.
- Need an authentication strategy that does not pass personal identifiers to third-party public AI providers.

## Next Steps
- Pivot to Indian mobile number verification with password registration and OTP verification.
- Author exhaustive end-to-end test suite for all application endpoints.
