# Week 8 : 3D Map and Street View

## Problem

The map was flat. A navigation app is much easier to judge when you can see the
road ahead, and the signal-timing idea is easiest to explain from the driver's
point of view. Google Street View would be ideal, but its embed needs an API key
and billing, which the prototype avoids (no key, no server, single HTML file).

## Approach

Keep the 2D Leaflet map and add a second, WebGL map that is shown on demand:

- **3D** — MapLibre GL JS with free OpenFreeMap vector tiles (no key). Buildings
  are extruded (`fill-extrusion` on the `building` layer). The map is tilted,
  and during a drive a chase camera follows the vehicle.
- **Street** — the same map at street level (pitch 78, zoom 18.4) with the
  camera riding along the route; the player's own car is hidden so it feels
  first-person.
- **Google Street View link** — a keyless URL
  (`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=lat,lng`)
  that opens the current spot in a new tab.

Signals, countdown timers, place labels, route, vehicles, the ambulance
corridor and the layer toggles all work in 3D too. Signal markers reuse the 2D
CSS classes; `updateSignals` now writes to both sets of elements.

## Error 1 — 3D Map Never Finished Loading

With `style:'https://tiles.openfreemap.org/styles/positron'` the map stayed
blank: no `load` event, no console error. Fetching the same style JSON by hand
worked, so the problem was the library's own style fetch.

### Resolution

Fetch the style ourselves and give MapLibre the object:

```js
fetch(STYLE_URL).then(r=>r.json()).then(create3D);
// create3D(style): new maplibregl.Map({container:'map3d', style, ...})
```

The container is also made visible before the map is created, so it has a size.

## Error 2 — Follow Switched Itself Off

The "Follow" toggle turned off by itself as soon as a drive started in 3D. The
camera is moved with `jumpTo`, and MapLibre fires `rotatestart`/`pitchstart` for
programmatic moves as well as user drags, so the "user dragged the map" handler
ran every frame.

### Resolution

Only react to events that carry the user's input:

```js
const unfollow = e => { if (e && e.originalEvent && ...) D.follow = false; };
```

## Dark theme

OpenFreeMap has no dark style, so after load every style layer is recoloured:
background `#1c1c1e`, land `#262628`, roads `#3d3d40`, water `#0f1013`, labels
`#aeaeb2`, and the raster shading layer is hidden. Route layers are added after
that, so they keep their true colours.

## Outcome

- `2D / 3D / Street` switch (key `V`), 3D buildings, chase and street cameras
- Works with normal drives and the SOS ambulance run
- Google Street View link for any position
- No API key, still a single HTML file (MapLibre and tiles load from CDNs)
- Verified in the browser pane; the first 3D load can take a few seconds
