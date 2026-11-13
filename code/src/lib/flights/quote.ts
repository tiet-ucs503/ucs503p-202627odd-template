import { normalise, resolveCountry } from "@/lib/countries";
import type { LatLng } from "@/types/place";
import type { FlightQuote, QuotedAirport } from "@/types/flights";
import { DEFAULT_ORIGIN, INDIAN_AIRPORTS, indianAirport, type IndianAirport } from "./airports";
import {
  CONNECTION_SHARE,
  COUNTRY_FARES,
  DOMESTIC_BASE_INR,
  DOMESTIC_CONNECTION_DISCOUNT,
  DOMESTIC_PER_KM_INR,
  DOMESTIC_ROUTES,
  DRIVE_INSTEAD_KM,
  GROUP_LAST_MINUTE,
  GROUP_SEASON,
  HUB_FACTORS,
  ORIGIN_OVERRIDES,
  ROUTE_FACTORS,
  type FareGroup,
  type Gateway,
} from "./fares";

/**
 * Estimates a round-trip economy fare the way a fare search would quote it:
 * for a given starting airport, destination, departure date and party size,
 * on a given day.
 *
 * The estimate starts from a real year of fares for the route (or the nearest
 * researched one) and then moves it for the things that move real fares:
 *
 *   yearly average  x  month of travel  x  how far ahead it is booked
 *                   x  day of the week  x  how many seats are needed
 *
 * It is deterministic: the same inputs on the same day give the same quote.
 * That is what lets a saved trip be rebuilt without its flight cost drifting:
 * the rebuild passes the original quote date back in as `now`.
 */

export interface FlightQuoteInput {
  /** IATA code of the starting airport. Missing or unknown means Delhi. */
  origin?: string | null;
  /** The trip's destination country, as stored on the trip. */
  destination: string;
  /** The first city of the itinerary: decides which airport is flown into. */
  firstCity?: string | null;
  /** Where that first city is, when known: places it when the name doesn't. */
  firstCityLocation?: LatLng | null;
  /** Departure, YYYY-MM-DD. */
  startDate: string;
  travelers: number;
  /** The day the quote is made. Defaults to today. */
  now?: Date;
}

const MS_PER_DAY = 86_400_000;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September",
  "October", "November", "December"];

/** True when the destination is India, so the flight is a domestic one. */
export function isDomestic(destination: string): boolean {
  return resolveCountry(destination)?.code === "IN";
}

/** Great-circle distance in km. */
export function distanceKm(a: LatLng, b: LatLng): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

// ---------------------------------------------------------------------------
// Matching a place name to an airport

interface Named {
  city: string;
  serves: string[];
}

/** The first entry that serves `text`: an exact name first, then a whole-word mention. */
function matchPlace<T extends Named>(entries: T[], text: string | null | undefined): T | undefined {
  if (!text) return undefined;
  const whole = normalise(text);
  // "Ubud, Bali" and "Ubud" should both find Bali: try the part before the first comma, then all of it.
  const head = normalise(text.split(",")[0] ?? "");
  for (const candidate of [head, whole]) {
    if (!candidate) continue;
    const exact = entries.find(
      (e) => normalise(e.city) === candidate || e.serves.some((s) => normalise(s) === candidate),
    );
    if (exact) return exact;
  }
  for (const e of entries) {
    for (const term of [e.city, ...e.serves].map(normalise)) {
      if (term && new RegExp(`(^| )${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}( |$)`).test(whole)) return e;
    }
  }
  return undefined;
}

/** The nearest airport to a point, if one is within a reasonable drive. */
function nearestIndianAirport(point: LatLng, maxKm = 300): IndianAirport | undefined {
  let best: { airport: IndianAirport; km: number } | undefined;
  for (const airport of INDIAN_AIRPORTS) {
    const km = distanceKm(point, airport);
    if (km <= maxKm && (!best || km < best.km)) best = { airport, km };
  }
  return best?.airport;
}

// ---------------------------------------------------------------------------
// Fares

const HUBS = INDIAN_AIRPORTS.filter((a) => a.role === "hub");
/** How much further than the nearest hub another hub may be and still be a sensible place to connect. */
const HUB_DETOUR_KM = 400;

function routeKey(a: string, b: string): string {
  return [a, b].sort().join("-");
}

