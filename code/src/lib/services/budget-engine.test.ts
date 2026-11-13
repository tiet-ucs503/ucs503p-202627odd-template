import { describe, expect, it } from "vitest";
import { buildSavingsSuggestions, computeBudgetBreakdown } from "@/lib/services/budget-engine";
import type { Activity, TripDay } from "@/types/itinerary";
import type { BudgetBreakdown } from "@/types/budget";

function activity(id: string, cost: number, currency: string): Activity {
  return {
    id,
    name: `Activity ${id}`,
    category: "sightseeing",
    time: "10:00",
    durationMinutes: 60,
    description: "",
    estimatedCost: cost,
    currency,
    referenceUrl: null,
    isDemoData: false,
  } as Activity;
}

function days(count: number, activities: Activity[] = []): TripDay[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `day-${i + 1}`,
    dayNumber: i + 1,
    date: `2026-12-0${i + 1}`,
    cityId: "c1",
    activities: i === 0 ? activities : [],
  }));
}

function breakdown(currency: string, total: number, estimatedTotal: number): BudgetBreakdown {
  return {
    currency,
    total,
    estimatedTotal,
    categories: {
      flights: 0,
      hotels: 0,
      food: 0,
      activities: 0,
      transport: 0,
      shopping: 0,
      misc: 0,
      buffer: 0,
    },
  };
}

describe("computeBudgetBreakdown currency", () => {
  it("keeps the rupee numbers for an INR trip", () => {
    const result = computeBudgetBreakdown({
      cities: [],
      days: days(3),
      travelers: 2,
      currency: "INR",
      userBudget: 20_000,
      flightCostTotal: 0,
    });
    expect(result.categories.transport).toBe(1_500); // 3 days x 500
    expect(result.categories.buffer).toBe(3_000); // 5% of 20,000 is 1,000, so the minimum wins
  });

  it("scales the daily transport allowance to the trip currency", () => {
    const result = computeBudgetBreakdown({
      cities: [],
      days: days(3),
      travelers: 2,
      currency: "USD",
      userBudget: 1_500,
      flightCostTotal: 0,
    });
    expect(result.categories.transport).toBe(18); // 3 days x $6, not 3 x $500
  });

  it("uses a small minimum buffer for a USD trip", () => {
    const result = computeBudgetBreakdown({
      cities: [],
      days: days(1),
      travelers: 1,
      currency: "USD",
      userBudget: 400,
      flightCostTotal: 0,
    });
    expect(result.categories.buffer).toBe(36); // 5% of 400 is 20, so the 3,000 rupee minimum (about $36) wins
  });

  it("does not let the minimum buffer swallow a small USD budget", () => {
    const result = computeBudgetBreakdown({
      cities: [],
      days: days(5),
      travelers: 2,
      currency: "USD",
      userBudget: 1_500,
      flightCostTotal: 0,
    });
    expect(result.categories.buffer).toBe(75); // 5% of 1,500
    expect(result.estimatedTotal).toBeLessThan(result.total);
  });
});

describe("buildSavingsSuggestions currency", () => {
  it("treats a $100 activity as pricey on a USD trip", () => {
    const trip = days(1, [activity("big", 100, "USD")]);
    const result = buildSavingsSuggestions([], trip, breakdown("USD", 50, 500));
    expect(result.some((s) => s.kind === "activity-swap")).toBe(true);
  });

  it("does not call a $10 activity pricey on a USD trip", () => {
    const trip = days(1, [activity("small", 10, "USD")]);
    const result = buildSavingsSuggestions([], trip, breakdown("USD", 50, 500));
    expect(result.some((s) => s.kind === "activity-swap")).toBe(false);
  });

  it("keeps the 1,500 rupee threshold for an INR trip", () => {
    const pricey = buildSavingsSuggestions([], days(1, [activity("a", 2_000, "INR")]), breakdown("INR", 5_000, 9_000));
    const cheap = buildSavingsSuggestions([], days(1, [activity("b", 1_000, "INR")]), breakdown("INR", 5_000, 9_000));
    expect(pricey.some((s) => s.kind === "activity-swap")).toBe(true);
    expect(cheap.some((s) => s.kind === "activity-swap")).toBe(false);
  });
});
