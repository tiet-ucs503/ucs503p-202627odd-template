import { fromInr } from "@/lib/fx";
import { signPhotoName } from "@/lib/server/photo-signing";
import {
  googlePlaceDetailsSchema,
  googleTextSearchResponseSchema,
  type GoogleRawPlace,
} from "@/lib/validation/places";
import type { ActivityCategory, TravelStyle } from "@/types/itinerary";
import type { Place, PlaceType, Rating } from "@/types/place";
import { TtlCache } from "./cache";
import { codeForHttpStatus, PlacesProviderError } from "./errors";
import type { PlaceSearchParams, PlacesProvider } from "./provider";

/**
 * Live provider backed by the Places API (New).
 *
 * `GOOGLE_PLACES_API_KEY` is a server-only env var (no `NEXT_PUBLIC_`
 * prefix). This class is only constructed by `getPlacesProvider()`, which is
 * only called from server code (the trip-generation and place-search API
 * routes), so the key never reaches the browser. Photo URLs are relative
 * links into `/api/places/photo`, which is the only other place the key is
 * ever attached to an outgoing request.
 *
 * What Google does and doesn't give us, and how that's represented:
 * - Identity, coordinates, address, rating, review count, website: real, used as-is.
 * - Price: only a coarse `priceLevel` enum, never an amount. Anything we show
 *   as a cost is derived from that enum and always flagged
 *   `price.isEstimate = true`. It is never presented as a Google price.
 * - Opening hours, live availability, bookability: not requested, not implied.
 */

const SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";
const DETAILS_URL = "https://places.googleapis.com/v1/";

/** Fields requested for search results. Kept tight — Places API bills per field group. */
const SEARCH_FIELDS = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.addressComponents",
  "places.location",
  "places.rating",
  "places.userRatingCount",
  "places.priceLevel",
  "places.googleMapsUri",
  "places.websiteUri",
  "places.editorialSummary",
  "places.types",
  "places.photos",
].join(",");

/** Same fields for a single-place lookup (no `places.` prefix on the details endpoint). */
const DETAILS_FIELDS = SEARCH_FIELDS.replaceAll("places.", "");

const PRICE_LEVEL_TO_INR: Record<string, number> = {
  PRICE_LEVEL_FREE: 0,
  PRICE_LEVEL_INEXPENSIVE: 500,
  PRICE_LEVEL_MODERATE: 1_500,
  PRICE_LEVEL_EXPENSIVE: 3_500,
  PRICE_LEVEL_VERY_EXPENSIVE: 7_000,
};

const CATEGORY_RULES: { types: string[]; category: ActivityCategory; styles: TravelStyle[] }[] = [
  { types: ["beach"], category: "beach", styles: ["beaches"] },
  { types: ["night_club", "bar"], category: "nightlife", styles: ["nightlife"] },
  { types: ["shopping_mall", "market", "store", "clothing_store"], category: "shopping", styles: ["shopping"] },
  {
    types: ["amusement_park", "hiking_area", "water_park", "zoo", "adventure_sports_center"],
    category: "adventure",
    styles: ["adventure"],
  },
  { types: ["spa"], category: "relaxation", styles: ["relaxation"] },
  { types: ["park", "national_park", "natural_feature"], category: "relaxation", styles: ["nature", "relaxation"] },
  {
    types: [
      "tourist_attraction",
      "museum",
      "art_gallery",
      "historical_landmark",
      "church",
      "hindu_temple",
      "buddhist_temple",
      "mosque",
      "synagogue",
      "history_museum",
    ],
    category: "culture",
    styles: ["culture"],
  },
  { types: ["restaurant", "cafe", "bakery", "food"], category: "food", styles: ["food"] },
];

