import { resolveCountry } from "@/lib/countries";
import type { LlmTravisSuggestion, LlmTravisTurn } from "@/lib/validation/travis";
import type { DestinationSuggestion, TravisReply } from "@/types/travis";
import { suggestDates, windowLabel } from "./dates";
import { containsPriceClaim, stripPriceClaims } from "./price-guard";

/**
 * Turning a model's proposal into something safe to show.
 *
 * By the time a turn gets here it already has the right *shape* (the Zod
 * schema saw to that). What it can still get wrong is content: a date the
 * model made up, the same place suggested twice, an amount of money. This is
 * where each of those is dealt with, so the UI can trust what it renders.
 */

/** Every piece of free text a traveller would read, for the price check. */
export function turnTexts(turn: LlmTravisTurn): string[] {
  return [
    turn.reply,
    ...turn.followUps,
    ...turn.suggestions.flatMap((s) => [s.headline, s.costReason, s.weatherNote, s.watchOut ?? ""]),
  ];
}

/**
 * The suggestions that name somewhere TripEase can't plan a trip to. A model
 * asked to stay inside a list will, now and then, suggest Santorini or
 * Patagonia anyway, and a card for a trip that can't be planned is a dead end.
 */
export function unsupportedDestinations(turn: LlmTravisTurn): string[] {
  return turn.suggestions.filter((s) => !resolveCountry(plainDestination(s.destination))).map((s) => s.destination);
}

/** Sentences in the turn that state an amount of money. Empty means clean. */
export function turnPriceClaims(turn: LlmTravisTurn): string[] {
  return turnTexts(turn).filter(containsPriceClaim);
}

const GENERIC = {
  reply: "Here are a few places that fit what you described.",
  headline: "Fits what you described.",
  costReason: "Cost depends on the season, so check current fares before you book.",
  weatherNote: "Weather varies through the year, so check the forecast closer to the time.",
} as const;

/**
 * Last resort when a model keeps quoting prices after being told not to:
 * remove the sentences that state them. Anything left empty gets a plain,
 * honest stand-in so the card never renders blank.
 */
export function redactPrices(turn: LlmTravisTurn): LlmTravisTurn {
  const clean = (text: string, fallback: string) => stripPriceClaims(text) || fallback;
  return {
    reply: clean(turn.reply, GENERIC.reply),
    followUps: turn.followUps.filter((text) => !containsPriceClaim(text)),
    suggestions: turn.suggestions.map((s) => ({
      ...s,
      headline: clean(s.headline, GENERIC.headline),
      costReason: clean(s.costReason, GENERIC.costReason),
      weatherNote: clean(s.weatherNote, GENERIC.weatherNote),
      watchOut: s.watchOut ? stripPriceClaims(s.watchOut) || null : null,
    })),
  };
}

function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function collapseSpaces(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * "Japan (Tokyo and surrounding)" is a description, not a destination, and the
 * wizard hands this string straight to the city planner. Keep the name and
 * drop the bracketed qualifier. A name that would be left empty is kept as is.
 */
function plainDestination(raw: string): string {
  const withoutQualifier = collapseSpaces(raw.replace(/\([^)]*\)/g, " "));
  return withoutQualifier.length >= 2 ? withoutQualifier : collapseSpaces(raw);
}

function toSuggestion(raw: LlmTravisSuggestion, index: number, today: string): DestinationSuggestion {
  const { startDate, endDate } = suggestDates({
    startMonth: raw.startMonth,
    endMonth: raw.endMonth,
    days: raw.suggestedDays,
    today,
  });

  // Callers have already dropped anything that isn't a supported country.
  const destination = resolveCountry(plainDestination(raw.destination))?.name ?? plainDestination(raw.destination);
  return {
    id: `${slug(destination) || "place"}-${index}`,
    destination,
    headline: raw.headline,
    startMonth: raw.startMonth,
    endMonth: raw.endMonth,
    windowLabel: windowLabel(raw.startMonth, raw.endMonth),
    costOutlook: raw.costOutlook,
    costReason: raw.costReason,
    weatherNote: raw.weatherNote,
    watchOut: raw.watchOut,
    suggestedDays: raw.suggestedDays,
    styles: [...new Set(raw.styles)],
    startDate,
    endDate,
  };
}

/** Normalise a (price-free) turn: supported countries only, once each, with derived windows and dates. */
export function toReply(turn: LlmTravisTurn, today: string): TravisReply {
  const seen = new Set<string>();
  const suggestions: DestinationSuggestion[] = [];

  for (const raw of turn.suggestions) {
    const country = resolveCountry(plainDestination(raw.destination));
    if (!country) continue; // not somewhere a trip can be planned, so not offered
    const key = country.code;
    if (seen.has(key)) continue; // the same country twice adds nothing
    seen.add(key);
    suggestions.push(toSuggestion(raw, suggestions.length, today));
  }

  const followUps = [...new Set(turn.followUps.map(collapseSpaces).filter(Boolean))].slice(0, 3);

  return { reply: turn.reply.trim(), suggestions, followUps };
}
