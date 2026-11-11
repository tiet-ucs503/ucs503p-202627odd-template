import type { TravelStyle } from "@/types/itinerary";
import type { Place } from "@/types/place";

/**
 * Choosing the best places, from real ratings.
 *
 * A search returns places in the order the provider thinks fits the words, which
 * is not the same as best. Two traps are well known. A 5.0 from nine reviews is
 * not better than a 4.7 from twelve thousand; and the most-reviewed place is not
 * always the best one. So a place is scored by a Bayesian average: its rating,
 * pulled toward a typical rating until it has enough reviews to stand on its own.
 *
 * Nothing here invents anything. A place with no rating is not given one: it
 * simply ranks below every place that has one.
 */

/** A typical rating for somewhere that people have bothered to review. */
const TYPICAL_RATING = 4.2;
/** How many reviews it takes before a place's own rating counts for half. */
const CONFIDENCE_REVIEWS = 150;
/** A match to one of the traveller's travel styles is worth this much rating. It is a tie-breaker, not a trump card. */
const STYLE_BONUS = 0.15;
/** Below this many reviews the rating is too thin to show off as "highly rated". */
export const MIN_REVIEWS_TO_RECOMMEND = 30;

/** Rating pulled toward `TYPICAL_RATING` by how few reviews it has. Null when there is no rating. */
export function qualityScore(place: Pick<Place, "rating">): number | null {
  const rating = place.rating;
  if (!rating || !Number.isFinite(rating.value)) return null;
  const reviews = Math.max(0, rating.count ?? 0);
  return (reviews / (reviews + CONFIDENCE_REVIEWS)) * rating.value + (CONFIDENCE_REVIEWS / (reviews + CONFIDENCE_REVIEWS)) * TYPICAL_RATING;
}

/**
 * Best first. Places without a rating go last, in the order they came in.
 * A matching travel style nudges a place up a little, so a food lover's top
 * attraction is a good food place, but never above one that is clearly better.
 */
export function rankByQuality<T extends Place>(places: T[], preferences: readonly TravelStyle[] = []): T[] {
  const score = (place: T) => {
    const quality = qualityScore(place);
    if (quality === null) return null;
    const matches = place.styleTags.filter((tag) => preferences.includes(tag)).length;
    return quality + Math.min(matches, 2) * STYLE_BONUS;
  };

  return places
    .map((place, index) => ({ place, index, score: score(place) }))
    .sort((a, b) => {
      if (a.score === null && b.score === null) return a.index - b.index;
      if (a.score === null) return 1;
      if (b.score === null) return -1;
      return b.score - a.score || a.index - b.index;
    })
    .map((entry) => entry.place);
}

/** The same place listed twice under slightly different names ("Wat Pho" and "Wat Pho Temple") is one stop. */
export function withoutDuplicates<T extends Place>(places: T[]): T[] {
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();
  return places.filter((place) => {
    const name = place.name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (seenIds.has(place.id) || seenNames.has(name)) return false;
    seenIds.add(place.id);
    seenNames.add(name);
    return true;
  });
}

/**
 * Choose a hotel: the best-rated one that fits the budget.
 *
 * `maxPerNight` is what the trip can spend on a night. A hotel whose price is
 * known (from the provider's coarse price level) and above it is passed over.
 * One with no known price is allowed, since not knowing is not the same as
 * expensive. If nothing fits, the best-rated one is used anyway: a traveller
 * would rather be told the budget is tight than be given no hotel.
 */
export function pickHotel<T extends Place>(hotels: T[], maxPerNight: number | null): T | null {
  const ranked = rankByQuality(withoutDuplicates(hotels));
  if (ranked.length === 0) return null;
  if (maxPerNight === null) return ranked[0];
  return ranked.find((hotel) => !hotel.price || hotel.price.amount <= maxPerNight) ?? ranked[0];
}

/** The best few, with enough reviews to be worth calling "highly rated". Falls back to whatever there is. */
export function topRated<T extends Place>(places: T[], count: number): T[] {
  const ranked = rankByQuality(withoutDuplicates(places));
  const established = ranked.filter((p) => (p.rating?.count ?? 0) >= MIN_REVIEWS_TO_RECOMMEND);
  return (established.length >= Math.min(count, 3) ? established : ranked).slice(0, count);
}
