# Evaluation Plan

## Metrics

| Metric | What it measures | How |
|---|---|---|
| Order completion rate | Fulfilled vs placed orders | Admin analytics / reports |
| Time-to-accept | Buyer place → farmer accept | Order timestamps |
| Inventory integrity | Oversell attempts blocked | Transaction tests + live checks |
| Mandi freshness | Age of last Agmarknet pull | Market price API metadata |
| Chat / call success | Messages delivered; calls connected | Socket smoke + call ring-timeout tests |
| Payment verify rate | Holds confirmed only after gateway read-back | Webhook + confirm-path tests |
| Grounded answer rate | Capstone answers with citations vs refused | `eval:grounded` curated pack |
| Locale coverage | Key parity across 13 languages | Vitest i18n parity + width budget |
| Contact-block rate | Blocked phone/email/UPI attempts | Contact-guard unit tests |

## Baseline Comparison

| Task | Without AgriConnect | With AgriConnect |
|---|---|---|
| Find a buyer / seller | Phone / mandi intermediaries | Browse listings + filters |
| Agree price | Opaque middleman cut | Listed INR price + mandi compare |
| Track order | Verbal / WhatsApp | Visible order state machine + timeline |
| Stay on-platform | Exchange phone numbers | Chat + voice call; contact info blocked |
| Crop advice | Informal / search engines | Grounded Kisan with citations or escalate |

## User Feedback

- In-app reviews after `fulfilled` (buyer ↔ farmer).
- Helpful / not-helpful on Grounded Kisan answers (when wired).
- Faculty demo checklist: Lab CRUD → Prototype realtime/payments → Capstone grounded Q&A.

## Current status (Week 3)

- Lab and Prototype demo-ready on `master`.
- Grounded Kisan curated eval: 30/30 on shipping pack.
- Remaining Capstone eval: ML price / crop-CV once those modules ship.
