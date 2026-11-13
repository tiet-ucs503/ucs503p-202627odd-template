/** An airport in a quote: its code and the city a traveller knows it by. */
export interface QuotedAirport {
  code: string;
  city: string;
}

/**
 * An estimated round-trip economy fare for a trip, saved with the trip so the
 * number in the budget can be explained and stays the same when the trip is
 * rebuilt. Every amount is in rupees; the budget converts the total.
 */
export interface FlightQuote {
  origin: QuotedAirport;
  /** Where the trip flies to; null when the trip starts at the origin itself. */
  arrival: QuotedAirport | null;
  /** True when no origin was chosen and Delhi was assumed. */
  originAssumed: boolean;
  /** Per traveller. `typical` is what the budget uses. */
  perTravelerInr: { low: number; typical: number; high: number };
  travelers: number;
  /** `typical` for everyone travelling. */
  totalInr: number;
  /** The day the quote was made, YYYY-MM-DD. */
  quotedOn: string;
  /** Days from `quotedOn` to the start of the trip. */
  daysAhead: number;
  /**
   * "route": built on a researched year of fares for this route.
   * "modelled": no researched route, so distance and nearby routes were used.
   */
  confidence: "route" | "modelled";
  /** One or two plain sentences on what the estimate is built from. */
  basis: string;
}
