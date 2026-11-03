import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  ELSEWHERE_PHOTO,
  PLAN_PHOTO,
  TRAVIS_PHOTO,
  photoForTrip,
} from "@/lib/destination-photos";
import { PHOTO_CREDITS } from "@/lib/photo-credits";

const named = (destination: string) => photoForTrip({ destination }).src;

describe("photoForTrip", () => {
  it("finds the place from what the traveller typed", () => {
    expect(named("Thailand")).toContain("thailand");
    expect(named("Bali, Indonesia")).toContain("bali");
    expect(named("Italy")).toContain("italy");
    expect(named("Japan")).toContain("japan");
    expect(named("Goa, India")).toContain("goa");
    expect(named("Portugal")).toContain("portugal");
  });

  it("ignores case and surrounding words", () => {
    expect(named("  a week in KYOTO  ")).toContain("japan");
    expect(named("Lisbon and the Algarve")).toContain("portugal");
  });

  it("matches whole words only", () => {
    expect(photoForTrip({ destination: "Mogoa" })).toBe(ELSEWHERE_PHOTO);
    expect(photoForTrip({ destination: "Baliwag" })).toBe(ELSEWHERE_PHOTO);
  });

  it("never stands in a photo of one place for another", () => {
    expect(photoForTrip({ destination: "Iceland" })).toBe(ELSEWHERE_PHOTO);
    expect(photoForTrip({ destination: "Porto Alegre, Brazil" })).toBe(ELSEWHERE_PHOTO);
    expect(photoForTrip({ destination: "India" })).toBe(ELSEWHERE_PHOTO);
  });

  it("falls back to the cities the planner chose", () => {
    const trip = {
      destination: "Southeast Asia",
      cities: [{ name: "Bangkok", country: "Thailand" }],
    };
    expect(photoForTrip(trip).src).toContain("thailand");
  });

  it("prefers the destination over a city, then a city over the title", () => {
    expect(
      photoForTrip({ destination: "Japan", cities: [{ name: "Bangkok", country: "Thailand" }] }).src,
    ).toContain("japan");
    expect(
      photoForTrip({ destination: "Asia", title: "Kyoto", cities: [{ name: "Bali", country: "Indonesia" }] })
        .src,
    ).toContain("bali");
  });

  it("uses the title when nothing else says where", () => {
    expect(photoForTrip({ destination: "Somewhere warm", title: "Weekend in Goa" }).src).toContain("goa");
  });
});

describe("the files", () => {
  const publicDir = path.join(process.cwd(), "public");

  it("exist for every photo the app can show", () => {
    const sources = [
      ...["Thailand", "Bali", "Italy", "Japan", "Goa", "Portugal"].map(named),
      PLAN_PHOTO.src,
      TRAVIS_PHOTO.src,
      ELSEWHERE_PHOTO.src,
    ];
    for (const src of sources) {
      expect(existsSync(path.join(publicDir, src)), src).toBe(true);
    }
  });

  it("are each credited, on the credits page and in the repository's list", () => {
    const sources = [
      ...["Thailand", "Bali", "Italy", "Japan", "Goa", "Portugal"].map(named),
      PLAN_PHOTO.src,
      TRAVIS_PHOTO.src,
      ELSEWHERE_PHOTO.src,
    ];
    const slugs = PHOTO_CREDITS.map((credit) => credit.slug);
    const markdown = readFileSync(path.join(publicDir, "images/CREDITS.md"), "utf8");

    for (const src of sources) {
      const slug = path.basename(src, ".jpg");
      expect(slugs, `${slug} is on the credits page`).toContain(slug);
      expect(markdown, `${slug} is in CREDITS.md`).toContain(`destinations/${slug}.jpg`);
    }
    // And no credit for a photo that isn't there any more.
    for (const slug of slugs) {
      expect(existsSync(path.join(publicDir, "images/destinations", `${slug}.jpg`)), slug).toBe(true);
    }
  });
});
