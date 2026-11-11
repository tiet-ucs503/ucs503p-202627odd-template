"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import { ACTIVITY_CATEGORY_ICON } from "@/types/itinerary";
import { roadmapElementId, type MapPoint } from "@/lib/services/map-points";
import { isDarkPainted, subscribeToTheme } from "@/lib/theme";
import { PlaceCard } from "./place-card";

/**
 * The map. Loaded only on the client (see `trip-map.tsx`, which
 * `dynamic()`-imports this with `ssr: false`) because Leaflet touches
 * `window` at module scope.
 *
 * Tiles come from OpenStreetMap, which needs no API key — that's deliberate:
 * the map needs no credentials of any kind. Attribution is required by the tile providers' terms and is
 * rendered by Leaflet in the corner.
 */

/**
 * OpenStreetMap's standard tiles: genuinely keyless, unlike CARTO's basemaps,
 * which now return an "API KEY REQUIRED" watermark. There's no official dark
 * variant, so dark mode dims the light tiles in CSS (see `globals.css`)
 * rather than pulling in a second, key-gated provider.
 *
 * OSM's tile usage policy expects light, attributed use — fine for this app's
 * scale. A production deployment with real traffic should move to a paid tile
 * host (and only the two constants here would change).
 */
const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/** How long the "use Ctrl to zoom" nudge stays up after a plain wheel. */
const SCROLL_HINT_MS = 1600;
/** Ignore wheel bursts closer together than this, so one flick is one zoom. */
const ZOOM_THROTTLE_MS = 120;

/**
 * Marker colours by what the place *is*, so a day's food stops read
 * differently from its sights at a glance.
 */
const MARKER_COLOR = {
  attraction: "#ea580c",
  restaurant: "#e11d48",
  hotel: "#4f46e5",
  selected: "#c2410c",
} as const;

function markerKind(point: MapPoint): keyof Omit<typeof MARKER_COLOR, "selected"> {
  if (point.kind === "hotel") return "hotel";
  return point.category === "food" ? "restaurant" : "attraction";
}

/** Which theme is painted is external state (the person's choice, or their
 *  device), so it's read through the store API rather than mirrored into React
 *  state inside an effect. */
function useIsDark(): boolean {
  return useSyncExternalStore(subscribeToTheme, isDarkPainted, () => false);
}

/**
 * Custom `divIcon` markers rather than Leaflet's default image pins: the
 * default icons need bundler-specific asset wiring to load at all, and these
 * carry more information anyway (order number, category, selected state).
 */
