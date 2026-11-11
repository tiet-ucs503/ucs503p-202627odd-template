import { NextRequest, NextResponse } from "next/server";
import { authErrorResponse, requireUser } from "@/lib/server/firebase-auth";
import { generateItinerary } from "@/lib/services/itinerary-generator";
import { friendlyPlacesMessage, PlacesProviderError, statusForPlacesError } from "@/lib/services/places/errors";
import { planCities, validateCityAllocation } from "@/lib/services/planning";
import { generatedItinerarySchema, newTripInputSchema } from "@/lib/validation/trip";
import { cityPlanSchema } from "@/lib/validation/planning";
import { dayCountInclusive, parseDateInput } from "@/lib/date";

/**
 * POST /api/trips/generate
 *
 * The second half of trip creation:
 *
 *   validated city plan -> places provider -> itinerary -> budget engine
 *
 * Accepts a plan produced by /api/trips/plan so the wizard doesn't pay for
 * planning twice; re-validates it regardless, because a plan arriving over
 * the wire is client input no matter where it originally came from. With no
 * plan supplied it plans internally, so the route still works standalone.
 *
 * Authenticated: this spends Places (and possibly LLM) quota. The provider
 * keys are read from `process.env` on the server and never reach the browser.
 */
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

  const parsedInput = newTripInputSchema.safeParse(body);
  if (!parsedInput.success) {
    return NextResponse.json(
      { error: "Invalid trip details.", issues: parsedInput.error.issues },
      { status: 400 },
    );
  }
  if (parsedInput.data.endDate < parsedInput.data.startDate) {
    return NextResponse.json({ error: "End date must be on or after the start date." }, { status: 400 });
  }

  const input = parsedInput.data;
  const dayCount = dayCountInclusive(parseDateInput(input.startDate), parseDateInput(input.endDate));
  const planRequest = {
    destination: input.destination,
    startDate: input.startDate,
    endDate: input.endDate,
    dayCount,
    travelers: input.travelers,
    budget: input.budget,
    currency: input.currency,
    preferences: input.preferences,
  };

  try {
    // A plan sent by the client is untrusted input: shape-check it, then run
    // the same constraint checks the planner itself has to pass. Anything
    // that fails is replanned server-side rather than rejected, so a stale
    // plan can't strand the traveller.
    const supplied = cityPlanSchema.safeParse((body as { plan?: unknown })?.plan);
    let plan =
      supplied.success && validateCityAllocation(supplied.data.cities, planRequest).ok
        ? supplied.data
        : null;

    if (!plan) {
      plan = await planCities(planRequest);
    }

    const itinerary = await generateItinerary(input, plan);
    const parsedOutput = generatedItinerarySchema.safeParse(itinerary);
    if (!parsedOutput.success) {
      console.error("Generated itinerary failed validation", parsedOutput.error);
      return NextResponse.json(
        { error: "Couldn't build a valid itinerary. Please try again." },
        { status: 502 },
      );
    }
    return NextResponse.json({ itinerary: parsedOutput.data, plan });
  } catch (error) {
    // The places service is the only source of places, so when it can't help the
    // traveller is told that, in words, instead of getting a trip made of guesses.
    if (error instanceof PlacesProviderError) {
      console.error(`[places] itinerary generation failed (${error.code})`);
      return NextResponse.json(
        { error: friendlyPlacesMessage(error.code), code: error.code },
        { status: statusForPlacesError(error.code) },
      );
    }
    console.error("Itinerary generation failed", error);
    return NextResponse.json(
      { error: "Something went wrong while planning your trip." },
      { status: 500 },
    );
  }
}