/** A nonstop return fare from the distance model, airport premiums included. */
function modelledNonstop(a: IndianAirport, b: IndianAirport): number {
  const km = distanceKm(a, b);
  return (DOMESTIC_BASE_INR + DOMESTIC_PER_KM_INR * km) * (a.premium ?? 1) * (b.premium ?? 1);
}

export function hasNonstop(a: IndianAirport, b: IndianAirport): boolean {
  if (DOMESTIC_ROUTES[routeKey(a.code, b.code)] !== undefined) return true;
  return a.role === "hub" || b.role === "hub" || (a.role === "focus" && b.role === "focus");
}

/** One leg's fare: the researched figure when there is one, else the model. */
function legFare(a: IndianAirport, b: IndianAirport): number {
  return DOMESTIC_ROUTES[routeKey(a.code, b.code)] ?? modelledNonstop(a, b);
}

/**
 * The cheapest sensible domestic return between two airports: the nonstop
 * where one exists, or a change at whichever hub comes out cheapest.
 */
export function domesticFareInr(a: IndianAirport, b: IndianAirport): { fare: number; researched: boolean } {
  const researched = DOMESTIC_ROUTES[routeKey(a.code, b.code)];
  if (researched !== undefined) return { fare: researched, researched: true };

  let fare = hasNonstop(a, b) ? modelledNonstop(a, b) : Infinity;
  for (const hub of HUBS) {
    if (hub.code === a.code || hub.code === b.code) continue;
    fare = Math.min(fare, (legFare(a, hub) + legFare(hub, b)) * DOMESTIC_CONNECTION_DISCOUNT);
  }
  return { fare, researched: false };
}

/**
 * An international return from an Indian airport to a gateway, before date
 * effects, and the hub it connects through when it has no data of its own.
 */
function internationalFareInr(
  origin: IndianAirport,
  gateway: Gateway,
  group: FareGroup,
): { fare: number; how: "route" | "group" | "via"; via: IndianAirport | null } {
  // Delhi's own fare, or a measured ratio for this exact pair.
  const measured = origin.code === "DEL" ? 1 : ROUTE_FACTORS[`${origin.code}-${gateway.code}`];
  if (measured !== undefined) return { fare: gateway.fromDelhiInr * measured, how: "route", via: null };

  // How this airport's fares to the region compare with Delhi's.
  const regional = HUB_FACTORS[origin.code]?.[group] ?? ORIGIN_OVERRIDES[origin.code]?.[group];
  if (regional !== undefined) return { fare: gateway.fromDelhiInr * regional, how: "group", via: null };

  // No researched flights of its own: connect at a hub. Only hubs close to the
  // nearest one count: Chandigarh to London goes through Delhi, not through
  // Bengaluru, however cheap Bengaluru-London is.
  const hubs = Object.keys(HUB_FACTORS)
    .map((code) => indianAirport(code))
    .filter((hub): hub is IndianAirport => Boolean(hub))
    .map((hub) => ({ hub, km: distanceKm(origin, hub) }));
  const nearest = Math.min(...hubs.map((h) => h.km));
  let best: { fare: number; how: "via"; via: IndianAirport | null } = { fare: Infinity, how: "via", via: null };
  for (const { hub, km } of hubs) {
    if (km > nearest + HUB_DETOUR_KM) continue;
    const hubFare = gateway.fromDelhiInr * (ROUTE_FACTORS[`${hub.code}-${gateway.code}`] ?? HUB_FACTORS[hub.code][group]);
    const fare = hubFare + CONNECTION_SHARE * domesticFareInr(origin, hub).fare;
    if (fare < best.fare) best = { fare, how: "via", via: hub };
  }
  return best;
}

// ---------------------------------------------------------------------------
// Date and party effects

/** This month's fare as a share of the yearly average: the group's year, reshaped by the place's own months. */
export function seasonFactor(group: FareGroup | "domestic", month: number, own?: Partial<Record<number, number>>): number {
  const year = [...GROUP_SEASON[group]];
  for (const [m, ratio] of Object.entries(own ?? {})) {
    if (ratio !== undefined) year[Number(m) - 1] = ratio;
  }
  // Rescale so the year still averages 1: the researched figure *is* the yearly average.
  const mean = year.reduce((sum, r) => sum + r, 0) / 12;
  return year[month - 1] / mean;
}

