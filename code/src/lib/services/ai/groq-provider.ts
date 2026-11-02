import type { ZodType } from "zod";
import { llmCityPlanSchema, type LlmCityPlan } from "@/lib/validation/planning";
import { llmTravisTurnSchema, type LlmTravisTurn } from "@/lib/validation/travis";
import type { CityPlanRequest } from "@/types/planning";
import {
  AIProviderError,
  buildCityPlannerUserPrompt,
  CITY_PLAN_JSON_SCHEMA,
  CITY_PLANNER_SYSTEM_PROMPT,
  type AIProvider,
  type TravisRequest,
} from "./provider";
import { buildTravisMessages, TRAVIS_JSON_SCHEMA } from "./travis-prompt";

/**
 * Groq-hosted models via their OpenAI-compatible chat-completions endpoint.
 *
 * `GROQ_API_KEY` is server-only (no `NEXT_PUBLIC_` prefix). This class is
 * constructed solely by `getAIProvider()`, which only runs in route handlers,
 * so the key never reaches the browser.
 *
 * Output is constrained with `response_format: json_schema` where the model
 * supports it, which makes the model emit the requested structure rather than
 * prose. Not every Groq model accepts a schema, so a rejection of that
 * specific parameter falls back to plain JSON mode for the retry — the result
 * is validated identically either way, so the fallback loses constraint
 * strength but never correctness.
 *
 * Every capability (city planning, Travis) goes through the one `structured`
 * method below, so timeouts, error classification and the schema fallback are
 * written once rather than per feature.
 */

const DEFAULT_BASE_URL = "https://api.groq.com/openai/v1";
const DEFAULT_MODEL = "openai/gpt-oss-120b";
const TIMEOUT_MS = 20_000;

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** What differs between one structured call and another. */
interface StructuredSpec<T> {
  /** Names the schema to the model. */
  name: string;
  schema: object;
  /** The boundary the model's JSON has to cross before anything uses it. */
  parser: ZodType<T>;
  temperature: number;
  /**
   * Caps the completion. Besides bounding cost, it matters for rate limits:
   * Groq counts the tokens a request *could* use against the per-minute
   * allowance, so an uncapped call reserves far more than it spends.
   */
  maxTokens?: number;
  /**
   * How hard a reasoning model thinks before answering. Chat doesn't need a
   * long chain of thought, and the thinking is billed against the same
   * tokens-per-minute allowance as the answer. Only sent to models that take it.
   */
  reasoningEffort?: "low" | "medium" | "high";
}

export class GroqAIProvider implements AIProvider {
  readonly name = "groq" as const;
  readonly simulated = false;
  readonly model: string;

  private readonly baseUrl: string;
  /** Flipped once the model tells us it won't accept a JSON schema. */
  private schemaModeSupported = true;

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

    return this.structured(messages, {
      name: "city_plan",
      schema: CITY_PLAN_JSON_SCHEMA,
      parser: llmCityPlanSchema,
      temperature: 0.3,
    });
  }

  async converse(request: TravisRequest, repairNote?: string): Promise<LlmTravisTurn> {
    return this.structured(buildTravisMessages(request.today, request.messages, repairNote), {
      name: "travis_turn",
      schema: TRAVIS_JSON_SCHEMA,
      parser: llmTravisTurnSchema,
      // Warmer than the planner: this is a conversation, and two travellers
      // asking the same question shouldn't get word-for-word identical answers.
      temperature: 0.5,
      // Three suggestion cards plus a short reply fit comfortably in this.
      maxTokens: 1500,
      reasoningEffort: "low",
    });
  }

  /** Ask for JSON in `spec.schema`'s shape and return it only if it parses and validates. */
  private async structured<T>(messages: ChatMessage[], spec: StructuredSpec<T>): Promise<T> {
    let raw = await this.complete(messages, this.schemaModeSupported, spec);

    // Some models accept the request but reject the schema parameter; retry
    // once in plain JSON mode rather than failing the whole call over it.
    if (raw === "unsupported-schema") {
      this.schemaModeSupported = false;
      console.warn("[ai] Groq model rejected json_schema; falling back to json_object mode.");
      raw = await this.complete(messages, false, spec);
    }

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

  /** Returns the message content, or the sentinel "unsupported-schema". */
  private async complete(
    messages: ChatMessage[],
    useSchema: boolean,
    spec: Pick<StructuredSpec<unknown>, "name" | "schema" | "temperature" | "maxTokens" | "reasoningEffort">,
  ): Promise<string> {
    const responseFormat = useSchema
      ? {
          type: "json_schema",
          json_schema: { name: spec.name, strict: true, schema: spec.schema },
        }
      : { type: "json_object" };

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          temperature: spec.temperature,
          response_format: responseFormat,
          ...(spec.maxTokens ? { max_completion_tokens: spec.maxTokens } : {}),
          // `reasoning_effort` is a gpt-oss parameter; other models may reject
          // an option they don't know, so it is sent only where it applies.
          ...(spec.reasoningEffort && this.model.includes("gpt-oss")
            ? { reasoning_effort: spec.reasoningEffort }
            : {}),
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
      // Logged server-side only: the body can echo prompt content and key hints.
      const detail = await response.text().catch(() => "");
      console.error(`[ai] Groq responded ${response.status}: ${detail.slice(0, 300)}`);

      if (useSchema && response.status === 400 && /json_schema|response_format|schema/i.test(detail)) {
        return "unsupported-schema";
      }
      if (response.status === 401 || response.status === 403) {
        throw new AIProviderError("auth", "The model rejected our credentials.");
      }
      if (response.status === 429) {
        throw new AIProviderError("quota", "The model is rate limited.");
      }
      throw new AIProviderError("provider-error", "The model failed.");
    }

    let content: unknown;
    try {
      const body = await response.json();
      content = body?.choices?.[0]?.message?.content;
    } catch {
      throw new AIProviderError("malformed-json", "The model returned an unreadable response.");
    }

    if (typeof content !== "string" || content.trim().length === 0) {
      throw new AIProviderError("malformed-json", "The model returned an empty answer.");
    }
    return content;
  }
}
