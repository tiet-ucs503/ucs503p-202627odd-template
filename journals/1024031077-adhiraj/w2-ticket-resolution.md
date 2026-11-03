# Week 2 : Technology Stack Selection and Map Integration

## Problem

Choosing a mapping library and tile provider that:

1. Works with no backend (single HTML file prototype)
2. Requires no API key (avoids billing and signup friction)
3. Renders dark enough to resemble professional navigation apps

## What I Tried

### Attempt 1 — Google Maps JS API

Requires an API key and billing account. Rejected — too much friction for a
prototype and impossible to distribute freely.

### Attempt 2 — Carto Voyager tiles with Leaflet

```js
L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png')
```

This looked clean but Carto now requires an API key for the `rastertiles`
endpoint. The map rendered with a large watermark:

```
API KEY REQUIRED
carto.com/basemaps/apikey
```

### Attempt 3 — Stadia Maps `alidade_smooth_dark`

```js
L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png')
```

**Result:** Dark navy tiles with white road lines — no API key required for
reasonable usage. Matches the Apple Maps dark aesthetic closely.

## Resolution

Settled on **Leaflet.js 1.9.4** (CDN) + **Stadia alidade_smooth_dark** tiles.

| Requirement | Met? |
|---|---|
| No API key | ✅ |
| No backend | ✅ |
| Dark tiles | ✅ |
| Free for prototype | ✅ |

## Key Leaflet Patterns Learned

Placing a custom div-icon label on the map:

```js
const icon = L.divIcon({
  className: '',
  html: `<div style="background:#1c1c1e; color:#f5f5f7; ...">Label</div>`,
  iconAnchor: [0, 0]
});
L.marker([lat, lng], { icon }).addTo(map);
```

Fitting the map viewport to a drawn polyline:

```js
const route = L.polyline(coords, { color: '#0a84ff', weight: 5 }).addTo(map);
map.fitBounds(route.getBounds(), { padding: [60, 60] });
```

## Outcome

- Working map centred on Chandigarh (`30.7280, 76.7820`, zoom 14)
- 7 place markers and 16 traffic signal circles rendered on load
- No API key needed — file opens directly in any browser
