import { AIProviderError, getAIProvider, type AIProvider } from "@/lib/services/ai";
import type { CityPlan, CityPlanRequest } from "@/types/planning";
import { FALLBACK_PLANNER_VERSION, planCitiesDeterministically } from "./fallback-planner";
import { destinationMatches, validateCityAllocation } from "./validate";

export type { CityPlan, CityPlanRequest, CityAllocation } from "@/types/planning";
export { validateCityAllocation, destinationMatches } from "./validate";
export { planCitiesDeterministically } from "./fallback-planner";
export { splitDaysAcrossCities } from "./split-days";

/**
 * The planning entry point: AI proposes, TripEase validates, and the
 * deterministic planner catches everything that falls through.
 *
 *   attempt → Zod → constraint checks → (one repair retry) → fallback
 *
 * Exactly one retry, and only when the failure is something a model can
 * plausibly fix (a bad allocation, malformed JSON) — never for auth/quota/
 * timeouts, where retrying just costs money and time. Whatever happens, this
 * returns a valid plan: the traveller never sees a broken generation screen
 * because a model had an off day.
 *
 * This function knows nothing about Groq, OpenAI or any other vendor; it
 * depends only on the `AIProvider` interface.
 */
export async function planCities(
  request: CityPlanRequest,
  /** Injectable for tests; defaults to whatever the environment configures. */
  provider: AIProvider | null = getAIProvider(),
): Promise<CityPlan> {
  if (!provider) {
    return fallbackPlan(request, "No planning model configured.");
  }

  let repairNote: string | undefined;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const proposal = await provider.planCities(request, repairNote);

      const problems: string[] = [];
      if (!destinationMatches(proposal.destination, request.destination)) {
        problems.push(
          `The plan is for "${proposal.destination}" but the trip is to "${request.destination}".`,
        );
      }
      const validation = validateCityAllocation(proposal.cities, request);
      if (!validation.ok) problems.push(...validation.problems);

      if (problems.length === 0) {
        return {
          destination: request.destination,
          cities: proposal.cities,
          source: "ai",
          plannerVersion: `${provider.name}:${provider.model}`,
          fallbackReason: null,
        };
      }

      // Worth one correction round; a second is paying twice for the same mistake.
      if (attempt === 0) {
        // Logged because a provider that needs repairing often is a prompt or
        // model-choice problem worth noticing, not a one-off.
        console.warn(`[planner] proposal rejected, retrying once: ${problems[0]}`);
        repairNote = problems.join("\n");
        continue;
      }
      return fallbackPlan(request, `Plan failed validation: ${problems[0]}`);
    } catch (error) {
      const code = error instanceof AIProviderError ? error.code : "provider-error";
      const retryable = code === "malformed-json" || code === "schema";
      if (retryable && attempt === 0) {
        repairNote = "Your previous answer was not valid JSON in the required shape.";
        continue;
      }
      return fallbackPlan(request, `Planning model unavailable (${code}).`);
    }
  }

  return fallbackPlan(request, "Planning model did not return a usable plan.");
}

function fallbackPlan(request: CityPlanRequest, reason: string): CityPlan {
  const cities = planCitiesDeterministically(request);

  // The fallback is meant to be incapable of producing something invalid; if
  // it somehow did, that's a bug worth surfacing in logs rather than shipping
  // a broken itinerary.
  const validation = validateCityAllocation(cities, request);
  if (!validation.ok) {
    console.error("[planner] deterministic fallback produced an invalid plan", validation.problems);
  }

  return {
    destination: request.destination,
    cities,
    source: "fallback",
    plannerVersion: FALLBACK_PLANNER_VERSION,
    fallbackReason: reason,
  };
}
