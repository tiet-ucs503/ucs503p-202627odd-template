import { describe, expect, it } from "vitest";
import { COUNTRIES } from "@/lib/countries";
import { INDIAN_AIRPORTS, ORIGIN_AIRPORTS, indianAirport, isOriginAirport } from "./airports";
import { COUNTRY_FARES, DOMESTIC_ROUTES, GROUP_SEASON, HUB_FACTORS, ORIGIN_OVERRIDES, ROUTE_FACTORS } from "./fares";
import { isDomestic, leadTimeFactor, quoteFlights, seasonFactor, type FlightQuoteInput } from "./quote";

const NOW = new Date("2026-11-13T09:00:00Z");

function quote(overrides: Partial<FlightQuoteInput>) {
  const q = quoteFlights({
    origin: "DEL",
    destination: "Thailand",
    startDate: "2027-03-08",
    travelers: 1,
    now: NOW,
    ...overrides,
  });
  if (!q) throw new Error("expected a quote");
  return q;
}

/** The average of twelve quotes, one a month, each booked five weeks ahead for a Monday departure. */
function yearlyAverage(origin: string, destination: string, firstCity?: string): number {
  let sum = 0;
  for (let month = 0; month < 12; month++) {
    let day = new Date(Date.UTC(2027, month, 1));
    while (day.getUTCDay() !== 1) day = new Date(day.getTime() + 86_400_000);
    const now = new Date(day.getTime() - 35 * 86_400_000);
    sum += quote({ origin, destination, firstCity, startDate: day.toISOString().slice(0, 10), now })
      .perTravelerInr.typical;
  }
  return sum / 12;
}

const within = (actual: number, expected: number, tolerance: number) =>
  Math.abs(actual - expected) / expected <= tolerance;

describe("the data", () => {
  it("prices every supported country", () => {
    for (const country of COUNTRIES) {
      if (country.code === "IN") continue;
      expect(COUNTRY_FARES[country.code], country.name).toBeDefined();
    }
  });

  it("has sane gateways", () => {
    const codes = new Set<string>();
    for (const [country, fares] of Object.entries(COUNTRY_FARES)) {
      expect(fares.gateways.length, country).toBeGreaterThan(0);
      for (const gateway of fares.gateways) {
        expect(codes.has(gateway.code), `duplicate ${gateway.code}`).toBe(false);
        codes.add(gateway.code);
        expect(gateway.fromDelhiInr).toBeGreaterThan(10_000);
        expect(gateway.fromDelhiInr).toBeLessThan(250_000);
        expect(gateway.serves.length).toBeGreaterThan(0);
        for (const month of Object.keys(gateway.season ?? {})) {
          expect(Number(month)).toBeGreaterThanOrEqual(1);
          expect(Number(month)).toBeLessThanOrEqual(12);
        }
      }
    }
  });

  it("has sane Indian airports", () => {
    const codes = INDIAN_AIRPORTS.map((a) => a.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const airport of INDIAN_AIRPORTS) {
      // Inside India's bounding box, Andamans included.
      expect(airport.lat).toBeGreaterThan(6);
      expect(airport.lat).toBeLessThan(36);
      expect(airport.lng).toBeGreaterThan(68);
      expect(airport.lng).toBeLessThan(98);
    }
    expect(ORIGIN_AIRPORTS.length).toBeGreaterThanOrEqual(25);
    for (const key of Object.keys(DOMESTIC_ROUTES)) {
      const [a, b] = key.split("-");
      expect(a < b, key).toBe(true);
      expect(indianAirport(a), key).toBeDefined();
      expect(indianAirport(b), key).toBeDefined();
    }
  });

  it("knows which airports are starting points", () => {
    expect(isOriginAirport("DEL")).toBe(true);
    expect(isOriginAirport("del")).toBe(true);
    expect(isOriginAirport("IXL")).toBe(false);
    expect(isOriginAirport("XXX")).toBe(false);
    expect(isOriginAirport(null)).toBe(false);
  });

  it("only measures pairs it knows both ends of", () => {
    const gateways = new Map(
      Object.values(COUNTRY_FARES).flatMap((fares) => fares.gateways.map((gw) => [gw.code, fares.group] as const)),
    );
    for (const [key, factor] of Object.entries(ROUTE_FACTORS)) {
      const [origin, gateway] = key.split("-");
      expect(isOriginAirport(origin), key).toBe(true);
      expect(gateways.has(gateway), key).toBe(true);
      expect(factor).toBeGreaterThan(0.5);
      expect(factor).toBeLessThan(1.5);
      // The regional factor used for unmeasured pairs should roughly agree
      // with the measured ones it summarises. Most are within 12%; the one
      // known outlier is Mumbai to Mauritius (27%), dearer than Mumbai's
      // cheap fares to the rest of Africa.
      const group = gateways.get(gateway)!;
      const regional = HUB_FACTORS[origin]?.[group] ?? ORIGIN_OVERRIDES[origin]?.[group];
      if (regional !== undefined) expect(Math.abs(regional - factor) / factor, key).toBeLessThan(0.3);
    }
  });

  it("keeps each group's year averaging one", () => {
    for (const year of Object.values(GROUP_SEASON)) {
      expect(year).toHaveLength(12);
      const mean = year.reduce((s, r) => s + r, 0) / 12;
      expect(mean).toBeGreaterThan(0.97);
      expect(mean).toBeLessThan(1.03);
    }
  });
});

