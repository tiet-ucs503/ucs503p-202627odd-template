import type { TravelStyle } from "@/types/itinerary";
import type { Place, PlaceType } from "@/types/place";

export interface PlaceSearchParams {
  /** A city name, e.g. "Bangkok". */
  destination: string;
  /** The country the destination is in, when known — improves query precision for a live provider. */
  country?: string;
  type: PlaceType;
  /** Biases the query text, so a food lover's attractions lean toward food. */
  preferences?: TravelStyle[];
  /** Restaurants only — narrows to places suited to that meal. */
  mealType?: "breakfast" | "lunch" | "dinner";
  /** Currency for any price estimate attached to a result. Defaults to "INR". */
  currency?: string;
  limit?: number;
  /**
   * Free-text the traveller typed, for the "find a real place" picker. When
   * present a live provider searches on this directly instead of building a
   * category query from `type`.
   */
  query?: string;
}

/**
 * Every travel-data source implements this one interface. The itinerary
 * generator and the search API route only ever talk to a `PlacesProvider`, so
 * switching providers (see `getPlacesProvider` in `./index.ts`) never requires
 * touching the generator, the plan, or the map.
 *
 * Implementations must not throw for ordinary "no results" cases: they return
 * an empty array. They throw `PlacesProviderError` only for genuine failures
 * (bad key, quota, network, malformed response), which callers surface to the
 * traveller. There is no stand-in content to fall back to.
 */
export interface PlacesProvider {
  /** `google` in the product. Tests use a double that calls itself `mock`. */
  readonly name: "mock" | "google";
  searchPlaces(params: PlaceSearchParams): Promise<Place[]>;
  /**
   * Re-fetch one place by the provider's own stable id. Used to refresh a
   * saved itinerary entry (coordinates, rating, website) without re-running
   * a whole search. Returns null when the id is unknown to the provider.
   */
  getPlaceDetails(providerPlaceId: string, options?: { currency?: string }): Promise<Place | null>;
}
