import { describe, expect, it } from "vitest";
import { flightDraftFields } from "@/lib/flights/draft";
import type { FlightQuote } from "@/types/flights";

const quote = (over: Partial<FlightQuote> = {}): FlightQuote => ({
  origin: { code: "BOM", city: "Mumbai" },
  arrival: { code: "BKK", city: "Bangkok" },
  originAssumed: false,
  perTravelerInr: { low: 20000, typical: 25000, high: 31000 },
  travelers: 2,
  totalInr: 50000,
  quotedOn: "2026-11-13",
  daysAhead: 60,
  confidence: "route",
  basis: "test",
  ...over,
});
const budget = (flights: number) => ({ categories: { flights } });

describe("flightDraftFields", () => {
  it("sends the saved airport and quote day back", () => {
    expect(flightDraftFields({ flights: quote(), budget: budget(50000) })).toEqual({
      includeFlights: true,
      origin: "BOM",
      quotedOn: "2026-11-13",
    });
  });

  it("does not pin an airport that was only assumed", () => {
    expect(flightDraftFields({ flights: quote({ originAssumed: true }), budget: budget(50000) })).toEqual({
      includeFlights: true,
      quotedOn: "2026-11-13",
    });
  });

  it("treats a zero quote as flights included", () => {
    expect(flightDraftFields({ flights: quote({ arrival: null, totalInr: 0 }), budget: budget(0) }).includeFlights).toBe(true);
  });

  it("treats null as flights left out", () => {
    expect(flightDraftFields({ flights: null, budget: budget(0) })).toEqual({ includeFlights: false });
  });

  it("falls back to the budget amount for a trip saved before quotes existed", () => {
    expect(flightDraftFields({ budget: budget(50000) })).toEqual({ includeFlights: true });
    expect(flightDraftFields({ budget: budget(0) })).toEqual({ includeFlights: false });
  });
});
