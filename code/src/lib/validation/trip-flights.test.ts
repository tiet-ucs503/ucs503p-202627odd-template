import { describe, expect, it } from "vitest";
import { flightQuoteSchema, tripDraftInputSchema } from "@/lib/validation/trip";

const draft = {
  destination: "Thailand",
  startDate: "2027-03-08",
  endDate: "2027-03-14",
  budget: 150000,
  currency: "INR",
  travelers: 2,
  travelerType: "couple",
  preferences: ["culture"],
};

describe("the flight fields of a trip draft", () => {
  it("are optional", () => {
    expect(tripDraftInputSchema.safeParse(draft).success).toBe(true);
  });

  it("accept a listed airport, a switch and a real quote day", () => {
    const parsed = tripDraftInputSchema.safeParse({ ...draft, includeFlights: false, origin: "BOM", quotedOn: "2026-11-13" });
    expect(parsed.success).toBe(true);
  });

  it("reject an airport that isn't one of the starting cities", () => {
    expect(tripDraftInputSchema.safeParse({ ...draft, origin: "XXX" }).success).toBe(false);
    expect(tripDraftInputSchema.safeParse({ ...draft, origin: "IXZ" }).success).toBe(false);
  });

  it("reject a quote day that is not a real date", () => {
    for (const quotedOn of ["2026-02-30", "2026-13-01", "yesterday"]) {
      expect(tripDraftInputSchema.safeParse({ ...draft, quotedOn }).success, quotedOn).toBe(false);
    }
  });

  it("reject a non-boolean switch", () => {
    expect(tripDraftInputSchema.safeParse({ ...draft, includeFlights: "yes" }).success).toBe(false);
  });
});

describe("a saved flight quote", () => {
  const quote = {
    origin: { code: "DEL", city: "Delhi" },
    arrival: { code: "BKK", city: "Bangkok" },
    originAssumed: false,
    perTravelerInr: { low: 22000, typical: 26000, high: 32000 },
    travelers: 2,
    totalInr: 52000,
    quotedOn: "2026-11-13",
    daysAhead: 115,
    confidence: "route",
    basis: "test",
  };

  it("is accepted as saved", () => {
    expect(flightQuoteSchema.safeParse(quote).success).toBe(true);
    expect(flightQuoteSchema.safeParse({ ...quote, arrival: null }).success).toBe(true);
  });

  it("is rejected with a negative amount, a fake day or a made-up confidence", () => {
    expect(flightQuoteSchema.safeParse({ ...quote, totalInr: -1 }).success).toBe(false);
    expect(flightQuoteSchema.safeParse({ ...quote, quotedOn: "2026-02-30" }).success).toBe(false);
    expect(flightQuoteSchema.safeParse({ ...quote, confidence: "exact" }).success).toBe(false);
  });
});
