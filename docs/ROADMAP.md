# AgriConnect Implementation Roadmap

Phased growth model (PRD): **Lab → Prototype → Capstone**.
Internal release tags V1/V2/V3 map to these milestones; `/api/v1` is API versioning only.

## Phase 1 — Structure

- [x] UCS503 folders (journals, project-proposal, docs)
- [x] Documentation skeleton + PRD / architecture / API contract
- [x] Journal skeleton
- [x] Project proposal (PDF + LaTeX)

## Phase 2 — Lab (CRUD marketplace)

- [x] Auth (JWT access + refresh cookie) + RBAC (Farmer / Buyer / Admin)
- [x] Produce listings + photo uploads (Supabase Storage)
- [x] Orders + inventory-safe quantity + state machine
- [x] Admin moderation, analytics, activity logs
- [x] In-app + email notifications
- [x] Farmer / buyer basic reports



## Phase 3 — Prototype (real-time, production-shaped)

- [x] Order-scoped chat (REST + Socket.io) + typing indicators
- [x] Anti-bypass contact guard (chat, notes, listing copy)
- [x] In-app voice calls (WebRTC + Socket.io signalling)
- [x] Reviews after fulfilled orders
- [x] Live mandi prices (Agmarknet / data.gov.in)
- [x] Logistics checkpoints on orders
- [x] Escrow-style payments (Razorpay verify + signed webhook; COD)
- [x] Buyer produce alerts
- [x] 13-locale UI (en + Indian languages, RTL for Urdu)
- [x] Docker Compose + GitHub Actions CI
- [x] TURN server for strict-NAT voice calls
- [x] Farmer payouts / settlement via gateway
- [x] Contact blocking on review comments
- [x] Native-speaker pass on machine-translated locales



## Phase 4 — Capstone (AI-assisted advisory)

- [x] Kisan AI chat widget (Gemini when configured)
- [x] Grounded Kisan (curated RAG pack, citations, refuse-when-empty)
- [x] Agronomist role + escalation for high-stakes asks
- [x] Profile weather + 5-day forecast
- [ ] ML price prediction service
- [ ] Crop disease CV (image upload → advisory)
- [ ] Optional IoT / soil sensor simulation



## Phase 5 — Testing / CI

- [x] Backend unit + API + security tests
- [x] Frontend Vitest (screens, i18n parity, width budget)
- [x] CI fails on typecheck / lint / test errors
- [ ] Expand grounded-eval coverage beyond curated pack smoke
- [ ] End-to-end Playwright (optional)



## Phase 6 — Product polish

- [x] Public marketplace browse + landing
- [x] Order timeline + mandi compare badge
- [x] Payment method selection + unpaid-fulfill warnings
- [ ] Faculty demo walkthrough from `master`
- [ ] Settlement UI for farmer payouts