import { describe, expect, it } from "vitest";
import { MockAIProvider } from "@/lib/services/ai/mock-provider";
import { planCities } from "@/lib/services/planning";
import type { CityPlanRequest } from "@/types/planning";

/**
 * The end-to-end planning pipeline with an injected provider:
 * proposal → Zod → constraint checks → one repair → fallback.
 */
function request(overrides: Partial<CityPlanRequest> = {}): CityPlanRequest {
  return {
    destination: "Thailand",
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

describe("planCities pipeline", () => {
  it("falls back deterministically when no provider is configured", async () => {
    const plan = await planCities(request(), null);
    expect(plan.source).toBe("fallback");
    expect(plan.cities.map((c) => `${c.name}:${c.days}`)).toEqual(["Bangkok:4", "Phuket:5"]);
  });

  it("accepts a valid proposal in a single call", async () => {
    const provider = new MockAIProvider("valid");
    const plan = await planCities(request(), provider);
    expect(provider.calls).toBe(1);
    expect(plan.cities.map((c) => `${c.name}:${c.days}`)).toEqual(["Bangkok:4", "Phuket:5"]);
  });

  it("records a simulated provider as fallback, not as AI planning", async () => {
    // A stand-in didn't reason about anything; the trip must not claim it did.
    const plan = await planCities(request(), new MockAIProvider("valid"));
    expect(plan.source).toBe("fallback");
  });

  it("repairs an invalid allocation with exactly one retry", async () => {
    const provider = new MockAIProvider("bad-allocation");
    const plan = await planCities(request(), provider);
    expect(provider.calls).toBe(2);
    expect(plan.cities.reduce((sum, c) => sum + c.days, 0)).toBe(9);
  });

  it("does not retry a quota failure", async () => {
    const provider = new MockAIProvider("error");
    const plan = await planCities(request(), provider);
    // Retrying a quota error just spends money twice.
    expect(provider.calls).toBe(1);
    expect(plan.source).toBe("fallback");
    expect(plan.fallbackReason).toContain("quota");
  });

  it("retries a malformed response once, then falls back", async () => {
    const provider = new MockAIProvider("malformed");
    const plan = await planCities(request(), provider);
    expect(provider.calls).toBe(2);
    expect(plan.source).toBe("fallback");
    expect(plan.cities.reduce((sum, c) => sum + c.days, 0)).toBe(9);
  });

  it("always returns an allocation matching the trip length", async () => {
    for (const behaviour of ["valid", "bad-allocation", "malformed", "error"] as const) {
      for (const dayCount of [1, 4, 9, 15]) {
        const plan = await planCities(request({ dayCount }), new MockAIProvider(behaviour));
        expect(plan.cities.reduce((sum, c) => sum + c.days, 0)).toBe(dayCount);
      }
    }
  });

  it("plans a supported country across its real cities when there is no model", async () => {
    const plan = await planCities(request({ destination: "Italy" }), null);
    expect(plan.source).toBe("fallback");
    expect(plan.cities.map((c) => c.name)).toEqual(["Rome", "Florence", "Venice"]);
    expect(plan.cities.reduce((sum, c) => sum + c.days, 0)).toBe(9);
  });

  it("keeps places it has no list for honest", async () => {
    const plan = await planCities(request({ destination: "Narnia" }), null);
    expect(plan.cities).toEqual([expect.objectContaining({ name: "Narnia", days: 9 })]);
  });
});