function inferCategoryAndStyles(
  types: string[] | undefined,
  searchType: PlaceType,
): { category: ActivityCategory; styleTags: TravelStyle[] } {
  for (const rule of CATEGORY_RULES) {
    if (types?.some((t) => rule.types.includes(t))) {
      return { category: rule.category, styleTags: rule.styles };
    }
  }
  const fallback: Record<PlaceType, ActivityCategory> = {
    attraction: "sightseeing",
    restaurant: "food",
    nightlife: "nightlife",
    hotel: "sightseeing",
  };
  return { category: fallback[searchType], styleTags: [] };
}

function inferRating(raw: GoogleRawPlace): Rating | null {
  if (typeof raw.rating !== "number") return null;
  return { value: raw.rating, count: raw.userRatingCount ?? null };
}

function inferPrice(
  raw: GoogleRawPlace,
  currency: string,
  multiplier = 1,
): { amount: number; currency: string; isEstimate: true } | null {
  if (!raw.priceLevel || !(raw.priceLevel in PRICE_LEVEL_TO_INR)) return null;
  return { amount: fromInr(PRICE_LEVEL_TO_INR[raw.priceLevel] * multiplier, currency), currency, isEstimate: true };
}

/** Pull city/country out of Google's address components. Null when absent — never guessed. */
function inferPlaceArea(raw: GoogleRawPlace): { city: string | null; country: string | null } {
  const components = raw.addressComponents ?? [];
  const find = (type: string) => components.find((c) => c.types?.includes(type))?.longText ?? null;
  return {
    city: find("locality") ?? find("administrative_area_level_2") ?? find("administrative_area_level_1"),
    country: find("country"),
  };
}

/** A same-origin, signed link into the photo proxy. Null when photos can't be
 *  served (no key/secret) so the UI simply shows no image. */
function photoUrl(photoName: string | undefined): string | null {
  if (!photoName) return null;
  const signature = signPhotoName(photoName);
  if (!signature) return null;
  return `/api/places/photo?name=${encodeURIComponent(photoName)}&sig=${signature}`;
}

function buildQuery(params: PlaceSearchParams): string {
  if (params.query?.trim()) {
    const place = params.country ? `${params.destination}, ${params.country}` : params.destination;
    return `${params.query.trim()} in ${place}`;
  }
  const place = params.country ? `${params.destination}, ${params.country}` : params.destination;
  switch (params.type) {
    case "hotel":
      return `hotels in ${place}`;
    case "restaurant":
      return params.mealType ? `best ${params.mealType} restaurants in ${place}` : `best restaurants in ${place}`;
    case "nightlife":
      return `popular nightlife and bars in ${place}`;
    case "attraction":
    default: {
      const style = params.preferences?.[0];
      return style ? `top ${style} attractions in ${place}` : `top tourist attractions in ${place}`;
    }
  }
}

/**
 * Shared across requests in this server process. Trip generation issues six
 * searches per city, and regenerating a similar trip repeats them verbatim —
 * this keeps that from becoming six more billable calls every time.
 */
const searchCache = new TtlCache<Place[]>();
const detailsCache = new TtlCache<Place | null>();

export class GooglePlacesProvider implements PlacesProvider {
  readonly name = "google" as const;

  constructor(private readonly apiKey: string) {}

  async searchPlaces(params: PlaceSearchParams): Promise<Place[]> {
    const currency = params.currency ?? "INR";
    const limit = Math.min(params.limit ?? 10, 20);
    const textQuery = buildQuery(params);
    const cacheKey = JSON.stringify({ textQuery, limit, currency, type: params.type, meal: params.mealType });

    return searchCache.wrap(cacheKey, async () => {
      const json = await this.post(SEARCH_URL, SEARCH_FIELDS, {
        textQuery,
        maxResultCount: limit,
      });

      const parsed = googleTextSearchResponseSchema.safeParse(json);
      if (!parsed.success) {
        throw new PlacesProviderError(
          "malformed-response",
          "Places search response did not match the expected shape.",
          parsed.error,
        );
      }

      const hotelMultiplier = params.type === "hotel" ? 3 : 1;
      return (parsed.data.places ?? [])
        .filter((raw) => Boolean(raw.displayName?.text))
        .map((raw) => this.mapPlace(raw, params.type, currency, hotelMultiplier, params.mealType))
        .slice(0, limit);
    });
  }

