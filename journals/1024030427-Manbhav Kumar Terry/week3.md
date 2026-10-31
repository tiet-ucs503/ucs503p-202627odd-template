# Week 3 Progress Report — AgriConnect — Manbhav Kumar Terry

| | |
|---|---|
| **Name** | Manbhav Kumar Terry |
| **Roll No.** | 1024030427 |
| **Teammate** | Kabir Manchanda (1024030415) |
| **Project** | AgriConnect |
| **Milestone** | Prototype close-out + Capstone start (Grounded Kisan UI) |
| **Period** | Mon 7 Sep → Mon 14 Sep 2026 |
| **Hours** | ~14 |

---

## 1. Work Completed This Week

During Week 3, I focused on AgriConnect’s **Prototype UI finish** and the first **Capstone** surfaces: payment methods / escrow UX, full **13-locale** UI with automated guards, in-app call panel polish, faster Kisan talk UX, and the new **header weather** chip plus Grounded Kisan citation display. Backend Capstone RAG, agronomist APIs, and OpenWeather service were Kabir’s; I wired the farmer-facing screens to those contracts.

The major work streams this week were:

- Order payment method picker (UPI / card / netbanking / COD) and escrow status UI
- Buyer payment-nudge copy and unpaid-fulfill farmer warning in the order UI
- Expanding i18n from en/hi/pa to **13 locales** with parity, script, width-budget, and no-hardcoded-string tests
- WebRTC call panel UX (ring / accept / decline / mute / hang-up) on order detail
- Kisan widget: show grounded citations; keep marketplace chat on the same launcher
- Header weather chip (profile location + 5-day list) consuming `GET /api/v1/weather`
- Local Vitest / lint / i18n checks and GitHub sync with Kabir’s API merges

---

## 2. Payments & Order UX

### Payment panel

- Method picker wired to `POST /orders/:id/payment` (`upi` | `card` | `netbanking` | `cod`).
- Razorpay Checkout opened when keys are configured; mock/COD paths remain usable for demos.
- Escrow status and confirm flow shown clearly so buyers know when money is held.

### Nudges & warnings

- Localized notification copy for payment-due variant so buyers are asked to pay after accept/confirm.
- Farmer order UI shows escrow-not-held warning beside fulfill without blocking legitimate COD.

These changes make the Prototype payment story visible in the UI, not only in API responses.

---

## 3. Thirteen-locale UI & Quality Gates

Prototype Week 2 shipped en/hi/pa. Week 3 completed faculty-facing multilingual coverage:

- Dictionaries for `en|hi|pa|bn|ta|te|mr|gu|kn|ml|or|as|ur` (483 keys by Capstone weather strings).
- Locale parity + Indic/Urdu script checks, width budget for nav labels, and a static guard against hardcoded JSX English.
- RTL (`dir`) for Urdu; webfonts for non-Latin scripts so tofu boxes are less likely on faculty machines.
- Header layout tests so the weather chip and language switcher do not break the overflow-proof nav.

Native-speaker polish on the ten newer dictionaries remains backlog; machine-assisted strings are marked as such on the weekly board.

---

## 4. In-app Calls & Faster Kisan Talk

### Call panel

- Order-detail call UI for invite / incoming ring / accept / decline / mute / duration / hang-up.
- Works with Kabir’s Socket.io signalling and 45s unanswered timeout so demos do not get stuck “Ringing…”.

### Kisan UX

- Same Ask Kisan launcher (no second chatbot).
- Assistant replies can show **citations** under grounded answers.
- Faster speak path: shorter on-screen replies and clipped read-aloud for latency; full text still visible.

---

## 5. Capstone UI — Weather Header & Grounded Citations

### Header weather

- Cloud + temperature chip next to the language switcher for signed-in users.
- Click opens place label (**Based on your profile: …**), 24–48h rain outlook, and a **Next 5 days** table (min/max, condition, rain mm).
- Uses farmer profile location from the weather API (e.g. Ludhiana, Punjab for the Kabir demo account), not a hard-coded Delhi UI string.

### Grounded Kisan

- Marketplace questions still feel like normal app help.
- Crop / scheme / weather answers can list source citations under the bubble.
- Escalation / refuse copy comes from the API when Kabir’s grounded router decides those paths.

---

## 6. Testing, Docs Sync & Shipping

### Verification

- Frontend Vitest green (screens, i18n parity, width budget, no-hardcoded-strings, header weather mock).
- `npm run check:i18n` / typecheck / lint after weather keys landed.
- Smoke-checked login + weather popup and Kisan citation display against local API.

### Collaboration / git

- Consumed Kabir’s Capstone contracts (`/assistant/query` modes, `/weather`, agronomist notifications).
- Week 3 Capstone UI shipped with merge `917cf07` → `master` `1072f10` after Prototype hardening earlier in the week.

---

## 7. Challenges, Learnings & Next Week

### Challenges & how resolved

- Adding weather i18n keys required all 13 locales (parity + script tests); filled Indic/Urdu strings and kept Latin-only data (temps, OWM descriptions) as API values.
- Header density: weather chip stays compact (temp + short description) with details in a popover so nav scroll behaviour stays intact.
- Autofill / wrong password during demo login — confirmed API accepts demo credentials; cleared field and retyped.

### Learnings

- Capstone advisory is clearer when the UI shows **citations and weather place**, not only chat prose.
- Locale test gates catch missing keys early; they make 13-language work sustainable.
- Splitting Capstone backend (Kabir) and Capstone UI (me) works when modes (`chat` / `grounded` / `escalated` / `refused`) and weather JSON stay documented.

### Collaboration note

Manbhav (me): payment UI, 13-locale UI + tests, call panel, Kisan citations, header weather, frontend docs touchpoints.  
Kabir: Razorpay/webhook, contact guard, call signalling, Grounded RAG, agronomist APIs, weather service, eval, migrations, API docs, merges.

### Plan for next week

- Faculty demo of Prototype payments/calls/i18n plus Grounded Kisan and profile weather from `master`.
- Native-speaker pass on the newer locale dictionaries where possible.
- Support optional TURN / payouts UI when backend backlog lands.