/**
 * How far ahead the ticket is bought, as a factor on the yearly average.
 * KAYAK's data for these routes: cheapest roughly 3 to 6 months out, about
 * average 4 to 6 weeks out, and `lastMinute` dearer inside two weeks. Booking
 * very early is a little dearer again, before airlines release cheaper fares.
 */
export function leadTimeFactor(daysAhead: number, lastMinute: number): number {
  const knots: [number, number][] = [
    [0, 1 + 1.35 * lastMinute],
    [7, 1 + 0.9 * lastMinute],
    [14, 1 + 0.45 * lastMinute],
    [21, 1 + 0.15 * lastMinute],
    [35, 1],
    [60, 0.97],
    [90, 0.94],
    [150, 0.93],
    [210, 0.95],
    [330, 0.98],
  ];
  const d = Math.max(0, daysAhead);
  if (d >= knots[knots.length - 1][0]) return knots[knots.length - 1][1];
  for (let i = 1; i < knots.length; i++) {
    const [d1, f1] = knots[i];
    const [d0, f0] = knots[i - 1];
    if (d <= d1) return f0 + ((f1 - f0) * (d - d0)) / (d1 - d0);
  }
  return 1;
}

/** Midweek departures are a little cheaper, Fridays and Sundays a little dearer. */
export function weekdayFactor(startDate: string): number {
  const day = new Date(`${startDate}T00:00:00Z`).getUTCDay();
  if (day === 2 || day === 3) return 0.97;
  if (day === 5 || day === 0) return 1.03;
  return 1;
}

/** A large party can't all get the cheapest seats on one flight. */
export function partyFactor(travelers: number): number {
  if (travelers >= 9) return 1.06;
  if (travelers >= 5) return 1.03;
  return 1;
}

// ---------------------------------------------------------------------------
// The quote

const round = (value: number, step: number) => Math.round(value / step) * step;

const label = (airport: { code: string; city: string }): QuotedAirport => ({ code: airport.code, city: airport.city });

function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / MS_PER_DAY);
}

function describe(params: {
  origin: QuotedAirport;
  arrival: QuotedAirport | null;
  originAssumed: boolean;
  source: string;
  month: number;
  season: number;
  daysAhead: number;
  travelers: number;
}): string {
  const { origin, arrival, originAssumed, source, month, season, daysAhead, travelers } = params;
  const parts: string[] = [];
  if (originAssumed) parts.push("No starting city was chosen, so this assumes you fly from Delhi.");
  const route = arrival ? `${origin.city} (${origin.code}) to ${arrival.city} (${arrival.code})` : `from ${origin.city}`;
  const monthName = MONTHS[month - 1];
  const article = /^[AEIOU]/.test(monthName) ? "an" : "a";
  const seasonNote = season >= 1.08 ? ", a peak month" : season <= 0.92 ? ", a quieter month" : "";
  const weeks = Math.round(daysAhead / 7);
  const booking =
    daysAhead < 14
      ? "booking now, less than two weeks before you leave, when fares are at their highest"
      : `booking now, about ${weeks} weeks before you leave`;
  parts.push(`Return economy, ${route}. Built from ${source}, for ${article} ${monthName} departure${seasonNote}, ${booking}.`);
  if (travelers >= 5) parts.push("Large groups rarely all get the cheapest seats, so this allows a little more.");
  return parts.join(" ");
}

/**
 * A full quote, or null when the destination isn't one TripEase prices
 * (an unsupported country). A trip that starts where the traveller already is
 * gets a zero quote rather than null, so the reason is still shown.
 */
