# TripEase

AI-powered, personalized trip planning. Tell TripEase where you're going, when,
and what your budget is — it generates a complete, editable day-by-day
itinerary with hotels, food, activities and a live budget breakdown.

```
Tell TripEase where you want to go → it plans it → you explore it → edit it → save it.
```

## Features

- **AI itinerary generation** — a destination, dates, budget and a handful of
  travel-style preferences turn into a full multi-city, day-by-day plan.
- **Travis, the trip assistant** — for a traveller who hasn't decided yet. Ask
  where to go this summer, or when somewhere usually costs less, and Travis
  suggests up to three places with the best months to go; one click turns a
  suggestion into a trip. Travis never states a price: cost is only ever
  "lower", "typical" or "higher" for the time of year, with the reason (see
  "Travis, the trip assistant" below).
- **Budget-aware planning** — every hotel, meal and activity rolls up into a
  categorized budget (flights, hotels, food, activities, transport, shopping,
  misc, buffer) that recalculates on every edit, with deterministic "ways to
  save" suggestions when a trip goes over budget.
- **Interactive roadmap** — a visual, per-city timeline of days rather than a
  wall of text; expand any day to see its full schedule.
- **Editable itinerary** — add, edit, delete and drag-to-reorder activities;
  change a city's hotel; all changes save immediately.
