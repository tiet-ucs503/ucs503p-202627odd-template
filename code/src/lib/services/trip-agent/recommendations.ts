import type { PlacesProvider } from "@/lib/services/places/provider";
import { PlacesProviderError } from "@/lib/services/places/errors";
import { topRated } from "@/lib/services/places/ranking";
import type { Place } from "@/types/place";
import type { AgentTrip, CityTopPlaces, TopPlace, TripAgentFocus } from "@/types/trip-agent";

/**
 * Real, top-rated places for Travis to recommend from.
 *
 * A model asked "what should I try in Bangkok?" answers from memory: fluent,
 * often right, sometimes out of date or invented. So when a question is about
 * what to see or eat, the best-rated real places in the trip's cities are looked
 * up first (Google Maps ratings, through the places provider) and handed to the
 * model with the question. It is told to recommend from that list and to quote a
 * rating only from it.
 *
 * This is best effort. If the lookup fails, Travis still answers, from what he
 * knows, and the prompt says not to quote ratings then. It never fails a request.
 */

const ASKS_FOR_RECOMMENDATIONS =
  /\b(?:recommend\w*|suggest\w*|famous|best|top|popular|must[- ]?(?:try|see|do|visit)|worth|local\w*|try|eat|food|restaurants?|cafes?|dinner|lunch|breakfast|street food|nightlife|bars?|sights?|attractions?|things to do|what to do|where to|hidden gems?|highly rated|good places?)\b/i;

/** Whether the traveller is asking what to see, eat or do, rather than asking for a change. */
export function wantsRecommendations(message: string): boolean {
  return ASKS_FOR_RECOMMENDATIONS.test(message);
}

/** How many cities to look up for one question. Each is two searches (cached for ten minutes). */
const MAX_CITIES = 3;
const PER_LIST = 6;

function toTopPlace(place: Place): TopPlace | null {
  if (!place.rating) return null;
  return { name: place.name, rating: place.rating.value, reviews: place.rating.count };
}

function listOf(places: Place[]): TopPlace[] {
  return topRated(places, PER_LIST)
    .map(toTopPlace)
    .filter((p): p is TopPlace => p !== null);
}

/**
 * Which cities the question is about: the one being looked at, else any the
 * message names, else the trip's first few.
 */
export function citiesToGround(trip: AgentTrip, message: string, focus?: TripAgentFocus): string[] {
  const ordered = [...trip.cities].sort((a, b) => a.order - b.order);

  const focused =
    (focus?.cityId ? ordered.find((c) => c.id === focus.cityId) : undefined) ??
    (focus?.dayId ? ordered.find((c) => c.id === trip.days.find((d) => d.id === focus.dayId)?.cityId) : undefined) ??
    (focus?.activityId
      ? ordered.find((c) => c.id === trip.days.find((d) => d.activities.some((a) => a.id === focus.activityId))?.cityId)
      : undefined);
  if (focused) return [focused.name];

  const lower = message.toLowerCase();
  const named = ordered.filter((c) => lower.includes(c.name.toLowerCase()));
  if (named.length > 0) return named.slice(0, MAX_CITIES).map((c) => c.name);

  return ordered.slice(0, MAX_CITIES).map((c) => c.name);
}

/** The best-rated sights and restaurants in the relevant cities, or null if there is nothing to offer. */
export async function gatherTopPlaces(
  trip: AgentTrip,
  message: string,
  focus: TripAgentFocus | undefined,
  places: PlacesProvider,
): Promise<CityTopPlaces[] | null> {
  const cities = citiesToGround(trip, message, focus);

  const found = await Promise.all(
    cities.map(async (city): Promise<CityTopPlaces | null> => {
      try {
        const base = { destination: city, country: trip.destination, currency: trip.currency, limit: 20 };
        const [sights, food] = await Promise.all([
          places.searchPlaces({ ...base, type: "attraction" }),
          places.searchPlaces({ ...base, type: "restaurant" }),
        ]);
        const result = { city, sights: listOf(sights), food: listOf(food) };
        return result.sights.length + result.food.length > 0 ? result : null;
      } catch (error) {
        // Recommendations are a bonus. A failed lookup must not fail the request.
        const code = error instanceof PlacesProviderError ? error.code : "unknown";
        console.warn(`[trip-agent] top places lookup failed (${code}) for ${city}`);
        return null;
      }
    }),
  );

  const usable = found.filter((c): c is CityTopPlaces => c !== null);
  return usable.length > 0 ? usable : null;
}
