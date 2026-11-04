import { describe, expect, it } from "vitest";
import {
  COUNTRIES,
  bestMonthsLabel,
  countriesForMonth,
  countryByCode,
  isBestMonth,
  isSupportedCountry,
  normalise,
  resolveCountry,
  searchCountries,
} from "@/lib/countries";

const names = (query: string, limit?: number) => searchCountries(query, limit).map((c) => c.name);

describe("the list", () => {
  it("has between 40 and 50 countries", () => {
    expect(COUNTRIES.length).toBeGreaterThanOrEqual(40);
    expect(COUNTRIES.length).toBeLessThanOrEqual(50);
  });

  it("has no repeated code or name", () => {
    expect(new Set(COUNTRIES.map((c) => c.code)).size).toBe(COUNTRIES.length);
    expect(new Set(COUNTRIES.map((c) => c.name)).size).toBe(COUNTRIES.length);
  });

  it("gives every country the same set of details", () => {
    for (const country of COUNTRIES) {
      expect(country.code, country.name).toMatch(/^[A-Z]{2}$/);
      expect(country.tagline.length, country.name).toBeGreaterThan(20);
      expect(country.tagline.length, country.name).toBeLessThanOrEqual(110);
      expect(country.cities.length, country.name).toBeGreaterThanOrEqual(1);
      for (const city of country.cities) {
        expect(city.share, `${country.name} / ${city.name}`).toBeGreaterThan(0);
      }
    }
  });

  it("uses months that exist", () => {
    for (const { name, bestMonths } of COUNTRIES) {
      expect(bestMonths.from, name).toBeGreaterThanOrEqual(1);
      expect(bestMonths.from, name).toBeLessThanOrEqual(12);
      expect(bestMonths.to, name).toBeGreaterThanOrEqual(1);
      expect(bestMonths.to, name).toBeLessThanOrEqual(12);
    }
  });

  it("states no prices, so nothing in it can go stale or be wrong", () => {
    for (const { name, tagline } of COUNTRIES) {
      expect(tagline, name).not.toMatch(/[₹$€£]|\bcheap\b|\bfrom \d/i);
    }
  });
});

describe("searchCountries", () => {
  it("shows the first few, in the list's own order, before anything is typed", () => {
    expect(searchCountries("", 5).map((c) => c.code)).toEqual(COUNTRIES.slice(0, 5).map((c) => c.code));
    expect(names("   ", 3)).toHaveLength(3);
  });

  it("finds a country by the start of its name, ignoring case", () => {
    expect(names("jap")).toEqual(["Japan"]);
    expect(names("THAI")[0]).toBe("Thailand");
  });

  it("finds a country by a city or short form", () => {
    expect(names("dubai")[0]).toBe("United Arab Emirates");
    expect(names("uae")[0]).toBe("United Arab Emirates");
    expect(names("bali")[0]).toBe("Indonesia");
    expect(names("holland")[0]).toBe("Netherlands");
    expect(names("goa")[0]).toBe("India");
    expect(names("uk")[0]).toBe("United Kingdom");
    expect(names("kyoto")[0]).toBe("Japan");
  });

  it("ignores accents either way", () => {
    expect(names("turkiye")[0]).toBe("Turkey");
    expect(names("TÜRKIYE")[0]).toBe("Turkey");
    expect(names("cancun")[0]).toBe("Mexico");
  });

  it("ranks a name above an alias that happens to match", () => {
    // "India" is Indonesia's neighbour in the alphabet and nothing's alias.
    expect(names("india")[0]).toBe("India");
    expect(names("korea")[0]).toBe("South Korea");
  });

  it("matches the start of a later word in a name", () => {
    expect(names("emirates")[0]).toBe("United Arab Emirates");
    expect(names("zealand")[0]).toBe("New Zealand");
  });

  it("returns nothing for what it does not have, instead of guessing", () => {
    expect(names("atlantis")).toEqual([]);
    expect(names("qq")).toEqual([]);
  });

  it("does not match a short fragment from the middle of a word", () => {
    // "wi" is inside "Switzerland" but starts nothing, so it is not a hit.
    expect(names("wi")).not.toContain("Switzerland");
    // A longer fragment is: "witz" is clearly aiming at it.
    expect(names("witz")).toContain("Switzerland");
  });

  it("respects the limit", () => {
    expect(names("a", 4).length).toBeLessThanOrEqual(4);
  });
});

