import { GroqAIProvider } from "./groq-provider";
import { MockAIProvider } from "./mock-provider";
import type { AIProvider } from "./provider";

export type { AIProvider, AIProviderName, AIFailureCode, TravisRequest } from "./provider";
export { AIProviderError } from "./provider";
export { MockAIProvider } from "./mock-provider";
export { GroqAIProvider } from "./groq-provider";

/**
 * The one place an AI provider gets chosen.
 *
 * `AI_PROVIDER=groq` with a `GROQ_API_KEY` gives live reasoning;
 * `AI_PROVIDER=mock` gives the deterministic stand-in; anything else (or a
 * missing key) returns null, and the city planner falls back to its
 * deterministic planner. Adding OpenAI later means one class plus one branch
 * here — `services/planning` doesn't change.
 *
 * Server-only: these env vars have no `NEXT_PUBLIC_` prefix, so calling this
 * from a client component would silently yield null.
 */
export function getAIProvider(): AIProvider | null {
  const configured = (process.env.AI_PROVIDER ?? "").toLowerCase();

  if (configured === "mock") {
    return new MockAIProvider();
  }

  if (configured === "groq") {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      console.warn("[ai] AI_PROVIDER=groq but GROQ_API_KEY is not set — using the deterministic planner.");
      return null;
    }
    return new GroqAIProvider(apiKey, process.env.GROQ_MODEL, process.env.GROQ_BASE_URL);
  }

  if (configured && configured !== "none") {
    console.warn(`[ai] Unknown AI_PROVIDER "${configured}" — using the deterministic planner.`);
  }
  return null;
}

/** Safe to expose: says whether AI planning is configured, never what the key is. */
export function aiProviderStatus(): { provider: string; live: boolean; model: string | null } {
  const provider = getAIProvider();
  if (!provider) return { provider: "none", live: false, model: null };
  return { provider: provider.name, live: !provider.simulated, model: provider.model };
}
