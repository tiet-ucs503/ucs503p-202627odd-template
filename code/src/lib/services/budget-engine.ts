import type { BudgetBreakdown, BudgetCategory, SavingsSuggestion } from "@/types/budget";
import type { ActivityCategory, City, TripDay } from "@/types/itinerary";
import { fromInr } from "@/lib/fx";

/**
 * Pure functions that turn an itinerary (cities + days + activities) into a
 * budget breakdown, and — when the estimate exceeds the traveller's stated
 * budget — into a short list of deterministic ways to close the gap.
 * Nothing here touches Firestore or React; the roadmap and budget UI call
 * these after every edit so the numbers stay in lockstep with the itinerary.
 */

// These three numbers are written in rupees and converted to the trip's currency
// when they are used, so a USD, EUR or GBP trip gets sensible values too.
const DAILY_TRANSPORT_INR = 500;
const MIN_BUFFER_INR = 3_000;
const PRICEY_ACTIVITY_INR = 1_500;

// A shared tour is something you buy for a sight or an activity. It makes no
// sense for a meal, a transfer between cities, a night out or a shopping stop.
const SHARED_TOUR_CATEGORIES: ActivityCategory[] = ["sightseeing", "culture", "adventure", "beach", "relaxation"];

const ACTIVITY_CATEGORY_TO_BUDGET: Record<string, BudgetCategory> = {
  food: "food",
  shopping: "shopping",
  transport: "transport",
  sightseeing: "activities",
  adventure: "activities",
  beach: "activities",
  culture: "activities",
  relaxation: "activities",
  nightlife: "activities",
};

export interface ComputeBudgetInput {
  cities: City[];
  days: TripDay[];
  travelers: number;
  currency: string;
  userBudget: number;
  flightCostTotal: number;
}

export function computeBudgetBreakdown(input: ComputeBudgetInput): BudgetBreakdown {
  const categories: Record<BudgetCategory, number> = {
    flights: Math.round(input.flightCostTotal),
    hotels: 0,
    food: 0,
    activities: 0,
    transport: 0,
    shopping: 0,
    misc: 0,
    buffer: 0,
  };

  for (const city of input.cities) {
    categories.hotels += city.hotel.pricePerNight * city.hotel.nights;
  }

  for (const day of input.days) {
    for (const activity of day.activities) {
      const bucket = ACTIVITY_CATEGORY_TO_BUDGET[activity.category] ?? "misc";
      categories[bucket] += activity.estimatedCost;
    }
    // A small daily allowance for local transport (taxis, tuk-tuks, metro)
    // that isn't tied to any single itinerary line item.
    categories.transport += fromInr(DAILY_TRANSPORT_INR, input.currency);
  }

  const subtotal =
    categories.flights +
    categories.hotels +
    categories.food +
    categories.activities +
    categories.transport +
    categories.shopping;

  categories.misc = Math.round(subtotal * 0.04);
  categories.buffer = Math.round(Math.max(input.userBudget * 0.05, fromInr(MIN_BUFFER_INR, input.currency)));

  for (const key of Object.keys(categories) as BudgetCategory[]) {
    categories[key] = Math.round(categories[key]);
  }

  const estimatedTotal = Object.values(categories).reduce((a, b) => a + b, 0);

  return {
    currency: input.currency,
    total: Math.round(input.userBudget),
    estimatedTotal,
    categories,
  };
}

/**
 * Deterministic, explainable "ways to save" — no real recommendation model,
 * just a handful of rules over the itinerary that has already been built.
 * A suggestion is advice, with the words to ask Travis to act on it. It never
 * edits the trip itself: a cheaper hotel or tour has to be a real one, found by
 * the places provider and confirmed by the traveller.
 */
export function buildSavingsSuggestions(
  cities: City[],
  days: TripDay[],
  budget: BudgetBreakdown,
): SavingsSuggestion[] {
  const suggestions: SavingsSuggestion[] = [];
  const overBy = budget.estimatedTotal - budget.total;
  if (overBy <= 0) return suggestions;

  // A city with no nights has no hotel to save on.
  const priciestHotel = cities.filter((c) => c.hotel.nights > 0).sort(
    (a, b) => b.hotel.pricePerNight * b.hotel.nights - a.hotel.pricePerNight * a.hotel.nights,
  )[0];
  if (priciestHotel && priciestHotel.hotel.pricePerNight > 0) {
    const savings = Math.round(priciestHotel.hotel.pricePerNight * 0.3 * priciestHotel.hotel.nights);
    suggestions.push({
      id: `hotel-${priciestHotel.id}`,
      kind: "hotel-downgrade",
      title: `Switch to a more modest hotel in ${priciestHotel.name}`,
      description: `Move from ${priciestHotel.hotel.name} to a cheaper, well-rated hotel for the same nights.`,
      estimatedSavings: savings,
      targetId: priciestHotel.id,
      askTravis: `Find me a cheaper, well-rated hotel in ${priciestHotel.name}`,
    });
  }

  const allActivities = days.flatMap((d) => d.activities.map((a) => ({ dayId: d.id, activity: a })));
  const nonEssential = allActivities
    .filter(
      ({ activity }) =>
        SHARED_TOUR_CATEGORIES.includes(activity.category) && activity.estimatedCost > fromInr(PRICEY_ACTIVITY_INR, budget.currency),
    )
    .sort((a, b) => b.activity.estimatedCost - a.activity.estimatedCost)[0];
  if (nonEssential) {
    const savings = Math.round(nonEssential.activity.estimatedCost * 0.6);
    suggestions.push({
      id: `activity-${nonEssential.activity.id}`,
      kind: "activity-swap",
      title: `Use a shared tour instead of "${nonEssential.activity.name}"`,
      description: "A shared/group version of this activity instead of a private one.",
      estimatedSavings: savings,
      targetId: nonEssential.activity.id,
      askTravis: `Replace ${nonEssential.activity.name} with a cheaper, well-rated alternative`,
    });
  }

  if (budget.categories.food > 0) {
    suggestions.push({
      id: "food-local",
      kind: "food-swap",
      title: "Choose local restaurants over hotel dining",
      description: "Swap one hotel/rooftop meal per city for a local restaurant.",
      estimatedSavings: Math.round(budget.categories.food * 0.15),
      askTravis: "Replace hotel meals with well-rated local restaurants",
    });
  }

  return suggestions.slice(0, 3);
}
