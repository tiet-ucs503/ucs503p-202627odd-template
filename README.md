# SyncDrive

**Signal-Aware Navigation and Speed Optimization System**

> Drive slower. Stop less. Arrive faster.

SyncDrive is a signal-aware GPS prototype that tells a driver *when to leave* and *what speed to maintain* so they pass through every traffic signal on green — eliminating red-light wait time entirely. The result: a lower speed with zero stops beats a faster speed with multiple stops.

**Core proof:**

| Strategy | Speed | Drive time | Wait time | **Total** |
|---|---|---|---|---|
| Normal GPS | 50 km/h | 1.7 min | 2.1 min | **3.8 min** |
| SyncDrive  | 32 km/h | 2.6 min | 0 min   | **2.6 min** ✅ |

---

## What's New (v0.5)

- **Live signals** — every junction shows real green/red state and a seconds-left countdown on the map, ticking in real time
- **Live drive simulator** — race SyncDrive vs Normal GPS along the route (1×–16× speed), with a live speed advisor ("Ease to 32 to catch the green"), Auto/Manual pilot, follow-camera and optional voice guidance
- **Leave now / Arrive by** modes, plus Drive / Cycle / Walk speed profiles
- **Auto-recalculate** on any input change, swap button, click places on the map to set start/destination
- **Speed-vs-time chart**, fuel/CO₂ estimates, per-signal live cycle strips
- **Live Signals board**, place search, popular routes, recent routes, shareable route links
- **Emergency mode (v0.6)** — separate `🚑 SOS` mode tab (or `E`); map signal lights and countdown timers can each be toggled on/off (`L`/`T`) — sends an ambulance down the route at 70 km/h with a green corridor: signals within 500 m ahead are forced green, while every other vehicle (SyncDrive car, Normal GPS car, 7 background cars) slows, pulls over and holds at those junctions until it passes
- **14 places, 25 signals, any-to-any routing** over a road graph; finer speed steps and per-stretch "Smart" speed plans; Normal GPS now leaves at the naive time for a fair comparison
- Keyboard: `Enter` sync · `S` swap · `Space` play/pause · `+`/`-` sim speed · `Esc` stop

---

## Team

| Name | Roll No. |
|---|---|
| Tarun Mahindra | 1024030177 |
| Parth Puri | 1024030178 |
| Adhiraj Kapur | 1024031077 |

**Course:** UCS503P — Software Engineering Project, 2026-27 Odd Semester  
**Institute:** Thapar Institute of Engineering and Technology  
**Instructor:** Dr. Paramveer Sidhu

---

## Quick Start

```shell
# No install, no server, no API key needed
open code/index.html   # macOS
# or just double-click code/index.html in your file explorer
```

The entire application is a single HTML file. Open it in any modern browser.

---

## Repository Structure

```
SyncDrive/
├── code/
│   ├── index.html                      ← full working prototype (map + UI + algorithm)
│   └── CONTEXT.md                      ← AI-handoff documentation
│
├── diagrams/
│   ├── README.md                       ← diagram index
│   ├── 01-use-case.md                  ← Use Case diagram
│   ├── 02-class.md                     ← Class diagram
│   ├── 03-sequence.md                  ← Sequence diagram
│   ├── 04-activity.md                  ← Activity diagram
│   ├── 05-state.md                     ← State machine diagram
│   ├── 06-swimlane.md                  ← Swimlane (cross-functional) diagram
│   ├── 07-deployment.md                ← Deployment diagram
│   └── 08-er.md                        ← Entity-Relationship diagram
│
├── journals/
│   ├── 1024030177-tarun/               ← 5 weekly entries (W1–W5)
│   ├── 1024030178-parth/               ← 7 weekly entries (W1–W7)
│   └── 1024031077-adhiraj/             ← 5 weekly entries (W1–W5)
│
├── project-proposal/
│   ├── main.tex
│   └── main.pdf
│
├── project-report-prototype-stage/
│   ├── main.tex
│   └── main.pdf
│
├── project-report-final/
│   └── TODO
│
└── assets/
    ├── architecture-diagram.pdf
    ├── tiet-logo.svg
    └── ...
```

---

## How It Works