  async getPlaceDetails(providerPlaceId: string, options?: { currency?: string }): Promise<Place | null> {
    const currency = options?.currency ?? "INR";
    // Accept both "places/ChIJ..." and a bare id.
    const resourceName = providerPlaceId.startsWith("places/") ? providerPlaceId : `places/${providerPlaceId}`;

    return detailsCache.wrap(`${resourceName}:${currency}`, async () => {
      let json: unknown;
      try {
        json = await this.get(`${DETAILS_URL}${resourceName}`, DETAILS_FIELDS);
      } catch (error) {
        // A stale/unknown id is a normal outcome, not a failure to report.
        if (error instanceof PlacesProviderError && error.code === "provider-error") return null;
        throw error;
      }

      const parsed = googlePlaceDetailsSchema.safeParse(json);
      if (!parsed.success) {
        throw new PlacesProviderError(
          "malformed-response",
          "Place details response did not match the expected shape.",
          parsed.error,
        );
      }
      if (!parsed.data.displayName?.text) return null;
      return this.mapPlace(parsed.data, "attraction", currency, 1, undefined);
    });
  }

  private async post(url: string, fieldMask: string, body: unknown): Promise<unknown> {
    return this.request(url, { method: "POST", body: JSON.stringify(body) }, fieldMask);
  }

  private async get(url: string, fieldMask: string): Promise<unknown> {
    return this.request(url, { method: "GET" }, fieldMask);
  }

  private async request(url: string, init: RequestInit, fieldMask: string): Promise<unknown> {
    let response: Response;
    try {
      response = await fetch(url, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": this.apiKey,
          "X-Goog-FieldMask": fieldMask,
        },
      });
    } catch (error) {
      throw new PlacesProviderError("network", "Could not reach the Places API.", error);
    }

    if (!response.ok) {
      // Read the body for server logs only — it can name the project/key, so
      // it must never travel back to the client.
      const detail = await response.text().catch(() => "");
      console.error(`[places] Google Places ${response.status}: ${detail.slice(0, 500)}`);
      throw new PlacesProviderError(
        codeForHttpStatus(response.status),
        `Places API responded with ${response.status}.`,
      );
    }

    try {
      return await response.json();
    } catch (error) {
      throw new PlacesProviderError("malformed-response", "Places API returned invalid JSON.", error);
    }
  }

  private mapPlace(
    raw: GoogleRawPlace,
    type: PlaceType,
    currency: string,
    priceMultiplier: number,
    mealType: PlaceSearchParams["mealType"],
  ): Place {
    const { category, styleTags } = inferCategoryAndStyles(raw.types, type);
    const { city, country } = inferPlaceArea(raw);
    const providerPlaceId = raw.id ?? null;

    return {
      id: providerPlaceId ? `google:${providerPlaceId}` : `google:${raw.displayName!.text}`,
      type,
      name: raw.displayName!.text,
      description: raw.editorialSummary?.text ?? "",
      category,
      styleTags,
      location: raw.location ? { lat: raw.location.latitude, lng: raw.location.longitude } : null,
      address: raw.formattedAddress ?? null,
      city,
      country,
      imageUrl: photoUrl(raw.photos?.[0]?.name),
      rating: inferRating(raw),
      price: inferPrice(raw, currency, priceMultiplier),
      durationMinutes: null,
      mealTypes: type === "restaurant" && mealType ? [mealType] : null,
      source: {
        provider: "google",
        providerPlaceId,
        sourceUrl: raw.googleMapsUri ?? raw.websiteUri ?? null,
        sourceName: raw.googleMapsUri ? "Google Maps" : raw.websiteUri ? "Official website" : null,
      },
      isDemoData: false,
    };
  }
}
