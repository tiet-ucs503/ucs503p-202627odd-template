# Week 3 : Green Wave Algorithm Design and Implementation

## Problem

The first version of the algorithm maximised the *count* of green signals hit,
but this produced incorrect results — it sometimes recommended leaving much
earlier and driving slower than necessary, even when a slightly faster speed
would arrive at the same time with the same green count.

## Error

The original scoring function was:

```js
const score = greens * 1000 - offset;
```

This caused two bugs:

1. **Speed insensitivity** — a result with 3 greens at 25 km/h scored the same
   as 3 greens at 45 km/h, always preferring the earlier (slower) departure
   regardless of total journey time.
2. **Wait time ignored** — signals hit on red were not simulated through; the
   driver's subsequent signal arrival times were not updated after a stop, making
   the green count unreliable.

## Key Observation

The correct objective is to **minimise total journey time**:

```
total_time = drive_time + wait_time_at_reds
```

A driver who hits one red and waits 40 seconds loses more time than the extra
drive time from reducing speed by 5 km/h.

## Signal Phase Mathematics

```
phase = (departure_time + travel_time_to_signal) % signal_cycle

isGreen = phase >= greenStart  &&  phase < (greenStart + greenDuration)

waitIfRed = phase < greenStart
            ? greenStart - phase
            : cycle - phase + greenStart
```

## Resolution

Rewrote the optimizer:

```js
// Speeds tested: 25, 28, 30, 32, 35, 38, 40, 42, 45 km/h
// Search window: 25 minutes before latest departure, step 15 seconds

for each (speed, departure_offset):
  driveSec = (km / speed) * 3600
  dep      = arrivalTime - driveSec - offset

  simulate each signal in order:
    phase = (dep + timeToSignal + elapsed) % cycle
    if red:  elapsed += waitSec(signal, phase)

  total = driveSec + totalWait
  score = total - greens * 0.5    // lower is better
```

The `elapsed` accumulation is critical — each red stop pushes the driver's
arrival at all subsequent signals later, potentially turning the next green into
a red. Without this, the simulation is wrong.

## Outcome

- Algorithm correctly finds cases where 30 km/h + zero stops beats 50 km/h + 3 stops
- Normal GPS simulation uses the same departure time for a fair apples-to-apples comparison
- Time breakdown bars in the UI visually prove the result:
  - Normal GPS: short blue (driving) bar + large red (waiting) bar
  - SyncDrive: longer blue bar + zero red bar = shorter total

## Test Case (sec17 → sec22, arrival 09:00)

| | Speed | Drive | Wait | Total |
|---|---|---|---|---|
| Normal GPS | 50 km/h | ~1.7 min | ~2.1 min | ~3.8 min |
| SyncDrive  | 32 km/h | ~2.6 min | 0 min    | ~2.6 min |
