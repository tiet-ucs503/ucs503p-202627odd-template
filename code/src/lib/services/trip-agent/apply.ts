import { flightDraftFields } from "@/lib/flights/draft";
import { fromInr } from "@/lib/fx";
import { computeBudgetBreakdown } from "@/lib/services/budget-engine";
import { analyzeTrip } from "@/lib/services/feasibility";
import { generateItinerary, placeToActivity, placeToHotel, searchPlaces } from "@/lib/services/itinerary-generator";
import { qualityScore } from "@/lib/services/places/ranking";
import type { PlacesProvider } from "@/lib/services/places/provider";
import { splitDaysAcrossCities, validateCityAllocation } from "@/lib/services/planning";
import { normalise } from "@/lib/countries";
import { MAX_TRIP_DAYS } from "@/lib/validation/trip-agent";
import { addDaysIso, formatDateShort, formatMoney } from "@/lib/utils";
import type { FlightQuote } from "@/types/flights";
import type { Activity, City, TripDay } from "@/types/itinerary";
import type { Place, PlaceType } from "@/types/place";
import type { Trip } from "@/types/trip";
import type { AgentTrip, ChangeSet, EditOperation, TripPatch, TripStats } from "@/types/trip-agent";
import { tripVersion } from "./version";

/**
 * Turning proposed operations into a change set the traveller can confirm.
 *
 * Everything the model asked for is checked and carried out here, by our code:
 * ids must exist, places are found by the places provider (never named by the
 * model), a new city list goes through the same validation as one typed by
 * hand, and the budget and the day-load check are recomputed on the result.
 * The output says exactly what will be written and what it does to the numbers.
 *
 * Pure apart from the places provider and `generateItinerary`, both injectable,
 * so the whole thing is testable without a network.
 */

export interface EngineDeps {
  places: PlacesProvider;
  /** Injectable for tests. */
  generate?: typeof generateItinerary;
}

export type EngineResult = { ok: true; changeSet: ChangeSet } | { ok: false; problems: string[] };

/** Hours the day check treats as the working day; a stop is not started after this. */
const LATEST_START_MINUTES = 20 * 60;
/** Gap left after the previous stop for getting there. */
const TRAVEL_BUFFER_MINUTES = 30;
const DEFAULT_START = "10:00";

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : 10 * 60;
}

function toTime(minutes: number): string {
  const clamped = Math.max(0, Math.min(minutes, 23 * 60 + 59));
  return `${String(Math.floor(clamped / 60)).padStart(2, "0")}:${String(clamped % 60).padStart(2, "0")}`;
}

/** When a stop added to the end of a day can start: after the last one, with room to get there. */
export function nextFreeTime(day: TripDay): string {
  if (day.activities.length === 0) return DEFAULT_START;
  const end = Math.max(...day.activities.map((a) => toMinutes(a.time) + a.durationMinutes));
  return toTime(Math.min(end + TRAVEL_BUFFER_MINUTES, LATEST_START_MINUTES));
}

const byTime = (a: Activity, b: Activity) => a.time.localeCompare(b.time);

/** A `Trip` the feasibility analysis accepts, from the slimmer `AgentTrip`. */
function asTrip(trip: AgentTrip): Trip {
  const epoch = new Date(0);
  return { ...trip, ownerId: "", status: "ready", createdAt: epoch, updatedAt: epoch };
}

export function statsOf(trip: AgentTrip): TripStats {
  const sorted = [...trip.cities].sort((a, b) => a.order - b.order);
  return {
    dayCount: trip.dayCount,
    total: trip.budget.total,
    estimatedTotal: trip.budget.estimatedTotal,
    cityDays: sorted.map((c) => ({ name: c.name, days: trip.days.filter((d) => d.cityId === c.id).length })),
    overfullDays: analyzeTrip(asTrip(trip)).infeasibleDayNumbers,
  };
}

