import { NextRequest, NextResponse } from "next/server";
import { authErrorResponse, requireUser } from "@/lib/server/firebase-auth";
import { getPlacesProvider } from "@/lib/services/places";
import { friendlyPlacesMessage, PlacesProviderError, statusForPlacesError } from "@/lib/services/places/errors";
import { topRated } from "@/lib/services/places/ranking";
import { placeSearchRequestSchema, placeSchema } from "@/lib/validation/places";

/**
 * POST /api/places/search
 *
 * Backs the "find a real place" picker used when a traveller replaces an
 * activity. Runs server-side for the same reason trip generation does: the
 * provider key is read from `process.env` here and never reaches the
 * browser. Components call this route; they never touch a provider directly.
 *
 * Results are real places, best rated first. If the places service can't be
 * reached, or isn't set up, the answer is an error that says so: there is no
 * stand-in list to fall back to.
 */
export async function POST(request: NextRequest) {
  // Authenticated: every call here can hit a paid Places search.
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

  const parsed = placeSearchRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid search request." }, { status: 400 });
  }

  const { query, destination, country, type, currency, limit } = parsed.data;

  let places;
  try {
    places = await getPlacesProvider().searchPlaces({ destination, country, type, currency, query, limit: 20 });
  } catch (error) {
    const code = error instanceof PlacesProviderError ? error.code : "provider-error";
    console.error(`[places] search failed (${code})`);
    return NextResponse.json({ error: friendlyPlacesMessage(code), code }, { status: statusForPlacesError(code) });
  }

  // Best rated first, so the top of the list is where to look. Validate our own
  // normalized shape before it leaves the server: a mapping bug in a provider
  // should fail here, not corrupt a saved itinerary.
  const validated = topRated(places, limit ?? 8).filter((place) => placeSchema.safeParse(place).success);

  return NextResponse.json({
    places: validated,
    notice: validated.length === 0 ? "No places matched that search. Try different words." : null,
  });
}
