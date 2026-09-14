# TravelSphere — Backend Development Workflow

This is the **backend-only** build plan for TravelSphere. It is written to be handed to a coding assistant chunk by chunk — implement one chunk fully (including its tests) before moving to the next.

**Stack:** Python, FastAPI, PostgreSQL, SQLAlchemy, Alembic, JWT auth (via `passlib` + `python-jose` or `pyjwt`), Pydantic v2.
**Architecture:** Modular monolith. No microservices, no message queues, no Redis unless explicitly noted.

Every endpoint listed under "API contract" in each chunk is a **contract with the frontend** — do not change field names, request/response shapes, or status codes without treating it as a breaking change. The frontend team is building against these exact shapes.

---

## Global Conventions (apply to every chunk)

**Request flow (for context only — implement this shape every time):**
```
FastAPI Route (routers/*.py)          → receives HTTP request only, no logic
Pydantic Schema (schemas/*.py)        → validates request/response
Dependency (dependencies/*.py)        → get_db, get_current_user, permission checks
Service (services/*.py)               → business logic — this is what gets unit tested
SQLAlchemy Model (models/*.py)        → table mapping
PostgreSQL
```
Keep routers thin — one route = one service call + status code + response schema. All logic (validation beyond basic type-checking, ownership checks, "already exists" checks) belongs in `services/`.

**Naming:**
- Python: `snake_case` everywhere (files, functions, variables, DB columns).
- Endpoints: REST-style, plural nouns (`/api/posts`, `/api/users`, `/api/destinations`, `/api/follows`), except auth actions (`/api/auth/register`, `/api/auth/login`, `/api/auth/logout`).
- IDs: always `user_id`, `post_id`, `destination_id`, `follower_id`, `followed_id`.
- Timestamps: `created_at` / `updated_at`, UTC, ISO 8601.
- Errors: FastAPI default `{"detail": "message"}` shape — don't invent a custom error envelope.
- Paginated list responses (introduced in Chunk 5, reused anywhere else a list could grow large): `{"items": [...], "total": N}`, query params `?skip=0&limit=20`.

**Project structure (create this exact layout in Chunk 0):**
```
backend/
  app/
    main.py                # creates FastAPI() app, includes routers, sets up CORS
    config.py               # reads .env: DATABASE_URL, JWT_SECRET, JWT_EXPIRE_MINUTES, etc.
    database.py              # SQLAlchemy engine + SessionLocal + Base
    models/
      user.py
      post.py
      destination.py
      follow.py
    schemas/
      auth.py
      user.py
      post.py
      destination.py
      follow.py
      feed.py
    services/
      auth_service.py
      user_service.py
      post_service.py
      destination_service.py
      follow_service.py
      feed_service.py
    dependencies/
      auth.py               # get_current_user
      db.py                 # get_db
    routers/
      auth.py
      users.py
      posts.py
      destinations.py
      follows.py
      feed.py
    utils/
      file_upload.py        # shared image-save helper
  alembic/
  alembic.ini
  requirements.txt
  .env.example
```

**Alembic workflow, used identically in every chunk that touches the schema:**
1. Edit/add a model in `models/`.
2. `alembic revision --autogenerate -m "<description>"`.
3. Open the generated file and check it — autogenerate can misread renames as drop+add.
4. `alembic upgrade head`.
5. Commit the migration file in the same change as the model edit.
6. Never edit a migration already applied elsewhere — write a new one.

---

## Database Schema (fixed for the whole project — do not diverge)

```
User
  |
  | creates
  ↓
Post ──── associated with ────→ Destination

User ──── follows ────→ User   (self-referential via Follow)
```

**users**
- `id` PK
- `username` — unique, indexed, str(3–30)
- `email` — unique, indexed
- `password_hash`
- `full_name`
- `bio` — nullable
- `profile_picture_url` — nullable
- `created_at`, `updated_at`

**destinations**
- `id` PK
- `name`
- `country` — nullable
- `latitude`, `longitude` — nullable
- `created_at`

**posts**
- `id` PK
- `user_id` FK → users.id, `ON DELETE CASCADE`, indexed
- `destination_id` FK → destinations.id, indexed
- `content` — text
- `image_url` — nullable
- `created_at`, `updated_at`

