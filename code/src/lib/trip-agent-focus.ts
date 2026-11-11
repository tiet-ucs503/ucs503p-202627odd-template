import type { TripAgentFocus } from "@/types/trip-agent";
import type { Trip } from "@/types/trip";

/**
 * What the traveller pointed Travis at, in words: "Day 3 · Phuket", or the
 * name of a place. Null when the focus is empty or points at something that is
 * no longer in the trip (it was removed since), so a stale chip never shows.
 * Activities win over days, and days over cities, matching what the agent is told.
 */
export function describeTripFocus(trip: Pick<Trip, "cities" | "days">, focus: TripAgentFocus | null | undefined): string | null {
  if (!focus) return null;

  if (focus.activityId) {
    for (const day of trip.days) {
      const activity = day.activities.find((a) => a.id === focus.activityId);
      if (activity) return `${activity.name} · Day ${day.dayNumber}`;
    }
  }
  if (focus.dayId) {
    const day = trip.days.find((d) => d.id === focus.dayId);
    if (day) {
      const city = trip.cities.find((c) => c.id === day.cityId);
      return city ? `Day ${day.dayNumber} · ${city.name}` : `Day ${day.dayNumber}`;
    }
  }
  if (focus.cityId) {
    return trip.cities.find((c) => c.id === focus.cityId)?.name ?? null;
  }
  return null;
}
