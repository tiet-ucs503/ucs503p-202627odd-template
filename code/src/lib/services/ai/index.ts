import { GeminiAIProvider } from "./gemini-provider";
import { GroqAIProvider } from "./groq-provider";
import type { AIProvider } from "./provider";

export type { AIProvider, AIProviderName, AIFailureCode, TravisRequest, TripEditRequest } from "./provider";
export { AIProviderError } from "./provider";
export { GroqAIProvider } from "./groq-provider";
export { GeminiAIProvider } from "./gemini-provider";

/**
 * Build the provider named `configured`, or null when it is not usable.
 *
 * `groq` and `gemini` need their key (`GROQ_API_KEY`, `GEMINI_API_KEY`);
 * anything else, or a missing key, returns null and the caller says the
 * assistant is unavailable (or, for the city planner, uses its rule-based
 * planner, which needs no model and invents nothing). There is no stand-in
 * model: an answer is either a real model's or there isn't one. Adding another vendor
 * later is one class plus one branch here; nothing that depends on
 * `AIProvider` changes.
 */
function buildProvider(configured: string, variable: string): AIProvider | null {
  if (configured === "groq") {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      console.warn(`[ai] ${variable}=groq but GROQ_API_KEY is not set.`);
      return null;
    }
    return new GroqAIProvider(apiKey, process.env.GROQ_MODEL, process.env.GROQ_BASE_URL);
  }

  if (configured === "gemini") {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn(`[ai] ${variable}=gemini but GEMINI_API_KEY is not set.`);
      return null;
    }
    return new GeminiAIProvider(apiKey, process.env.GEMINI_MODEL, process.env.GEMINI_BASE_URL);
  }

  if (configured && configured !== "none") {
    console.warn(`[ai] Unknown ${variable} "${configured}".`);
  }
  return null;
}

/**
 * The one place an AI provider gets chosen.
 *
 * `AI_PROVIDER=groq|gemini` with the matching key gives live reasoning;
 * anything else (or a missing key) returns null, and the city planner falls
 * back to its rule-based planner.
 *
 * Server-only: these env vars have no `NEXT_PUBLIC_` prefix, so calling this
 * from a client component would silently yield null.
 */
export function getAIProvider(): AIProvider | null {
  return buildProvider((process.env.AI_PROVIDER ?? "").toLowerCase(), "AI_PROVIDER");
}

/**
 * The provider for the trip agent. By default the same one as everything else;
 * `TRIP_AGENT_PROVIDER` lets the agent use a different model from the planner
 * and Travis (for example Gemini for editing while Groq keeps the rest).
 */
export function getTripAgentProvider(): AIProvider | null {
  const override = (process.env.TRIP_AGENT_PROVIDER ?? "").toLowerCase();
  if (override && override !== "inherit") return buildProvider(override, "TRIP_AGENT_PROVIDER");
  return getAIProvider();
}

/** Safe to expose: says whether AI planning is configured, never what the key is. */
export function aiProviderStatus(): { provider: string; live: boolean; model: string | null } {
  const provider = getAIProvider();
  if (!provider) return { provider: "none", live: false, model: null };
  return { provider: provider.name, live: true, model: provider.model };
}
