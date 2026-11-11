import { NextRequest, NextResponse } from "next/server";
import { authErrorResponse, requireUser } from "@/lib/server/firebase-auth";
import { createRateLimiter } from "@/lib/server/rate-limit";
import { AIProviderError, getTripAgentProvider } from "@/lib/services/ai";
import { getPlacesProvider } from "@/lib/services/places";
import { friendlyPlacesMessage, PlacesProviderError, statusForPlacesError } from "@/lib/services/places/errors";
import { runTripAgent } from "@/lib/services/trip-agent";
import { tripAgentRequestSchema } from "@/lib/validation/trip-agent";
import type { TripAgentResponse } from "@/types/trip-agent";

/**
 * POST /api/trips/agent
 *
 * One turn of the trip agent: the traveller asks for a change to a trip, and
 * gets back a sentence and, when there is something to do, a `ChangeSet` to
 * confirm. THIS ROUTE CHANGES NOTHING. It has no database access; the browser
 * sends the trip along with the request, and applying a confirmed change set is
 * a write the browser makes under the traveller's own Firestore permissions.
 *
 * That is also why a forged trip in the body can't hurt anyone else: the worst
 * it does is produce a proposal for the sender's own data.
 *
 * Authenticated and rate limited, because every call spends model quota and
 * may spend Places quota.
 *
 * Privacy: neither the request text nor the trip is logged. Only status codes
 * and failure categories reach the server log.
 */

// A model call, a repair retry and the places lookups can run past a short serverless default.
export const maxDuration = 60;

/**
 * The whole trip travels with each request, and a long trip with many
 * activities is a few hundred kilobytes. Counted in characters; a cheap guard,
 * not an exact byte limit.
 */
const MAX_BODY_CHARS = 400_000;

/** 30 requests per person per 10 minutes: a lively editing session, not a script. */
const limiter = createRateLimiter({ limit: 30, windowMs: 10 * 60 * 1000 });

const UNAVAILABLE = "Travis can't change trips right now. You can still edit your trip yourself.";

export async function POST(request: NextRequest) {
  let uid: string;
  try {
    ({ uid } = await requireUser(request));
  } catch (error) {
    return authErrorResponse(error);
  }

  const allowed = limiter.check(uid);
  if (!allowed.ok) {
    return NextResponse.json(
      {
        error: "You're sending requests quickly. Give Travis a moment and try again.",
        code: "rate-limited",
        retryAfterSeconds: allowed.retryAfterSeconds,
      },
      { status: 429, headers: { "Retry-After": String(allowed.retryAfterSeconds) } },
    );
  }

  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_CHARS) {
      return NextResponse.json({ error: "This trip is too large to change in one go.", code: "too-large" }, { status: 413 });
    }
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Request body must be JSON.", code: "bad-request" }, { status: 400 });
  }

  const parsed = tripAgentRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Travis couldn't read that request. Try rewording it.", code: "bad-request" }, { status: 400 });
  }

  const provider = getTripAgentProvider();
  if (!provider) {
    return NextResponse.json({ error: UNAVAILABLE, code: "unavailable" }, { status: 503 });
  }

  try {
    const result = await runTripAgent(parsed.data, provider, getPlacesProvider());
    const response: TripAgentResponse = {
      reply: result.reply,
      changeSet: result.changeSet,
    };
    return NextResponse.json(response);
  } catch (error) {
    // Looking up real places failed (the only source of places has nothing, or is down).
    if (error instanceof PlacesProviderError) {
      console.error(`[trip-agent] places lookup failed (${error.code})`);
      return NextResponse.json(
        { error: friendlyPlacesMessage(error.code), code: error.code },
        { status: statusForPlacesError(error.code) },
      );
    }
    const code = error instanceof AIProviderError ? error.code : "unknown";
    // Category only; what was asked, the trip and the model's output stay out of the log.
    console.error(`[trip-agent] request failed (${code})`);

    switch (code) {
      case "quota":
        return NextResponse.json({ error: "Travis is busy right now. Try again in a minute.", code: "busy" }, { status: 503 });
      case "timeout":
        return NextResponse.json({ error: "Travis took too long to answer. Try again.", code: "timeout" }, { status: 504 });
      case "malformed-json":
      case "schema":
        return NextResponse.json({ error: "Travis gave an answer we couldn't use. Try rephrasing.", code: "unusable" }, { status: 502 });
      default:
        return NextResponse.json({ error: UNAVAILABLE, code: "unavailable" }, { status: 503 });
    }
  }
}
