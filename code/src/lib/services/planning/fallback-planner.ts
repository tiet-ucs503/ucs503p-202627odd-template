import { resolveCountry } from "@/lib/countries";
import type { CityAllocation, CityPlanRequest } from "@/types/planning";
import { splitDaysAcrossCities } from "./split-days";

/**
 * The planner that runs when there's no AI configured, or when the AI's
 * answer doesn't survive validation. It must never fail and never invent.
 *
 * Two cases, most specific first:
 *
 * 1. A supported country (see `@/lib/countries`) has a few real cities written
 *    down for it, so the trip is split across places that exist and are worth
 *    the time.
 * 2. Anything else stays in one place named after the destination itself.
 *    Earlier iterations split unknown destinations into "<Destination> City"
 *    and "<Destination> Coast", which read like real cities but weren't, which
 *    is exactly the fabrication this planner has to avoid. Choosing real
 *    cities for an arbitrary place is a reasoning job; without the AI we
 *    don't guess, we just don't split.
 */
export const FALLBACK_PLANNER_VERSION = "fallback-3";

/** Below this, a stop costs more in travel than it returns in time there. */
const MIN_DAYS_PER_CITY = 2;

export function planCitiesDeterministically(request: CityPlanRequest): CityAllocation[] {
  const country = resolveCountry(request.destination);
  if (country && country.cities.length > 0) {
    const affordableCities = Math.max(1, Math.floor(request.dayCount / MIN_DAYS_PER_CITY));
    const usable = country.cities.slice(0, Math.min(country.cities.length, affordableCities));
    const days = splitDaysAcrossCities(
      request.dayCount,
      usable.map((city) => city.share),
    );
    return usable.map((city, i) => ({
      name: city.name,
      days: days[i],
      reason: `A well-known stop in ${country.name}`,
    }));
  }

  return [
    {
      name: request.destination,
      days: request.dayCount,
      reason: "Single base for the whole trip",
    },
  ];
}
