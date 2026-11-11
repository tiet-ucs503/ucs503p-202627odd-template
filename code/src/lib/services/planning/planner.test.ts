import { describe, expect, it } from "vitest";
import { resolveCountry } from "@/lib/countries";
import { planCitiesDeterministically } from "@/lib/services/planning/fallback-planner";
import { validateCityAllocation } from "@/lib/services/planning/validate";
import { splitDaysAcrossCities } from "@/lib/services/planning/split-days";
import { llmCityPlanSchema } from "@/lib/validation/planning";
import type { CityPlanRequest } from "@/types/planning";

function request(overrides: Partial<CityPlanRequest> = {}): CityPlanRequest {
  return {
    destination: "Italy",
    startDate: "2027-06-12",
    endDate: "2027-06-20",
    dayCount: 9,
    travelers: 2,
    budget: 150_000,
    currency: "INR",
    preferences: ["culture", "food"],
    ...overrides,
  };
}

describe("fallback planner", () => {
  it("produces an allocation that always passes validation", () => {
    for (const dayCount of [1, 2, 5, 9, 14, 21]) {
      const req = request({ dayCount });
      const cities = planCitiesDeterministically(req);
      expect(validateCityAllocation(cities, req).ok).toBe(true);
    }
  });

  it("splits Thailand across its real cities", () => {
    const cities = planCitiesDeterministically(request({ destination: "Thailand" }));
    expect(cities.map((c) => c.name)).toEqual(["Bangkok", "Phuket", "Chiang Mai"]);
    expect(cities.reduce((sum, c) => sum + c.days, 0)).toBe(9);
  });

  it("drops stops a short trip can't afford the travel time for", () => {
    // A 3-day trip shouldn't be one night in Bangkok followed by a flight.
    const short = planCitiesDeterministically(request({ destination: "Thailand", dayCount: 3 }));
    expect(short).toEqual([expect.objectContaining({ name: "Bangkok", days: 3 })]);

    const single = planCitiesDeterministically(request({ destination: "Thailand", dayCount: 1 }));
    expect(single).toHaveLength(1);
    expect(single[0].days).toBe(1);

    // Long enough to justify the moves, so every city comes back.
    const longer = planCitiesDeterministically(request({ destination: "Thailand", dayCount: 6 }));
    expect(longer).toHaveLength(3);
    expect(longer.reduce((s, c) => s + c.days, 0)).toBe(6);
  });

  it("splits a supported country across its real cities", () => {
    const cities = planCitiesDeterministically(request({ destination: "Italy" }));
    expect(cities.map((c) => c.name)).toEqual(["Rome", "Florence", "Venice"]);
    expect(cities.reduce((sum, c) => sum + c.days, 0)).toBe(9);
    expect(cities.every((c) => c.days >= 2)).toBe(true);
  });

  it("uses fewer cities on a short trip, so no stop gets less than two days", () => {
    const short = planCitiesDeterministically(request({ destination: "Italy", dayCount: 4 }));
    expect(short.map((c) => c.name)).toEqual(["Rome", "Florence"]);

    const tiny = planCitiesDeterministically(request({ destination: "Italy", dayCount: 2 }));
    expect(tiny).toHaveLength(1);
    expect(tiny[0].days).toBe(2);
  });

  it("works from a place inside a supported country, as older trips store it", () => {
    const cities = planCitiesDeterministically(request({ destination: "Goa, India" }));
    expect(cities.map((c) => c.name)[0]).toBe("Delhi");
  });

  it("gives a one-city country one stop for the whole trip", () => {
    const cities = planCitiesDeterministically(request({ destination: "Singapore", dayCount: 5 }));
    expect(cities).toEqual([expect.objectContaining({ name: "Singapore", days: 5 })]);
  });

  it("does not invent city names for places it has no list for", () => {
    const cities = planCitiesDeterministically(request({ destination: "Narnia" }));
    // Earlier iterations produced "Narnia City"/"Narnia Coast", which look like
    // real places but aren't. One honest base is preferred over two fictions.
    expect(cities).toHaveLength(1);
    expect(cities[0].name).toBe("Narnia");
    expect(cities[0].days).toBe(9);
  });

  it("only ever names cities from the country's own list", () => {
    for (const destination of ["France", "Japan", "Peru", "Kenya"]) {
      const names = planCitiesDeterministically(request({ destination })).map((c) => c.name);
      const known = resolveCountry(destination)!.cities.map((c) => c.name);
      for (const name of names) expect(known, `${destination}: ${name}`).toContain(name);
    }
  });
});

describe("splitDaysAcrossCities", () => {
  it("always sums to the trip length", () => {
    expect(splitDaysAcrossCities(9, [0.4, 0.6]).reduce((a, b) => a + b, 0)).toBe(9);
    expect(splitDaysAcrossCities(7, [1, 1, 1]).reduce((a, b) => a + b, 0)).toBe(7);
    expect(splitDaysAcrossCities(3, [0.5, 0.3, 0.2]).reduce((a, b) => a + b, 0)).toBe(3);
  });

  it("gives every city at least one day", () => {
    expect(splitDaysAcrossCities(3, [0.9, 0.05, 0.05]).every((d) => d >= 1)).toBe(true);
  });
});

describe("llmCityPlanSchema", () => {
  it("accepts a well-formed plan", () => {
    const result = llmCityPlanSchema.safeParse({
      destination: "Italy",
      cities: [
        { name: "Rome", days: 4, reason: "History and food" },
        { name: "Florence", days: 5, reason: "Art" },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects malformed model output", () => {
    // Free-form text instead of structure.
    expect(llmCityPlanSchema.safeParse("Spend 4 days in Rome then Florence").success).toBe(false);
    // Missing cities.
    expect(llmCityPlanSchema.safeParse({ destination: "Italy" }).success).toBe(false);
    // Non-integer days.
    expect(
      llmCityPlanSchema.safeParse({ destination: "Italy", cities: [{ name: "Rome", days: 2.5 }] }).success,
    ).toBe(false);
    // Empty city name.
    expect(
      llmCityPlanSchema.safeParse({ destination: "Italy", cities: [{ name: "", days: 3 }] }).success,
    ).toBe(false);
    // Negative days.
    expect(
      llmCityPlanSchema.safeParse({ destination: "Italy", cities: [{ name: "Rome", days: -1 }] }).success,
    ).toBe(false);
  });

  it("defaults a missing reason rather than failing", () => {
    const result = llmCityPlanSchema.safeParse({
      destination: "Japan",
      cities: [{ name: "Tokyo", days: 5 }],
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.cities[0].reason).toBe("");
  });
});
