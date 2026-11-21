# Week 2 Progress Report — AgriConnect — Manbhav Kumar Terry

| | |
|---|---|
| **Name** | Manbhav Kumar Terry |
| **Roll No.** | 1024030427 |
| **Teammate** | Kabir Manchanda (1024030415) |
| **Project** | AgriConnect |
| **Milestone** | Prototype — real-time, production-shaped system |
| **Period** | Mon 31 Aug → Mon 7 Sep 2026 |
| **Hours** | ~11 |

---

## 1. Work Completed This Week

During Week 2, I focused primarily on AgriConnect’s **Prototype UI**: order chat and typing, order timeline, live mandi `/market-prices` page UX, Hindi/Punjabi (en/hi/pa) i18n, guest browse/landing polish, and Kisan assistant UI wiring. The goal was a faculty-demo-ready frontend on top of Kabir’s Prototype APIs.

The major work streams this week were:

- Real-time chat UI + typing indicators on order detail
- Order timeline (status, payment, logistics)
- Market-prices page (trends, live mandi, empty/offline states)
- en/hi/pa language switcher across register, profile, and Kisan
- Guest marketplace / landing polish
- Local testing with Socket.io and mandi pages; GitHub sync

Kabir owned Prototype backend and infra (mandi service, Socket.io, logistics/payments/alerts, Docker/CI). I consumed those contracts in the Next.js app.

---

## 2. Real-time Chat & Order Timeline UI

### Order chat

- Chat panel on order detail for farmer and buyer participants.
- Message history via REST; live updates via Socket.io (`join:order`, `message:new`).
- Typing indicator UI wired to `typing:start` / `typing` events.
- Clear auth errors when the socket token is missing or expired.

### Order timeline

- Visual stepper for Lab order status plus Prototype escrow payment and logistics stages.
- Helps faculty and users see “where the order is” without reading raw enums.

These screens make Prototype feel production-shaped rather than form-only.

---

## 3. Market Prices Page & Mandi UX

I built and polished the `/market-prices` experience so live Agmarknet data is understandable.

### What I delivered

- Trends / summary views using `GET /market/prices` and `/prices/summary`.
- Live mandi table and history filters using `/market/mandi/*`.
- Mandi compare badge on marketplace cards via `POST /market/prices/compare`.
- Honest empty states when a crop×state has no arrivals today (e.g. Wheat empty while Potato/Onion have rows).
- Offline / backend-down messaging when `:5001` is unreachable; parallel loads so one failing call does not blank the whole page.
- Haryana kept available in the state fallback list for demos.

### Why this matters

Price transparency is a Prototype selling point — the UI must show live data, empty days, and feed errors without looking broken.

---

## 4. i18n, Landing & Kisan Assistant UI

### Hindi / Punjabi i18n

- Language switcher for English, Hindi (हिन्दी), and Punjabi (ਪੰਜਾਬੀ).
- Persists preference in `localStorage` and syncs `languagePref` when signed in.
- Register / profile forms accept `en` | `hi` | `pa`.
- Kisan assistant UI passes optional `language` so replies match the user’s choice.

### Guest browse & landing

- Logo hero / landing polish for guest visitors.
- Public marketplace browse without forcing login first.

### Kisan assistant UI

- Chat widget integration against `GET /assistant/status` and `POST /assistant/query`.
- Online/offline indicator and safer handling when replies are long.
- Voice-first improvements (mic / read-aloud) as Prototype polish for demos.

---

## 5. Testing & Debugging

### Areas checked

- Socket connect, join order room, send/receive, typing
- Order timeline rendering across payment/logistics states
- Market-prices live / history / trends with `Promise.allSettled`
- Empty mandi tables vs true network errors
- Language switcher parity on key screens (en/hi/pa)
- Guest marketplace and landing
- Kisan status offline when Gemini key missing; query when online
- Register required fields (phone, state, district) in the UI

### Issues investigated / resolved

- Mandi page wiping on a single failed request — switched to settled parallel loads.
- “Failed to fetch” mapped to a clear backend-down message for demos.
- i18n missing keys on some screens — kept en/hi/pa message files in parity for Lab/Prototype strings.

---

## 6. Documentation, Presentation & Repository

### Documentation & presentation

During Week 2, I:

- Prepared the Week 2 progress report for my UI/i18n contributions.
- Updated frontend guide notes for mandi page behaviour and Kisan language.
- Prepared faculty demo clicks: marketplace → mandi page → order chat → language switch → Kisan.
- Coordinated with Kabir on API error codes (`502 MANDI_FEED_UNAVAILABLE` vs empty `200 []`).

### GitHub & project structure

```text
ucs503p-AgriConnect/
├── frontend/
│   ├── src/app/market-prices/
│   ├── src/features/assistant/
│   └── src/lib/i18n/messages/   # en, hi, pa (+ later locales)
├── backend/                     # teammate-led Prototype APIs
├── docs/
└── journals/
    └── 1024030427-Manbhav Kumar Terry/
        ├── week1.md
        └── week2.md
```

---

## 7. Challenges, Learnings & Next Week

### Challenges & how resolved

- **Sparse mandi data** — design UI for empty success, not only errors.
- **Realtime + REST** — keep history durable via REST while sockets feel live.
- **i18n scope** — ship solid en/hi/pa for Prototype demo; more locales can follow without blocking faculty walkthrough.

### Learnings

- Prototype value for users is mostly in clarity: timeline, mandi empty states, and language.
- Frontend and backend must share error-code meaning or demos look flaky.
- Pairing UI (me) with APIs/infra (Kabir) stays fast when contracts stay updated.

### Collaboration note

Manbhav (me): chat UI, order timeline, market-prices UX, en/hi/pa i18n, guest browse/landing, Kisan assistant UI.  
Kabir: mandi service, chat/reviews APIs, logistics/payments/alerts, jobs, Docker/CI, Vitest/docs.

### Plan for next week

- Support faculty Prototype demo walkthrough from `backend_frontend`.
- Continue marketplace/mandi load polish and register-field UX.
- Help plan Capstone UI needs once ML advisory scope is chosen.
