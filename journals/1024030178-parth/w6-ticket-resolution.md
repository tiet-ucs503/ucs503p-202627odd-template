# Week 6 : Live Signals, Drive Simulator and Extended Network

## Problem

The prototype was a static calculator: it produced one result and the signals on
the map never changed. Three gaps stood out:

1. Signals did not behave like signals — they showed one fixed colour from the
   moment of calculation, with no timer.
2. Only 7 places and 42 hand-written routes existed. Every new place meant
   writing routes for every pair by hand.
3. The comparison was not convincing. Both vehicles left at SyncDrive's chosen
   departure, so Normal GPS at 50 km/h was often just as fast as SyncDrive at its
   best speed (45 km/h) — the "slower but faster" claim did not show up.

## Live Signals

Every signal is now a live marker: green or red with the seconds left until it
changes, driven by one clock.

```js
const phAt    = (sig,t)=>((t%sig.cycle)+sig.cycle)%sig.cycle;
const greenAt = (sig,t,margin=0)=>{ const p=phAt(sig,t); return p>=sig.gS+margin && p<sig.gS+sig.gD-margin; };
function flipIn(sig,t){                       // seconds until the colour changes
  const p=phAt(sig,t);
  if(isGreen(sig,p)) return sig.gS+sig.gD-p;
  return p<sig.gS ? sig.gS-p : sig.cycle-p+sig.gS;
}
```

Idle, the clock is the real time of day. During a drive it is the simulation
clock. A new Live Signals view lists all junctions with a cycle strip (green
window, a "now" needle) and a count of green/red.

## Error 1 — Render Loop Crash

After adding the live strips, the whole UI froze after the first calculation:

```
Uncaught TypeError: Cannot read properties of undefined (reading 'cycle')
    at phAt
    at updateStrips
    at renderResults
```

`updateStrips` selected every `.strip .nd` element and looked up its signal with
`data-sid`. The new Live Signals board uses the same classes but has no
`data-sid`, so `sigR(undefined)` returned `undefined`. An exception inside the
`requestAnimationFrame` loop also stops the loop, so everything stopped updating.

### Resolution

Only select elements that carry the attribute:

```js
document.querySelectorAll('.strip .nd[data-sid]')
```

## Live Drive Simulator

Two vehicles run on the same clock and the same signals:

- **SyncDrive** — follows a live speed advisor (Auto) or a speed the user sets
  (Manual).
- **Normal GPS** — flat 50 km/h, stops at every red.

The advisor looks at the next signal each tick and suggests the speed that
arrives on green (with a 1.5 s safety margin), e.g. "Ease to 32 to catch the
green". Controls: pause/resume, 1x–16x simulation speed, follow camera, optional
voice, and a finish card with times and stops.

The optimizer places signal *i* at fraction (i+1)/(n+1) of the trip, which does
not match where the signal marker really is on the polyline. To keep the
optimizer numbers unchanged but still stop the car visibly at the marker, each
model fraction is mapped to the signal's projected position on the polyline
(piecewise linear anchors, forced strictly increasing).

## Extended Network

Added 7 places (Sector 8 Market, Panjab University, Rock Garden, Sukhna Lake,
Sector 26 Grain Market, Railway Station, Airport) and 9 signals (c17–c25) —
14 places and 25 signals in total.

Rather than hand-writing 140 more routes, any pair without a hand-written route is
resolved over a road graph (junction-to-junction edges) with Dijkstra:

```js
function getRoute(o,d){
  if(ROUTES[`${o}->${d}`]) return ROUTES[`${o}->${d}`];   // the 42 original routes
  // otherwise: shortest path over EDGES, signals on the path, km = path length * 1.2
}
```

Verified in the browser console that all 14 × 13 = 182 directed pairs resolve.

## Speed Variation and a Fairer Comparison

- Speed sets are finer: car 20–48 km/h in 2 km/h steps (was 9 values, max 45),
  and similar finer sets for Cycle and Walk; departure step 15 s → 10 s.
- A per-stretch "Smart" plan: after the best constant speed is found, each stretch
  between signals picks the speed that reaches the next signal on green soonest
  (with a small penalty above 40 km/h and for large changes). It is accepted when
  it costs no more than 2 s extra, so equal-time plans that are smoother win.
- The comparison baseline was the real problem. Normal GPS now leaves at the
  naive time — arrive-by minus drive time at 50 km/h — instead of SyncDrive's
  departure:

```js
const ngDep = arriveBy - route.km / 50 * 3600;     // it knows nothing about signals
```

Measured over all 182 car routes at a 09:00 arrival: SyncDrive was never faster
before (0 of 182); after the change it is faster on 149, slower on 28, and saves
38 s on average. The 28 routes where it is slower were not analysed further.

## Outcome

- Signals are live: colour and countdown update in real time
- Drive simulator with advisor, manual mode, 1x–16x speed, follow camera, finish card
- 14 places, 25 signals, all 182 pairs routable
- Finer and per-stretch speed plans; honest Normal GPS baseline
- New Live Signals, Search (places, popular routes) views; recents and share links
