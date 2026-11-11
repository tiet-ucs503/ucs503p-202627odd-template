import {
  DESTINATION_TEMPLATES,
  GENERIC_ACTIVITY_BANK,
  type ActivityTemplate,
  type CityTemplate,
} from "@/test-support/places/destinations";
import { fromInr } from "@/lib/fx";
import type { TravelStyle } from "@/types/itinerary";
import type { LatLng, Place, PlaceType } from "@/types/place";
import type { PlaceSearchParams, PlacesProvider } from "@/lib/services/places/provider";

/**
 * Offline, deterministic provider backed by the curated content in
 * `lib/mock-data/destinations.ts`. This is what the app runs on by default
 * and always falls back to — see `getPlacesProvider` in `./index.ts`.
 *
 * Real, publicly known coordinates for the curated Thailand landmarks are
 * attached here (not invented — these are well-established GPS positions
 * for famous, permanent landmarks). Nothing else in mock mode gets a
 * location, rating or image: we simply don't have verified data for it,
 * and inventing one would violate the product's "never fabricate" rule.
 */
const KNOWN_COORDINATES: Record<string, LatLng> = {
  "grand palace": { lat: 13.75, lng: 100.4913 },
  "wat pho": { lat: 13.7466, lng: 100.493 },
  "wat arun": { lat: 13.7437, lng: 100.4888 },
  "chatuchak weekend market": { lat: 13.7998, lng: 100.5501 },
  "damnoen saduak floating market": { lat: 13.5165, lng: 99.9539 },
  "jim thompson house": { lat: 13.7495, lng: 100.5283 },
  "lumphini park morning walk": { lat: 13.7307, lng: 100.5418 },
  "khao san road": { lat: 13.7589, lng: 100.4977 },
  "chinatown (yaowarat)": { lat: 13.7398, lng: 100.5077 },
  "patong beach": { lat: 7.8964, lng: 98.2963 },
  "phi phi islands day trip": { lat: 7.7407, lng: 98.7784 },
  "big buddha phuket": { lat: 7.8278, lng: 98.312 },
  "phuket old town walk": { lat: 7.8804, lng: 98.3923 },
  "kata beach": { lat: 7.8202, lng: 98.2966 },
  "wat chalong": { lat: 7.8464, lng: 98.3378 },
  "phang nga bay kayaking": { lat: 8.2833, lng: 98.5 },
  "bangla road nightlife": { lat: 7.8938, lng: 98.2964 },
};

function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

interface Area {
  city: string | null;
  country: string | null;
}

function templateToPlace(
  template: ActivityTemplate,
  type: PlaceType,
  currency: string,
  area: Area,
  mealTypes: ("breakfast" | "lunch" | "dinner")[] | null = null,
): Place {
  const providerPlaceId = slug(template.name);
  return {
    id: `mock:${providerPlaceId}`,
    type,
    name: template.name,
    description: template.description,
    category: template.category,
    styleTags: template.styles,
    location: KNOWN_COORDINATES[template.name.toLowerCase()] ?? null,
    address: null,
    city: area.city,
    country: area.country,
    imageUrl: null,
    rating: null,
    price: { amount: fromInr(template.estimatedCost, currency), currency, isEstimate: true },
    durationMinutes: template.durationMinutes,
    mealTypes,
    source: {
      provider: "mock",
      providerPlaceId,
      sourceUrl: template.referenceUrl,
      sourceName: template.referenceUrl ? "Wikipedia" : null,
    },
    isDemoData: template.isDemoData,
  };
}

function hotelTemplateToPlace(hotel: CityTemplate["hotel"], currency: string, area: Area): Place {
  const providerPlaceId = slug(hotel.name);
  return {
    id: `mock:${providerPlaceId}`,
    type: "hotel",
    name: hotel.name,
    description: "",
    category: "sightseeing",
    styleTags: [],
    location: null,
    address: null,
    city: area.city,
    country: area.country,
    imageUrl: null,
    rating: null,
    price: { amount: fromInr(hotel.pricePerNight, currency), currency, isEstimate: true },
    durationMinutes: null,
    mealTypes: null,
    source: { provider: "mock", providerPlaceId, sourceUrl: null, sourceName: null },
    isDemoData: true,
  };
}

function rankByPreference(places: Place[], preferences: TravelStyle[]): Place[] {
  return [...places].sort((a, b) => {
    const aScore = a.styleTags.filter((s) => preferences.includes(s)).length;
    const bScore = b.styleTags.filter((s) => preferences.includes(s)).length;
    return bScore - aScore;
  });
}

/** Every curated city across every curated destination, keyed by city name. */
const CITY_INDEX: Record<string, CityTemplate> = Object.values(DESTINATION_TEMPLATES)
  .flatMap((d) => d.cities)
  .reduce<Record<string, CityTemplate>>((acc, city) => {
    acc[city.name.toLowerCase()] = city;
    return acc;
  }, {});

function genericAttractions(preferences: TravelStyle[]): ActivityTemplate[] {
  const pool = Array.from(
    new Map(
      preferences
        .flatMap((style) => GENERIC_ACTIVITY_BANK[style] ?? [])
        .concat(Object.values(GENERIC_ACTIVITY_BANK).flat())
        .map((t) => [t.name, t] as const),
    ).values(),
  );
  return pool;
}

const GENERIC_HOTEL = (cityName: string): CityTemplate["hotel"] => ({
  name: `${cityName} Central Hotel (demo)`,
  pricePerNight: 3_500,
});

