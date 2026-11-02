import { DEMO_DESTINATIONS, type DemoDestination } from "@/lib/mock-data/travis-demo";
import { planCitiesDeterministically } from "@/lib/services/planning/fallback-planner";
import { llmCityPlanSchema, type LlmCityPlan } from "@/lib/validation/planning";
import { llmTravisTurnSchema, type LlmTravisTurn } from "@/lib/validation/travis";
import type { CityPlanRequest } from "@/types/planning";
import { AIProviderError, type AIProvider, type TravisRequest } from "./provider";

/**
 * A stand-in AI provider: no network, no key, deterministic output.
 *
 * Two uses. In tests it exercises the full proposal → Zod → constraint →
 * repair → fallback pipeline without a live model. At runtime
 * (`AI_PROVIDER=mock`) it keeps the app fully functional with no credentials.
 *
 * Its proposals come from the deterministic planner, so they're always valid
 * and never invent city names. Because nothing actually *reasoned* about the
 * trip, `simulated` is true and `services/planning` records the resulting
 * plan as `fallback`, not `ai` — a trip should never claim AI planning it
 * didn't get. Travis likewise reports `mode: "demo"` so the interface can say
 * its answers are canned.
 */
export type MockBehaviour =
  | "valid"
  | "bad-allocation"
  | "malformed"
  | "error"
  /** Quotes a price on the first attempt, then answers cleanly once corrected. */
  | "price-claim"
  /** Quotes a price every time, however many times it is corrected. */
  | "price-claim-always";

const MONTH_WORDS: [RegExp, number][] = [
  [/\bjan(uary)?\b/, 1],
  [/\bfeb(ruary)?\b/, 2],
  [/\bmar(ch)?\b/, 3],
  [/\bapr(il)?\b/, 4],
  [/\bmay\b/, 5],
  [/\bjun(e)?\b/, 6],
  [/\bjul(y)?\b/, 7],
  [/\baug(ust)?\b/, 8],
  [/\bsep(t(ember)?)?\b/, 9],
  [/\boct(ober)?\b/, 10],
  [/\bnov(ember)?\b/, 11],
  [/\bdec(ember)?\b/, 12],
  [/\bsummer\b/, 7],
  [/\bwinter\b/, 12],
];

const CHEAP_WORDS = /\b(cheap(er|est)?|low[- ]?cost|lowest|budget|save|saving|afford(able)?|inexpensive)\b/;

function monthInWindow(month: number, startMonth: number, endMonth: number): boolean {
  return startMonth <= endMonth
    ? month >= startMonth && month <= endMonth
    : month >= startMonth || month <= endMonth;
}

export class MockAIProvider implements AIProvider {
  readonly name = "mock" as const;
  readonly model = "mock";
  readonly simulated = true;

  /** How many times `planCities` has been called — lets tests assert retry counts. */
  calls = 0;
  /** The same, for `converse`. */
  chatCalls = 0;
  /** The repair notes `converse` received, in order — for asserting what a retry told the model. */
  repairNotes: (string | undefined)[] = [];

  constructor(private readonly behaviour: MockBehaviour = "valid") {}

  async planCities(request: CityPlanRequest, repairNote?: string): Promise<LlmCityPlan> {
    this.calls += 1;

    if (this.behaviour === "error") {
      throw new AIProviderError("quota", "Simulated provider failure.");
    }
    if (this.behaviour === "malformed") {
      throw new AIProviderError("malformed-json", "Simulated malformed response.");
    }

    // Reproduce the realistic failure the pipeline has to survive: a
    // well-formed plan whose days don't add up. The repair round then
    // succeeds, exactly as a real model's correction would.
    if (this.behaviour === "bad-allocation" && !repairNote) {
      const parsed = llmCityPlanSchema.parse({
        destination: request.destination,
        cities: [
          { name: "First City", days: request.dayCount, reason: "Simulated" },
          { name: "Second City", days: 1, reason: "Simulated overflow" },
        ],
      });
      return parsed;
    }

    return llmCityPlanSchema.parse({
      destination: request.destination,
      cities: planCitiesDeterministically(request),
    });
  }

  async converse(request: TravisRequest, repairNote?: string): Promise<LlmTravisTurn> {
    this.chatCalls += 1;
    this.repairNotes.push(repairNote);

    if (this.behaviour === "error") {
      throw new AIProviderError("quota", "Simulated provider failure.");
    }
    if (this.behaviour === "malformed") {
      throw new AIProviderError("malformed-json", "Simulated malformed response.");
    }

    const turn = this.demoTurn(request.messages.at(-1)?.content ?? "");

    const quotesPrice =
      this.behaviour === "price-claim-always" || (this.behaviour === "price-claim" && !repairNote);
    if (quotesPrice) {
      turn.reply = `${turn.reply} Return flights are usually around $400.`;
    }

    return llmTravisTurnSchema.parse(turn);
  }

  /** Pick destinations by keyword and answer from the canned catalogue. */
  private demoTurn(message: string): LlmTravisTurn {
    const text = message.toLowerCase();
    const wantsCheap = CHEAP_WORDS.test(text);
    const month = MONTH_WORDS.find(([pattern]) => pattern.test(text))?.[1] ?? null;

    const named = DEMO_DESTINATIONS.filter((d) => d.keywords.some((keyword) => text.includes(keyword)));
    // With nothing named, offer the places whose chosen window suits the
    // month asked about, or failing that the first few.
    const pool = named.length > 0 ? named : DEMO_DESTINATIONS;
    const suited = pool.filter((d) => {
      const window = wantsCheap ? d.cheap : d.best;
      return month === null || monthInWindow(month, window.startMonth, window.endMonth);
    });
    const chosen = (suited.length > 0 ? suited : pool).slice(0, 3);

    const suggestions = chosen.map((d) => this.suggestionFor(d, wantsCheap));
    const names = chosen.map((d) => d.destination);
    const list = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : names[0];

    return {
      reply: wantsCheap
        ? `For lower costs, ${list} ${names.length > 1 ? "are" : "is"} best outside the busiest weeks. These are typical seasonal patterns from demo data, not live fares.`
        : `${list} ${names.length > 1 ? "suit" : "suits"} what you described. These suggestions come from demo data rather than a live assistant.`,
      suggestions,
      followUps: ["What about somewhere cheaper?", "Show me a shorter trip", "Somewhere with fewer crowds"],
    };
  }

  private suggestionFor(d: DemoDestination, wantsCheap: boolean): LlmTravisTurn["suggestions"][number] {
    const window = wantsCheap ? d.cheap : d.best;
    return {
      destination: d.destination,
      headline: d.headline,
      startMonth: window.startMonth,
      endMonth: window.endMonth,
      costOutlook: wantsCheap ? "lower" : d.best.costOutlook,
      costReason: window.costReason,
      weatherNote: wantsCheap ? d.cheap.weatherNote : d.weatherNote,
      watchOut: d.watchOut,
      suggestedDays: d.suggestedDays,
      styles: d.styles,
    };
  }
}
