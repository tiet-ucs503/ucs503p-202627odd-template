# System Architecture

```text
Browser
  |
  v
Next.js (App Router) UI
  |
  v
Express REST API (/api/v1) + Socket.io
  |-------------------|-------------------|-------------------|
  v                   v                   v                   v
Prisma            Supabase Storage     SMTP / console      Gemini (optional)
  |                   |                   |                   |
  v                   |                   |                   v
Supabase PostgreSQL   |                   |            Grounded Kisan RAG
                      |                   |            (curated pack + cite)
                      +-------------------+-------------------+
                                          |
                                          v
                         Listings, orders, chat, calls, payments
```

## Main Components

1. **Frontend** — Next.js, TypeScript, Tailwind; talks only to Express
2. **Backend** — Express 5 + Zod validation + role guards
3. **Database** — PostgreSQL on Supabase via Prisma
4. **Storage** — Supabase Storage for listing photos (service role on server only)
5. **Realtime** — Socket.io for order chat and WebRTC call signalling
6. **Payments** — Razorpay (verify on confirm + signed webhook) or simulated / COD
7. **Market data** — Agmarknet / data.gov.in mandi price feed
8. **AI** — Gemini-backed Kisan assistant; Capstone Grounded Kisan with citations
9. **Email** — Nodemailer (console fallback in development)

## Hard boundaries

- Frontend never uses Supabase DB client or service-role key.
- Money and quantities are PostgreSQL `NUMERIC`, serialized as JSON strings.
- Errors: `{ success: false, error: { code, message, fields? } }`.

## Deeper reference

Full engineering write-up: [ARCHITECTURE.md](./ARCHITECTURE.md)
