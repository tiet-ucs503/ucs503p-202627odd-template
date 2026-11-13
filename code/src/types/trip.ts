import type { BudgetBreakdown } from "./budget";
import type { FlightQuote } from "./flights";
import type { City, TravelerType, TravelStyle, TripDay } from "./itinerary";
import type { CityPlan } from "./planning";

export type TripStatus = "generating" | "ready";

/**
 * A trip is stored as a single Firestore document. Iteration 1 modelled a
 * trip as a flat list of places; V1 replaces that with the richer
 * city/day/activity structure the roadmap and budget views need. At this
 * scale (a handful of cities, a couple of dozen activities) the whole trip
 * comfortably fits well under Firestore's 1MiB document limit, so denormalizing
 * everything into one document keeps reads and edits a single round trip.
 */
export interface Trip {
  id: string;
  ownerId: string;
  status: TripStatus;

  destination: string;
  title: string;
  startDate: string;
  endDate: string;
  dayCount: number;

  currency: string;
  travelers: number;
  travelerType: TravelerType;
  preferences: TravelStyle[];

  cities: City[];
  days: TripDay[];

  budget: BudgetBreakdown;

  /**
   * How this trip's cities were chosen. Optional so trips saved before the
   * planner existed still load; absent simply means "planned by an earlier
   * version of TripEase".
   */
  planning?: CityPlan | null;

  /**
   * How the flight cost in the budget was worked out. null when flights were
   * left out; absent on trips saved before quotes existed, whose flight cost
   * was a flat estimate.
   */
  flights?: FlightQuote | null;

  createdAt: Date;
  updatedAt: Date;
}

/** The subset of a trip decided in the create-trip wizard, before generation. */
export interface TripDraftInput {
  destination: string;
  startDate: string;
  endDate: string;
  budget: number;
  currency: string;
  travelers: number;
  travelerType: TravelerType;
  preferences: TravelStyle[];
  /** Leave out the flight cost (road trip, tickets already booked). Absent means include. */
  includeFlights?: boolean;
  /** IATA code of the airport the traveller flies from. Absent means Delhi is assumed. */
  origin?: string;
  /**
   * The day an earlier flight quote for this trip was made, YYYY-MM-DD. A
   * rebuild sends it back so the fare is priced as of that day and doesn't
   * drift just because the city list was edited later.
   */
  quotedOn?: string;
}

/** What the itinerary generator produces; validated, then persisted as a Trip. */
export interface GeneratedItinerary {
  destination: string;
  title: string;
  startDate: string;
  endDate: string;
  dayCount: number;
  currency: string;
  cities: City[];
  days: TripDay[];
  budget: BudgetBreakdown;
  /** null when flights were left out of the budget. */
  flights?: FlightQuote | null;
}