### The Green Wave Concept

Traffic engineers use *green waves* — timing signals along a corridor so a vehicle at a specific speed hits all greens. SyncDrive reverses this for the individual driver: instead of the city timing lights for a fixed speed, the driver adjusts their speed to match whatever wave is currently running.

### Algorithm

```
Speeds (car): 20, 22, ... 48 km/h          (finer sets for Cycle / Walk)
For each speed:
  For each departure offset in 0..25 min (step 10 s):      "Arrive by"
    dep = arrivalTime - driveTime - offset                  (or now + 0..10 min for "Leave now")
    Simulate each signal:
      phase = (dep + timeToSignal + elapsed) % cycle
      if red: elapsed += waitUntilGreen(signal, phase)
    Refine: per stretch between signals, pick the speed that reaches the next
            signal on green soonest ("Smart" plan, speeds vary per stretch)
    score = totalTime - 0.5 * greensHit   <- minimise
```

The `elapsed` accumulation is critical: each red stop shifts all subsequent signal arrival times, so missing it gives wrong results.

### Normal GPS comparison

Normal GPS knows nothing about signals: it leaves at the naive time (arrive-by minus drive time at its flat 50 km/h) and hits signals at uncontrolled phases, accumulating real wait time. At a 09:00 arrival (car), SyncDrive is faster on 149 of the 182 routes, 38 s on average.

### Live drive simulation

Two vehicles run on the same clock and signals: SyncDrive (follows a live speed advisor, or a manual speed) and Normal GPS (flat speed, stops at every red). The advisor checks the next signal each tick and suggests the speed that reaches it on green.

### Emergency (SOS) mode

A separate mode tab. An ambulance runs at 70 km/h with a green corridor: signals within 500 m ahead are forced green. Every other vehicle (the two cars above plus 7 background cars) slows to 6-12 km/h within 350 m ahead of the ambulance and holds at corridor junctions until it has passed.

---

## Prototype Coverage

| | Count |
|---|---|
| Locations | 14 (Sec 8, 17, 22, 26, 35, 43, PGI, Panjab University, Rock Garden, Sukhna Lake, Elante, Tribune Chowk, Railway Station, Airport) |
| Traffic signals | 25 (simulated Chandigarh sector grid) |
| Routes | 182 directed pairs: 42 hand-defined + the rest generated over a road graph (shortest path) |
| Modes | Drive, Walk, Cycle, SOS (ambulance) |
| Tech dependencies | 0 (no install, no API key, no server) |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Map | Leaflet.js 1.9.4 |
| Tiles | Esri World Dark Gray Canvas (free, no key) |
| Font | Inter via Google Fonts |
| Language | Vanilla JavaScript (ES6+) |
| Build | None — single HTML file |

---

## Diagrams

All UML and architecture diagrams are in [`diagrams/`](./diagrams/README.md), rendered as Mermaid markdown (GitHub renders these natively):

- [Use Case](./diagrams/01-use-case.md)
- [Class](./diagrams/02-class.md)
- [Sequence](./diagrams/03-sequence.md)
- [Activity](./diagrams/04-activity.md)
- [State Machine](./diagrams/05-state.md)
- [Swimlane](./diagrams/06-swimlane.md)
- [Deployment](./diagrams/07-deployment.md)
- [Entity-Relationship](./diagrams/08-er.md)

---

## Journals

Weekly development journals for each team member (Parth: W1–W7, others: W1–W5):

- [Tarun's Journal](./journals/1024030177-tarun/index.md)
- [Parth's Journal](./journals/1024030178-parth/index.md)
- [Adhiraj's Journal](./journals/1024031077-adhiraj/index.md)

---

## Reports

| Document | Source | PDF |
|---|---|---|
| Project Proposal | [main.tex](./project-proposal/main.tex) | [main.pdf](./project-proposal/main.pdf) |
| Prototype Stage Report | [main.tex](./project-report-prototype-stage/main.tex) | [main.pdf](./project-report-prototype-stage/main.pdf) |

---

## Docs

Documentation is built with [MkDocs](https://www.mkdocs.org/) and auto-deployed on every push to `master` via GitHub Actions.

```shell
make docs       # local dev server
```
