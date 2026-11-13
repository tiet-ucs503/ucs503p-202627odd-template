import { describe, expect, it } from "vitest";
import { quoteFlights } from "@/lib/flights/quote";
import { fromInr } from "@/lib/fx";
import { generateItinerary } from "@/lib/services/itinerary-generator";
import { PlacesProviderError } from "@/lib/services/places/errors";
import type { CityPlan } from "@/types/planning";
import type { TripDraftInput } from "@/types/trip";
import { ratedPlace, RatedPlacesProvider, type RatedResults } from "@/test-support/places/rated-provider";

/**
 * The generator builds a trip from real places only. These tests use a provider
 * that returns rated places the way Google does, and check three things: the best
 * places are the ones chosen, a failing or empty provider is reported and never
 * filled with invented content, and nothing in a generated trip is flagged demo.
 */

const draft: TripDraftInput = {
  destination: "Testland",
  startDate: "2027-03-01",
  endDate: "2027-03-04",
  budget: 100_000,
  currency: "INR",
  travelers: 2,
  travelerType: "couple",
  preferences: ["culture"],
};

const plan = (cities: { name: string; days: number }[]): CityPlan => ({
  destination: "Testland",
  cities: cities.map((c) => ({ ...c, reason: "test" })),
  source: "ai",
  plannerVersion: "test",
  fallbackReason: null,
});

const oneCity = plan([{ name: "Testville", days: 4 }]);

const attractions = () => [
  ratedPlace("Hidden Gem Museum", 5.0, 12),
  ratedPlace("Old Fort", 4.4, 5_000),
  ratedPlace("Grand Temple", 4.8, 40_000),
  ratedPlace("Riverside Park", 4.5, 9_000),
  ratedPlace("City Market", 4.2, 3_000),
  ratedPlace("Art Gallery", 4.6, 7_000),
  ratedPlace("Lookout Hill", 4.7, 15_000),
  ratedPlace("Old Quarter Walk", 4.3, 2_000),
];

const hotels = () => [ratedPlace("Fine Hotel", 4.6, 4_000, { type: "hotel" })];
const restaurants = () => Array.from({ length: 9 }, (_, i) => ratedPlace(`Restaurant ${i}`, 4.0 + i / 20, 800 + i * 100, { type: "restaurant", category: "food" }));
const results = (over: RatedResults = {}): RatedResults => ({
  attraction: attractions(),
  hotel: hotels(),
  restaurant: restaurants(),
  nightlife: [ratedPlace("Jazz Bar", 4.4, 600, { type: "nightlife", category: "nightlife" })],
  ...over,
});

const allActivities = (itinerary: Awaited<ReturnType<typeof generateItinerary>>) => itinerary.days.flatMap((d) => d.activities);

describe("a trip built from real places", () => {
  it("is made of the places the provider returned, with their real data", async () => {
    const itinerary = await generateItinerary(draft, oneCity, undefined, new RatedPlacesProvider(results()));
    const sights = allActivities(itinerary).filter((a) => a.name === "Grand Temple");
    expect(sights.length).toBeGreaterThan(0);
    expect(sights[0].rating).toEqual({ value: 4.8, count: 40_000 });
    expect(sights[0].source?.provider).toBe("google");
    expect(sights[0].location).not.toBeNull();
  });

  it("flags nothing as demo, including the travel between cities", async () => {
    const itinerary = await generateItinerary(
      draft,
      plan([
        { name: "Testville", days: 2 },
        { name: "Otherton", days: 2 },
      ]),
      undefined,
      new RatedPlacesProvider(results()),
    );
    expect(allActivities(itinerary).some((a) => a.isDemoData)).toBe(false);
    expect(itinerary.cities.some((c) => c.hotel.isDemoData)).toBe(false);
    const transfer = allActivities(itinerary).find((a) => a.category === "transport");
    expect(transfer?.priceIsEstimate).toBe(true);
  });

  it("never names a hotel or place that the provider did not return", async () => {
    const provider = new RatedPlacesProvider(results());
    const itinerary = await generateItinerary(draft, oneCity, undefined, provider);
    const known = new Set(
      [...(results().attraction ?? []), ...(results().restaurant ?? []), ...(results().nightlife ?? []), ...(results().hotel ?? [])].map((p) => p.name),
    );
    for (const a of allActivities(itinerary)) {
      if (a.category === "transport") continue;
      expect(known.has(a.name), `${a.name} is not a place the provider returned`).toBe(true);
    }
    expect(known.has(itinerary.cities[0].hotel.name)).toBe(true);
    expect(JSON.stringify(itinerary)).not.toMatch(/\(demo\)|Central Hotel|Breakfast at the hotel/);
  });
});