**follows**
- `id` PK
- `follower_id` FK → users.id
- `followed_id` FK → users.id
- `created_at`
- UNIQUE (`follower_id`, `followed_id`)
- CHECK (`follower_id != followed_id`)

No separate `travel_history` table — it's derived: `SELECT DISTINCT d.* FROM destinations d JOIN posts p ON p.destination_id = d.id WHERE p.user_id = :id`.

---

# CHUNK 0 — Project Setup

### Goal
A running FastAPI app connected to PostgreSQL, with Alembic wired up and a health check endpoint — nothing functional yet.

### Files/modules
The full `backend/` tree above, empty `models/`, `schemas/`, etc. for now.

### Design decisions
- Local Postgres via `docker-compose.yml` (Postgres image only).
- Config via `.env` / `.env.example`, read through `config.py` (use `pydantic-settings`).
- CORS: allow the frontend's dev origin (e.g. `http://localhost:5173`) explicitly in `main.py`.

### Database changes
None yet — just prove Alembic can connect and run against an empty DB.

### API contract (used by frontend)
**GET /api/health**
Auth: none
Response 200: `{"status": "ok"}`

### Implementation steps
1. Scaffold the project structure.
2. Set up `docker-compose.yml` for Postgres.
3. `database.py`: engine, `SessionLocal`, `Base`.
4. `config.py`: load `.env`.
5. `main.py`: create app, CORS, include a placeholder health router.
6. `routers/health.py` (or inline in `main.py`): the `/api/health` route.
7. `alembic init alembic`, point `sqlalchemy.url` at `.env`'s `DATABASE_URL`, run `alembic upgrade head` against the empty DB.

### Testing
- Confirm the app boots, `/api/health` returns 200, and `alembic upgrade head` runs cleanly with zero migrations.

### Definition of Done
- [ ] Project structure created
- [ ] Postgres reachable via docker-compose
- [ ] `/api/health` returns 200
- [ ] Alembic connects and runs
- [ ] `.env.example` documents all required variables

---

# CHUNK 1 — Authentication

### Goal
Registration, login, logout, and a protected endpoint gated by JWT.

### Requirements covered
Register, login, logout, protected-route auth.

### Design decisions
- Passwords hashed with `bcrypt` via `passlib`.
- JWT access token, `Authorization: Bearer <token>` header. No refresh-token flow for MVP — a longer-lived token (e.g. 7 days) is acceptable.
- Logout is stateless — no server-side token blacklist; this endpoint exists mainly for symmetry and future-proofing.
- Validation (in Pydantic schema): `email` valid format, `username` 3–30 chars, `password` min length 8.

### Files/modules
- `models/user.py`
- `schemas/auth.py` — `RegisterRequest`, `LoginRequest`, `TokenResponse`
- `services/auth_service.py` — `hash_password`, `verify_password`, `create_access_token`, `register_user`, `authenticate_user`
- `dependencies/auth.py` — `get_current_user` (decodes JWT, loads `User` via DB session)
- `routers/auth.py`

### Database changes
Create `users` table. `alembic revision --autogenerate -m "create users table"`.

### API contract (used by frontend)

**POST /api/auth/register**
Auth: none
Request:
```json
{ "username": "traveler_amy", "email": "amy@example.com", "password": "securepass123", "full_name": "Amy Chen" }
```
Response 201:
```json
{ "id": 1, "username": "traveler_amy", "email": "amy@example.com", "full_name": "Amy Chen" }
```
Errors: 400 username/email taken, 422 validation.

**POST /api/auth/login**
Auth: none
Request: `{ "username": "traveler_amy", "password": "securepass123" }`
Response 200: `{ "access_token": "eyJ...", "token_type": "bearer" }`
Errors: 401 invalid credentials.

**POST /api/auth/logout**
Auth: yes (Bearer token)
Response 200: `{"detail": "logged out"}`

**GET /api/users/me**
Auth: yes
Response 200: `{ "id": 1, "username": "traveler_amy", "email": "amy@example.com", "full_name": "Amy Chen" }`
Errors: 401 no/invalid token.

### Implementation steps
1. `User` model.
2. Migration + run.
3. `auth_service.py`: hashing, token create/verify, register, authenticate.
4. Schemas.
5. `dependencies/auth.py`: `get_current_user`.
6. `routers/auth.py`: register, login, logout.
7. Add `GET /api/users/me` (put it in `routers/users.py`, created now).

