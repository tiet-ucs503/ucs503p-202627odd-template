# Week 7 : Emergency Mode, Map Layer Toggles, Voice and UI Cleanup

## Problem

1. Emergency vehicles were not covered. In a real city the point of signal
   coordination is also to get an ambulance through, and everyone else has to
   get out of its way.
2. The map got crowded: with 25 signals and 14 place labels, markers overlapped
   (see the screenshot in the week's discussion), and the on/off switches for
   them were in a legend that is hidden on narrow screens.
3. The voice guidance sounded male.
4. The UI used emojis and symbol icons, which looked cluttered and rendered
   differently across platforms.

## Emergency (SOS) Mode

Emergency is a separate mode tab (Drive / Walk / Cycle / SOS), not a button
inside normal driving. It has its own panel: ambulance ETA, time with a green
corridor against time on normal signals, red lights overridden, and the
corridor signals.

In the run, an ambulance drives at 70 km/h and everything else gives way:

- **Green corridor** — signals within 500 m ahead of the ambulance are forced
  green; the ambulance never stops.
- **Yielding** — any vehicle within 350 m *ahead* of the ambulance slows to
  12 km/h (6 km/h within 120 m) and pulls over.
- **Holding** — other vehicles treat a corridor signal as red until the
  ambulance has passed it. Only the ambulance gets priority.
- Other vehicles: the two cars from the normal race (Car A, Car B) and 7
  background cars whose speed varies gently around a base speed.

```js
const gOthers=(s,t)=>!(D.emerg&&D.forced.has(s.id)) && greenAt(s,t);  // hold
const gAmb   =(s,t)=> D.forced.has(s.id) || greenAt(s,t);             // corridor
```

On Airport → PGI (12.4 km) the corridor saved about 70–106 s, with zero
ambulance stops and 6 of 10 red lights overridden.

## Error 1 — Emergency Run Started With The Wrong Clock

Opening a saved link `...#o=airport&d=pgi&t=09:00&w=arrive&m=emerg` ran the
ambulance well after the other cars (ambulance `d = 0` after 100 simulated
seconds). Emergency mode forces "leave now", but `applyHash()` applied the mode
first and the saved `w=arrive` second, overwriting it, so Normal GPS's departure
was computed from the 09:00 arrival time.

### Resolution

Apply the saved timing first, then the mode, and ignore "arrive by" for the
baseline when in emergency mode:

```js
if(p.get('w')==='now'||p.get('w')==='arrive') setWhenUI(p.get('w'));
if(MODES[p.get('m')]) setModeUI(p.get('m'));
...
const ngDep = S.when==='arrive' && S.mode!=='emerg' ? ... : gw.dep-(gw.offset||0);
```

## Error 2 — Crowded Map, Toggles Not Reachable

The legend (with the signal switches) is `display:none` below 760 px, so on a
phone-sized window there was no way to turn the clutter off.

### Resolution

A separate layers panel, always visible: **All layers** master switch plus
**Signals**, **Timers**, **Places**. All off hides everything, all on restores it
(including timers). `L`, `T`, `P` toggle the three layers; the choice is saved in
`localStorage`. When zoomed out (zoom 14 or less) signals shrink to small dots
without numbers so they stop piling up.

## Error 3 — Voice Was Male

The first fix preferred Samantha/Siri by name, but the voice list in browsers is
loaded asynchronously. On the first announcement `getVoices()` was still empty,
no voice was set, and the system default (male in this setup) was used.

### Resolution

- Choose from an ordered list of female English voices (Siri, Samantha, Ava,
  Allison, Susan, Zoe, Karen, Kathy, Tessa, Moira, ...), skipping a male/novelty
  deny-list, re-picking when `voiceschanged` fires.
- A voice dropdown appears when Voice is on, so the user can override it; it
  speaks a test line when changed.

## UI Cleanup

All emojis and symbol icons (on buttons, markers, banners and the finish card) were replaced with plain text: "SOS", "Pause", "Play", "Stop",
"EV" on corridor signals, "A" on the ambulance marker. The emergency banner no
longer blinks.

## Outcome

- Separate SOS mode with green corridor and yielding traffic
- Layers panel with a master on/off switch, usable on small screens
- Female voice with a selectable voice list
- Plain-text UI without emojis