describe("choosing the best", () => {
  it("builds the trip from the best-rated sights, and leaves the weaker ones out", async () => {
    // Four days have room for about eight sights. Twelve come back, four of them clearly worse
    // and one of them far from the rest, where a day's grouping would otherwise seed from it.
    const strong = attractions();
    const weak = ["Dull Square", "Empty Mall", "Closed Pier", "Roadside Stall"].map((name, i) =>
      ratedPlace(name, 3.0, 4_000, i === 0 ? { location: { lat: 14.5, lng: 101.5 } } : {}),
    );
    const itinerary = await generateItinerary(draft, oneCity, undefined, new RatedPlacesProvider(results({ attraction: [...weak, ...strong] })));
    const used = allActivities(itinerary).map((a) => a.name);
    for (const name of ["Dull Square", "Empty Mall", "Closed Pier", "Roadside Stall"]) expect(used).not.toContain(name);
    expect(used).toContain("Grand Temple");
    expect(used).toContain("Lookout Hill");
  });

  it("uses a sight at most once on a day", async () => {
    const itinerary = await generateItinerary(draft, oneCity, undefined, new RatedPlacesProvider(results()));
    for (const day of itinerary.days) {
      const names = day.activities.map((a) => a.name);
      expect(new Set(names).size).toBe(names.length);
    }
  });

  it("chooses the best-rated hotel that fits the budget", async () => {
    const provider = new RatedPlacesProvider(
      results({
        hotel: [
          ratedPlace("Palace Hotel", 4.9, 9_000, { type: "hotel", price: { amount: 60_000, currency: "INR", isEstimate: true } }),
          ratedPlace("Comfort Inn", 4.5, 3_000, { type: "hotel", price: { amount: 4_000, currency: "INR", isEstimate: true } }),
          ratedPlace("Cheap Stay", 3.9, 200, { type: "hotel", price: { amount: 800, currency: "INR", isEstimate: true } }),
        ],
      }),
    );
    const itinerary = await generateItinerary({ ...draft, budget: 80_000 }, oneCity, undefined, provider);
    expect(itinerary.cities[0].hotel.name).toBe("Comfort Inn");
  });

  it("labels the hotel's price as an estimate, since Google gives only a price level", async () => {
    const itinerary = await generateItinerary(draft, oneCity, undefined, new RatedPlacesProvider(results()));
    expect(itinerary.cities[0].hotel.priceIsEstimate).toBe(true);
  });

  it("asks the provider for the full page of results, so the best can be picked from many", async () => {
    const provider = new RatedPlacesProvider(results());
    await generateItinerary(draft, oneCity, undefined, provider);
    const byType = Object.fromEntries(provider.searches.map((s) => [s.type, s.limit]));
    expect(byType.attraction).toBe(20);
    expect(byType.restaurant).toBe(20);
    expect(byType.hotel).toBeGreaterThanOrEqual(10);
  });
});

describe("when the places service cannot help", () => {
  it.each(["quota-exceeded", "network", "invalid-key", "provider-error", "malformed-response"] as const)(
    "reports a %s failure instead of building a trip from anything else",
    async (code) => {
      await expect(generateItinerary(draft, oneCity, undefined, new RatedPlacesProvider(results(), code))).rejects.toMatchObject({
        name: "PlacesProviderError",
        code,
      });
    },
  );

  it("reports a city with no hotels", async () => {
    const error = await generateItinerary(draft, oneCity, undefined, new RatedPlacesProvider(results({ hotel: [] }))).catch((e) => e);
    expect(error).toBeInstanceOf(PlacesProviderError);
    expect(error.code).toBe("no-results");
    expect(error.message).toMatch(/No hotels were found in Testville/);
  });

  it("reports a city with nothing to see, which is almost always a name the service does not know", async () => {
    const error = await generateItinerary(draft, oneCity, undefined, new RatedPlacesProvider(results({ attraction: [] }))).catch((e) => e);
    expect(error).toBeInstanceOf(PlacesProviderError);
    expect(error.code).toBe("no-results");
    expect(error.message).toMatch(/Nothing to see was found in Testville/);
  });

  it("is happy with no restaurants or nightlife: the days are lighter, not filled with invented meals", async () => {
    const itinerary = await generateItinerary(draft, oneCity, undefined, new RatedPlacesProvider(results({ restaurant: [], nightlife: [] })));
    expect(allActivities(itinerary).some((a) => a.category === "food")).toBe(false);
    expect(allActivities(itinerary).filter((a) => a.category !== "transport").length).toBeGreaterThan(0);
    expect(JSON.stringify(itinerary)).not.toMatch(/Local lunch|Dinner in the city centre/);
  });
});