- **Destination recommendations** — hotels, attractions, restaurants and
  nightlife come from a swappable places provider (an offline curated/mock
  dataset by default, or live Google Places when configured — see "Places
  data provider" below). Real places link to a genuine reference; anything
  without a verifiable source is clearly labelled "Demo data" rather than
  presented as fact.
- **Interactive map** — a real Leaflet/OpenStreetMap map of the itinerary's
  own places, linked both ways with the roadmap: pick an activity and the map
  centres on it, click a marker and the roadmap opens that day and highlights
  it. Filters follow the roadmap (whole trip / current city / current day),
  and a day's stops are joined in itinerary order.
- **Feasibility checking** — every day is measured against the clock: time at
  places, plus estimated travel between them, plus a realistic buffer. Days
  that can't physically happen are flagged, city-to-city transfers appear as
  their own step with a mode and a duration, and travel figures are always
  labelled as estimates (see "Feasibility, distance and travel time").
- **Firebase Authentication** — email/password and Google sign-in.
- **Firestore persistence** — trips are private to their owner and enforced
  by security rules that are unit-tested in CI.

## Tech stack

- **Next.js 16** (App Router, Turbopack) · **React 19** · **TypeScript**
- **Tailwind CSS v4** for styling, **Radix UI** primitives (Dialog, Tabs,
  Progress) for accessible interactive components
- **Framer Motion** for animation, **@dnd-kit** for drag-and-drop reordering,
  **Recharts** for the budget chart, **Leaflet / react-leaflet** for the map
- **Zod** for validating trip input and generated itineraries
- **Firebase Auth** + **Cloud Firestore** — no separate backend; Next.js API
  routes handle itinerary generation, Firestore security rules are the
  authorization layer

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in the Firebase web config
npm run dev                  # http://localhost:3000
```

### Firebase project

1. In the [Firebase console](https://console.firebase.google.com/), create a
   project (e.g. `tripease-dev`).
2. **Build → Authentication → Get started**, then enable the **Email/Password**
   and **Google** sign-in providers.
3. **Build → Firestore Database → Create database**, start in production mode,
   pick a region close to you.
4. **Project settings → General → Your apps → Web app**. Register an app and copy
   the config values into `.env.local`.
5. Push the security rules and indexes:
   ```bash
   npx firebase deploy --only firestore
   ```

`.firebaserc` also defines a `staging` alias — create a second Firebase project
`tripease-staging` for it so pilot data never mixes with development data.

### Environment variables

See `.env.example`. Only the six `NEXT_PUBLIC_FIREBASE_*` values are required.
Trip generation needs no API key by default — see "Places data provider" below.

## How a trip gets planned

```
trip input → AI city planner → Zod → TripEase validation → places provider
          → itinerary → budget engine → roadmap + map
```

Each layer has one job, and none of them trusts the one above it:

- **The AI proposes.** Given a destination, length, budget and preferences it
  returns *only* a structured city allocation — "Rome 4 days, Florence 3,
  Naples 2" — never itinerary prose, never prices, never place facts.
- **TripEase validates.** Zod checks the shape; then deterministic checks
  (`services/planning/validate.ts`) confirm the plan is actually possible:
  days summing to the trip length, no duplicate cities, a sane number of
  stops. An allocation that adds up to 11 days for a 9-day trip is rejected
  even though it's perfectly well-formed JSON.
- **Google supplies the facts.** Real places for whichever cities survived.
- **The budget engine is authoritative.** The AI is told the budget and may
  reason about it, but it cannot bypass the engine — if the resulting trip
  runs over, the normal over-budget state and savings suggestions appear.

### When the AI isn't available

`planCities()` tries once, retries once *only* if the failure is something a
model can fix (malformed JSON, or an allocation that doesn't add up), and
otherwise falls straight through to the deterministic planner. Quota, auth
and timeout failures don't get a retry — that just spends money twice.

The fallback keeps the curated multi-city split for curated destinations
(Thailand → Bangkok + Phuket) and otherwise puts the whole trip in one base
named after the destination. It deliberately does **not** invent city names:
earlier iterations split unknown destinations into "*Destination* City" and
"*Destination* Coast", which read like real places but weren't.

Trips record which planner produced them (`planning.source: "ai" | "fallback"`),
and the generation screen says so when the fallback was used.

### Enabling the AI planner

```
AI_PROVIDER=groq
GROQ_API_KEY=gsk_...
GROQ_MODEL=openai/gpt-oss-120b
```

Server-only, never `NEXT_PUBLIC_`. `AI_PROVIDER=mock` runs a deterministic
stand-in with no network or key; leaving it unset uses the deterministic
planner directly. The same variables switch on Travis (see "Travis, the trip
assistant"): with a key it is a live assistant, with `mock` it is demo mode, and
with neither it tells the traveller it is unavailable.

Providers live behind one interface (`lib/services/ai/provider.ts`) and are
chosen in `getAIProvider()`. The city planner depends on `AIProvider` and
knows nothing about any vendor, so adding OpenAI later is a new class plus a
branch — `services/planning` doesn't change.

Where the model supports it, output is constrained with
`response_format: json_schema` (strict), so the model emits the planner's
exact structure rather than prose. Models that reject a schema fall back to
plain JSON mode automatically; the result is validated identically either way.

### Editing which cities you visit

The roadmap's **Edit cities** dialog adds, removes, renames and re-times
cities. It rebalances days automatically so they keep summing to the trip
length, and runs the *same* `validateCityAllocation` the AI's output must
pass — hand edits get no more trust than a model's. The server re-validates
before rebuilding.

Cities you keep hold on to their existing activities: only new or renamed
cities (and extra days added to an existing one) cost a fresh places lookup,
so editing the city list doesn't discard the rest of your work.

## Travis, the trip assistant

Travis is the chat on the **Ask Travis** page. It is for a traveller who
hasn't decided where to go or when: it suggests places and the best time of
year, says when that time usually costs less, and hands a chosen suggestion to
the new-trip wizard. It works before a trip exists and, in this iteration,
changes nothing. (Asking Travis to edit a trip from inside the trip page is
the next step.)

```
question → /api/travis/chat → login → rate limit → Zod
        → AI proposes → Zod → price guard (one retry) → dates worked out by us
        → suggestion cards → "Plan this trip" → wizard, pre-filled
```

It follows the same rule as the city planner: **the AI proposes, TripEase
decides.** The model only ever returns a short reply and up to three
structured suggestions, and nothing it says reaches the page unchecked:

- **No prices, ever.** The prompt forbids them, but a prompt is a request, not
  a guarantee, so `services/travis/price-guard.ts` looks for money amounts
  ("$300", "₹40,000", "5,000 INR", "2 lakh") in every piece of text. If it finds
  one the model is asked again once; if it still quotes one, the sentence is
  cut out. Cost is only ever *lower / typical / higher than the rest of that
  destination's year*, with a seasonal reason. The check is narrow on purpose:
  "7 days", "June 2027" and "25–30°C" are left alone.
- **Dates are ours.** The model only says months ("November to February"). The
  dates on a card are worked out by `services/travis/dates.ts` from those
  months and today's date: never in the past, never sooner than 14 days away,
  inside the window when the trip fits, otherwise the next year's. Models are
  bad at calendars; this keeps them out of it.
- **Destinations are plain names.** "Japan (Tokyo and surrounding)" becomes
  "Japan", because the wizard passes the name straight to the city planner.
- **Nothing is claimed that isn't known.** Travis says it can't see live fares
  or availability, never claims to have searched or booked anything, and the
  page labels cost and weather as a typical year, not live prices or a forecast.
- **The conversation is untrusted input.** The client can only send `user` and
  `assistant` messages (a `system` message is rejected), length and count are
  capped, and an attempt to talk the model out of its rules stays in the user
  role. Travis's own earlier turns carry the names of the places it suggested,
  in a fixed format added by the server, so "which of those is cheapest?" works.

**When Travis can't answer** — no AI configured, the model is busy or slow, or
its answer is unusable — the page says so in plain words, offers *Try again*
where that could help (never twice for the same message, and never for a quota
or timeout, where asking again only costs more), and offers to plan the trip
without Travis. The rest of TripEase doesn't depend on it. Unlike the city
planner there is no deterministic fallback: a conversation can't be faked with
rules, and pretending would be worse than saying so.

**Privacy.** Nothing about a conversation is stored on the server and message
text is never logged (only a failure category is). The conversation is kept in
the browser tab's session storage so a refresh doesn't lose it, and is gone when
the tab closes. Because a tab can outlive a person, it is stored under the
signed-in account's id (so whoever signs in next on a shared machine never sees
it) and is cleared on sign-out. Messages are sent to the AI provider (Groq) to
be answered.

**Limits.** Each person gets 20 messages per 10 minutes
(`lib/server/rate-limit.ts`). That limiter lives in server memory, so on a
serverless host each instance counts separately: it stops runaway loops and
casual abuse, not a determined attacker, and the model provider's own quota is
the real ceiling. Groq's free tier allows 8,000 tokens a minute for the whole
project, which is roughly four Travis messages a minute, so several people
using it at once will see "busy". Answers are capped at 1,500 tokens and the
model is asked to think briefly, to stay inside that.

**Demo mode.** With `AI_PROVIDER=mock`, Travis answers from a small catalogue of
canned seasonality (`lib/mock-data/travis-demo.ts`) through the *same* pipeline,
and the page says "Demo mode" so nobody mistakes it for a live assistant. With
no `AI_PROVIDER` at all, Travis says it is unavailable. No new environment
variables were added: it uses the same `AI_PROVIDER`, `GROQ_API_KEY` and
`GROQ_MODEL` as the city planner.

**Honest limits of the content.** Seasons, weather and cost labels come from
the model's general knowledge. They are hedged and labelled, but they can be
wrong and nothing checks them against data. Destination names aren't verified
either; an invented place would only show up when the trip is planned.

## API security

Every route that spends external quota requires a Firebase ID token:

| Route | Protection |
| --- | --- |
| `/api/trips/plan` | Bearer ID token → 401 without one |
| `/api/trips/generate` | Bearer ID token → 401 without one |
| `/api/trips/rebuild` | Bearer ID token → 401 without one |
| `/api/places/search` | Bearer ID token → 401 without one |
| `/api/travis/chat` | Bearer ID token → 401 without one; 20 messages per 10 minutes per user → 429 |
| `/api/places/photo` | HMAC-signed URL → 403 without a valid signature |

The browser attaches the token via `lib/api-client.ts`; the server verifies
it in `lib/server/firebase-auth.ts`.

**Why not the Firebase Admin SDK?** Firebase ID tokens are ordinary RS256
JWTs signed by Google, so they're verified here against Google's published
public keys using `jose`. That needs *no* server secret at all (the project
id it checks is already public), where the Admin SDK would mean provisioning
and storing a service-account private key — a second long-lived credential to
protect. The tradeoff is real and worth knowing: without the Admin SDK we
can't detect a **revoked** token, so a signed-out account's token stays usable
until it expires (up to an hour). For "stop strangers spending our Places and
LLM quota" that's fine; anything needing instant revocation should move to the
Admin SDK.

`/api/places/photo` can't use a bearer token because browsers don't send
headers for `<img src>`, so the server signs each photo reference it issues
and rejects unsigned ones.

## Places data provider

`src/lib/services/places/` is a small provider abstraction with one interface
(`PlacesProvider`, with `searchPlaces` + `getPlaceDetails`) and two
implementations:

- **`mock-provider.ts`** (default, no setup required) — offline, curated
  content for Thailand (Bangkok + Phuket) plus a generic fallback for any
  other destination. This is what the app runs on out of the box.
- **`google-provider.ts`** — live results from the Places API (New)
  `searchText` endpoint.

`getPlacesProvider()` (`src/lib/services/places/index.ts`) picks between
them based on environment variables and always falls back to mock data if
anything is missing or fails, so **the app never requires an API key to
work**.

### Using live Google Places data (optional)

1. In the [Google Cloud console](https://console.cloud.google.com/), enable
   the **Places API (New)** on a project and create an API key. Restrict the
   key to the Places API and, ideally, to your server's IP/referrer.
2. Add to `.env.local` (**not** `.env.example` — never commit a real key):
   ```
   PLACES_PROVIDER=google
   GOOGLE_PLACES_API_KEY=your-key-here
   ```
3. Restart the dev server. Newly generated trips will now pull real hotels,
   attractions, restaurants and nightlife for the destination.

**This key is server-only.** It's read from `process.env` (no
`NEXT_PUBLIC_` prefix) only in server code: `getPlacesProvider()` (used by
the `/api/trips/generate`, `/api/trips/rebuild` and `/api/places/search`
routes), the `/api/places/photo` image proxy and the photo-link signing
helper. It is never sent to, or readable from, the browser. Photos are
streamed through `/api/places/photo` for the same
reason: a raw Google photo URL needs the key attached as a query
parameter, so the app fetches it server-side and relays the image bytes
instead of ever putting that URL in front of a client.

If a live search comes back empty for a city, or fails outright (bad key,
quota, network), the generator transparently fills that one gap from the mock
provider rather than failing the whole trip — every place still carries its
own source, so a hybrid itinerary is never misrepresented as fully verified.
The same fallback applies to the in-app place search, which additionally
shows the traveller a plain-language notice about what happened.

Provider responses are cached in-process for 10 minutes
(`places/cache.ts`), so regenerating a similar trip doesn't re-bill the same
searches. It's a per-process cache, cleared on restart — deliberately not a
distributed cache.

### What Google Places does and doesn't give us

| Field | Source |
| --- | --- |
| Name, address, city/country, coordinates, Google place id | Real, from Google |
| Rating and review count | Real, from Google (absent for many places) |
| Website / Google Maps link | Real, from Google |
| Photos | Real, proxied via `/api/places/photo` |
| **Cost** | **Derived from Google's coarse `priceLevel` enum, never an exact price.** Always flagged `(est.)` in the UI. |
| Opening hours, availability, bookability | Not requested, not implied |

Google Places is a source of *place identity and location*, not of travel
prices. An estimated cost is never presented as a Google price.

## The map

The map is Leaflet via `react-leaflet`, rendering **OpenStreetMap** tiles.

- **No API key.** That's the reason for this choice over the Google Maps
  JS API: the map has to work in mock mode, where there are no credentials
  at all. OSM's tile usage policy expects light, attributed use, which suits
  this app's scale; a production deployment with real traffic should move to
  a paid tile host (only two constants in `leaflet-map.tsx` would change).
- **Markers come from the itinerary itself** (`lib/services/map-points.ts`),
  never a separate dataset — so they reflect the traveller's edits live.
- **Only real coordinates are plotted.** Demo hotels and generic restaurants
  have no verifiable position, so they get no pin, and the map says how many
  places that affects rather than inventing locations to look fuller.
- **The dashed day line is itinerary order, not a route.** No routing/
  directions API is involved, and the UI says so.
- Dark mode dims the tiles rather than inverting them (inverting OSM's light
  basemap produced an unreadable near-black map).

## Feasibility, distance and travel time

A plausible-looking itinerary can still be impossible: two sights on opposite
sides of a city in the same afternoon, an island day trip squeezed in beside
three meals, or a beach in Phuket scheduled inside a Bangkok day. The
feasibility engine (`lib/services/feasibility/`) is the deterministic half of
planning — the part that asks whether the plan can physically happen.

**Travel times here are estimates, not routes.** Nothing in the app calls a
routing or directions API. Distances are great-circle (Haversine) with a road
detour factor applied, and durations come from distance bands with a
door-to-door speed and a fixed overhead — the overhead is what stops a 690 km
flight being reported as 59 minutes. Every figure is flagged `isEstimated` and
every string the UI renders says "estimated". If a real routing provider is
ever configured, `TravelTimeProvider` in `travel-time.ts` is the one seam that
changes; the engine and the UI stay as they are.

What the engine does:

- **Distance** (`geo.ts`) — Haversine between two points, returning `null`
  rather than a number whenever either end has no coordinates. `(0, 0)` is
  treated as missing, because it is nearly always a provider default rather
  than a spot in the Gulf of Guinea.
- **Travel time** (`travel-time.ts`) — walk / car / train / flight chosen by
  distance, separately for hops inside a city and transfers between cities.
- **Durations** (`durations.ts`) — a provider-supplied duration when there is
  one, otherwise a mid-range default per activity category. A model is never
  asked to invent one. Opening hours are modelled but always report
  `"unknown"` today, since the Places integration doesn't request that
  (billable) field group — and missing hours are explicitly not an error.
- **Day feasibility** (`engine.ts`) — a day is time at places, plus travel
  between them, plus a buffer for getting in and queueing, measured against a
  09:00–21:00 window. Over-capacity days are flagged red, tight ones amber,
  and long-travel and missing-location notes are shown as-is.
- **City transfers** (`engine.ts`) — a city change is a planning event in its
  own right: it appears as its own segment on the arrival day, with mode,
  distance and duration. Its cost is read from the transport activity the
  generator already booked, so the budget is never charged twice.
- **Ordering and clustering** (`ordering.ts`) — a day's stops are visited
  nearest-neighbour from the hotel, and a city's sights are grouped
  geographically so one day is the old town and another is the coast.

**Nothing here is persisted.** The whole analysis is derived from the saved
trip on every render, which means trips saved before this engine existed work
untouched (no migration), and an edit re-evaluates for free. It also costs no
API calls — it is arithmetic over data already in memory.

The itinerary generator uses the same arithmetic *while building* a day, so it
can't emit a day the engine then flags red: each candidate stop is accepted
only if the day still fits with dinner held in reserve, and only if it doesn't
overlap something already booked. That's why an eight-hour island trip
displaces the day's second museum and its lunch reservation instead of being
stacked on top of them.

## Scripts

| Command              | What it does                                              |
| --------------------- | --------------------------------------------------------- |
| `npm run dev`         | Dev server                                                |
| `npm run build`       | Production build                                          |
| `npm run lint`        | ESLint                                                    |
| `npm test`            | Unit tests (`src/**/*.test.ts`), via Vitest               |
| `npm run test:rules`  | Firestore rules tests against the emulator                |
| `npm run emulators`   | Start the Auth + Firestore emulators locally              |

To develop fully offline against the emulators, set
`NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true` in `.env.local` and run `npm run
emulators` in a second terminal.

## Deployment

Merges to `main` deploy to a staging environment on **Vercel**.

- Vercel project **Root Directory** is set to `code/`.
- The six `NEXT_PUBLIC_FIREBASE_*` variables are configured in the Vercel
  project settings (Production + Preview), pointing at the `tripease-staging`
  Firebase project.

## Mock mode: what's real, what's demo

By default there's no AI provider or Places API key configured — the whole
app works offline aside from Firebase:

- **Itinerary generation** (`src/lib/services/itinerary-generator.ts`) is
  deterministic: it takes the validated city plan (see "How a trip gets
  planned") and asks the active **places provider** (see above) for each
  city's hotel, attractions, restaurants and nightlife. With the mock
  provider, Thailand (Bangkok + Phuket) is curated with real, well-known
  attractions; any other destination falls back to a generic template.
- **Every place carries its own provenance** (`Activity.source` /
  `Hotel.source`, see `src/types/place.ts`): `isDemoData` says whether the
  place itself is real, `priceIsEstimate` says whether its cost is a
  verified number or an inferred guess (true for essentially everything
  today — Google Places only ever returns a coarse price *level*, never an
  exact amount). Real, well-known landmarks link to a genuine reference
  (Wikipedia in mock mode, a Google Maps/website link in Google mode);
  anything without a verifiable source carries no link and is tagged
  **"Demo data"** in the UI. Nothing is ever presented as a verified fact
  it isn't.
- **Travis** answers from a small canned catalogue of seasons and cost
  patterns (`lib/mock-data/travis-demo.ts`) when `AI_PROVIDER=mock`, through the
  same checks as a live model, and the page says "Demo mode". With no AI
  configured at all it says it is unavailable and points to planning by hand.
- **Map view** is a real Leaflet/OpenStreetMap map either way — it needs no
  credentials — but in mock mode only the places that carry genuine
  coordinates get a pin (see "The map").
- **Budget numbers** are computed from whatever the places provider
  returned (see `src/lib/services/budget-engine.ts`) — realistic in shape,
  not live/bookable prices, even when the underlying places are real.

## Project layout

```
src/
  app/
    (auth)/                    sign-in, sign-up — redirect to /dashboard if signed in
    (app)/                     gated by <RequireAuth>
      dashboard/                trip list + the two ways to start a trip
      travis/                   Ask Travis — the chat page
      trips/new/                the multi-step create-trip wizard
      trips/[tripId]/           the roadmap / budget / map trip view
    api/trips/plan/             city planning endpoint (AI, then validation, then fallback)
    api/trips/generate/         itinerary generation endpoint
    api/trips/rebuild/          rebuilds new or changed cities after "Edit cities"
    api/travis/chat/            one turn of Travis (auth, rate limit, AI, checks)
    api/places/search/          server-side place search for the "replace with a real place" picker
    api/places/photo/           server-side proxy for Google Places photos (keeps the API key off the client)
    page.tsx                    landing page
  components/
    landing/                   hero, how-it-works, itinerary + budget previews, features, CTA
    dashboard/                 trip card, start card (the two ways to begin)
    travis/                    chat container, message, suggestion card, composer
    trips/wizard/               wizard shell, steps, generation loader, initial-data (draft → wizard)
    roadmap/                   trip header, city section, city manager ("Edit cities"), day view,
                               activity editor/row, hotel editor, place search,
                               travel-segment row + feasibility notes
    budget/                    budget panel + chart
    maps/                      trip-map (filters/states) + leaflet-map (the map itself, client-only)
    ui/                        shared primitives (button, input, dialog, tabs, progress, chip…)
    auth-provider.tsx, require-auth.tsx, site-header.tsx, auth-form.tsx  (unchanged from iteration 1)
  lib/
    firebase.ts                 SDK initialisation (+ emulator switch)
    collections.ts               Firestore collection paths
    date.ts, utils.ts            date + formatting helpers
    draft-storage.ts             carries a trip idea from the landing page or Travis into the wizard
    travis-client.ts             sends a conversation to Travis (history → request messages)
    travis-draft.ts              a Travis suggestion → a pre-filled wizard draft
    travis-storage.ts            keeps the conversation in session storage, validated on read
    api-client.ts                attaches the Firebase ID token to API calls
    server/
      firebase-auth.ts           verifies Firebase ID tokens in the API routes
      photo-signing.ts           signs and checks /api/places/photo links
      rate-limit.ts              per-user sliding-window limiter (best-effort, in memory)
    mock-data/                  curated destination content + city list, mock FX rates
    services/
      auth.ts                    the ONLY place Firebase Auth is touched (unchanged)
      trips.ts                   the ONLY place Firestore trip docs are touched
      trip-mutations.ts          pure add/edit/delete/reorder/hotel-change logic
      itinerary-generator.ts     validated city plan → full itinerary, via the places provider
      ai/
        provider.ts               the AIProvider interface + shared planner prompt
        groq-provider.ts          Groq, with JSON-schema-constrained output
        mock-provider.ts          deterministic stand-in (tests, AI_PROVIDER=mock)
        travis-prompt.ts          Travis's instructions + JSON schema, shared by all providers
        index.ts                  getAIProvider() — picks a provider from env vars
      travis/
        index.ts                  chatWithTravis() — AI, then checks, one retry
        sanitize.ts               dedupe, plain destination names, derived dates, price redaction
        price-guard.ts            recognises amounts of money in text
        dates.ts                  best months → real dates; window labels
      planning/
        index.ts                  planCities() — AI, then validation, then fallback
        fallback-planner.ts       deterministic planner; never invents city names
        validate.ts               TripEase's own constraint checks on an allocation
        split-days.ts             shared day-allocation maths
      budget-engine.ts           itinerary → budget breakdown, over-budget savings suggestions
      map-points.ts              trip → map markers/filters/day route (pure, unit-tested)
      feasibility/
        geo.ts                    Haversine distance + centroid; null rather than a guess
        travel-time.ts            TravelTimeProvider + the heuristic (no routing API)
        durations.ts              how long an activity takes; opening-hours seam
        engine.ts                 day segments, day feasibility, whole-trip analysis
        ordering.ts               nearest-neighbour day routes, geographic day clustering
        index.ts                  barrel export
      places/
        provider.ts               the PlacesProvider interface every provider implements
        mock-provider.ts          offline provider backed by lib/mock-data
        google-provider.ts        live provider backed by the Places API (New)
        cache.ts                  in-process TTL cache so repeat searches aren't re-billed
        errors.ts                 typed provider failures + user-safe messages
        index.ts                  getPlacesProvider() — picks a provider from env vars
    validation/
      trip.ts                     Zod schemas for trip input and generated itineraries
      places.ts                   Zod schemas for the Place model + raw Google API responses
      travis.ts                   Zod schemas: the request into Travis, and the model's reply out
  types/                        trip.ts, itinerary.ts, budget.ts, place.ts, planning.ts, travel.ts, travis.ts
firestore.rules                 authorization layer, tested by tests/rules/
```

All Firestore access goes through `src/lib/services/*`; components never
build queries or touch `firebase/auth` directly. A trip is stored as a single
Firestore document (cities, days and activities are denormalized into it) —
at the scale of a handful of cities and a few dozen activities this stays
well under Firestore's document size limit and keeps every edit a single
read-modify-write instead of a fan-out across subcollections.

## Known limitations

- **Travel times are estimated, never routed.** No routing or directions API
  is called anywhere in the app. Distances are great-circle with a detour
  factor, and durations come from distance bands with a fixed door-to-door
  overhead — good enough to tell a walk from a flight and to catch an
  impossible day, but not a substitute for a real route. See "Feasibility,
  distance and travel time".
- Opening hours aren't fetched (a separate, billable Places field group), so
  the feasibility engine can't tell you a museum is shut on the day you've
  planned it. The check exists and reports `"unknown"`; turning hours on is a
  provider change, not an engine change.
- Transfer costs are transparent arithmetic (a floor plus a distance
  component, by mode), not quoted fares. They're labelled as estimates
  everywhere they appear.
- A day's travel is only counted between places that actually have
  coordinates. Demo hotels and generic restaurants have none, so a mock-mode
  trip under-counts its own travel; the day says how many places that
  affects rather than inventing positions.
- Without an AI key, non-curated destinations get a single base city rather
  than a multi-city route. That's the honest fallback, not a bug — but it
  does mean the AI planner is what makes the app genuinely multi-country.
- Token revocation isn't detected (see "API security" above).
- Costs are treated as a flat total for the travelling party rather than
  computed per-traveller (except flights, which scale by traveller count).
- The AI decides the city split, and Travis suggests destinations and the
  best months to go. Individual activities, meals and hotels are still chosen
  by the deterministic generator from the places provider, not by an LLM — see
  "Mock mode" above. Travis cannot yet change a trip.
- Travis's seasons, weather and cost labels come from the model's general
  knowledge and aren't checked against any data. There is no free source of
  live flight or hotel prices, so costs stay estimates and Travis only ever
  says lower, typical or higher. See "Travis, the trip assistant" for the
  rate limits (including Groq's 8,000-tokens-a-minute free tier).
- `google-provider.ts` has been used by hand against a live key (place search,
  and generating trips for Thailand, Italy and Japan), but **no automated test
  calls the real API**: the whole test suite runs against the mock provider.
- The map's day line shows itinerary order only, and the city-transfer line is
  a straight connection between two cities — neither is a driving route.
