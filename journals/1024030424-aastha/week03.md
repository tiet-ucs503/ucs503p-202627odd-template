# Week 03 — Aastha Mahajan

## Objective
Design and implement citizen identification and database persistence via Indian mobile phone number authentication, password management, and persistent chat history.

## Work Completed
- **Phone Number Authentication Architecture**:
  - Initialized citizen authentication based on 10-digit Indian mobile numbers (starting with 6, 7, 8, 9) rather than third-party OAuth, matching Indian civic accessibility standards.
  - Developed backend routes in `app.py`:
    - `POST /api/auth/register-send-otp`: Dispatches 6-digit verification code for new accounts.
    - `POST /api/auth/register-verify`: Validates OTP, hashes password with PBKDF2/SHA256 (`generate_password_hash`), and establishes secure session.
    - `POST /api/auth/login-password`: Authenticates registered citizens via mobile and password.
  - Made citizen Full Name strictly mandatory during registration (minimum 2 characters) for personalized interaction.

- **Database Schema Upgrades (`bharatassist.db`)**:
  - Upgraded the SQLite `users` table schema: added columns for `phone`, `name`, `password_hash`, `otp`, `otp_expiry`, `is_verified`, and `last_login`.
  - Created persistent `chat_history` table in SQLite: stores `user_id`, `user_phone`, `question`, `answer`, `language`, `sources_json`, and `created_at`.

- **Zero-LLM Privacy Shield**:
  - Enforced architectural isolation so citizen phone numbers, passwords, and OTPs remain strictly local in SQLite and signed sessions.
  - Phone numbers are completely redacted and never transmitted in Gemini API prompt payloads.

- **Persistent Chat History Integration**:
  - Linked authenticated user turns to `chat_history`.
  - Created `GET /api/assistant/history` to retrieve prior queries and `POST /api/assistant/history/clear` to permanently erase saved history on citizen request.

## Problems Identified & Addressed
- **Guest vs. Logged-in Separation**: Required ensuring that unauthenticated guest users can still use the assistant anonymously without errors or leaking any prior user's session data. Implemented clean conditional session checks.
- **Data Integrity**: Created automated database initialization (`init_users_table()`) so missing tables and columns are automatically upgraded without data loss.

## Next Steps
- Collaborate with Lehar on comprehensive endpoint testing and verification.
- Refine login flow redirection to the homepage and implement session security controls.
- Polish project documentation and prepare evaluation artifacts.
