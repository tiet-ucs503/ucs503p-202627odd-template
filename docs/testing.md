# Testing Plan

## Unit Tests
- Auth schemas and password rules
- Order state machine transitions
- Inventory decrement / oversell protection
- Contact-info guard (phone, email, UPI patterns)
- Payment schema and escrow state helpers
- Mandi price service parsing / filters
- Grounded Kisan retrieval + refuse-when-empty
- Assistant TTS clipping helpers

## API Tests
- Auth register / login / refresh / logout
- Listings create → photos → publish
- Orders place / accept / confirm / fulfill / cancel
- Payment confirm + signed webhook paths
- Admin moderate / verify / suspend
- Invalid bodies (400), unauthorized (401), forbidden (403)
- Oversized / bad content-type uploads (413 / 415)

## Frontend Tests
- Critical screens (dashboards, listings, orders, admin, auth)
- Locale context + 13-language key parity
- Hardcoded-string and width-budget guards
- Notification copy rendering from structured params

## Integration / Smoke
- Backend: `npm test` (target ~138 cases on current branch)
- Frontend: Vitest suite (target ~128 cases)
- Socket smoke: order chat antibypass
- Calls smoke: ring / accept / decline / timeout (13/13)
- Health / ready endpoints for deploy gates

## Security Tests
- Missing / invalid JWT
- Role escalation attempts (farmer hitting admin routes)
- Suspended account blocked from write actions
- Webhook signature verification (reject unsigned payloads)
- XSS-safe rendering of user-generated listing/chat text
- Secrets never returned in API JSON

## CI
- GitHub Actions: typecheck, lint, and tests must pass on push/PR
- Docker Compose path covered for local full-stack bring-up

## How to run locally

```bash
cd backend
npm test

cd ../frontend
npm test
```
