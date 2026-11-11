import type { ActivityCategory } from "@/types/itinerary";
import { verificationOf, type LatLng, type PlaceVerification, type Rating } from "@/types/place";
import type { Trip } from "@/types/trip";

/**
 * Turns a saved trip into the flat list of mappable points the map renders.
 *
 * Pure and provider-agnostic: the map never knows where a coordinate came
 * from, only that it exists. Places
 * without a real coordinate are simply not mapped — we never place a pin at
 * a guessed position to make the map look fuller.
 */

export type MapFilterMode = "all" | "city" | "day";

export interface MapFilter {
  mode: MapFilterMode;
  cityId: string | null;
  dayId: string | null;
}

export interface MapPoint {
  /** Activity id, or `hotel:<cityId>` for a city's hotel. Also the selection key. */
  id: string;
  kind: "activity" | "hotel";
  name: string;
  location: LatLng;
  cityId: string;
  cityName: string;
  dayId: string | null;
  dayNumber: number | null;
  category: ActivityCategory | null;
  estimatedCost: number | null;
  currency: string;
  verification: PlaceVerification;
  /** 1-based position within its day, used for the marker label and route order. */
  order: number | null;

  /**
   * Everything below is carried purely so a marker's detail card can be shown
   * without asking a provider anything. It is copied from the activity or
   * hotel the point came from — nothing here is looked up, derived or filled
   * in when the trip doesn't have it.
   */
  /** Scheduled clock time, e.g. "10:30". Hotels have none. */
  time: string | null;
  durationMinutes: number | null;
  rating: Rating | null;
  /** False only when the provider gave a verified price. */
  priceIsEstimate: boolean;
  address: string | null;
  /** A real, provider-supplied URL — never constructed. */
  referenceUrl: string | null;
  /** What that URL is, e.g. "Google Maps" or "Wikipedia". */
  sourceName: string | null;
}

export function buildMapPoints(trip: Trip): MapPoint[] {
  const cityById = new Map(trip.cities.map((c) => [c.id, c]));
  const points: MapPoint[] = [];

  for (const city of trip.cities) {
    if (city.hotel.location) {
      points.push({
        id: `hotel:${city.id}`,
        kind: "hotel",
        name: city.hotel.name,
        location: city.hotel.location,
        cityId: city.id,
        cityName: city.name,
        dayId: null,
        dayNumber: null,
        category: null,
        estimatedCost: city.hotel.pricePerNight,
        currency: city.hotel.currency,
        verification: verificationOf(city.hotel),
        order: null,
        time: null,
        durationMinutes: null,
        rating: city.hotel.rating ?? null,
        priceIsEstimate: city.hotel.priceIsEstimate !== false,
        address: city.hotel.address ?? null,
        referenceUrl: city.hotel.referenceUrl,
        sourceName: city.hotel.source?.sourceName ?? null,
      });
    }
  }

  for (const day of trip.days) {
    const city = cityById.get(day.cityId);
    day.activities.forEach((activity, index) => {
      if (!activity.location) return;
      points.push({
        id: activity.id,
        kind: "activity",
        name: activity.name,
        location: activity.location,
        cityId: day.cityId,
        cityName: city?.name ?? "",
        dayId: day.id,
        dayNumber: day.dayNumber,
        category: activity.category,
        estimatedCost: activity.estimatedCost,
        currency: activity.currency,
        verification: verificationOf(activity),
        order: index + 1,
        time: activity.time,
        durationMinutes: activity.durationMinutes > 0 ? activity.durationMinutes : null,
        rating: activity.rating ?? null,
        priceIsEstimate: activity.priceIsEstimate !== false,
        address: activity.address ?? null,
        referenceUrl: activity.referenceUrl,
        sourceName: activity.source?.sourceName ?? null,
      });
    });
  }

  return points;
}

export function filterMapPoints(points: MapPoint[], filter: MapFilter): MapPoint[] {
  switch (filter.mode) {
    case "city":
      return filter.cityId ? points.filter((p) => p.cityId === filter.cityId) : points;
    case "day":
      // A city's hotel has no day of its own, but it's where that day starts
      // and ends — keep it visible so a day's route makes sense.
      return filter.dayId
        ? points.filter(
            (p) => p.dayId === filter.dayId || (p.kind === "hotel" && p.cityId === filter.cityId),
          )
        : points;
    default:
      return points;
  }
}

/**
 * The ordered points for a single day, used to draw the itinerary-order line.
 * This is the order the traveller planned to visit them in — not a routed or
 * driveable path, and the UI says so.
 */
export function routeForDay(points: MapPoint[], dayId: string | null): MapPoint[] {
  if (!dayId) return [];
  return points
    .filter((p) => p.dayId === dayId && p.order !== null)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

/**
 * The city-to-city hops, as straight lines between city anchors.
 *
 * Drawn distinctly from a day's local order line, and explicitly not a route:
 * no routing provider is involved, so this is "Bangkok connects to Phuket",
 * not "here is how you drive there".
 */
export function cityTransferLines(points: MapPoint[], cities: { id: string; order: number }[]): MapPoint[][] {
  const ordered = [...cities].sort((a, b) => a.order - b.order);
  const anchorByCity = new Map<string, MapPoint>();

  for (const point of points) {
    // Prefer the hotel as a city's anchor; otherwise its first mapped stop.
    if (point.kind === "hotel") anchorByCity.set(point.cityId, point);
    else if (!anchorByCity.has(point.cityId)) anchorByCity.set(point.cityId, point);
  }

  const lines: MapPoint[][] = [];
  for (let i = 1; i < ordered.length; i++) {
    const from = anchorByCity.get(ordered[i - 1].id);
    const to = anchorByCity.get(ordered[i].id);
    if (from && to) lines.push([from, to]);
  }
  return lines;
}

/**
 * The DOM id of the roadmap row a map point corresponds to.
 *
 * The roadmap and the map identify a place by the same key (`MapPoint.id`),
 * and both need to turn it into an element id to scroll to. Keeping that
 * convention in one place stops the two drifting apart.
 */
export function roadmapElementId(pointId: string): string {
  return pointId.startsWith("hotel:")
    ? `hotel-${pointId.slice("hotel:".length)}`
    : `activity-${pointId}`;
}

/** How many itinerary entries couldn't be mapped, so the UI can say so honestly. */
export function countUnmappablePlaces(trip: Trip): number {
  const missingHotels = trip.cities.filter((c) => !c.hotel.location).length;
  const missingActivities = trip.days.reduce(
    (sum, day) => sum + day.activities.filter((a) => !a.location).length,
    0,
  );
  return missingHotels + missingActivities;
}
