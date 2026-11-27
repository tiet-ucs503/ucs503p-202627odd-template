# ADR 0001: One process, in-memory working copy, built-in scheduling engine

Status: accepted (describes the current code). Date: 2026-10-06.

## Context

One institute, a few coordinators and admins making changes, and many students and faculty reading. Timetable operations need the whole dataset at once (generation, validation, conflict checks on every move), and the result must survive restarts and be hosted cheaply.

## Decision

1. **One Node.js process** (Express 5) serves the API and the built React app on one origin. No separate frontend host, no CORS, cookie sessions.
2. **Working copy in memory, Postgres as the record.** The server loads academic data and the timetable as four JSONB documents (`intellischedule.app_state`) at start and saves every change in one transaction before responding. Each document has a `version` column; a mismatched version fails the request with 409 instead of overwriting. Timetable versions and the audit log are separate append-only tables. Users and sessions are normal rows queried directly.
3. **Supabase Postgres through a direct connection string** (`pg`), in a private `intellischedule` schema with RLS enabled and no policies. No Supabase Auth or REST API. Embedded Postgres (PGlite) for development and tests.
4. **Built-in scheduling engine** in TypeScript (`src/lib/optimizationEngine.ts`): seeded backtracking with bitset occupancy, then local search on a soft penalty, checked by a separate validator. No external solver service.

## Consequences

- Simple to run: one container plus a database. Local development needs no services.
- Reads are served from memory; a write costs one transaction.
- **Only one instance may serve traffic.** A second instance would conflict (409s and reloads). Rate-limit counters are per process too. This is the scaling ceiling; moving past it means storing entities as rows and moving rate limits and the solver out of the request process.
- The solver blocks the event loop while it runs. The total budget is capped at 3 s per request, shared by its routines.
- Each save rewrites the changed documents in full; fine at the size of the sample dataset, not tested beyond it.