export function quoteFlights(input: FlightQuoteInput): FlightQuote | null {
  // A departure that isn't a real calendar day can't be priced: say so with
  // null instead of letting a NaN reach the budget. (`2027-02-30` still parses
  // as a date, so the day is checked by round-tripping it.)
  const startMs = Date.parse(`${input.startDate}T00:00:00Z`);
  if (Number.isNaN(startMs) || new Date(startMs).toISOString().slice(0, 10) !== input.startDate) return null;

  const now = input.now ?? new Date();
  if (Number.isNaN(now.getTime())) return null;
  const quotedOn = now.toISOString().slice(0, 10);
  const daysAhead = Math.max(0, daysBetween(quotedOn, input.startDate));
  const month = Number(input.startDate.slice(5, 7));
  const travelers = Number.isFinite(input.travelers) ? Math.max(1, Math.round(input.travelers)) : 1;

  const chosen = indianAirport(input.origin);
  const origin = chosen ?? indianAirport(DEFAULT_ORIGIN)!;
  const originAssumed = !chosen;

  const country = resolveCountry(input.destination);
  if (!country) return null;

  let base: number;
  let researched: boolean;
  let source: string;
  let arrival: QuotedAirport | null;
  let group: FareGroup | "domestic";
  let ownSeason: Partial<Record<number, number>> | undefined;
  let lastMinute: number;

  if (country.code === "IN") {
    const airport =
      matchPlace(INDIAN_AIRPORTS, input.firstCity) ??
      (input.firstCityLocation ? nearestIndianAirport(input.firstCityLocation) : undefined) ??
      matchPlace(INDIAN_AIRPORTS, input.destination);

    const noFlight = (basis: string): FlightQuote => ({
      origin: label(origin),
      arrival: null,
      originAssumed,
      perTravelerInr: { low: 0, typical: 0, high: 0 },
      travelers,
      totalInr: 0,
      quotedOn,
      daysAhead,
      confidence: "route",
      basis,
    });
    if (airport && airport.code === origin.code) {
      return noFlight(`The trip starts in ${airport.city}, where you are flying from, so there is no flight to pay for.`);
    }
    if (airport && !hasNonstop(origin, airport) && distanceKm(origin, airport) < DRIVE_INSTEAD_KM) {
      // Nobody flies Chandigarh to Kullu through Delhi: it's a few hours by road.
      const km = Math.round(distanceKm(origin, airport) / 10) * 10;
      return noFlight(
        `${airport.city} is about ${km} km from ${origin.city} as the crow flies, with no direct flight, so this ` +
          "assumes you go by road or rail and budgets no flight.",
      );
    }

    group = "domestic";
    lastMinute = GROUP_LAST_MINUTE.domestic;
    if (airport) {
      const fare = domesticFareInr(origin, airport);
      base = fare.fare;
      researched = fare.researched;
      source = fare.researched
        ? "the past year of fares on this route"
        : "fares on researched routes of a similar distance";
      arrival = label(airport);
      ownSeason = airport.season;
    } else {
      // Nowhere to place the first city: a typical mid-length domestic return.
      base = DOMESTIC_BASE_INR + DOMESTIC_PER_KM_INR * 1_200;
      researched = false;
      source = "a typical domestic return, as the first city couldn't be matched to an airport";
      arrival = null;
    }
  } else {
    const fares = COUNTRY_FARES[country.code];
    if (!fares) return null;
    const gateway =
      matchPlace(fares.gateways, input.firstCity) ??
      matchPlace(fares.gateways, input.destination) ??
      fares.gateways[0];
    group = fares.group;
    const priced = internationalFareInr(origin, gateway, fares.group);
    base = priced.fare;
    researched = gateway.source === "route" && priced.how === "route";
    if (priced.how === "via") {
      source = `researched fares from ${priced.via!.city}, plus a connecting flight from ${origin.city}`;
    } else if (gateway.source === "derived") {
      source = `researched fares to nearby airports in ${country.name}`;
    } else if (priced.how === "group") {
      source = `the past year of Delhi to ${gateway.city} fares, adjusted for how fares from ${origin.city} compare`;
    } else {
      source = "the past year of fares on this route";
    }
    arrival = label(gateway);
    ownSeason = gateway.season;
    lastMinute = gateway.lastMinute ?? GROUP_LAST_MINUTE[fares.group];
  }

  const season = seasonFactor(group, month, ownSeason);
  const typical =
    base * season * leadTimeFactor(daysAhead, lastMinute) * weekdayFactor(input.startDate) * partyFactor(travelers);
  const lastMinuteBooking = daysAhead < 14;
  const perTraveler = {
    low: round(typical * (lastMinuteBooking ? 0.9 : 0.85), 100),
    typical: round(typical, 10),
    high: round(typical * (lastMinuteBooking ? 1.35 : 1.25), 100),
  };

  return {
    origin: label(origin),
    arrival,
    originAssumed,
    perTravelerInr: perTraveler,
    travelers,
    totalInr: perTraveler.typical * travelers,
    quotedOn,
    daysAhead,
    confidence: researched ? "route" : "modelled",
    basis: describe({ origin: label(origin), arrival, originAssumed, source, month, season, daysAhead, travelers }),
  };
}
