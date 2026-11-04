import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { COUNTRIES } from "@/lib/countries";
import { COUNTRY_PHOTOS } from "@/lib/country-photos";
import {
  ELSEWHERE_PHOTO,
  PLAN_PHOTO,
  TRAVIS_PHOTO,
  photoForCountry,
  photoForTrip,
} from "@/lib/destination-photos";

describe("every supported country", () => {
  it("has its own photograph", () => {
    for (const country of COUNTRIES) {
      expect(COUNTRY_PHOTOS[country.code], country.name).toBeDefined();
      expect(photoForCountry(country.code), country.name).not.toBe(ELSEWHERE_PHOTO);
    }
  });

  it("has a photograph nobody else shares", () => {
    const sources = COUNTRIES.map((country) => photoForCountry(country.code).src);
    expect(new Set(sources).size).toBe(sources.length);
  });

  it("has a description that says what the picture shows", () => {
    for (const country of COUNTRIES) {
      expect(photoForCountry(country.code).alt.length, country.name).toBeGreaterThan(15);
    }
  });
});

describe("photoForCountry", () => {
  it("ignores case, and falls back to a neutral landscape for an unknown code", () => {
    expect(photoForCountry("jp")).toBe(photoForCountry("JP"));
    expect(photoForCountry("ZZ")).toBe(ELSEWHERE_PHOTO);
  });
});

describe("photoForTrip", () => {
  const japan = photoForCountry("JP");

  it("finds the country from what was typed, whatever its form", () => {
    expect(photoForTrip({ destination: "Japan" })).toBe(japan);
    expect(photoForTrip({ destination: "  a week in KYOTO  " })).toBe(japan);
    expect(photoForTrip({ destination: "Bali, Indonesia" })).toBe(photoForCountry("ID"));
    expect(photoForTrip({ destination: "Goa, India" })).toBe(photoForCountry("IN"));
  });

  it("never stands in a photo of one place for another", () => {
    expect(photoForTrip({ destination: "Narnia" })).toBe(ELSEWHERE_PHOTO);
    expect(photoForTrip({ destination: "Argentina" })).toBe(ELSEWHERE_PHOTO);
    expect(photoForTrip({ destination: "Mogoa" })).toBe(ELSEWHERE_PHOTO);
  });

  it("falls back to the cities the planner chose", () => {
    const trip = { destination: "Southeast Asia", cities: [{ name: "Bangkok", country: "Thailand" }] };
    expect(photoForTrip(trip)).toBe(photoForCountry("TH"));
  });

  it("prefers the destination over a city, then a city over the title", () => {
    expect(photoForTrip({ destination: "Japan", cities: [{ name: "Bangkok", country: "Thailand" }] })).toBe(japan);
    expect(
      photoForTrip({ destination: "Asia", title: "Kyoto", cities: [{ name: "Ubud", country: "Indonesia" }] }),
    ).toBe(photoForCountry("ID"));
  });

  it("uses the title when nothing else says where", () => {
    expect(photoForTrip({ destination: "Somewhere warm", title: "Weekend in Goa" })).toBe(photoForCountry("IN"));
  });
});

describe("the files", () => {
  const publicDir = path.join(process.cwd(), "public");
  const everyPhoto = [...Object.values(COUNTRY_PHOTOS), PLAN_PHOTO, TRAVIS_PHOTO, ELSEWHERE_PHOTO];

  it("exist for every photograph the app can show", () => {
    for (const photo of everyPhoto) {
      expect(existsSync(path.join(publicDir, photo.src)), photo.src).toBe(true);
    }
  });

  it("have no leftover files that nothing shows", () => {
    const used = new Set(everyPhoto.map((photo) => path.basename(photo.src)));
    const dir = path.join(publicDir, "images/destinations");
    const onDisk = readdirSync(dir);
    expect(onDisk.filter((file) => !used.has(file))).toEqual([]);
  });
});