describe("resolveCountry", () => {
  it("returns the country for its exact name", () => {
    expect(resolveCountry("Japan")?.code).toBe("JP");
    expect(resolveCountry("  united kingdom ")?.code).toBe("GB");
  });

  it("understands trips saved before there was a list", () => {
    expect(resolveCountry("Bali, Indonesia")?.code).toBe("ID");
    expect(resolveCountry("Goa, India")?.code).toBe("IN");
    expect(resolveCountry("A week in Kyoto")?.code).toBe("JP");
  });

  it("takes the last place named, since the country comes last", () => {
    expect(resolveCountry("Georgia, USA")?.code).toBe("US");
  });

  it("needs whole words", () => {
    expect(resolveCountry("Mogoa")).toBeNull();
    expect(resolveCountry("Baliwag")).toBeNull();
  });

  it("is not fooled by ordinary words in a title", () => {
    expect(resolveCountry("A nice trip with male friends")).toBeNull();
    expect(resolveCountry("A trip for us")).toBeNull();
  });

  it("returns null for places that are not on the list", () => {
    expect(resolveCountry("Iceland")?.code).toBe("IS");
    expect(resolveCountry("Narnia")).toBeNull();
    expect(resolveCountry("")).toBeNull();
  });
});

describe("helpers", () => {
  it("looks a country up by code", () => {
    expect(countryByCode("jp")?.name).toBe("Japan");
    expect(countryByCode("ZZ")).toBeNull();
  });

  it("supports only exact names", () => {
    expect(isSupportedCountry("Japan")).toBe(true);
    expect(isSupportedCountry("japan")).toBe(false);
    expect(isSupportedCountry("Japan, Asia")).toBe(false);
  });

  it("writes the best months, across New Year too", () => {
    expect(bestMonthsLabel(countryByCode("JP")!)).toBe("Mar–May");
    expect(bestMonthsLabel(countryByCode("TH")!)).toBe("Nov–Feb");
  });

  it("knows whether a month is in the window, across New Year too", () => {
    const thailand = countryByCode("TH")!;
    expect([11, 12, 1, 2].every((m) => isBestMonth(thailand, m))).toBe(true);
    expect([3, 6, 10].some((m) => isBestMonth(thailand, m))).toBe(false);
  });

  it("normalises accents, case and punctuation", () => {
    expect(normalise("  Réunion,  Île! ")).toBe("reunion ile");
  });
});

describe("countriesForMonth", () => {
  it("returns only countries whose best weather includes the month, when there are enough", () => {
    const picks = countriesForMonth(11);
    expect(picks.length).toBeGreaterThanOrEqual(4);
    expect(picks.every((pick) => pick.inSeason)).toBe(true);
    expect(picks.every((pick) => isBestMonth(pick.country, 11))).toBe(true);
    expect(picks.map((p) => p.country.name)).toContain("Thailand");
  });

  it("keeps the list's own order and respects the limit", () => {
    const picks = countriesForMonth(5, { limit: 3 });
    expect(picks).toHaveLength(3);
    const order = COUNTRIES.map((c) => c.code);
    const positions = picks.map((p) => order.indexOf(p.country.code));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it("is honest when a month has few, by marking the extras as not in season", () => {
    const picks = countriesForMonth(8, { minimum: 40, limit: 40 });
    const extras = picks.filter((p) => !p.inSeason);
    expect(extras.length).toBeGreaterThan(0);
    expect(extras.every((p) => !isBestMonth(p.country, 8))).toBe(true);
  });

  it("has something in season in every month, so the section is never empty", () => {
    for (let month = 1; month <= 12; month++) {
      expect(countriesForMonth(month, { minimum: 1 }).some((p) => p.inSeason), `month ${month}`).toBe(true);
    }
  });
});

describe("countriesForMonth limits", () => {
  it("never returns more than the limit, even when padding", () => {
    expect(countriesForMonth(8, { minimum: 10, limit: 2 })).toHaveLength(2);
  });
});