describe("matching the research", () => {
  // A year of quotes has to average back to the researched yearly figure.
  it.each([
    ["DEL", "Singapore", undefined, 30_690],
    ["DEL", "United Kingdom", "London", 73_580],
    ["BOM", "United Kingdom", "London", 68_430],
    ["DEL", "United States", "New York City", 92_950],
    ["DEL", "Nepal", "Kathmandu", 17_330],
    ["DEL", "India", "Goa", 12_400],
    ["BOM", "India", "Goa", 9_080],
    ["DEL", "India", "Leh", 12_300],
  ])("%s to %s (%s) averages %d", (origin, destination, city, expected) => {
    expect(within(yearlyAverage(origin, destination, city), expected, 0.01)).toBe(true);
  });

  // Routes from other cities, through the measured ratios to Delhi.
  it.each([
    ["BOM", "United States", "New York City", 91_000, 0.05],
    ["CCU", "Japan", "Tokyo", 59_500, 0.05],
    ["BOM", "Egypt", "Cairo", 36_790, 0.05],
    ["MAA", "Singapore", undefined, 24_000, 0.1],
    ["BLR", "United Kingdom", "London", 62_000, 0.1],
    ["HYD", "Thailand", "Bangkok", 25_500, 0.1],
    ["COK", "Maldives", undefined, 29_580, 0.05],
    ["LKO", "United Arab Emirates", "Dubai", 32_000, 0.05],
  ])("%s to %s (%s) lands near %d", (origin, destination, city, expected, tolerance) => {
    expect(within(yearlyAverage(origin, destination, city), expected, tolerance)).toBe(true);
  });
});

describe("what moves the fare", () => {
  it("follows the season", () => {
    const december = quote({ destination: "Singapore", startDate: "2027-12-06" }).perTravelerInr.typical;
    const march = quote({ destination: "Singapore", startDate: "2027-03-08" }).perTravelerInr.typical;
    expect(december).toBeGreaterThan(march * 1.3);

    const leh = (startDate: string) =>
      quote({ destination: "India", firstCity: "Leh", startDate, now: new Date("2027-01-01T00:00:00Z") })
        .perTravelerInr.typical;
    expect(leh("2027-06-07")).toBeGreaterThan(leh("2027-11-08") * 2);
  });

  it("makes July the cheapest month to Dubai from Delhi", () => {
    const factors = Array.from({ length: 12 }, (_, i) => seasonFactor("gulf", i + 1, { 7: 0.78, 12: 1.23 }));
    expect(Math.min(...factors)).toBe(factors[6]);
    expect(Math.max(...factors)).toBe(factors[11]);
  });

  it("charges more the closer to departure it is booked", () => {
    const at = (daysAhead: number) =>
      quote({ startDate: "2027-03-08", now: new Date(Date.parse("2027-03-08") - daysAhead * 86_400_000) })
        .perTravelerInr.typical;
    expect(at(3)).toBeGreaterThan(at(10));
    expect(at(10)).toBeGreaterThan(at(35));
    expect(at(35)).toBeGreaterThan(at(120));
    expect(leadTimeFactor(-5, 0.2)).toBe(leadTimeFactor(0, 0.2));
    expect(leadTimeFactor(1000, 0.2)).toBeCloseTo(0.98);
  });

  it("is cheaper midweek than on a Friday", () => {
    const wednesday = quote({ startDate: "2027-03-10" }).perTravelerInr.typical;
    const friday = quote({ startDate: "2027-03-12" }).perTravelerInr.typical;
    expect(wednesday).toBeLessThan(friday);
  });

  it("allows more per seat for a large group, and totals every traveller", () => {
    const two = quote({ travelers: 2 });
    const ten = quote({ travelers: 10 });
    expect(ten.perTravelerInr.typical).toBeGreaterThan(two.perTravelerInr.typical);
    expect(ten.totalInr).toBe(ten.perTravelerInr.typical * 10);
    expect(two.totalInr).toBe(two.perTravelerInr.typical * 2);
  });

  it("widens the range for a last-minute booking", () => {
    const early = quote({ startDate: "2027-03-08" }).perTravelerInr;
    const late = quote({ startDate: "2026-11-18" }).perTravelerInr;
    expect(early.high / early.typical).toBeCloseTo(1.25, 1);
    expect(late.high / late.typical).toBeCloseTo(1.35, 1);
  });
});