describe("hotel nights", () => {
  const nightsOf = async (input: TripDraftInput, cityPlan: CityPlan) => {
    const itinerary = await generateItinerary(input, cityPlan, undefined, new RatedPlacesProvider(results()));
    return itinerary.cities.map((c) => c.hotel.nights);
  };

  it("charges no night in the last city when the trip ends there the same day it arrives", async () => {
    const threeDays = { ...draft, endDate: "2027-03-03" };
    const twoCities = plan([
      { name: "Testville", days: 2 },
      { name: "Otherton", days: 1 },
    ]);
    expect(await nightsOf(threeDays, twoCities)).toEqual([2, 0]);
  });

  it("charges no night for a one-day trip", async () => {
    const oneDay = { ...draft, endDate: "2027-03-01" };
    expect(await nightsOf(oneDay, plan([{ name: "Testville", days: 1 }]))).toEqual([0]);
  });

  it("charges one night fewer than the days in total", async () => {
    const threeDays = { ...draft, endDate: "2027-03-03" };
    const nights = await nightsOf(threeDays, plan([{ name: "Testville", days: 3 }]));
    expect(nights).toEqual([2]);
  });
});

describe("flights in the budget", () => {
  // Quoted as of a fixed day, so the fare doesn't depend on when the tests run.
  const thailand: TripDraftInput = { ...draft, destination: "Thailand", origin: "BOM", quotedOn: "2026-11-13" };
  const build = (input: TripDraftInput, cities = oneCity) =>
    generateItinerary(input, cities, undefined, new RatedPlacesProvider(results()));

  it("budgets the quoted fare for every traveller, and keeps the quote", async () => {
    const itinerary = await build(thailand);
    const expected = quoteFlights({
      origin: "BOM",
      destination: "Thailand",
      firstCity: "Testville",
      startDate: draft.startDate,
      travelers: 2,
      now: new Date("2026-11-13T12:00:00Z"),
    })!;
    expect(itinerary.flights).toEqual(expected);
    expect(itinerary.flights?.quotedOn).toBe("2026-11-13");
    expect(itinerary.budget.categories.flights).toBe(expected.totalInr);
    expect(expected.totalInr).toBe(expected.perTravelerInr.typical * 2);
  });

  it("flies into the airport of the first city", async () => {
    const itinerary = await build(
      { ...thailand, destination: "Japan" },
      plan([{ name: "Kyoto", days: 2 }, { name: "Tokyo", days: 2 }]),
    );
    expect(itinerary.flights?.arrival?.code).toBe("KIX");
  });

  it("prices a trip inside India as a domestic flight, or nothing when it starts at home", async () => {
    const goa = await build({ ...thailand, destination: "India" }, plan([{ name: "Goa", days: 4 }]));
    expect(goa.flights?.arrival?.code).toBe("GOI");
    expect(goa.budget.categories.flights).toBeGreaterThan(10_000);

    const home = await build({ ...thailand, destination: "India", origin: "DEL" }, plan([{ name: "Delhi", days: 4 }]));
    expect(home.budget.categories.flights).toBe(0);
    expect(home.flights?.basis).toMatch(/no flight/);
  });

  it("converts the fare into the trip's currency", async () => {
    const inr = await build(thailand);
    const usd = await build({ ...thailand, currency: "USD", budget: 1_200 });
    expect(usd.budget.categories.flights).toBe(fromInr(inr.flights!.totalInr, "USD"));
  });

  it("charges nothing for flights when the traveller leaves them out", async () => {
    const itinerary = await build({ ...thailand, includeFlights: false });
    expect(itinerary.budget.categories.flights).toBe(0);
    expect(itinerary.flights).toBeNull();
  });

  it("still includes flights when the choice was never made, as for trips saved earlier", async () => {
    const itinerary = await build({ ...thailand, includeFlights: undefined, origin: undefined });
    expect(itinerary.flights?.originAssumed).toBe(true);
    expect(itinerary.budget.categories.flights).toBeGreaterThan(0);
  });
});
