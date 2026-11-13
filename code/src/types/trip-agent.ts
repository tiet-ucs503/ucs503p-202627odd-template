import type { BudgetBreakdown } from "./budget";
import type { FlightQuote } from "./flights";
import type { ActivityCategory, City, TravelerType, TravelStyle, TripDay } from "./itinerary";

/**
 * Types for the trip agent: the assistant on a trip's page that changes the
 * trip when it is asked to.
 *
 * The shape of the idea: the model never edits a trip. It proposes a short list
 * of `EditOperation`s, our code turns them into a concrete `ChangeSet` (real
 * places, recomputed budget, re-checked days), and the traveller confirms it
 * before anything is saved.
 */

/** The part of a trip the agent reads and may change. A `Trip` minus its bookkeeping. */
export interface AgentTrip {
  id: string;
  title: string;
  destination: string;
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
   * The saved flight quote, if the trip has one. Not shown to the model; our
   * code re-prices it when an edit changes where the trip starts.
   */
  flights?: FlightQuote | null;
}

/**
 * Everything the agent can do, and nothing else. Ids are the ones in the trip
 * the agent was shown; a place is asked for by a short search phrase and found
 * by the places provider, never named by the model.
 */
export type EditOperation =
  | { type: "remove_activity"; activityId: string }
  | { type: "move_activity"; activityId: string; toDayId: string }
  | { type: "replace_activity"; activityId: string; query: string }
  | { type: "add_activity"; dayId: string; query: string; category?: ActivityCategory }
  | { type: "change_hotel"; cityId: string; query: string }
  /** The complete new city list, in visiting order. Its days set the trip's length. */
  | { type: "set_cities"; cities: { name: string; days: number }[] }
  /** A new length: our code spreads the days across the cities there already are. */
  | { type: "set_trip_length"; dayCount: number };

export type EditOperationType = EditOperation["type"];

/** What changes in the saved trip. Applying a change set writes exactly this. */
export interface TripPatch {
  cities: City[];
  days: TripDay[];
  budget: BudgetBreakdown;
  endDate: string;
  dayCount: number;
  /** Present only when the edit re-priced the flights; absent means they are left as saved. */
  flights?: FlightQuote | null;
}

/** A few numbers that say what a change did, before and after. */
export interface TripStats {
  dayCount: number;
  total: number;
  estimatedTotal: number;
  cityDays: { name: string; days: number }[];
  /** Day numbers the feasibility check says do not fit in a day. */
  overfullDays: number[];
}

/** A proposed change, resolved against real data and ready to confirm. */
export interface ChangeSet {
  id: string;
  /** Identifies the trip this was worked out against; applying it to a changed trip is refused. */
  baseVersion: string;
  /** What will happen, in plain words, one per line. */
  lines: string[];
  /** Things worth knowing before saying yes. */
  warnings: string[];
  patch: TripPatch;
  before: TripStats;
  after: TripStats;
}

/** A real, well-rated place and the rating it really has (Google Maps), for Travis to recommend from. */
export interface TopPlace {
  name: string;
  rating: number;
  /** How many reviews the rating rests on. Null when the provider doesn't say. */
  reviews: number | null;
}

/** The best-rated sights and restaurants in one city. */
export interface CityTopPlaces {
  city: string;
  sights: TopPlace[];
  food: TopPlace[];
}

/** Where the traveller was looking when they asked, so "this day" means something. */
export interface TripAgentFocus {
  dayId?: string;
  cityId?: string;
  activityId?: string;
}

export interface TripAgentMessageInput {
  role: "user" | "assistant";
  content: string;
}

export interface TripAgentResponse {
  reply: string;
  /** Null when the agent is asking a question, or could not do what was asked. */
  changeSet: ChangeSet | null;
}

export type ChangeStatus = "pending" | "applied" | "discarded" | "undone";

/**
 * A change set as the conversation keeps it. The `patch` (the whole new
 * itinerary) is present only while the change is waiting to be confirmed: once
 * it is applied or discarded it is dropped, and it is never written to storage.
 * What stays is what the traveller reads: the lines, warnings and the numbers.
 */
export type ChangeSetView = Omit<ChangeSet, "patch"> & { patch?: TripPatch };

/** One turn of a trip's conversation, as the page keeps it. */
export interface TripAgentChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  changeSet?: ChangeSetView;
  /** What became of `changeSet`. */
  status?: ChangeStatus;
}
