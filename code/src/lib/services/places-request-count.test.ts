import { describe, expect, it } from "vitest";
import { generateItinerary } from "@/lib/services/itinerary-generator";
import { MockPlacesProvider } from "@/test-support/places/mock-provider";
import type { PlaceSearchParams, PlacesProvider } from "@/lib/services/places/provider";
import type { Place } from "@/types/place";
import type { CityPlan } from "@/types/planning";
import type { TripDraftInput } from "@/types/trip";

/**
 * Guards the Places request budget.
 *
 * Every search here is a billable request against a daily quota in Google
 * mode, so the count per city is a number worth pinning down in a test rather
 * than rediscovering from a 429 in production.
 */
class CountingProvider implements PlacesProvider {
  readonly name = "mock" as const;
  readonly calls: PlaceSearchParams[] = [];
  private readonly inner = new MockPlacesProvider();

  async searchPlaces(params: PlaceSearchParams): Promise<Place[]> {
    this.calls.push(params);
    return this.inner.searchPlaces(params);
  }

  getPlaceDetails(providerPlaceId: string, options?: { currency?: string }) {
    return this.inner.getPlaceDetails(providerPlaceId, options);
  }
}

const draft: TripDraftInput = {
  destination: "Thailand",
  startDate: "2027-06-12",
  endDate: "2027-06-20",
  budget: 150_000,
  currency: "INR",
  travelers: 2,
  travelerType: "couple",
  preferences: ["culture", "food"],
};

const threeCityPlan: CityPlan = {
  destination: "Thailand",
  cities: [
    { name: "Bangkok", days: 3, reason: "" },
    { name: "Chiang Mai", days: 3, reason: "" },
    { name: "Phuket", days: 3, reason: "" },
  ],
  source: "ai",
  plannerVersion: "test",
};

describe("Places requests per trip", () => {
  it("makes four searches per city, not six", async () => {
    const provider = new CountingProvider();
    await generateItinerary(draft, threeCityPlan, undefined, provider);

    const byType = provider.calls.reduce<Record<string, number>>((acc, c) => {
      acc[c.type] = (acc[c.type] ?? 0) + 1;
      return acc;
    }, {});

    // One each of hotel / attraction / restaurant / nightlife, per city.
    expect(byType).toEqual({ hotel: 3, attraction: 3, restaurant: 3, nightlife: 3 });
    expect(provider.calls).toHaveLength(12);
  });

  it("no longer issues per-meal restaurant searches", async () => {
    const provider = new CountingProvider();
    await generateItinerary(draft, threeCityPlan, undefined, provider);

    const restaurantCalls = provider.calls.filter((c) => c.type === "restaurant");
    expect(restaurantCalls).toHaveLength(3);
    // The old shape issued three separate searches per city, one per meal.
    expect(restaurantCalls.every((c) => c.mealType === undefined)).toBe(true);
  });

  it("still fills the day's meal slots from the single search", async () => {
    const provider = new CountingProvider();
    const itinerary = await generateItinerary(draft, threeCityPlan, undefined, provider);

    for (const day of itinerary.days) {
      const food = day.activities.filter((a) => a.category === "food");
      // Two, not three: since the feasibility engine started sizing days, a
      // full-day excursion or a long transfer legitimately displaces one meal
      // rather than being scheduled on top of it. Lunch and dinner always
      // survive; breakfast is the one that gives way.
      expect(food.length).toBeGreaterThanOrEqual(2);
      // Dinner in particular is never displaced — the generator reserves it.
      expect(food.some((a) => a.time === "20:00")).toBe(true);
      // And no restaurant is reused within a single day.
      const names = food.map((a) => a.name);
      expect(new Set(names).size).toBe(names.length);
    }
  });

  it("skips lookups entirely for unchanged cities on a rebuild", async () => {
    const first = new CountingProvider();
    const original = await generateItinerary(draft, threeCityPlan, undefined, first);

    const rebuilt = new CountingProvider();
    await generateItinerary(
      draft,
      {
        ...threeCityPlan,
        cities: [
          { name: "Bangkok", days: 3, reason: "" },
          { name: "Chiang Mai", days: 3, reason: "" },
          { name: "Krabi", days: 3, reason: "" },
        ],
      },
      { cities: original.cities, days: original.days },
      rebuilt,
    );

    // Only the newly-added city costs anything.
    expect(rebuilt.calls).toHaveLength(4);
    expect(new Set(rebuilt.calls.map((c) => c.destination))).toEqual(new Set(["Krabi"]));
  });
});
