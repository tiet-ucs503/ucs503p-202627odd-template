import type { ZodType } from "zod";
import { llmCityPlanSchema, type LlmCityPlan } from "@/lib/validation/planning";
import { llmTravisTurnSchema, type LlmTravisTurn } from "@/lib/validation/travis";
import { llmTripEditSchema, type LlmTripEdit } from "@/lib/validation/trip-agent";
import type { CityPlanRequest } from "@/types/planning";
import {
  AIProviderError,
  buildCityPlannerUserPrompt,
  CITY_PLAN_JSON_SCHEMA,
  CITY_PLANNER_SYSTEM_PROMPT,
  type AIProvider,
  type TravisRequest,
  type TripEditRequest,
} from "./provider";
import { buildTravisMessages, TRAVIS_JSON_SCHEMA } from "./travis-prompt";
import { buildTripEditMessages, TRIP_EDIT_JSON_SCHEMA } from "./trip-edit-prompt";

/**
 * Google's Gemini models, through the Gemini API (`generateContent`).
 *
 * `GEMINI_API_KEY` is server-only (no `NEXT_PUBLIC_` prefix) and this class is
 * constructed only by `getAIProvider()` in route handlers, so the key never
 * reaches the browser.
 *
 * Output is requested as JSON (`responseMimeType`), with the JSON Schema given
 * in the instructions rather than as a request parameter: Gemini's own schema
 * dialect is a subset of JSON Schema, and passing the same schema every other
 * provider gets keeps the three comparable. Whatever comes back is parsed and
 * validated identically, so a model that drifts from the schema is caught by
 * the same Zod boundary as any other.
 *
 * Every capability goes through the one `structured` method, so timeouts, error
 * classification and the request shape are written once.
 */

const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_MODEL = "gemini-2.5-flash";
const TIMEOUT_MS = 30_000;

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface StructuredSpec<T> {
  schema: object;
  parser: ZodType<T>;
  temperature: number;
  /** Includes any hidden "thinking" tokens on models that spend them, so keep it generous. */
  maxOutputTokens: number;
}

/** The brief goes in `systemInstruction`; the conversation maps onto Gemini's user/model turns. */
export function toGeminiRequest(messages: ChatMessage[], schema: object) {
  const system = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");
  const turns = messages.filter((m) => m.role !== "system");

  return {
    systemInstruction: {
      parts: [
        {
          text: `${system}\n\nReply with a single JSON object that validates against this JSON Schema, and nothing else:\n${JSON.stringify(schema)}`,
        },
      ],
    },
    contents: turns.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
  };
}

export class GeminiAIProvider implements AIProvider {
  readonly name = "gemini" as const;
  readonly model: string;

  private readonly baseUrl: string;

  constructor(
    private readonly apiKey: string,
    model?: string,
    baseUrl?: string,
  ) {
    this.model = model ?? DEFAULT_MODEL;
    this.baseUrl = (baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  }

  async planCities(request: CityPlanRequest, repairNote?: string): Promise<LlmCityPlan> {
    const messages: ChatMessage[] = [
      { role: "system", content: CITY_PLANNER_SYSTEM_PROMPT },
      { role: "user", content: buildCityPlannerUserPrompt(request) },
    ];
    if (repairNote) {
      messages.push({
        role: "user",
        content: `Your previous answer was rejected:\n${repairNote}\nReturn corrected JSON in the same format.`,
      });
    }
    return this.structured(messages, { schema: CITY_PLAN_JSON_SCHEMA, parser: llmCityPlanSchema, temperature: 0.3, maxOutputTokens: 4096 });
  }

  async converse(request: TravisRequest, repairNote?: string): Promise<LlmTravisTurn> {
    return this.structured(buildTravisMessages(request.today, request.messages, repairNote), {
      schema: TRAVIS_JSON_SCHEMA,
      parser: llmTravisTurnSchema,
      temperature: 0.5,
      maxOutputTokens: 4096,
    });
  }

  async proposeTripEdit(request: TripEditRequest, repairNote?: string): Promise<LlmTripEdit> {
    return this.structured(
      buildTripEditMessages(request.today, request.trip, request.messages, request.focus, repairNote, request.grounding),
      { schema: TRIP_EDIT_JSON_SCHEMA, parser: llmTripEditSchema, temperature: 0.2, maxOutputTokens: 4096 },
    );
  }

  private async structured<T>(messages: ChatMessage[], spec: StructuredSpec<T>): Promise<T> {
    const raw = await this.complete(messages, spec);

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new AIProviderError("malformed-json", "The model returned text that isn't JSON.");
    }

    const result = spec.parser.safeParse(parsed);
    if (!result.success) {
      throw new AIProviderError("schema", "The model's JSON didn't match the expected shape.");
    }
    return result.data;
  }

  private async complete(messages: ChatMessage[], spec: StructuredSpec<unknown>): Promise<string> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/models/${encodeURIComponent(this.model)}:generateContent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // In a header, not the URL: a key in a query string ends up in logs.
          "x-goog-api-key": this.apiKey,
        },
        body: JSON.stringify({
          ...toGeminiRequest(messages, spec.schema),
          generationConfig: {
            temperature: spec.temperature,
            responseMimeType: "application/json",
            maxOutputTokens: spec.maxOutputTokens,
          },
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
      throw new AIProviderError(
        timedOut ? "timeout" : "provider-error",
        timedOut ? "The model timed out." : "Could not reach the model.",
      );
    }

    if (!response.ok) {
      // Logged server-side only: the body can echo prompt content.
      const detail = await response.text().catch(() => "");
      console.error(`[ai] Gemini responded ${response.status}: ${detail.slice(0, 300)}`);

      // An invalid key is a 400 on this API, not a 401.
      if (response.status === 401 || response.status === 403 || /API key not valid|API_KEY_INVALID/i.test(detail)) {
        throw new AIProviderError("auth", "The model rejected our credentials.");
      }
      if (response.status === 429) {
        throw new AIProviderError("quota", "The model is rate limited.");
      }
      throw new AIProviderError("provider-error", "The model failed.");
    }

    let text: string;
    try {
      const body = await response.json();
      const candidate = body?.candidates?.[0];
      // A reply cut off mid-JSON can never parse; say so rather than "malformed" in general.
      if (candidate?.finishReason === "MAX_TOKENS") {
        throw new AIProviderError("malformed-json", "The model's answer was cut off.");
      }
      const parts: unknown = candidate?.content?.parts;
      text = Array.isArray(parts)
        ? parts.map((part) => (part && typeof part.text === "string" ? part.text : "")).join("")
        : "";
    } catch (error) {
      if (error instanceof AIProviderError) throw error;
      throw new AIProviderError("malformed-json", "The model returned an unreadable response.");
    }

    if (text.trim().length === 0) {
      // Often a safety block: there is nothing to parse and nothing a retry will change.
      throw new AIProviderError("malformed-json", "The model returned an empty answer.");
    }
    return text;
  }
}