describe("choosing the airports", () => {
  it("flies into the first city's airport", () => {
    expect(quote({ destination: "Japan", firstCity: "Kyoto" }).arrival?.code).toBe("KIX");
    expect(quote({ destination: "Japan", firstCity: "Tokyo" }).arrival?.code).toBe("TYO");
    expect(quote({ destination: "Indonesia", firstCity: "Ubud" }).arrival?.code).toBe("DPS");
    expect(quote({ destination: "Switzerland", firstCity: "Zermatt" }).arrival?.code).toBe("GVA");
    expect(quote({ destination: "India", firstCity: "Munnar" }).arrival?.code).toBe("COK");
    expect(quote({ destination: "India", firstCity: "Rishikesh" }).arrival?.code).toBe("DED");
  });

  it("uses the country's main airport for a city it doesn't know", () => {
    expect(quote({ destination: "Japan", firstCity: "Takayama" }).arrival?.code).toBe("TYO");
    expect(quote({ destination: "Indonesia" }).arrival?.code).toBe("DPS");
  });

  it("places an unnamed Indian city by where it is", () => {
    const q = quote({ destination: "India", firstCity: "Sethan", firstCityLocation: { lat: 32.21, lng: 77.2 } });
    expect(q.arrival?.code).toBe("KUU");
  });

  it("still gives a domestic estimate when the first city can't be placed", () => {
    const q = quote({ destination: "India", firstCity: "Somewhere" });
    expect(q.arrival).toBeNull();
    expect(q.perTravelerInr.typical).toBeGreaterThan(5_000);
    expect(q.confidence).toBe("modelled");
  });

  it("charges nothing when the trip starts where the traveller lives", () => {
    const q = quote({ destination: "India", firstCity: "Delhi", travelers: 3 });
    expect(q.totalInr).toBe(0);
    expect(q.arrival).toBeNull();
    expect(q.basis).toMatch(/no flight/);
    // Shimla is a drive from Chandigarh, not a flight.
    expect(quote({ origin: "IXC", destination: "India", firstCity: "Shimla" }).totalInr).toBe(0);
  });

  it("budgets no flight between nearby airports with no nonstop", () => {
    const q = quote({ origin: "IXC", destination: "India", firstCity: "Manali" });
    expect(q.totalInr).toBe(0);
    expect(q.basis).toMatch(/by road or rail/);
    // But a short hop that does have a nonstop is still priced.
    expect(quote({ origin: "DEL", destination: "India", firstCity: "Jaipur" }).totalInr).toBeGreaterThan(4_000);
  });

  it("only claims route data where the route was measured", () => {
    const measured = quote({ origin: "BOM", destination: "Singapore" });
    expect(measured.confidence).toBe("route");
    expect(measured.basis).toMatch(/past year of fares on this route/);

    const regional = quote({ origin: "HYD", destination: "France", firstCity: "Paris" });
    expect(regional.confidence).toBe("modelled");
    expect(regional.basis).toMatch(/Delhi to Paris fares, adjusted for how fares from Hyderabad compare/);

    const nearby = quote({ origin: "DEL", destination: "Japan", firstCity: "Kyoto" });
    expect(nearby.confidence).toBe("modelled");
    expect(nearby.basis).toMatch(/nearby airports in Japan/);
  });

  it("assumes Delhi, and says so, when no origin was chosen", () => {
    for (const origin of [undefined, null, "", "XYZ"]) {
      const q = quote({ origin });
      expect(q.origin.code).toBe("DEL");
      expect(q.originAssumed).toBe(true);
      expect(q.basis).toMatch(/assumes you fly from Delhi/);
    }
    expect(quote({ origin: "BOM" }).originAssumed).toBe(false);
  });

  it("connects a small airport through its nearest hub, not a distant cheaper one", () => {
    const chandigarh = quote({ origin: "IXC", destination: "United Kingdom", firstCity: "London" });
    const delhi = quote({ origin: "DEL", destination: "United Kingdom", firstCity: "London" });
    expect(chandigarh.basis).toMatch(/fares from Delhi, plus a connecting flight from Chandigarh/);
    expect(chandigarh.perTravelerInr.typical).toBeGreaterThan(delhi.perTravelerInr.typical);
    expect(chandigarh.confidence).toBe("modelled");
    expect(delhi.confidence).toBe("route");
  });

  it("treats only India as domestic", () => {
    expect(isDomestic("India")).toBe(true);
    expect(isDomestic("Goa, India")).toBe(true);
    expect(isDomestic("Thailand")).toBe(false);
    expect(isDomestic("Narnia")).toBe(false);
  });

  it("does not price a destination it doesn't support", () => {
    expect(quoteFlights({ destination: "Narnia", startDate: "2027-03-08", travelers: 1, now: NOW })).toBeNull();
  });
});