function markerIcon(point: MapPoint, selected: boolean): L.DivIcon {
  const label =
    point.kind === "hotel"
      ? "🏨"
      : point.order !== null
        ? String(point.order)
        : ACTIVITY_CATEGORY_ICON[point.category ?? "sightseeing"];
  const size = selected ? 34 : 26;
  const style = [
    "display:flex",
    "align-items:center",
    "justify-content:center",
    "border-radius:9999px",
    "font-weight:700",
    "font-family:ui-sans-serif,system-ui,sans-serif",
    "border:2px solid #fff",
    "color:#fff",
    `width:${size}px`,
    `height:${size}px`,
    `font-size:${selected ? 14 : 12}px`,
    `background:${selected ? MARKER_COLOR.selected : MARKER_COLOR[markerKind(point)]}`,
    selected
      ? "box-shadow:0 0 0 4px rgba(234,88,12,.35),0 2px 8px rgba(0,0,0,.3)"
      : "box-shadow:0 2px 8px rgba(0,0,0,.25)",
  ].join(";");

  return L.divIcon({
    className: "tripease-marker",
    // The label is decorative: the accessible name lives on the focusable
    // element Leaflet creates, set in `AccessibleMarker` below. Marking this
    // inner node hidden stops the name being announced twice.
    //
    // Nothing here interpolates provider- or traveller-supplied text, so
    // there is no string to escape — the label is a digit or a fixed emoji.
    html: `<div style="${style}" aria-hidden="true">${label}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

/**
 * A marker that a keyboard or screen-reader user can actually use.
 *
 * Leaflet already makes markers tabbable and fires a click on Enter, but the
 * element it creates is a bare `<div tabindex="0">` with no role and no name,
 * which announces as nothing. The semantics have to go on that element rather
 * than on the icon's inner HTML, because that element is the one that takes
 * focus — so they're applied through the marker instance once it exists.
 */
function AccessibleMarker({
  point,
  selected,
  onSelect,
}: {
  point: MapPoint;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const markerRef = useRef<L.Marker | null>(null);

  const description =
    point.dayNumber !== null
      ? `${point.name} — day ${point.dayNumber}, ${point.cityName}`
      : `${point.name} — ${point.cityName}`;

  useEffect(() => {
    const element = markerRef.current?.getElement();
    if (!element) return;

    element.setAttribute("role", "button");
    element.setAttribute("aria-label", description);
    element.setAttribute("aria-pressed", String(selected));
    element.setAttribute("title", description);

    // Leaflet handles Enter itself; Space is expected of anything with a
    // button role, so it's added here rather than left to surprise people.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== " " && event.key !== "Spacebar") return;
      event.preventDefault();
      onSelect(point.id);
    };
    element.addEventListener("keydown", onKeyDown);
    return () => element.removeEventListener("keydown", onKeyDown);
  }, [description, selected, onSelect, point.id]);

  return (
    <Marker
      ref={markerRef}
      position={[point.location.lat, point.location.lng]}
      icon={markerIcon(point, selected)}
      // Selected sits above its neighbours, and the day's order is preserved
      // underneath so earlier stops aren't buried by later ones.
      zIndexOffset={selected ? 1000 : (point.order ?? 0) * -1}
      eventHandlers={{ click: () => onSelect(point.id) }}
    />
  );
}

/**
 * Keeps the viewport fitted to whatever is currently filtered in.
 *
 * Leaflet measures its container once at mount and caches that size. This map
 * lives in a sticky column that can still be laid out (or hidden entirely on
 * mobile) at that moment, so it can easily mount at 0×0 — in which case
 * `fitBounds` computes a nonsense zoom. The ResizeObserver both re-measures
 * and re-fits once the container actually has a size, which is what makes the
 * map correct on first paint rather than only after a manual pan.
 */
function AutoViewport({
  points,
  selectedId,
  fitKey,
}: {
  points: MapPoint[];
  selectedId: string | null;
  /** Changes when the traveller switches filter — an explicit request to refit. */
  fitKey: string;
}) {
  const map = useMap();
  // Lets the resize observer below read the current selection without
  // re-subscribing every time that selection changes.
  const selectedRef = useRef(selectedId);
  useEffect(() => {
    selectedRef.current = selectedId;
  }, [selectedId]);

  const fit = useCallback(() => {
    if (points.length === 0) return;
    const size = map.getSize();
    if (size.x === 0 || size.y === 0) return;
    const bounds = L.latLngBounds(points.map((p) => [p.location.lat, p.location.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14, animate: false });
  }, [map, points]);

  useEffect(() => {
    // While something is selected, leave the viewport alone — refitting would
    // fight with the centring below every time the selection changes.
    if (selectedId) return;
    fit();
  }, [fit, selectedId]);

  // Switching filter is an explicit "show me this set" request, so it refits
  // even with a marker selected — otherwise the map would stay zoomed in on
  // the old selection while the marker set underneath it had changed.
  useEffect(() => {
    fit();
    // `fit` is intentionally not a dependency: this must run on filter changes
    // only, not every time the points array is rebuilt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey]);

  useEffect(() => {
    const observer = new ResizeObserver(() => {
      map.invalidateSize({ animate: false });
      if (!selectedRef.current) fit();
    });
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map, fit]);

  return null;
}

/**
 * Centres on the selected point, wherever the selection came from.
 *
 * Deliberately not animated: Leaflet's animated moves (`flyTo`) drive
 * themselves with `requestAnimationFrame`, which browsers throttle in
 * backgrounded or occluded tabs — the animation then never advances and the
 * map silently stays put. Centring is core to the roadmap↔map link, so it
 * uses the deterministic path instead of a prettier one that can no-op.
 */
function FocusSelected({ points, selectedId }: { points: MapPoint[]; selectedId: string | null }) {
  const map = useMap();
  const pointsRef = useRef(points);
  useEffect(() => {
    pointsRef.current = points;
  }, [points]);

  useEffect(() => {
    if (!selectedId) return;
    const point = pointsRef.current.find((p) => p.id === selectedId);
    if (!point) return;
    map.setView([point.location.lat, point.location.lng], Math.max(map.getZoom(), 14), { animate: false });
    // Depends on the selection only, deliberately: re-centring whenever the
    // points array was rebuilt would undo the refit that a filter change just
    // performed, leaving the map zoomed in on a stale selection.
  }, [map, selectedId]);

  return null;
}

/**
 * Wheel behaves the way an embedded map should: the page keeps scrolling, and
 * zooming is something you opt into with Ctrl (or ⌘).
 *
 * A map that swallows the wheel traps the reader halfway down the page, which
 * is why Leaflet's `scrollWheelZoom` is off. But silently ignoring the wheel
 * is confusing on its own, so a plain scroll over the map explains how to zoom
 * and then gets out of the way.
 *
 * Deliberately not a scroll lock: the plain-wheel path never calls
 * `preventDefault`, so the page scrolls exactly as it would over any other
 * element. Only the Ctrl path prevents the default, and only to stop the
 * browser zooming the whole page while the traveller zooms the map.
 */
function WheelZoom({ onPlainWheel }: { onPlainWheel: () => void }) {
  const map = useMap();
  const lastZoomAt = useRef(0);

  useEffect(() => {
    const container = map.getContainer();

    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) {
        // Let the page scroll, and say how to zoom instead.
        onPlainWheel();
        return;
      }

      // Ctrl+wheel is the browser's page-zoom gesture; over the map it means
      // "zoom the map", so the page-level default has to be suppressed.
      event.preventDefault();

      const now = Date.now();
      if (now - lastZoomAt.current < ZOOM_THROTTLE_MS) return;
      lastZoomAt.current = now;

      // Zoom around the cursor rather than the centre, so the place under the
      // pointer stays under the pointer.
      const anchor = map.mouseEventToLatLng(event);
      map.setZoomAround(anchor, map.getZoom() + (event.deltaY < 0 ? 1 : -1));
    };

    // Passive listeners can't call `preventDefault`, which the Ctrl path needs.
    container.addEventListener("wheel", onWheel, { passive: false });
    return () => container.removeEventListener("wheel", onWheel);
  }, [map, onPlainWheel]);

  return null;
}

export default function LeafletMap({
  points,
  routePoints,
  transferLines = [],
  selectedId,
  onSelect,
  fitKey,
}: {
  points: MapPoint[];
  routePoints: MapPoint[];
  transferLines?: MapPoint[][];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  fitKey: string;
}) {
  const dark = useIsDark();
  const [showScrollHint, setShowScrollHint] = useState(false);
  const hintTimer = useRef(0);

  const selectedPoint = useMemo(
    () => points.find((p) => p.id === selectedId) ?? null,
    [points, selectedId],
  );

  const center = useMemo<[number, number]>(() => {
    if (points.length === 0) return [13.7563, 100.5018];
    return [points[0].location.lat, points[0].location.lng];
  }, [points]);

  const routeLine = useMemo(
    () => routePoints.map((p) => [p.location.lat, p.location.lng] as [number, number]),
    [routePoints],
  );

  const nudgeAboutZooming = useCallback(() => {
    setShowScrollHint(true);
    window.clearTimeout(hintTimer.current);
    hintTimer.current = window.setTimeout(() => setShowScrollHint(false), SCROLL_HINT_MS);
  }, []);

  useEffect(() => () => window.clearTimeout(hintTimer.current), []);

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={center}
        zoom={12}
        // Wheel zooming is handled by `WheelZoom`, which requires Ctrl — see
        // its docstring for why the page keeps its scroll.
        scrollWheelZoom={false}
        className={`h-full w-full rounded-2xl ${dark ? "tripease-map-dark" : ""}`}
        style={{ background: dark ? "#18181b" : "#f4f4f5" }}
      >
        <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />

        {/* City-to-city hops: long, straight, and visually unlike a day's order
            line — these are connections, not routes. */}
        {transferLines.map((line, index) => (
          <Polyline
            key={`transfer-${index}`}
            positions={line.map((p) => [p.location.lat, p.location.lng] as [number, number])}
            pathOptions={{ color: "#0ea5e9", weight: 2, opacity: 0.5, dashArray: "2 10" }}
          />
        ))}

        {routeLine.length > 1 ? (
          <Polyline
            positions={routeLine}
            pathOptions={{ color: "#ea580c", weight: 3, opacity: 0.6, dashArray: "6 8" }}
          />
        ) : null}

        {points.map((point) => (
          <AccessibleMarker
            key={point.id}
            point={point}
            selected={point.id === selectedId}
            onSelect={onSelect}
          />
        ))}

        {/*
          A standalone popup driven by the selection, rather than one bound to
          each marker: selecting from the roadmap has to open the same card as
          clicking the marker, and there is only ever one open.

          `autoPan` is what keeps the card on screen — on the short map panel
          used at mobile widths the card would otherwise be clipped by the top
          edge. Leaflet pans as far as it usefully can and stops, so a card
          taller than the map degrades to "showing the top of it" rather than
          scrolling off entirely.
        */}
        {selectedPoint ? (
          <Popup
            position={[selectedPoint.location.lat, selectedPoint.location.lng]}
            className="tripease-popup"
            // The card carries its own close control and its own chrome.
            closeButton={false}
            maxWidth={280}
            minWidth={260}
            autoPan
            autoPanPadding={[16, 16]}
            offset={[0, -18]}
            eventHandlers={{ remove: () => onSelect(null) }}
          >
            <PlaceCard
              point={selectedPoint}
              onClose={() => onSelect(null)}
              onViewActivity={() => {
                document
                  .getElementById(roadmapElementId(selectedPoint.id))
                  ?.scrollIntoView({ behavior: "smooth", block: "center" });
              }}
            />
          </Popup>
        ) : null}

        <AutoViewport points={points} selectedId={selectedId} fitKey={fitKey} />
        <FocusSelected points={points} selectedId={selectedId} />
        <WheelZoom onPlainWheel={nudgeAboutZooming} />
      </MapContainer>

      {/*
        Mouse-only affordance: a wheel event is something only a pointing
        device produces, so this is hidden from assistive technology rather
        than announced to people who can never trigger it. `pointer-events`
        stays off so it can't swallow a click on whatever is underneath.
      */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 z-[500] flex items-center justify-center transition-opacity duration-200 ${
          showScrollHint ? "opacity-100" : "opacity-0"
        }`}
      >
        <span className="rounded-full bg-zinc-900/75 px-3.5 py-1.5 text-xs font-medium text-white shadow-lg backdrop-blur-sm">
          Use Ctrl + scroll to zoom the map
        </span>
      </div>
    </div>
  );
}