/**
 * `flights` is the re-priced quote when the edit moved the trip's start;
 * `undefined` means the flights stay exactly as saved, which is what almost
 * every edit wants (a stop or a hotel doesn't change the fare).
 */
function recomputeBudget(base: AgentTrip, cities: City[], days: TripDay[], flights?: FlightQuote | null) {
  return computeBudgetBreakdown({
    cities,
    days,
    travelers: base.travelers,
    currency: base.currency,
    userBudget: base.budget.total,
    flightCostTotal:
      flights === undefined ? base.budget.categories.flights : flights ? fromInr(flights.totalInr, base.currency) : 0,
  });
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function placeTypeFor(category: Activity["category"]): PlaceType {
  if (category === "food") return "restaurant";
  if (category === "nightlife") return "nightlife";
  return "attraction";
}

interface Working {
  cities: City[];
  days: TripDay[];
  endDate: string;
  dayCount: number;
  /** Set only when the trip's flights were re-priced. */
  flights?: FlightQuote | null;
  lines: string[];
  warnings: string[];
  problems: string[];
  usedUnverifiedPlace: boolean;
}

function findActivity(w: Working, activityId: string) {
  for (const day of w.days) {
    const activity = day.activities.find((a) => a.id === activityId);
    if (activity) return { day, activity };
  }
  return null;
}

function mapDay(w: Working, dayId: string, update: (day: TripDay) => TripDay) {
  w.days = w.days.map((d) => (d.id === dayId ? update(d) : d));
}

const cityOf = (w: Working, day: TripDay) => w.cities.find((c) => c.id === day.cityId);

const STOP_WORDS = new Set([
  "the", "and", "for", "near", "best", "good", "great", "famous", "local", "nice", "some", "something",
  "place", "places", "visit", "new", "old", "big", "small", "any", "with", "from", "that", "this",
]);

/** The words in a request that say what is wanted: no filler, lightly de-plural-ed. */
export function queryWords(query: string): string[] {
  return normalise(query)
    .split(" ")
    .map((word) => (word.length > 3 && word.endsWith("s") ? word.slice(0, -1) : word))
    .filter((word) => word.length >= 3 && !STOP_WORDS.has(word));
}

/**
 * How many of the request's words a place's name, description or address
 * contains. A search engine will always hand back *something*, even when
 * nothing matches well; this is what stops a request for one thing quietly
 * becoming another.
 */
function relevance(place: Place, words: string[]): number {
  const haystack = normalise(`${place.name} ${place.description} ${place.address ?? ""}`);
  return words.filter((word) => haystack.includes(word)).length;
}

/** The place that best matches the request and is not already on the day, or null. */
async function findPlace(
  deps: EngineDeps,
  trip: AgentTrip,
  cityName: string,
  type: PlaceType,
  query: string,
  avoid: Set<string>,
): Promise<Place | null> {
  const words = queryWords(query);
  if (words.length === 0) return null;

  const results = await searchPlaces(deps.places, {
    destination: cityName,
    country: trip.destination,
    type,
    query,
    currency: trip.currency,
    limit: 8,
  });

  // The place that best matches what was asked; among equals, the best rated.
  let best: { place: Place; score: number; quality: number } | null = null;
  for (const place of results) {
    if (avoid.has(place.name.toLowerCase())) continue;
    const score = relevance(place, words);
    if (score === 0) continue;
    const quality = qualityScore(place) ?? 0;
    if (!best || score > best.score || (score === best.score && quality > best.quality)) best = { place, score, quality };
  }
  return best ? best.place : null;
}

type StructuralOperation = Extract<EditOperation, { type: "set_cities" | "set_trip_length" }>;

const isStructural = (op: EditOperation): op is StructuralOperation =>
  op.type === "set_cities" || op.type === "set_trip_length";

/** The structural operation (new city list or new length), if there is one. */
async function applyStructure(
  trip: AgentTrip,
  op: StructuralOperation,
  w: Working,
  deps: EngineDeps,
) {
  const generate = deps.generate ?? generateItinerary;
  const before = [...w.cities].sort((a, b) => a.order - b.order);

  let allocation: { name: string; days: number }[];
  if (op.type === "set_cities") {
    allocation = op.cities;
  } else {
    if (op.dayCount < before.length) {
      w.problems.push(
        `A ${op.dayCount}-day trip can't include all ${before.length} cities. Remove a city first, or say which to keep.`,
      );
      return;
    }
    const days = splitDaysAcrossCities(
      op.dayCount,
      before.map((c) => c.dayCount),
    );
    allocation = before.map((c, i) => ({ name: c.name, days: days[i] }));
  }

  const newTotal = allocation.reduce((sum, c) => sum + c.days, 0);
  if (newTotal < 1 || newTotal > MAX_TRIP_DAYS) {
    w.problems.push(`A trip can be 1 to ${MAX_TRIP_DAYS} days long; this would be ${newTotal}.`);
    return;
  }

  const validation = validateCityAllocation(
    allocation.map((c) => ({ ...c, reason: "Chosen by the traveller" })),
    { destination: trip.destination, dayCount: newTotal, travelers: trip.travelers, budget: trip.budget.total },
  );
  if (!validation.ok) {
    w.problems.push(...validation.problems);
    return;
  }

  const endDate = addDaysIso(trip.startDate, newTotal - 1);
  const itinerary = await generate(
    {
      destination: trip.destination,
      startDate: trip.startDate,
      endDate,
      budget: trip.budget.total,
      currency: trip.currency,
      travelers: trip.travelers,
      travelerType: trip.travelerType,
      preferences: trip.preferences,
      // A trip that carries a quote is priced again with the same airport and
      // quote day, so the fare moves only if the first city changed. A trip
      // without one (saved before quotes existed, or flights left out) is not
      // touched: there is nothing to keep consistent.
      ...(trip.flights ? flightDraftFields(trip) : {}),
    },
    {
      destination: trip.destination,
      cities: allocation.map((c) => ({ ...c, reason: "Chosen by the traveller" })),
      source: "fallback",
      plannerVersion: "agent-1",
      fallbackReason: "Edited with the trip agent.",
    },
    { cities: w.cities, days: w.days },
    deps.places,
  );

  w.cities = itinerary.cities;
  w.days = itinerary.days;
  w.endDate = itinerary.endDate;
  w.dayCount = itinerary.dayCount;
  if (trip.flights) w.flights = itinerary.flights ?? null;
  if (itinerary.days.some((d) => d.activities.some((a) => a.isDemoData))) w.usedUnverifiedPlace = true;

  // Say what moved, city by city.
  if (newTotal !== trip.dayCount) {
    w.lines.push(
      `The trip becomes ${plural(newTotal, "day")} (${formatDateShort(trip.startDate)} – ${formatDateShort(endDate)}), from ${trip.dayCount}.`,
    );
  }
  const was = new Map(before.map((c) => [c.name.trim().toLowerCase(), c.dayCount]));
  const nowKeys = new Set(allocation.map((c) => c.name.trim().toLowerCase()));
  for (const c of allocation) {
    const prev = was.get(c.name.trim().toLowerCase());
    if (prev === undefined) w.lines.push(`Add ${c.name} (${plural(c.days, "day")}).`);
    else if (prev !== c.days) w.lines.push(`${c.name}: ${plural(prev, "day")} → ${plural(c.days, "day")}.`);
  }
  for (const c of before) {
    if (!nowKeys.has(c.name.trim().toLowerCase())) w.lines.push(`Remove ${c.name}.`);
  }
  const sameSet = before.length === allocation.length && before.every((c) => nowKeys.has(c.name.trim().toLowerCase()));
  if (sameSet && before.some((c, i) => c.name.trim().toLowerCase() !== allocation[i].name.trim().toLowerCase())) {
    w.lines.push(`New order: ${allocation.map((c) => c.name).join(" → ")}.`);
  }
}

async function applyActivityOperation(trip: AgentTrip, op: EditOperation, w: Working, deps: EngineDeps) {
  switch (op.type) {
    case "remove_activity": {
      const found = findActivity(w, op.activityId);
      if (!found) return void w.problems.push(`There's no activity "${op.activityId}" in this trip.`);
      mapDay(w, found.day.id, (d) => ({ ...d, activities: d.activities.filter((a) => a.id !== op.activityId) }));
      w.lines.push(`Remove ${found.activity.name} (Day ${found.day.dayNumber}).`);
      return;
    }

    case "move_activity": {
      const found = findActivity(w, op.activityId);
      if (!found) return void w.problems.push(`There's no activity "${op.activityId}" in this trip.`);
      const target = w.days.find((d) => d.id === op.toDayId);
      if (!target) return void w.problems.push(`There's no day "${op.toDayId}" in this trip.`);
      if (target.id === found.day.id) return void w.problems.push(`${found.activity.name} is already on Day ${target.dayNumber}.`);
      mapDay(w, found.day.id, (d) => ({ ...d, activities: d.activities.filter((a) => a.id !== op.activityId) }));
      mapDay(w, target.id, (d) => ({ ...d, activities: [...d.activities, found.activity].sort(byTime) }));
      w.lines.push(`Move ${found.activity.name} from Day ${found.day.dayNumber} to Day ${target.dayNumber}.`);
      return;
    }

    case "replace_activity": {
      const found = findActivity(w, op.activityId);
      if (!found) return void w.problems.push(`There's no activity "${op.activityId}" in this trip.`);
      const city = cityOf(w, found.day);
      if (!city) return void w.problems.push(`Day ${found.day.dayNumber} isn't linked to a city.`);
      const onDay = new Set(found.day.activities.map((a) => a.name.toLowerCase()));
      const place = await findPlace(deps, trip, city.name, placeTypeFor(found.activity.category), op.query, onDay);
      if (!place) return void w.problems.push(`I couldn't find "${op.query}" in ${city.name}.`);
      const replacement: Activity = {
        ...placeToActivity(place, found.activity.time, found.activity.durationMinutes),
        // Keep the slot: the same time, and a stop about as long as the one it replaces.
        time: found.activity.time,
        durationMinutes: place.durationMinutes ?? found.activity.durationMinutes,
      };
      mapDay(w, found.day.id, (d) => ({
        ...d,
        activities: d.activities.map((a) => (a.id === op.activityId ? replacement : a)),
      }));
      if (place.isDemoData) w.usedUnverifiedPlace = true;
      w.lines.push(`Replace ${found.activity.name} with ${place.name} (Day ${found.day.dayNumber}).`);
      return;
    }

    case "add_activity": {
      const day = w.days.find((d) => d.id === op.dayId);
      if (!day) return void w.problems.push(`There's no day "${op.dayId}" in this trip.`);
      const city = cityOf(w, day);
      if (!city) return void w.problems.push(`Day ${day.dayNumber} isn't linked to a city.`);
      const onDay = new Set(day.activities.map((a) => a.name.toLowerCase()));
      const place = await findPlace(deps, trip, city.name, placeTypeFor(op.category ?? "sightseeing"), op.query, onDay);
      if (!place) return void w.problems.push(`I couldn't find "${op.query}" in ${city.name}.`);
      const added = placeToActivity(place, nextFreeTime(day));
      mapDay(w, day.id, (d) => ({ ...d, activities: [...d.activities, added].sort(byTime) }));
      if (place.isDemoData) w.usedUnverifiedPlace = true;
      w.lines.push(`Add ${place.name} to Day ${day.dayNumber} at ${added.time}.`);
      return;
    }

    case "change_hotel": {
      const city = w.cities.find((c) => c.id === op.cityId);
      if (!city) return void w.problems.push(`There's no city "${op.cityId}" in this trip.`);
      const place = await findPlace(deps, trip, city.name, "hotel", op.query, new Set([city.hotel.name.toLowerCase()]));
      if (!place) return void w.problems.push(`I couldn't find a hotel matching "${op.query}" in ${city.name}.`);
      const hotel = placeToHotel(place, city.hotel.nights, trip.currency);
      w.cities = w.cities.map((c) => (c.id === city.id ? { ...c, hotel } : c));
      if (place.isDemoData) w.usedUnverifiedPlace = true;
      w.lines.push(`Change the ${city.name} hotel from ${city.hotel.name} to ${hotel.name}.`);
      return;
    }

    case "set_cities":
    case "set_trip_length":
      return; // handled before the others, by applyStructure
  }
}

/**
 * Work out what a list of operations would do to a trip, or why it can't.
 *
 * The structural operation (a new city list or length) runs first, so the
 * activity operations act on the trip as it will then be; one that points at
 * something the restructure removed is reported, not guessed at.
 */
export async function buildChangeSet(trip: AgentTrip, operations: EditOperation[], deps: EngineDeps): Promise<EngineResult> {
  if (operations.length === 0) return { ok: false, problems: ["There was nothing to change."] };

  const structural = operations.filter(isStructural);
  if (structural.length > 1) {
    return { ok: false, problems: ["Change either the city list or the trip length in one go, not both."] };
  }

  const w: Working = {
    cities: trip.cities,
    days: trip.days,
    endDate: trip.endDate,
    dayCount: trip.dayCount,
    lines: [],
    warnings: [],
    problems: [],
    usedUnverifiedPlace: false,
  };

  if (structural[0]) await applyStructure(trip, structural[0], w, deps);
  if (w.problems.length > 0) return { ok: false, problems: w.problems };

  for (const op of operations) {
    if (isStructural(op)) continue;
    await applyActivityOperation(trip, op, w, deps);
  }
  if (w.problems.length > 0) return { ok: false, problems: w.problems };

  if (w.lines.length === 0) return { ok: false, problems: ["That wouldn't change anything in the trip."] };

  const budget = recomputeBudget(trip, w.cities, w.days, w.flights);
  const patch: TripPatch = {
    cities: w.cities,
    days: w.days,
    budget,
    endDate: w.endDate,
    dayCount: w.dayCount,
    ...(w.flights !== undefined ? { flights: w.flights } : {}),
  };

  // Say so when the fare moved, so the new total is not a surprise.
  const flightsBefore = trip.budget.categories.flights;
  const flightsAfter = budget.categories.flights;
  if (w.flights && flightsAfter !== flightsBefore) {
    const where = w.flights.arrival ? `arriving at ${w.flights.arrival.city}` : "no flight needed";
    w.lines.push(
      `Flights re-estimated (${where}): ${formatMoney(flightsBefore, trip.currency)} → ${formatMoney(flightsAfter, trip.currency)}.`,
    );
  }

  const before = statsOf(trip);
  const after = statsOf({ ...trip, ...patch });

  const newlyFull = after.overfullDays.filter((n) => !before.overfullDays.includes(n));
  if (newlyFull.length > 0) {
    w.warnings.push(`${newlyFull.length === 1 ? `Day ${newlyFull[0]} looks` : `Days ${newlyFull.join(", ")} look`} too full to fit.`);
  }
  if (after.estimatedTotal > after.total && before.estimatedTotal <= before.total) {
    w.warnings.push(`This takes the plan ${formatMoney(after.estimatedTotal - after.total, trip.currency)} over your budget.`);
  }
  if (w.usedUnverifiedPlace) w.warnings.push("Some places in this trip are not verified.");

  return {
    ok: true,
    changeSet: {
      id: `chg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      baseVersion: tripVersion(trip),
      lines: w.lines,
      warnings: w.warnings,
      patch,
      before,
      after,
    },
  };
}
