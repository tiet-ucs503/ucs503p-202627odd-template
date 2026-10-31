# Week 3 Progress Report — AgriConnect — Kabir Manchanda

| | |
|---|---|
| **Name** | Kabir Manchanda |
| **Roll No.** | 1024030415 |
| **Teammate** | Manbhav Kumar Terry (1024030427) |
| **Project** | AgriConnect |
| **Milestone** | Prototype close-out + Capstone start (Grounded Kisan) |
| **Period** | Mon 7 Sep → Mon 14 Sep 2026 |
| **Hours** | ~16 |

---

## 1. Work Completed This Week

During Week 3, I finished shipping the remaining **Prototype** hardening to `master`, then started the **Capstone** milestone with **Grounded Kisan** (PRD §8.2): RAG over a curated knowledge pack, refuse/escalate paths, a seeded `AGRONOMIST` role, evaluation harness, and profile-based OpenWeather (including a 5-day outlook) shared with the header weather API.

The major work streams this week were:

- Razorpay escrow payments (verify-on-confirm, signed webhook, COD / mock modes)
- Contact-exchange guard beyond chat (order notes + listing fields)
- In-app WebRTC voice-call signalling (Socket.io) and ring-timeout hardening
- Capstone Grounded Kisan: classify → retrieve → cite / refuse / escalate
- `AGRONOMIST` RBAC, `AdvisoryEscalation` migration/seed, agronomist queue API
- OpenWeather live + forecast for farmer profile location; `GET /api/v1/weather`
- Offline eval set (~30 questions) and `npm run eval:grounded`
- Docs, Postman, weekly board, and merge to `master` (`917cf07` / `1072f10`)

Manbhav Kumar Terry owned Week 3 frontend surfaces in parallel: payment method UI and buyer payment nudges, 13-locale expansion + test guards, call panel UX, Kisan citation display, and the header weather chip. Backend contracts, integrations, and Capstone advisory logic were primarily my responsibility.

---

## 2. Prototype Hardening — Payments, Anti-bypass & Calls

### Escrow payments

- Production-shaped Razorpay path: checkout create, verify on order confirm, signed webhook.
- Mock mode when keys are absent so faculty demos still run.
- COD stays outside escrow; buyer payment nudge notifications on accept/confirm; farmer unpaid-fulfill warning (fulfilil not blocked for COD).

### Contact guard

- Extended `CONTACT_INFO_BLOCKED` from order chat to order notes and listing `description` / `variety` / `village` so phone/UPI/email cannot bypass chat moderation.

### In-app calls

- WebRTC + Socket.io invite/accept/decline/signal path so buyer and farmer talk without exchanging phone numbers.
- 45s ring timeout so an unanswered call cannot lock the order forever; socket auth refresh so long-lived tabs keep working.

These close the Prototype “production-shaped” gap: money, anti-disintermediation, and voice without leaving the platform.

---

## 3. Capstone — Grounded Kisan (RAG)

Prototype Kisan was a thin Gemini wrapper. Capstone upgrades the **same** widget (not a second chatbot).

### Routing

| Path | When | Behaviour |
|---|---|---|
| **Legacy chat** | Marketplace / app how-to | Existing Gemini chat |
| **Grounded** | Crop / scheme / weather | Top-k curated chunks + citations |
| **Refuse** | Grounded intent, empty retrieval | No invented answer |
| **Escalate** | Pesticide dose / medical-adjacent / low confidence | `AdvisoryEscalation` + notify agronomists |

### Knowledge & retrieval

- Curated pack: ICAR-style crop cards, PM-Kisan / PMFBY / MSP one-pagers, weather practice rules.
- Lexical top-k retrieval with confidence threshold; tiny-tag false positives (e.g. `ph` inside “photoperiod”) fixed.

### Evaluation

- ~30 labelled cases (`answer` / `escalate` / `refuse` / `legacy`).
- Offline report: overall accuracy **100%**, correct-escalation **100%** (`npm run eval:grounded`).

---

## 4. AGRONOMIST Role & Escalation Queue

- Additive Prisma `Role.AGRONOMIST` and `AdvisoryEscalation` model (migration `20260911120000_grounded_kisan_agronomist`).
- Seeded expert (like admin) — **not** self-registerable at `/auth/register`.
- `GET/PATCH /api/v1/agronomist/escalations` for claim/resolve; farmer + agronomist notifications (`ADVISORY_ESCALATION`).

This satisfies Capstone’s human handoff requirement without inventing chemical doses in chat.

---

## 5. Profile Weather API

- Geocode farmer `village` / `district` / `state` via OpenWeather Geocoding; fall back to Delhi only if geocode fails.
- Current conditions + 24–48h rain outlook + **5-day** daily aggregates.
- `GET /api/v1/weather` powers the header chip; the same live evidence feeds Grounded Kisan weather answers.
- Optional `OPENWEATHER_API_KEY` in env (documented in `.env.example`).

---

## 6. Testing, Docs & Shipping

### Verification

- Backend Vitest suite green after Capstone modules (assistant/grounded tests + full suite).
- `eval:grounded` 30/30; live OpenWeather smoke for Ludhiana (Kabir demo profile).
- Coordinated with Manbhav’s frontend tests (i18n parity, header weather mock, lint).

### Documentation

- Updated `API_CONTRACT`, `API_ENDPOINTS`, `API_STATUS_CODES`, `BACKEND_GUIDE`, `FRONTEND_GUIDE`, `CHANGELOG`, `README`, Postman, and `WEEKLY_PROGRESS`.

### Git

- Feature commit `917cf07` on `backend_frontend`.
- Merged to `master` as `1072f10`.
- Earlier in the week also merged Prototype hardening (`b394fed` and CI/lint follow-ups).

---

## 7. Challenges, Learnings & Next Week

### Challenges & how resolved

- Gemini thinking tokens were eating reply budget / TTS latency — pinned TTS model and `GEMINI_THINKING_LEVEL=minimal`.
- OpenWeather free keys can return 401 until activated; verified once the dashboard key was live.
- Retrieval substring boosts on short tags caused false “low confidence” escalations — raised minimum tag length for includes-matching.

### Learnings

- Capstone advisory must **refuse and escalate**, not invent doses; RAG + RBAC handoff matches faculty PRD better than a second chatbot.
- Profile location beats a hard-coded city for demo credibility (Ludhiana vs Delhi).
- Shipping Prototype polish and Capstone start in the same week is workable if contracts and eval stay first-class.

### Collaboration note

Kabir (me): payments/webhook, contact guard, call signalling, Grounded RAG, agronomist APIs, weather service, eval, migrations, API docs, merges.  
Manbhav: payment UI, 13-locale UI + tests, call panel, Kisan citations, header weather chip, i18n keys.

### Plan for next week

- Faculty walkthrough of Prototype + Grounded Kisan / weather from `master`.
- Optional: TURN for strict-NAT calls; farmer payout settlement; native-speaker pass on machine-translated locales.
- Capstone backlog remains ML price prediction / crop CV after advisory grounding is demoed.
