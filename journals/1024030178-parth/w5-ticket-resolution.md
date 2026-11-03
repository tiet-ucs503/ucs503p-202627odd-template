# Week 5 : Route Coverage, Comparison Panel and Deployment

## Problem

With 7 locations in the prototype, only 20 of the required 42 directed routes
were defined. Attempting an undefined pair showed no result. Additionally, the
comparison panel showed "saves 0 min" in many cases because the Normal GPS
simulation and the SyncDrive optimizer were not using the same departure time —
making the comparison unfair.

## Error 1 — Missing Routes

```
// user selects sec17 → sec35
const key = `${orig}->${dest}`;   // "sec17->sec35"
const route = ROUTES[key];        // undefined
if (!route) { showToast('No route for this pair'); return; }
```

7 locations → 7 × 6 = **42 directed pairs** needed.  
Only 20 were defined. 22 pairs returned "No route".

### Resolution

Systematically generated all missing pairs. Routes grouped by origin:

```
sec17 ↔ sec22, sec35, sec43, pgi, elante, tribune   (12 routes)
sec22 ↔ sec35, sec43, pgi, elante, tribune           (10 routes)
sec35 ↔ sec43, pgi, elante, tribune                  (8 routes)
sec43 ↔ pgi, elante, tribune                         (6 routes)
pgi   ↔ elante, tribune                              (4 routes)
elante ↔ tribune                                     (2 routes)
─────────────────────────────────────────────────────────────
Total: 42 directed routes
```

Each route has `sigs[]` (signal ids along path), `km` (distance),
`pts[][]` (polyline coordinates), and `steps[]` (turn-by-turn text).

Verified with:

```bash
grep -o "'[a-z0-9]*->[a-z0-9]*'" index.html | sort | uniq -c
# all 42 keys appear exactly once
```

## Error 2 — Unfair Comparison (saves 0 min)

The Normal GPS simulation was using `arrivalSec` (the target arrival time) as
its departure reference, while SyncDrive departed earlier. This meant Normal GPS
had more time to complete the journey, making the comparison look equal.

```js
// BEFORE (wrong)
const ng = simNG(route, route.km, arrSec);    // wrong reference

// AFTER (correct — same departure time, different speed)
const gw = optimise(route, route.km, arrSec);
const ng = simNG(route, route.km, gw.dep);    // same dep as GreenWave
```

With the same departure time, Normal GPS rushes at 50 km/h and hits red lights
while SyncDrive drives at 30–40 km/h and sails through green. The wait time
difference becomes visible in the time breakdown bars.

## Comparison Panel — Time Breakdown Bars

Added a visual bar for each mode showing the split:

```
Normal GPS: [████████ driving (1.7m)] [██████ waiting at reds (2.1m)]
SyncDrive:  [████████████ driving (2.6m)] [  (0m waiting) ✓          ]
```

Implemented as two `div` elements inside a flex track:

```html
<div class="tbar-track">
  <div class="tbar-d" id="bar-ng-d"></div>   <!-- blue: drive time -->
  <div class="tbar-w" id="bar-ng-w"></div>   <!-- red:  wait time  -->
</div>
```

Width set as percentage of the longer total:

```js
const maxT = Math.max(ng.total, gw.total);
barNgDrive.style.width = ((ng.driveSec / maxT) * 100) + '%';
barNgWait.style.width  = ((ng.waitSec  / maxT) * 100) + '%';
```

## Deployment

Pushed to GitHub via personal access token:

```bash
git init
git checkout -b master
git add code/index.html code/CONTEXT.md
git commit -m "feat: SyncDrive v0.4 — Apple Maps dark UI, 7 places, 42 routes"
git remote add origin https://github.com/ParthPuri/SyncDrive.git
git pull origin master --allow-unrelated-histories --no-rebase --no-edit
git push -u origin master
```

## Outcome

- All 42 directed routes working — every From/To combination resolves
- Comparison panel correctly shows time saved by SyncDrive vs Normal GPS
- Time breakdown bars make the "slower but faster" proof visually obvious
- Code live at `github.com/ParthPuri/SyncDrive/tree/master/code`
