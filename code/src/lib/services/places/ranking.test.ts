import { describe, expect, it } from "vitest";
import { MIN_REVIEWS_TO_RECOMMEND, pickHotel, qualityScore, rankByQuality, topRated, withoutDuplicates } from "@/lib/services/places/ranking";
import { ratedPlace } from "@/test-support/places/rated-provider";

const names = (places: { name: string }[]) => places.map((p) => p.name);

describe("qualityScore", () => {
  it("is null for a place with no rating, never an invented one", () => {
    expect(qualityScore(ratedPlace("x", null, null))).toBeNull();
  });

  it("does not let a perfect score from a few reviews beat a very good one from thousands", () => {
    const few = qualityScore(ratedPlace("few", 5.0, 9))!;
    const many = qualityScore(ratedPlace("many", 4.7, 12_000))!;
    expect(many).toBeGreaterThan(few);
  });

  it("approaches the place's own rating as reviews grow", () => {
    expect(qualityScore(ratedPlace("x", 4.8, 1_000_000))!).toBeCloseTo(4.8, 1);
  });

  it("treats an unknown review count as no evidence, pulling toward a typical rating", () => {
    const score = qualityScore(ratedPlace("x", 5.0, null))!;
    expect(score).toBeCloseTo(4.2, 5);
  });

  it("ranks the same rating higher with more reviews behind it", () => {
    expect(qualityScore(ratedPlace("a", 4.6, 5_000))!).toBeGreaterThan(qualityScore(ratedPlace("b", 4.6, 50))!);
  });
});

describe("rankByQuality", () => {
  it("puts the best first, whatever order the provider returned them in", () => {
    const ranked = rankByQuality([
      ratedPlace("middling", 4.0, 800),
      ratedPlace("best", 4.8, 20_000),
      ratedPlace("good", 4.5, 3_000),
    ]);
    expect(names(ranked)).toEqual(["best", "good", "middling"]);
  });

  it("puts places with no rating last, in the order they came, without giving them a rating", () => {
    const ranked = rankByQuality([ratedPlace("unrated 1", null, null), ratedPlace("rated", 3.9, 400), ratedPlace("unrated 2", null, null)]);
    expect(names(ranked)).toEqual(["rated", "unrated 1", "unrated 2"]);
    expect(ranked[1].rating).toBeNull();
  });

  it("keeps the provider's order between equals", () => {
    const ranked = rankByQuality([ratedPlace("first", 4.5, 1000), ratedPlace("second", 4.5, 1000)]);
    expect(names(ranked)).toEqual(["first", "second"]);
  });

  it("lets a matching travel style win a close call, but not a clearly better place", () => {
    const food = ratedPlace("food place", 4.5, 2_000, { styleTags: ["food"] });
    const plain = ratedPlace("plain place", 4.55, 2_000);
    expect(names(rankByQuality([plain, food], ["food"]))[0]).toBe("food place");

    const muchBetter = ratedPlace("much better", 4.9, 30_000);
    expect(names(rankByQuality([food, muchBetter], ["food"]))[0]).toBe("much better");
  });

  it("does not change the list it is given", () => {
    const input = [ratedPlace("a", 3.0, 100), ratedPlace("b", 4.9, 9_000)];
    const copy = [...input];
    rankByQuality(input);
    expect(input).toEqual(copy);
  });

  it("copes with nothing", () => {
    expect(rankByQuality([])).toEqual([]);
  });
});

describe("withoutDuplicates", () => {
  it("drops the same place listed twice, by id or by name", () => {
    const a = ratedPlace("Wat Pho", 4.7, 50_000);
    const result = withoutDuplicates([a, { ...a }, ratedPlace("wat  pho!", 4.0, 10), ratedPlace("Wat Arun", 4.7, 40_000)]);
    expect(names(result)).toEqual(["Wat Pho", "Wat Arun"]);
  });
});

describe("pickHotel", () => {
  const luxury = ratedPlace("Luxury", 4.9, 8_000, { price: { amount: 20_000, currency: "INR", isEstimate: true } });
  const fair = ratedPlace("Fair", 4.5, 3_000, { price: { amount: 3_500, currency: "INR", isEstimate: true } });
  const unpriced = ratedPlace("Unpriced", 4.2, 500);

  it("is null when there are no hotels", () => {
    expect(pickHotel([], 5_000)).toBeNull();
  });

  it("takes the best-rated hotel when there is no budget to respect", () => {
    expect(pickHotel([fair, luxury], null)?.name).toBe("Luxury");
  });

  it("passes over a hotel whose price is known and over the budget", () => {
    expect(pickHotel([luxury, fair, unpriced], 5_000)?.name).toBe("Fair");
  });

  it("allows a hotel with no known price: not knowing is not the same as expensive", () => {
    expect(pickHotel([luxury, unpriced], 5_000)?.name).toBe("Unpriced");
  });

  it("uses the best-rated anyway when nothing fits, rather than giving no hotel", () => {
    expect(pickHotel([luxury, ratedPlace("Also dear", 4.0, 100, { price: { amount: 30_000, currency: "INR", isEstimate: true } })], 1_000)?.name).toBe("Luxury");
  });
});

describe("topRated", () => {
  it("returns the best few, best first", () => {
    const places = Array.from({ length: 10 }, (_, i) => ratedPlace(`p${i}`, 3.5 + i / 10, 500));
    expect(names(topRated(places, 3))).toEqual(["p9", "p8", "p7"]);
  });

  it("leaves out places with too few reviews to call highly rated, when there are enough others", () => {
    const places = [
      ratedPlace("thin", 5.0, MIN_REVIEWS_TO_RECOMMEND - 1),
      ratedPlace("a", 4.5, 900),
      ratedPlace("b", 4.4, 900),
      ratedPlace("c", 4.3, 900),
    ];
    expect(names(topRated(places, 4))).not.toContain("thin");
  });

  it("uses whatever there is when almost nothing has enough reviews", () => {
    const places = [ratedPlace("only", 4.9, 5), ratedPlace("other", 4.1, 3)];
    expect(names(topRated(places, 5))).toEqual(["only", "other"]);
  });

  it("drops duplicates", () => {
    const a = ratedPlace("Same Place", 4.5, 1000);
    expect(names(topRated([a, { ...a }], 5))).toEqual(["Same Place"]);
  });
});
