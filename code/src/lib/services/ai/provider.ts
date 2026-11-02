import type { CityPlanRequest } from "@/types/planning";
import type { LlmCityPlan } from "@/lib/validation/planning";
import type { TravisMessageInput } from "@/types/travis";
import type { LlmTravisTurn } from "@/lib/validation/travis";

/**
 * The reasoning layer's provider seam.
 *
 * The city planner depends on this interface and nothing else — it has no
 * knowledge of Groq, OpenAI, or any particular vendor's request shape. Adding
 * a provider means adding a class here and a branch in `getAIProvider()`;
 * `services/planning` doesn't change.
 *
 * A provider's only job is to return a *proposal*. It never decides anything:
 * whatever it returns is schema-checked and then constraint-checked by
 * `services/planning` before it can influence a trip.
 */

export type AIProviderName = "groq" | "mock";

export type AIFailureCode =
  | "not-configured"
  | "timeout"
  | "quota"
  | "auth"
  | "provider-error"
  | "malformed-json"
  | "schema";

export class AIProviderError extends Error {
  constructor(
    readonly code: AIFailureCode,
    message: string,
  ) {
    super(message);
    this.name = "AIProviderError";
  }
}

/** What Travis is asked: the conversation so far, and today's date as the server knows it. */
export interface TravisRequest {
  /** Oldest first; the last entry is the traveller's newest message. */
  messages: TravisMessageInput[];
  /** `YYYY-MM-DD`. Supplied by us so the model never has to guess the date. */
  today: string;
}

export interface AIProvider {
  readonly name: AIProviderName;
  /** Identifier of the model actually used, for reporting and logs. */
  readonly model: string;
  /**
   * True for stand-ins that don't actually reason. Plans from these are
   * recorded as `fallback` rather than `ai`, so a trip never claims to have
   * been AI-planned when it wasn't.
   */
  readonly simulated: boolean;

  /**
   * Propose a city allocation. `repairNote` carries the previous attempt's
   * validation failures so a retry is a correction, not a re-roll.
   *
   * Throws `AIProviderError`; returns only well-formed JSON that has already
   * passed `llmCityPlanSchema`.
   */
  planCities(request: CityPlanRequest, repairNote?: string): Promise<LlmCityPlan>;

  /**
   * One turn of Travis, the discovery assistant. Same contract as
   * `planCities`: a *proposal* only, already parsed through
   * `llmTravisTurnSchema`, thrown as `AIProviderError` on any failure. What
   * the traveller finally sees is decided later, in `services/travis`.
   */
  converse(request: TravisRequest, repairNote?: string): Promise<LlmTravisTurn>;
}

/**
 * Shared prompt. Kept here rather than inside a provider so every provider
 * reasons from identical instructions and they stay comparable.
 *
 * The travel-burden guidance matters: without it a model happily proposes
 * three cities for a three-day trip. Real routing/travel-time logic is a
 * later iteration's job — this just makes the model treat each transfer as
 * costing something.
 */
export const CITY_PLANNER_SYSTEM_PROMPT = [
  "You plan the city-level shape of a trip. You do not write itineraries, list attractions, or invent prices.",
  "Reply with JSON only, matching exactly:",
  '{"destination": string, "cities": [{"name": string, "days": integer, "reason": string}]}',
  "",
  "Rules:",
  "- Use real, well-known city (or island/region) names a traveller could actually book. Never invent placeholder names like 'X City' or 'X Coast'.",
  "- The `days` values MUST sum to exactly the trip length given.",
  "- Every city appears at most once, with at least 1 day.",
  "",
  "Treat every city change as a real cost — roughly half a day of travel plus transfer expense:",
  "- Favour cities that are geographically close to one another; avoid criss-crossing a country.",
  "- Short trips should stay in fewer places. A 3-day trip is usually one city; adding a second needs a strong reason.",
  "- As a rule of thumb, allow at least 2-3 days per city; a 9-day trip supports about 2-3 cities.",
  "- A tight budget means fewer moves (each transfer costs money); a generous budget allows more.",
  "- Weight the choice towards the traveller's stated preferences.",
  "",
  "- `reason` is one short phrase (under 12 words) explaining why that city earns its days.",
].join("\n");

export function buildCityPlannerUserPrompt(request: CityPlanRequest): string {
  return [
    `Destination: ${request.destination}`,
    `Trip length: ${request.dayCount} days (${request.startDate} to ${request.endDate})`,
    `Travellers: ${request.travelers}`,
    `Total budget: ${request.budget} ${request.currency} for the whole trip, all travellers`,
    `Preferences: ${request.preferences.length > 0 ? request.preferences.join(", ") : "none stated"}`,
    "",
    `Return cities whose days sum to exactly ${request.dayCount}.`,
  ].join("\n");
}

/** JSON Schema handed to providers that support schema-constrained output. */
export const CITY_PLAN_JSON_SCHEMA = {
  type: "object",
  properties: {
    destination: { type: "string" },
    cities: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          days: { type: "integer", minimum: 1 },
          reason: { type: "string" },
        },
        required: ["name", "days", "reason"],
        additionalProperties: false,
      },
    },
  },
  required: ["destination", "cities"],
  additionalProperties: false,
} as const;