### Testing
- Unit: password hash/verify, token create/decode (valid, expired, tampered).
- API: register success + duplicate username/email (400) + bad input (422); login success + wrong password (401); `/me` valid token / missing token / expired token (401 in all failure cases).

### Definition of Done
- [ ] `users` table + migration
- [ ] Register/login/logout endpoints work
- [ ] JWT create/verify correct, expiry enforced
- [ ] `/users/me` protected correctly
- [ ] Unit + API tests pass

---

# CHUNK 2 — User Profiles

### Goal
View own/others' profile, edit own profile.

### Requirements covered
Create/edit/view own profile, view others' profiles.

### Design decisions
- No separate `Profile` table — fields live on `User` directly.
- `post_count` computed at read time (`COUNT(*) FROM posts WHERE user_id = ...`), not stored.
- Profile picture upload reuses the shared `utils/file_upload.py` (build it now, reuse in Chunk 3 for post images).

### Files/modules
- `schemas/user.py` — `UserPublic`, `UserMinimal` (for nesting elsewhere), `UserUpdate`
- `services/user_service.py` — `get_user_by_id`, `update_user`, `get_post_count`
- `routers/users.py` — extend with the two routes below
- `utils/file_upload.py` — generic save-and-return-url helper (local disk for MVP)

### Database changes
None new (fields already on `users` from Chunk 1). If `bio`/`profile_picture_url` weren't added then, add via migration now.

### API contract (used by frontend)

**GET /api/users/{user_id}**
Auth: none
Response 200:
```json
{ "id": 4, "username": "traveler_amy", "full_name": "Amy Chen", "bio": "Backpacking through SE Asia", "profile_picture_url": "/uploads/profiles/4.jpg", "post_count": 12 }
```
Errors: 404 not found.

**PATCH /api/users/me**
Auth: yes
Request (all optional): `{ "full_name": "Amy C.", "bio": "Now in Vietnam", "profile_picture_url": "/uploads/profiles/4.jpg" }`
Response 200: updated `UserPublic`.
Errors: 401 unauthenticated, 422 invalid data.

**POST /api/uploads/images** (generic upload endpoint used by both profile pictures and post images)
Auth: yes
Request: multipart/form-data, field `file`
Response 201: `{ "url": "/uploads/xyz.jpg" }`
Errors: 400 invalid file type/size, 401 unauthenticated.

### Implementation steps
1. Add missing columns if needed + migrate.
2. Schemas.
3. `user_service.py`: get by id (+ post count), update current user.
4. `file_upload.py` + `POST /api/uploads/images` route.
5. `routers/users.py`: the two profile routes.

### Testing
- API: get existing profile, get nonexistent (404), update own profile, update without auth (401), upload valid/invalid file type.

### Definition of Done
- [ ] Profile fields present on `users`
- [ ] View/edit profile endpoints work
- [ ] Generic image upload endpoint works
- [ ] Tests pass

---

# CHUNK 3 — Travel Posts

### Goal
Create, view, and delete posts (text + image + destination).

### Requirements covered
Create post, view posts, delete own posts.

### Design decisions
- `find_or_create_destination(name)` pattern: post creation takes a destination **name**, not an ID — creates the destination row if it doesn't exist (case-insensitive match), reuses it if it does. This avoids requiring the full destination-search feature to exist first.
- Only the owner may delete their post — enforced in `post_service.py`, not just at the route.
- `PostPublic` nests a minimal `user` and `destination` object (not just IDs) so the frontend doesn't need extra requests.

### Files/modules
- `models/destination.py`, `models/post.py`
- `schemas/post.py` — `PostCreate`, `PostPublic`
- `schemas/destination.py` — `DestinationMinimal`
- `services/post_service.py` — `create_post`, `get_post`, `list_posts`, `delete_post`, `find_or_create_destination`
- `routers/posts.py`

### Database changes
Create `destinations` and `posts` tables. `alembic revision --autogenerate -m "create destinations and posts tables"`.

### API contract (used by frontend)