const GENERIC_BREAKFAST: ActivityTemplate = {
  name: "Breakfast at the hotel",
  category: "food",
  description: "Breakfast before heading out for the day.",
  estimatedCost: 400,
  durationMinutes: 45,
  referenceUrl: null,
  isDemoData: true,
  styles: [],
};

const GENERIC_LUNCH: ActivityTemplate = {
  name: "Local lunch",
  category: "food",
  description: "Lunch at a well-reviewed local restaurant.",
  estimatedCost: 700,
  durationMinutes: 60,
  referenceUrl: null,
  isDemoData: true,
  styles: [],
};

const GENERIC_DINNER: ActivityTemplate = {
  name: "Dinner in the city centre",
  category: "food",
  description: "Dinner at a popular local restaurant.",
  estimatedCost: 900,
  durationMinutes: 90,
  referenceUrl: null,
  isDemoData: true,
  styles: [],
};

const GENERIC_EVENING: ActivityTemplate = {
  name: "Evening stroll in the city centre",
  category: "sightseeing",
  description: "A relaxed evening walk through the main square or promenade.",
  estimatedCost: 0,
  durationMinutes: 90,
  referenceUrl: null,
  isDemoData: true,
  styles: [],
};

export class MockPlacesProvider implements PlacesProvider {
  readonly name = "mock" as const;

  async searchPlaces(params: PlaceSearchParams): Promise<Place[]> {
    const city = CITY_INDEX[params.destination.trim().toLowerCase()];
    const limit = params.limit ?? 10;

    const results = city
      ? this.searchCity(city, params, limit)
      : this.searchGeneric(params.destination, params, limit);

    // Free-text search (the "find a real place" picker) filters the curated
    // set by name — mock mode has no search engine, just this small catalogue.
    const query = params.query?.trim().toLowerCase();
    if (!query) return results;
    const matches = results.filter(
      (p) => p.name.toLowerCase().includes(query) || p.description.toLowerCase().includes(query),
    );
    return matches.length > 0 ? matches : results;
  }

  /** Look one curated place up by the id `searchPlaces` gave it. */
  async getPlaceDetails(providerPlaceId: string, options?: { currency?: string }): Promise<Place | null> {
    const currency = options?.currency ?? "INR";
    const wanted = providerPlaceId.replace(/^mock:/, "");

    for (const city of Object.values(CITY_INDEX)) {
      const area: Area = { city: city.name, country: city.country };
      const candidates: Place[] = [
        hotelTemplateToPlace(city.hotel, currency, area),
        templateToPlace(city.breakfast, "restaurant", currency, area, ["breakfast"]),
        ...city.lunch.map((t) => templateToPlace(t, "restaurant", currency, area, ["lunch"])),
        ...city.dinner.map((t) => templateToPlace(t, "restaurant", currency, area, ["dinner"])),
        ...city.attractions.map((t) => templateToPlace(t, "attraction", currency, area)),
        ...city.eveningSpots.map((t) => templateToPlace(t, "nightlife", currency, area)),
      ];
      const hit = candidates.find((p) => p.source.providerPlaceId === wanted);
      if (hit) return hit;
    }
    return null;
  }

  private searchCity(city: CityTemplate, params: PlaceSearchParams, limit: number): Place[] {
    const preferences = params.preferences ?? [];
    const currency = params.currency ?? "INR";
    const area: Area = { city: city.name, country: city.country };

    switch (params.type) {
      case "hotel":
        return [hotelTemplateToPlace(city.hotel, currency, area)];
      case "attraction":
        return rankByPreference(
          city.attractions.map((t) => templateToPlace(t, "attraction", currency, area)),
          preferences,
        ).slice(0, limit);
      case "nightlife":
        return city.eveningSpots.map((t) => templateToPlace(t, "nightlife", currency, area)).slice(0, limit);
      case "restaurant": {
        const all = [
          templateToPlace(city.breakfast, "restaurant", currency, area, ["breakfast"]),
          ...city.lunch.map((t) => templateToPlace(t, "restaurant", currency, area, ["lunch"])),
          ...city.dinner.map((t) => templateToPlace(t, "restaurant", currency, area, ["dinner"])),
        ];
        const filtered = params.mealType
          ? all.filter((p) => p.mealTypes?.includes(params.mealType!))
          : all;
        return (filtered.length > 0 ? filtered : all).slice(0, limit);
      }
      default:
        return [];
    }
  }

  private searchGeneric(destination: string, params: PlaceSearchParams, limit: number): Place[] {
    const preferences = params.preferences ?? [];
    const currency = params.currency ?? "INR";
    const area: Area = { city: destination, country: null };

    switch (params.type) {
      case "hotel":
        return [hotelTemplateToPlace(GENERIC_HOTEL(destination), currency, area)];
      case "attraction":
        return rankByPreference(
          genericAttractions(preferences).map((t) => templateToPlace(t, "attraction", currency, area)),
          preferences,
        ).slice(0, limit);
      case "nightlife":
        return [templateToPlace(GENERIC_EVENING, "nightlife", currency, area)];
      case "restaurant": {
        const all = [
          templateToPlace(GENERIC_BREAKFAST, "restaurant", currency, area, ["breakfast"]),
          templateToPlace(GENERIC_LUNCH, "restaurant", currency, area, ["lunch"]),
          templateToPlace(GENERIC_DINNER, "restaurant", currency, area, ["dinner"]),
        ];
        const filtered = params.mealType
          ? all.filter((p) => p.mealTypes?.includes(params.mealType!))
          : all;
        return (filtered.length > 0 ? filtered : all).slice(0, limit);
      }
      default:
        return [];
    }
  }
}
