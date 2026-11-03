# Week 1 : Project Ideation and Problem Definition

## Problem Statement

During early planning I struggled to define a problem that was both technically
interesting and practically useful. The initial idea was a simple route planner,
but that already exists in every major mapping product.

## Key Observation

The real problem is not *finding* the fastest route — it is *timing* a trip so
a driver hits the most traffic signals on green. A driver who goes slower but
never stops can arrive faster than one who rushes and waits at every red light.

> Example:
> - Normal GPS: 2.6 min driving + 2.5 min waiting at reds = **5.1 min total**
> - SyncDrive:  3.8 min driving + 0 min waiting           = **3.8 min total ✅**

This is the *green wave* concept used by traffic engineers at the city level,
reversed for the individual driver.

## Ticket / Issue Resolved

**Defining the core value proposition clearly enough to scope the prototype.**

### What I tried first

I initially framed it as "avoid traffic jams" which overlapped too much with
Google Maps. This made the feature set unclear and the evaluation criteria vague.

### Resolution

Narrowed the problem to a single, verifiable claim:

> *"By driving at a recommended steady speed and leaving at the right time, a
> driver can pass through every signal on green, eliminating wait time entirely,
> and arriving faster despite a lower speed."*

This gave a concrete, testable hypothesis that could be demonstrated with a
prototype even using simulated signal data.

## Outcome

- Problem statement finalised and written up in project proposal (`project-proposal/main.tex`)
- Decided on Chandigarh as the prototype city (grid-sector layout makes signal
  simulation realistic)
- Identified 7 key locations across Chandigarh sectors to use as
  origin/destination pairs

## References

- Chandigarh sector grid layout — [openstreetmap.org](https://openstreetmap.org)
- Green wave (traffic) — Wikipedia
