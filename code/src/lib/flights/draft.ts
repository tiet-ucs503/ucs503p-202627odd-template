import type { FlightQuote } from "@/types/flights";
import type { TripDraftInput } from "@/types/trip";

/**
 * The flight settings a rebuild or an agent edit must send back to the
 * generator so that re-pricing a saved trip gives the same fare it had.
 *
 * - A saved quote means flights are in (even a zero one, for a trip that
 *   starts at home); `null` means they were left out. Trips saved before
 *   quotes existed only have the budget amount to go on.
 * - The same airport and the same quote day, so editing cities doesn't move
 *   the fare unless the first city (and so the arrival airport) changes.
 */
export function flightDraftFields(trip: {
  flights?: FlightQuote | null;
  budget: { categories: { flights: number } };
}): Pick<TripDraftInput, "includeFlights" | "origin" | "quotedOn"> {
  const { flights } = trip;
  return {
    includeFlights: flights !== undefined ? flights !== null : trip.budget.categories.flights > 0,
    ...(flights && !flights.originAssumed ? { origin: flights.origin.code } : {}),
    ...(flights ? { quotedOn: flights.quotedOn } : {}),
  };
}
