# SyncDrive — Project Context File (v0.6)

> Paste this entire file into another AI (ChatGPT, Claude, Gemini, etc.) to continue development from where we left off.

---

## Objective

**SyncDrive** is a Signal Sync GPS — a navigation app that tells a driver:

- **When to leave** (departure time) so they hit the most traffic signals on green
- **What speed to maintain** (20-48 km/h for cars, varying per stretch if that helps) to avoid red lights
- **Why this is faster**: driving slower with zero red-light stops beats driving at 50 km/h with several stops

The core proof:
```
Normal GPS:   1.7 min driving  +  2.1 min waiting at reds  =  3.8 min total
SyncDrive:    2.6 min driving  +  0 min waiting            =  2.6 min total
```

It also has a separate **Emergency (SOS) mode**: an ambulance gets a green corridor and every other vehicle yields.

---

## Scope

- **City**: Chandigarh, India — 14 places, 25 signals, 182 directed routes
- **Tech**: Pure HTML + CSS + JavaScript, **single file** (`code/index.html`, mirrored to root `index.html` for GitHub Pages), no build step, no server needed
- **Map tiles**: Esri World Dark Gray Canvas — free, no API key
- **Map library**: Leaflet.js 1.9.4 (CDN)
- **Font**: Inter (Google Fonts CDN)
- **Data**: All fake/hardcoded — signal timings, routes, distances
- **UI rule**: plain text only, no emojis or symbol icons

---

## File Structure (unchanged)

```
Project/
├── code/index.html        <- entire app
├── index.html             <- identical copy (GitHub Pages)
├── CONTEXT.md             <- this file (identical copy in code/)
├── diagrams/              <- 8 Mermaid UML diagrams
├── journals/<roll-name>/  <- weekly ticket-resolution journals
├── project-proposal/, project-report-*/   <- LaTeX reports (submission)
└── README.md, mkdocs.yml, Makefile, assets/, docs/
```

After editing `code/index.html`, copy it to `index.html`.

---

## Layout

```
[ Nav Rail ] [ Panel (320px) ] [ Map (flex:1) ]
```

- **Nav rail**: Search, Live Signals, Directions; live clock
- **Panel views**: Directions (modes, From/To with swap, Arrive by / Leave now, results), Search (places, popular routes), Live Signals (board of all junctions)
- **Mode tabs**: Drive, Walk, Cycle, SOS. SOS swaps the panel to "Emergency Response" (red accent, no arrive-by row, separate results block `#results-emg`)
- **Map overlays**: simulation clock chip (LIVE / SIM Nx), legend, layers panel (All layers / Signals / Timers / Places), pre-drive HUD, drive console, finish card, emergency banner
- Under 1100 px the nav collapses to icons; under 760 px it becomes a bottom bar

---

## Data

- `PLACES` — 7 original + 7 added (sec8, pu, rock, sukhna, sec26, rail, airport)
- `SIGNALS` — c1-c16 original, c17-c25 added. Fields: `id, name, lat, lng, cycle, gS (green start), gD (green duration)`
- `ROUTES` — 42 hand-written directed routes (`sigs, km, pts, steps`)
- `EDGES` — road graph (place/signal ids). `getRoute(o,d)` returns the hand route if present, otherwise the Dijkstra shortest path (km = path length * 1.2), cached

---

## Algorithms

- `phase/isGreen/waitSec/greenAt/flipIn` — signal maths (phase = (t) % cycle; green if gS <= phase < gS+gD)
- `evaluate(route, km, dep, spd, segSpd?)` — one candidate; `segSpd[i]` is the speed between signal i-1 and i
- `refine()` — per-stretch speed plan: at each signal pick the speed arriving green soonest (penalty above 40 km/h and for deviation from base)
- `bestAt()` — constant vs refined; refined wins if it costs <= 2 s more
- `optimise(route, km, arrSec, M)` — Arrive by: all speeds x departure offsets 0-25 min (10 s step)
- `optimiseLeave()` — Leave now: wait 0-10 min
- **Normal GPS** leaves at the naive time (arrive-by minus drive time at `M.ng`), not at SyncDrive's departure
- `MODES` — `car` / `emerg` speeds 20-48 (ng 50), `bike` 10-26 (ng 26), `walk` 3-6.5 (ng 6.5)
- Route geometry: model fraction (i+1)/(n+1) is mapped to the signal's projected position on the polyline (`buildGeo`, `toGeo`, `pointAt`)

---

## Drive Simulation

`D` holds state. `stepVeh(v, dt, t, target, greenFn)` advances a vehicle (accel limited, stops at red). Main loop `frame()` advances at 1x-16x.

- **Normal run**: SyncDrive car vs Normal GPS car. `advise()` suggests the speed reaching the next signal on green (1.5 s margin). Auto follows the advisor; Manual uses the slider. Follow camera, optional voice, finish card.
- **Emergency run** (mode SOS): ambulance at 70 km/h starts 20 s after the others; `updateForced()` forces signals within 500 m ahead green; `yieldSpeed()` slows vehicles within 350 m ahead of it to 6-12 km/h; others treat forced signals as red until it passes (`gOthers` vs `gAmb`). 7 background cars with gently varying speed. Finish card: ambulance time vs normal signals, red lights cleared, vehicles yielded.

---

## Voice

`say()` uses the Web Speech API (only at <=4x). `pickVoice()` prefers female English voices in a fixed order (Siri, Samantha, Ava, ...) with a male/novelty deny-list and re-picks on `voiceschanged`; a dropdown (`#cn-voice-sel`) lets the user override.

---

## Persistence and sharing

- `localStorage`: recent routes (`syncdrive.recents`), layer toggles (`syncdrive.ui`)
- Share link = URL hash `#o=&d=&t=&w=&m=`. `applyHash()` must apply `w` (when) before `m` (mode) because SOS forces "leave now"

---

## Keyboard

`Enter` sync, `S` swap, `Space` start/pause, `+`/`-` sim speed, `Esc` stop, `E` toggle SOS mode, `L`/`T`/`P` toggle signals/timers/places

---

## Design System (Apple Maps dark)

```
--bg #1c1c1e  --bg2 #2c2c2e  --bg3 #3a3a3c  --bg4 #48484a
--text #f5f5f7  --sub #aeaeb2  --muted #636366
--accent #0a84ff (UI accent, SyncDrive route/car)
--green #30d158 (ONLY for "signal is green")
--red #ff453a (red lights, Normal GPS, SOS accent)
--amber #ffd60a (ETA, yielding vehicles)
```

---

## Known limitations / ideas

- All data is fake; signal timings are not real
- Advisor only looks at the next signal (greedy)
- In 28 of 182 car routes at a 09:00 arrival SyncDrive is not faster than Normal GPS (not analysed)
- Ambulance and traffic share one lane model: vehicles do not collide or overtake, they slow down
- Ideas: real signal data, multiple ambulances, route alternatives, mobile PWA
