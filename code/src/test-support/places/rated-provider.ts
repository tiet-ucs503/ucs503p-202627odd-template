import { PlacesProviderError, type PlacesErrorCode } from "@/lib/services/places/errors";
import type { PlaceSearchParams, PlacesProvider } from "@/lib/services/places/provider";
import type { Place, PlaceType } from "@/types/place";

/**
 * TEST SUPPORT. A places provider whose results the test decides, with ratings,
 * so tests can check that the best places are the ones chosen and that a failing
 * provider is reported rather than papered over. Not importable from the product.
 */

let counter = 0;

export function ratedPlace(
  name: string,
  rating: number | null,
  reviews: number | null,
  overrides: Partial<Place> & { type?: PlaceType } = {},
): Place {
  counter += 1;
  return {
    id: `google:test-${counter}`,
    type: "attraction",
    name,
    description: "",
    category: "sightseeing",
    styleTags: [],
    location: { lat: 13.7 + counter / 1000, lng: 100.5 + counter / 1000 },
    address: `${name}, Test City`,
    city: "Test City",
    country: "Testland",
    imageUrl: null,
    rating: rating === null ? null : { value: rating, count: reviews },
    price: null,
    durationMinutes: null,
    mealTypes: null,
    source: { provider: "google", providerPlaceId: `test-${counter}`, sourceUrl: "https://maps.example/p", sourceName: "Google Maps" },
    isDemoData: false,
    ...overrides,
  };
}

export type RatedResults = Partial<Record<PlaceType, Place[]>>;

/** Answers each search with the list for its type, in the order given: like a provider that returns "best match first". */
export class RatedPlacesProvider implements PlacesProvider {
  readonly name = "google" as const;
  readonly searches: PlaceSearchParams[] = [];

  constructor(
    private readonly results: RatedResults,
    private readonly failWith?: PlacesErrorCode,
  ) {}

  async searchPlaces(params: PlaceSearchParams): Promise<Place[]> {
    this.searches.push(params);
    if (this.failWith) throw new PlacesProviderError(this.failWith, "test failure");
    const list = (this.results[params.type] ?? []).map((p) => ({ ...p, type: params.type }));
    const query = params.query?.toLowerCase();
    return query ? list.filter((p) => p.name.toLowerCase().includes(query.split(" ")[0])) : list;
  }

  async getPlaceDetails(): Promise<Place | null> {
    return null;
  }
}
