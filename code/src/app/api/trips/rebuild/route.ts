import { NextRequest, NextResponse } from "next/server";
import { authErrorResponse, requireUser } from "@/lib/server/firebase-auth";
import { generateItinerary } from "@/lib/services/itinerary-generator";
import { friendlyPlacesMessage, PlacesProviderError, statusForPlacesError } from "@/lib/services/places/errors";
import { validateCityAllocation } from "@/lib/services/planning";
import { cityAllocationSchema } from "@/lib/validation/planning";
import { citySchema, generatedItinerarySchema, tripDaySchema, tripDraftInputSchema } from "@/lib/validation/trip";
import { dayCountInclusive, parseDateInput } from "@/lib/date";
import { z } from "zod";

/**
 * POST /api/trips/rebuild
 *
 * Applies an edited city list to an existing trip: add, remove, rename, or
 * change a city's days. Runs server-side because new cities need a places
 * lookup, and the provider key lives here.
 *
 * The allocation goes through exactly the same deterministic validation the
 * AI planner's output does — a hand-edited plan gets no more trust than a
 * model-generated one. Cities that survive the edit keep their existing
 * activities (see `generateItinerary`'s `existing` parameter), so editing the
 * city list doesn't throw away the traveller's other work.
 *
 * Authenticated: this can spend Places quota.
 */
const rebuildRequestSchema = z.object({
  draft: tripDraftInputSchema,
  cities: z.array(cityAllocationSchema).min(1).max(12),
  existing: z.object({
    cities: z.array(citySchema),
    days: z.array(tripDaySchema),
  }),
});

export async function POST(request: NextRequest) {
  try {
    await requireUser(request);
  } catch (error) {
    return authErrorResponse(error);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  const parsed = rebuildRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid city changes." }, { status: 400 });
  }

  const { draft, cities, existing } = parsed.data;
  const dayCount = dayCountInclusive(parseDateInput(draft.startDate), parseDateInput(draft.endDate));

  const validation = validateCityAllocation(cities, {
    destination: draft.destination,
    dayCount,
    travelers: draft.travelers,
    budget: draft.budget,
  });
  if (!validation.ok) {
    // These are the traveller's own edits, so the specific problems are
    // useful to show them — unlike upstream provider errors.
    return NextResponse.json({ error: validation.problems[0], problems: validation.problems }, { status: 400 });
  }

  try {
    const itinerary = await generateItinerary(
      draft,
      {
        destination: draft.destination,
        cities,
        source: "fallback",
        plannerVersion: "manual-1",
        fallbackReason: "Cities edited by the traveller.",
      },
      existing,
    );

    const validated = generatedItinerarySchema.safeParse(itinerary);
    if (!validated.success) {
      console.error("Rebuilt itinerary failed validation", validated.error);
      return NextResponse.json({ error: "Couldn't rebuild this trip. Please try again." }, { status: 502 });
    }
    return NextResponse.json({ itinerary: validated.data });
  } catch (error) {
    if (error instanceof PlacesProviderError) {
      console.error(`[places] trip rebuild failed (${error.code})`);
      return NextResponse.json(
        { error: friendlyPlacesMessage(error.code), code: error.code },
        { status: statusForPlacesError(error.code) },
      );
    }
    console.error("Trip rebuild failed", error);
    return NextResponse.json({ error: "Something went wrong while updating your trip." }, { status: 500 });
  }
}
