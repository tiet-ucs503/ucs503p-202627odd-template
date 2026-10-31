# AgriConnect frontend

Next.js App Router UI for the V1 Express API.

## Setup

```bash
cd frontend
copy .env.example .env.local
npm install
npm run dev
```

The app runs at `http://localhost:3000` and calls `NEXT_PUBLIC_API_BASE_URL` (default `http://localhost:5001`).

Keep the backend running in another terminal:

```bash
cd backend
npm run dev
```

## Auth notes

- Access tokens stay in memory only.
- Refresh tokens are HttpOnly cookies on `/api/v1/auth`.
- The browser never talks to Supabase tables.
