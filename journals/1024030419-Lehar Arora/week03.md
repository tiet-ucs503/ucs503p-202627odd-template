# Week 03 — Lehar Arora (1024030419)

## Objective
Evaluate authentication strategies for BharatAssist, transition from Google OAuth to mobile-first authentication, implement comprehensive endpoint testing, and refine session and navigation user experience.

## Work Completed
- **Google Auth Evaluation & Transition to Mobile-First Auth**:
  - Initially prototyped Google OAuth 2.0 authentication for citizen login.
  - Through usability analysis for Indian public governance and civic services, determined that Google authentication is suboptimal for government-aided portals: many Indian citizens, particularly in rural and semi-urban demographics, do not use Google accounts for civic tasks and predominantly rely on mobile numbers.
  - Led the architectural shift from Google Auth to Indian Mobile Number verification with dual modes:
    - Login for Existing Citizens (Mobile + Password + OTP fallback).
    - Sign Up for New Citizens (Mandatory Full Name + Mobile + Password + 6-digit OTP).

- **Comprehensive API & Endpoint Testing**:
  - Developed and verified the automated test suite in `tests/test_all_endpoints.py`.
  - Expanded test coverage to 33 exhaustive automated tests covering:
    - All 7 HTML frontend pages (`/`, `/services`, `/services/<id>`, `/schemes`, `/simplify`, `/assistant`, `/login`).
    - REST APIs (Service listing, details, search, health check).
    - AI Assistant grounded responses, multilingual queries, and context clearing.
    - Document Simplifier and PII redaction pipeline.
    - Voice STT and TTS synthesis endpoints.
    - Citizen authentication: mandatory name check, registration OTP dispatch, OTP verification, password sign-in, invalid credential rejection (401), and logout session clearing.
    - Persistent chat history persistence and guest privacy isolation.
  - Achieved 100% test pass rate (`Ran 33 tests ... OK`).

- **Post-Login Redirection & Navigation Refinement**:
  - Resolved post-login routing: updated authentication callbacks so successful sign-in redirects citizens directly to the first page (homepage `/`) rather than immediately forcing them into the assistant.
  - Kept the assistant screen clean on load: ensured `/assistant` opens with a fresh greeting (`Namaste, [Name]! How can I help you?`) rather than dumping all prior conversation history onto the screen.
  - Integrated past conversations into an offcanvas "Saved Chat History" drawer with on-demand inspection.

- **Auto-Logout on Page Refresh (Kiosk Security Mode)**:
  - Addressed kiosk and shared terminal vulnerability: when citizens access BharatAssist from public cyber cafes or Common Service Centres (CSCs), pressing page reload (F5 / browser refresh) now immediately invalidates the session and returns the user to the homepage as a logged-out guest.
  - Implemented via high-precision W3C navigation timing detection (`performance.getEntriesByType('navigation')[0].type === 'reload'`).

- **UI Polish & Minor Refinements**:
  - Removed the prototype dark-blue authentication bar from `index.html`.
  - Added clean badges for Zero-LLM Privacy Shield.
  - Tested database persistence to ensure newly added citizen profiles and chat turns are written to SQLite.

## Problems Identified & Addressed
- **Public Terminal Session Leakage**: On public computers, citizens frequently refresh or leave tabs open. Implemented client-side reload detection that immediately triggers `/logout?next=/`, ensuring privacy protection for civic users.
- **Idempotency in Test Runs**: Addressed test database teardown so automated test cases can be run repeatedly without collision with previously registered phone numbers.

## Next Steps
- Finalize project report and prototype demonstration materials.
- Update project README with architecture diagrams, endpoint specifications, and quickstart guides.
- Review evaluation metrics (IRT, grounding accuracy) for submission.
