import { NextRequest, NextResponse } from "next/server";
import { authErrorResponse, requireUser } from "@/lib/server/firebase-auth";
import { planCities } from "@/lib/services/planning";
import { newTripInputSchema } from "@/lib/validation/trip";
import { dayCountInclusive, parseDateInput } from "@/lib/date";

/**
 * POST /api/trips/plan
 *
 * The reasoning half of trip creation: decide which cities to visit and for
 * how long. Split out from /api/trips/generate so the wizard can show the
 * traveller a real "planning your cities…" stage and then the cities the
 * planner actually chose, rather than a spinner over one long request.
 *
 * Authenticated: this spends LLM quota.
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

  const parsed = newTripInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid trip details." }, { status: 400 });
  }
  if (parsed.data.endDate < parsed.data.startDate) {
    return NextResponse.json({ error: "End date must be on or after the start date." }, { status: 400 });
  }

  const input = parsed.data;
  const dayCount = dayCountInclusive(parseDateInput(input.startDate), parseDateInput(input.endDate));

  try {
    const plan = await planCities({
      destination: input.destination,
      startDate: input.startDate,
      endDate: input.endDate,
      dayCount,
      travelers: input.travelers,
      budget: input.budget,
      currency: input.currency,
      preferences: input.preferences,
    });
    return NextResponse.json({ plan });
  } catch (error) {
    console.error("[plan] city planning failed", error);
    return NextResponse.json({ error: "Couldn't plan your trip. Please try again." }, { status: 500 });
  }
}