**POST /api/posts**
Auth: yes
Request: `{ "content": "Sunrise at Angkor Wat was unreal.", "destination_name": "Siem Reap, Cambodia", "image_url": "/uploads/posts/xyz.jpg" }`
Response 201:
```json
{
  "id": 10,
  "user": { "id": 1, "username": "traveler_amy", "profile_picture_url": "..." },
  "content": "Sunrise at Angkor Wat was unreal.",
  "image_url": "/uploads/posts/xyz.jpg",
  "destination": { "id": 5, "name": "Siem Reap, Cambodia" },
  "created_at": "2026-08-31T09:00:00Z"
}
```
Errors: 401 unauthenticated, 422 missing content/destination.

**GET /api/posts/{post_id}**
Auth: none
Response 200: same shape as above. Errors: 404.

**GET /api/posts**
Auth: none
Response 200: array of `PostPublic`, most recent first. (Superseded by the feed's paginated version in Chunk 5 for the logged-in view — this stays as a general/public listing.)

**DELETE /api/posts/{post_id}**
Auth: yes, must be owner
Response 204: no body.
Errors: 401 unauthenticated, 403 not owner, 404 not found.

### Implementation steps
1. `Destination`, `Post` models.
2. Migration + run.
3. Schemas.
4. `post_service.py`: `find_or_create_destination`, `create_post`, `get_post`, `list_posts`, `delete_post` (ownership check).
5. `routers/posts.py`: the four routes.

### Testing
- Unit: `find_or_create_destination` creates vs reuses (case-insensitive), `delete_post` ownership check.
- API: create success/missing fields, get found/404, delete as owner/non-owner(403)/unauthenticated(401)/already-deleted(404).

### Definition of Done
- [ ] `destinations`/`posts` tables + migration
- [ ] Create/view/delete post endpoints work
- [ ] Ownership enforced on delete
- [ ] Tests pass

---

# CHUNK 4 — Following System

### Goal
Search users, follow/unfollow, view followers/following.

### Requirements covered
Search travelers, follow, unfollow, view followers/following.

### Design decisions
- Search: case-insensitive substring match on `username`/`full_name`.
- Duplicate-follow and self-follow rejected both at the DB level (constraints already in schema) and the service level (clean 400 error instead of a raw DB constraint error).

### Files/modules
- `models/follow.py`
- `schemas/follow.py` — `FollowCreate`, `FollowPublic`
- `services/follow_service.py` — `follow_user`, `unfollow_user`, `list_followers`, `list_following`, `search_users`
- `routers/follows.py`
- `routers/users.py` — add the search route here

### Database changes
Create `follows` table with constraints. `alembic revision --autogenerate -m "create follows table"`.

### API contract (used by frontend)

**GET /api/users?search=amy**
Auth: none
Response 200: array of `UserMinimal` (`id`, `username`, `full_name`, `profile_picture_url`).

**POST /api/follows**
Auth: yes
Request: `{ "followed_id": 4 }`
Response 201: `{ "follower_id": 1, "followed_id": 4, "created_at": "..." }`
Errors: 401, 400 (already following / self-follow), 404 (target not found).

**DELETE /api/follows/{followed_id}**
Auth: yes
Response 204: no body.
Errors: 401, 404 (not currently following).

**GET /api/users/{user_id}/followers**
Auth: none
Response 200: array of `UserMinimal`.

**GET /api/users/{user_id}/following**
Auth: none
Response 200: array of `UserMinimal`.

### Implementation steps
1. `Follow` model + migration.
2. Schemas.
3. `follow_service.py`: all five operations with duplicate/self-follow guards.
4. `routers/follows.py` + search route in `routers/users.py`.

### Testing
- Unit: duplicate follow rejected, self-follow rejected.
- API: follow success/duplicate(400)/self(400)/target-missing(404); unfollow success/not-following(404); followers/following list correctness; search partial match.

### Definition of Done
- [ ] `follows` table + constraints + migration
- [ ] Follow/unfollow endpoints correct, including error cases
- [ ] Followers/following list endpoints work
- [ ] Search endpoint works
- [ ] Tests pass

---

# CHUNK 5 — Personalized Feed

### Goal
Logged-in user's feed: posts from followed users, most recent first, paginated.

### Requirements covered
Feed from followed travelers, recency order, updates with follow changes.

### Design decisions
- Feed is a live query (`posts.user_id IN (followed ids)`), not precomputed/cached — unnecessary at this scale.
- First use of pagination in the project: `?skip=0&limit=20`, response `{"items": [...], "total": N}` — this becomes the standard shape for any future paginated list.
- Own posts excluded from the feed (profile page already shows them) — document this choice, keep it consistent.
- Recommended: composite index on `posts(user_id, created_at)` for query performance.

### Files/modules
- `services/feed_service.py` — `get_feed(user_id, skip, limit)`
- `routers/feed.py`

### Database changes
None required. Optional: migration adding a composite index on `posts(user_id, created_at)`.

### API contract (used by frontend)

**GET /api/feed?skip=0&limit=20**
Auth: yes
Response 200:
```json
{ "items": [ { "id": 10, "user": {...}, "content": "...", "destination": {...}, "created_at": "..." } ], "total": 34 }
```
Errors: 401 unauthenticated.

### Implementation steps
1. `feed_service.py`: join `posts` against current user's `following` ids, exclude own posts, order by `created_at desc`, paginate.
2. `routers/feed.py`: single protected route.

### Testing
- Unit: feed returns only followed users' posts, correct order, respects `skip`/`limit`, excludes own posts.
- API: feed for a user following no one (empty `items`, `total: 0`), feed for a user following several, unauthenticated (401).

### Definition of Done
- [ ] Feed query correct and paginated
- [ ] Own posts excluded (or included — whichever was decided, documented)
- [ ] Tests pass

---

# CHUNK 6 — Destination Search

### Goal
Search destinations, view a destination with its posts and travelers.

### Requirements covered
Search destinations, view a destination, view its posts, view its travelers.

### Design decisions
- Search: substring match on `name`/`country`, same approach as user search.
- "Travelers at a destination" = distinct users who've posted there — a query, not a stored relationship.
- Optional map/location API enrichment happens once, inside `find_or_create_destination` (Chunk 3) at creation time — not on every read. Not required for MVP correctness.

### Files/modules
- `services/destination_service.py` — `search_destinations`, `get_destination`, `get_posts_for_destination`, `get_travelers_for_destination`
- `routers/destinations.py`
- `utils/map_api.py` — optional external API wrapper

### Database changes
None required. Optional: index on `destinations(name)`.

### API contract (used by frontend)

**GET /api/destinations?search=bali**
Auth: none
Response 200: array of `DestinationMinimal` (`id`, `name`, `country`).

**GET /api/destinations/{destination_id}**
Auth: none
Response 200: `{ "id": 5, "name": "Siem Reap, Cambodia", "country": "Cambodia", "latitude": 13.36, "longitude": 103.86 }`
Errors: 404.

**GET /api/destinations/{destination_id}/posts**
Auth: none
Response 200: array of `PostPublic`, most recent first.

**GET /api/destinations/{destination_id}/travelers**
Auth: none
Response 200: array of `UserMinimal`, no duplicates.

### Implementation steps
1. `destination_service.py`: search, get by id, posts-for, distinct-travelers-for.
2. `routers/destinations.py`: the four routes.
3. (Optional) `map_api.py`, wired into Chunk 3's `find_or_create_destination`.

### Testing
- API: search partial match, get found/404, posts-for-destination correctness, travelers-for-destination has no duplicates even with multiple posts from the same user.

### Definition of Done
- [ ] Destination search/detail/posts/travelers endpoints work
- [ ] No duplicate travelers returned
- [ ] Tests pass

---

# CHUNK 7 — Traveler / Destination History

### Goal
Expose a user's derived travel history (distinct destinations posted about) on their profile.

### Requirements covered
Derive and expose travel history from posts.

### Design decisions
- No new table — confirmed derivation: `SELECT DISTINCT d.* FROM destinations d JOIN posts p ON p.destination_id = d.id WHERE p.user_id = :id`.
- Added as a field on the existing `GET /api/users/{user_id}` response (Chunk 2), not a new endpoint.

### Files/modules
- `services/user_service.py` — extend `get_user_by_id` (or add `get_travel_history(user_id)`) to include distinct destinations
- `schemas/user.py` — add `destinations_visited: List[DestinationMinimal]` to `UserPublic`

### Database changes
None.

### API contract (used by frontend)

**GET /api/users/{user_id}** (extends Chunk 2's contract — same endpoint, new field)
Response 200:
```json
{
  "id": 4, "username": "traveler_amy", "full_name": "Amy Chen", "bio": "...", "profile_picture_url": "...",
  "post_count": 12,
  "destinations_visited": [ { "id": 5, "name": "Siem Reap, Cambodia" }, { "id": 8, "name": "Hanoi, Vietnam" } ]
}
```

### Implementation steps
1. Extend `user_service.py` with the distinct-destinations query.
2. Add the field to `UserPublic`.

### Testing
- Unit: distinct-destinations query has no duplicates even with multiple posts at the same destination.
- API: profile response includes correct `destinations_visited`, empty array for a user with no posts.

### Definition of Done
- [ ] Profile endpoint includes travel history field
- [ ] No duplicates
- [ ] Tests pass

---

# CHUNK 8 — Backend Integration & Hardening

### Goal
Verify all endpoints work together correctly and are consistent, before deployment.

### Design decisions
- No new features — this chunk is purely correctness/robustness.

### Implementation steps
1. Full API-level regression pass: register → edit profile → create posts at multiple destinations → follow/unfollow → feed reflects follows correctly → search destinations → history correct → delete a post and confirm it disappears from feed/destination/profile everywhere it should.
2. Review every endpoint against the naming/error conventions in the Global Conventions section — fix any drift.
3. Confirm every mutating endpoint requires auth, and every ownership-sensitive endpoint (delete post, edit profile) checks ownership server-side, not just relying on frontend hiding buttons.
4. Check for N+1 queries in list endpoints (feed, destination posts, followers/following) — use `joinedload`/`selectinload` where a nested `user`/`destination` object is being returned.

### Testing
- Full automated test suite run together (not per-chunk) to catch regressions.
- Manual API walkthrough via a tool like `httpie`/Postman/curl scripts covering the full flow above.

### Definition of Done
- [ ] Full end-to-end API walkthrough passes
- [ ] Auth/ownership checks verified on every mutating/sensitive endpoint
- [ ] No N+1 query issues in list endpoints
- [ ] Full test suite passes

---

# CHUNK 9 — Backend Deployment

### Goal
Backend deployed and reachable at a stable URL, migrated database, ready for the frontend to point at it.

### Design decisions
- Managed Postgres (Render/Railway/Supabase free/student tier) + FastAPI deployed as a single service. No container orchestration.
- Env vars set via the hosting platform's dashboard, never committed.
- Uploaded images stored on host disk or a free-tier bucket — no CDN pipeline needed for a class project.

### Implementation steps
1. Provision managed Postgres, run `alembic upgrade head` against it.
2. Deploy the FastAPI app, set all env vars (`DATABASE_URL`, `JWT_SECRET`, etc.).
3. Confirm CORS allows the deployed frontend's origin once that URL is known.
4. Re-run the Chunk 8 walkthrough against the live deployment.
5. Document the deployed base URL and all endpoints for the frontend team.

### Testing
- Smoke test every endpoint listed in this document against the live deployment.

### Definition of Done
- [ ] Backend deployed and reachable
- [ ] Database migrated on the deployed instance
- [ ] CORS configured for the real frontend origin
- [ ] Full smoke test passes on live deployment
- [ ] Endpoint list handed off to frontend team

---

## Full Endpoint Reference (for quick lookup)

| Method | Endpoint | Auth | Chunk |
|---|---|---|---|
| GET | /api/health | no | 0 |
| POST | /api/auth/register | no | 1 |
| POST | /api/auth/login | no | 1 |
| POST | /api/auth/logout | yes | 1 |
| GET | /api/users/me | yes | 1 |
| GET | /api/users/{user_id} | no | 2, 7 |
| PATCH | /api/users/me | yes | 2 |
| POST | /api/uploads/images | yes | 2 |
| POST | /api/posts | yes | 3 |
| GET | /api/posts/{post_id} | no | 3 |
| GET | /api/posts | no | 3 |
| DELETE | /api/posts/{post_id} | yes (owner) | 3 |
| GET | /api/users?search= | no | 4 |
| POST | /api/follows | yes | 4 |
| DELETE | /api/follows/{followed_id} | yes | 4 |
| GET | /api/users/{user_id}/followers | no | 4 |
| GET | /api/users/{user_id}/following | no | 4 |
| GET | /api/feed?skip=&limit= | yes | 5 |
| GET | /api/destinations?search= | no | 6 |
| GET | /api/destinations/{destination_id} | no | 6 |
| GET | /api/destinations/{destination_id}/posts | no | 6 |
| GET | /api/destinations/{destination_id}/travelers | no | 6 |
