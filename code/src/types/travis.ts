import type { TravelStyle } from "./itinerary";

/**
 * Travis: TripEase's trip-planning assistant.
 *
 * These types describe the conversation as the app sees it. They deliberately
 * hold no prompts and no raw model output — only what was said and the
 * structured suggestions that came back, so a conversation stays small enough
 * to keep in the browser and is cheap to send back as context.
 *
 * Iteration 1 of Travis is discovery only: where to go and when. It reads no
 * trip and changes nothing. Editing a trip is a later iteration and will reuse
 * these message types.
 */

export type TravisRole = "user" | "assistant";

/** What the browser sends for each earlier turn. Plain text only. */
export interface TravisMessageInput {
  role: TravisRole;
  content: string;
  /**
   * Travis's turns only: the places that turn suggested. A reply's text does
   * not reliably name them, and without them a follow-up like "which of those
   * is cheapest?" would have nothing to refer to.
   */
  suggested?: string[];
}

/**
 * How expensive a travel window usually is compared with the rest of the same
 * destination's year. Never an amount: Travis has no live prices, and a
 * relative label is the most that seasonality can honestly support.
 */
export type CostOutlook = "lower" | "typical" | "higher";

export interface DestinationSuggestion {
  /** Stable within one reply; used as a React key and to label buttons. */
  id: string;
  /** A country, city, island or region a traveller could actually book. */
  destination: string;
  /** One line on why it fits what the traveller asked for. */
  headline: string;
  /** Best months to go (1–12). `endMonth` may be earlier than `startMonth`: the window wraps the new year. */
  startMonth: number;
  endMonth: number;
  /** The window in words, e.g. "Jun–Aug" or "Nov–Feb". Derived, never model-written. */
  windowLabel: string;
  costOutlook: CostOutlook;
  costReason: string;
  weatherNote: string;
  watchOut: string | null;
  /** A sensible length for the trip, in days. */
  suggestedDays: number;
  styles: TravelStyle[];
  /**
   * Concrete dates inside the window, worked out deterministically from the
   * month range and today's date — the model never writes a date. They are a
   * starting point the wizard lets the traveller change.
   */
  startDate: string;
  endDate: string;
}

/** One turn from Travis, after validation and clean-up. */
export interface TravisReply {
  reply: string;
  suggestions: DestinationSuggestion[];
  /** Things the traveller might want to say next, written from their side. */
  followUps: string[];
}

/** `demo` means the canned stand-in answered, not a language model. */
export type TravisMode = "live" | "demo";

export interface TravisResponse extends TravisReply {
  mode: TravisMode;
}

/** A message as kept in the browser and shown on screen. */
export interface TravisChatMessage {
  id: string;
  role: TravisRole;
  content: string;
  /** Present on Travis's messages only. */
  suggestions?: DestinationSuggestion[];
  followUps?: string[];
  /** Which kind of answer this was, so a demo-mode notice survives a page refresh. */
  mode?: TravisMode;
}