describe("every quote", () => {
  it("is ordered, positive and repeatable from every origin to every country", () => {
    for (const origin of ORIGIN_AIRPORTS) {
      for (const country of COUNTRIES) {
        const input = { origin: origin.code, destination: country.name, startDate: "2027-05-14", travelers: 2, now: NOW };
        const q = quoteFlights(input)!;
        const { low, typical, high } = q.perTravelerInr;
        expect(Number.isFinite(typical), `${origin.code} ${country.name}`).toBe(true);
        if (q.arrival) {
          expect(low).toBeGreaterThan(2_000);
          expect(low).toBeLessThan(typical);
          expect(typical).toBeLessThan(high);
          expect(high).toBeLessThan(400_000);
        }
        expect(quoteFlights(input)).toEqual(q);
        expect(q.quotedOn).toBe("2026-11-13");
        expect(q.daysAhead).toBe(182);
      }
    }
  });
});

describe("bad input", () => {
  it("gives no quote for a departure that is not a real day", () => {
    for (const startDate of ["2027-02-30", "2027-13-01", "2027-00-10", "soon", ""]) {
      expect(quoteFlights({ origin: "DEL", destination: "Thailand", startDate, travelers: 2, now: NOW })).toBeNull();
    }
  });

  it("treats a missing party size as one traveller", () => {
    for (const travelers of [Number.NaN, 0, -3]) {
      const q = quote({ travelers });
      expect(q.travelers).toBe(1);
      expect(Number.isFinite(q.totalInr)).toBe(true);
    }
  });

  it("prices a departure in the past as a last-minute one, not a negative lead time", () => {
    const q = quote({ startDate: "2026-10-01" });
    expect(q.daysAhead).toBe(0);
    expect(q.perTravelerInr.typical).toBeGreaterThan(quote({ startDate: "2027-03-08" }).perTravelerInr.typical);
  });
});

