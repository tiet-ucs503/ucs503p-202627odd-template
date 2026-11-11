import { NextRequest, NextResponse } from "next/server";
import { authErrorResponse, requireUser } from "@/lib/server/firebase-auth";
import { createRateLimiter } from "@/lib/server/rate-limit";
import { AIProviderError, getAIProvider } from "@/lib/services/ai";
import { chatWithTravis } from "@/lib/services/travis";
import { travisChatRequestSchema } from "@/lib/validation/travis";
import type { TravisResponse } from "@/types/travis";

/**
 * POST /api/travis/chat
 *
 * One turn of Travis, the discovery assistant: where to go, and when it costs
 * less. Stateless — the browser sends the conversation so far and gets one
 * reply back, so nothing about a conversation is stored on the server.
 *
 * Authenticated and rate limited, because every call spends model quota.
 *
 * Privacy: message text is never logged. A traveller's half-formed plans are
 * their own, and the pilot study promises not to collect more than it says.
 * Only status codes and failure categories reach the server log.
 */

// A model call plus one repair retry can run past a short serverless default.
export const maxDuration = 45;

/** Counted in characters, which is what `text.length` measures; a cheap guard, not an exact byte limit. */
const MAX_BODY_CHARS = 32_000;

/** 20 messages per person per 10 minutes: plenty for a real conversation. */
const limiter = createRateLimiter({ limit: 20, windowMs: 10 * 60 * 1000 });

const UNAVAILABLE = "Travis isn't available right now. You can still plan your trip yourself.";

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
        error: "You're sending messages quickly. Give Travis a moment and try again.",
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
      return NextResponse.json({ error: "That message is too long.", code: "too-large" }, { status: 413 });
    }
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Request body must be JSON.", code: "bad-request" }, { status: 400 });
  }

  const parsed = travisChatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Travis couldn't read that message. Try rewording it.", code: "bad-request" },
      { status: 400 },
    );
  }

  const provider = getAIProvider();
  if (!provider) {
    return NextResponse.json({ error: UNAVAILABLE, code: "unavailable" }, { status: 503 });
  }

  try {
    const result = await chatWithTravis(parsed.data.messages, provider);
    const response: TravisResponse = {
      reply: result.reply,
      suggestions: result.suggestions,
      followUps: result.followUps,
    };
    return NextResponse.json(response);
  } catch (error) {
    const code = error instanceof AIProviderError ? error.code : "unknown";
    // Category only; the message text and the model's output stay out of the log.
    console.error(`[travis] chat failed (${code})`);

    switch (code) {
      case "quota":
        return NextResponse.json(
          { error: "Travis is busy right now. Try again in a minute.", code: "busy" },
          { status: 503 },
        );
      case "timeout":
        return NextResponse.json(
          { error: "Travis took too long to answer. Try again.", code: "timeout" },
          { status: 504 },
        );
      case "malformed-json":
      case "schema":
        return NextResponse.json(
          { error: "Travis gave an answer we couldn't use. Try rephrasing.", code: "unusable" },
          { status: 502 },
        );
      default:
        return NextResponse.json({ error: UNAVAILABLE, code: "unavailable" }, { status: 503 });
    }
  }
}
