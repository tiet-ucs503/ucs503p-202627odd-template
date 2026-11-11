import type { ActivityCategory, TravelStyle } from "./itinerary";

/**
 * The travel-data model shared by every places provider.
 * `lib/services/places/*` is the only code that produces `Place` values;
 * the itinerary generator converts them into `Activity`/`Hotel` records
 * (see `placeToActivity`/`placeToHotel` in `itinerary-generator.ts`), and
 * nothing downstream of that needs to know which provider a place came from.
 */

export type PlaceType = "attraction" | "restaurant" | "hotel" | "nightlife";

export interface LatLng {
  lat: number;
  lng: number;
}

/** Never fabricated: null when the provider doesn't supply a real rating. */
export interface Rating {
  value: number;
  count: number | null;
}

/**
 * A cost estimate attached to a place. `isEstimate` is true for every value in
 * this app today (a provider like Google Places only ever returns a coarse
 * `priceLevel` enum, never an exact amount), and it exists so the UI can say
 * "estimated" rather than imply a verified, bookable price.
 */
export interface PriceInfo {
  amount: number;
  currency: string;
  isEstimate: boolean;
}

/**
 * Where a place's data came from, so the UI can show real provenance.
 * This travels with a place all the way into the saved itinerary, which is
 * what lets an edit later tell "same real place, new price" apart from
 * "the traveller replaced this with something else entirely".
 */
export interface SourceRef {
  /**
   * `google` for every place TripEase finds. `mock` is only ever read, from trips
   * saved by an earlier version that had built-in sample places; nothing writes it.
   */
  provider: "mock" | "google";
  /**
   * The provider's own stable id for this place (a Google `places/…` id).
   * The single home for the provider place id — `Place.id` is the
   * app-namespaced form of the same thing (`google:<providerPlaceId>`), so
   * storing it twice would just invite the two copies to drift apart.
   *
   * Optional because trips saved before this field existed simply don't have
   * it; providers always populate it.
   */
  providerPlaceId?: string | null;
  /** A real, working URL (e.g. a Wikipedia article or Google Maps place page). Never fabricated. */
  sourceUrl: string | null;
  /** Human-readable label for the source, e.g. "Wikipedia" or "Google Places". */
  sourceName: string | null;
}

export interface Place {
  /** Provider-namespaced, e.g. "google:ChIJ...". */
  id: string;
  type: PlaceType;
  name: string;
  description: string;
  category: ActivityCategory;
  /** Coarse travel-style tags used to rank places against the traveller's preferences. */
  styleTags: TravelStyle[];
  location: LatLng | null;
  /** Provider-supplied formatted address. Null when the provider has none — never guessed. */
  address: string | null;
  /** Parsed from the provider's address components where available, else null. */
  city: string | null;
  country: string | null;
  /** Relative URL into this app's image proxy (see `/api/places/photo`), never a raw provider URL with a key attached. */
  imageUrl: string | null;
  rating: Rating | null;
  price: PriceInfo | null;
  durationMinutes: number | null;
  /** Restaurants only: which itinerary meal slots this place suits. */
  mealTypes: ("breakfast" | "lunch" | "dinner")[] | null;
  source: SourceRef;
  /**
   * True when the place is not backed by a real source: something the traveller
   * typed in, or sample content in a trip saved by an earlier version. Always
   * false for a place found by the places provider. (The name is kept because it
   * is stored on every saved trip.)
   */
  isDemoData: boolean;
}

export type Attraction = Place & { type: "attraction" };
export type Restaurant = Place & { type: "restaurant" };
export type HotelPlace = Place & { type: "hotel" };

/**
 * How much of a place is real-world verified. Derived rather than stored:
 * a second persisted "verified" boolean alongside `isDemoData` could drift
 * out of sync with it, and there'd be no way to tell which one was right.
 *
 * - `live`       a real place fetched from a live provider (Google Places).
 * - `cited`      a place whose source link points at a real page.
 * - `unverified` something the traveller typed in, or sample content from a trip
 *                saved by an earlier version.
 */
export type PlaceVerification = "live" | "cited" | "unverified";

export function verificationOf(input: {
  isDemoData: boolean;
  source?: SourceRef | null;
}): PlaceVerification {
  if (input.isDemoData) return "unverified";
  if (input.source?.provider === "google") return "live";
  return input.source?.sourceUrl ? "cited" : "unverified";
}
