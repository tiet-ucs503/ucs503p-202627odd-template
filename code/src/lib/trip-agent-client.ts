import { postAuthenticated } from "@/lib/api-client";
import type { Trip } from "@/types/trip";
import type { AgentTrip, TripAgentFocus, TripAgentMessageInput, TripAgentResponse } from "@/types/trip-agent";

/** The part of a saved trip the agent reads: everything except ownership and bookkeeping. */
export function toAgentTrip(trip: Trip): AgentTrip {
  return {
    id: trip.id,
    title: trip.title,
    destination: trip.destination,
    startDate: trip.startDate,
    endDate: trip.endDate,
    dayCount: trip.dayCount,
    currency: trip.currency,
    travelers: trip.travelers,
    travelerType: trip.travelerType,
    preferences: trip.preferences,
    cities: trip.cities,
    days: trip.days,
    budget: trip.budget,
    ...(trip.flights !== undefined ? { flights: trip.flights } : {}),
  };
}

/**
 * Ask the trip agent for a change. Returns a sentence and, when there is one, a
 * proposal to confirm. Changes nothing: see `/api/trips/agent`.
 */
export function askTripAgent(input: {
  trip: AgentTrip;
  messages: TripAgentMessageInput[];
  focus?: TripAgentFocus;
}): Promise<TripAgentResponse> {
  return postAuthenticated<TripAgentResponse>("/api/trips/agent", input);
}