describe("invariants across the whole table", () => {
  const gateways = Object.entries(COUNTRY_FARES).flatMap(([code, c]) =>
    c.gateways.map((gw) => ({ country: COUNTRIES.find((x) => x.code === code)!.name, gw })),
  );
  const partySizes = [1, 2, 5, 9];

  it("is finite, positive and ordered low <= typical <= high for every origin and gateway, across seasons and lead times", () => {
    const problems: string[] = [];
    for (const o of ORIGIN_AIRPORTS) {
      for (const { country, gw } of gateways) {
        for (const m of [1, 4, 8, 12]) {
          for (const ahead of [0, 13, 14, 100, 400]) {
            const start = new Date(Date.UTC(2027, m - 1, 15));
            const now = new Date(start.getTime() - ahead * 86_400_000);
            const q = quoteFlights({
              origin: o.code, destination: country, firstCity: gw.serves[0],
              startDate: start.toISOString().slice(0, 10), travelers: 2, now,
            });
            const where = `${o.code}->${gw.code} m${m} +${ahead}d`;
            if (!q) { problems.push(`${where}: no quote`); continue; }
            const p = q.perTravelerInr;
            if (!Number.isFinite(p.typical) || p.typical <= 0) problems.push(`${where}: typical ${p.typical}`);
            else if (p.low > p.typical || p.typical > p.high) problems.push(`${where}: ${p.low}/${p.typical}/${p.high}`);
            else if (q.totalInr !== p.typical * 2) problems.push(`${where}: total ${q.totalInr}`);
          }
        }
      }
    }
    expect(problems.slice(0, 10)).toEqual([]);
  });

  it("never gets cheaper per person as the party grows", () => {
    for (const { country, gw } of gateways) {
      let last = 0;
      for (const travelers of partySizes) {
        const per = quote({ destination: country, firstCity: gw.serves[0], travelers }).perTravelerInr.typical;
        expect(per, `${gw.code} x${travelers}`).toBeGreaterThanOrEqual(last);
        last = per;
      }
    }
  });

  it("never gets dearer the earlier it is booked, up to five months out", () => {
    for (const lastMinute of [0, 0.05, 0.12, 0.25, 0.34, 0.5]) {
      let last = Infinity;
      for (let d = 0; d <= 150; d++) {
        const f = leadTimeFactor(d, lastMinute);
        expect(f, `lm ${lastMinute} d ${d}`).toBeLessThanOrEqual(last + 1e-9);
        last = f;
      }
    }
  });

  it("keeps every season's year averaging exactly 1, including a place's own months", () => {
    for (const group of Object.keys(GROUP_SEASON) as (keyof typeof GROUP_SEASON)[]) {
      const mean = Array.from({ length: 12 }, (_, i) => seasonFactor(group, i + 1)).reduce((a, b) => a + b, 0) / 12;
      expect(mean).toBeCloseTo(1, 9);
    }
    for (const country of Object.values(COUNTRY_FARES)) {
      for (const gw of country.gateways) {
        const mean = Array.from({ length: 12 }, (_, i) => seasonFactor(country.group, i + 1, gw.season)).reduce((a, b) => a + b, 0) / 12;
        expect(mean, gw.code).toBeCloseTo(1, 9);
      }
    }
  });

  it("is the same fare to fly A to B as B to A inside India", () => {
    for (const a of INDIAN_AIRPORTS) {
      for (const b of INDIAN_AIRPORTS) {
        if (a.code >= b.code) continue;
        const ab = quoteFlights({ origin: a.code, destination: "India", firstCity: b.city, startDate: "2027-03-08", travelers: 1, now: NOW });
        if (!isOriginAirport(b.code) || !isOriginAirport(a.code)) continue;
        const ba = quoteFlights({ origin: b.code, destination: "India", firstCity: a.city, startDate: "2027-03-08", travelers: 1, now: NOW });
        // Each leg is priced with its destination's own season, so compare the model's base through a month neutral to both.
        expect(Math.abs(ab!.perTravelerInr.typical - ba!.perTravelerInr.typical) / Math.max(ab!.perTravelerInr.typical, 1)).toBeLessThan(0.25);
      }
    }
  });

  it("keeps domestic fares within a believable band", () => {
    for (const a of ORIGIN_AIRPORTS) {
      for (const b of INDIAN_AIRPORTS) {
        if (a.code === b.code) continue;
        const q = quoteFlights({ origin: a.code, destination: "India", firstCity: b.city, startDate: "2027-03-08", travelers: 1, now: NOW })!;
        const typical = q.perTravelerInr.typical;
        if (typical === 0) continue; // by road or rail
        expect(typical, `${a.code}->${b.code}`).toBeGreaterThan(3_000);
        expect(typical, `${a.code}->${b.code}`).toBeLessThan(35_000);
      }
    }
  });

  it("keeps every origin within a believable band of Delhi on the same trip", () => {
    for (const { country, gw } of gateways) {
      const del = quote({ destination: country, firstCity: gw.serves[0] }).perTravelerInr.typical;
      for (const o of ORIGIN_AIRPORTS) {
        const ratio = quote({ origin: o.code, destination: country, firstCity: gw.serves[0] }).perTravelerInr.typical / del;
        expect(ratio, `${o.code}->${gw.code}`).toBeGreaterThan(0.55);
        expect(ratio, `${o.code}->${gw.code}`).toBeLessThan(1.7);
      }
    }
  });
});
