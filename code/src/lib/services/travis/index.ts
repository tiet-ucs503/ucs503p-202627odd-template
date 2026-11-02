import { AIProviderError, type AIProvider } from "@/lib/services/ai";
import { toDateInputValue } from "@/lib/date";
import { MAX_HISTORY_MESSAGES } from "@/lib/validation/travis";
import type { LlmTravisTurn } from "@/lib/validation/travis";
import type { TravisMessageInput, TravisReply } from "@/types/travis";
import { redactPrices, toReply, turnPriceClaims } from "./sanitize";

export { suggestDates, windowLabel } from "./dates";
export { containsPriceClaim, findPriceClaims, stripPriceClaims } from "./price-guard";

/**
 * Travis's entry point: the model proposes, TripEase decides.
 *
 *   attempt → Zod → price check → (one repair retry) → clean-up
 *
 * The same shape as the city planner's pipeline, with one deliberate
 * difference: there is no deterministic fallback to fall *back* to. A
 * conversation can't be faked by rules, and pretending otherwise would be
 * worse than saying Travis is unavailable. So when the model can't be reached
 * this throws, and the caller tells the traveller plainly — while the manual
 * way of planning a trip carries on working.
 *
 * Exactly one retry, and only for things a model can fix: unusable JSON, or
 * an amount of money in its answer. Never for auth, quota or timeouts, where
 * a second call just costs more and takes longer.
 */

export interface TravisResult extends TravisReply {
  /** Model calls made: 1 normally, 2 after a repair. For logs and tests; never shown. */
  attempts: number;
  /** True when prices survived the retry and had to be cut out of the answer. */
  redacted: boolean;
}

const PRICE_REPAIR =
  "You stated amounts of money. You have no live prices, so you must not state any amount, fare or rate in any currency. Describe cost only as lower, typical or higher, with the seasonal reason.";
const SHAPE_REPAIR = "Your answer was not valid JSON in the required shape. Reply with JSON only, exactly matching the schema.";

export async function chatWithTravis(
  messages: TravisMessageInput[],
  provider: AIProvider,
  /** Injectable for tests. `YYYY-MM-DD`. */
  today: string = toDateInputValue(new Date()),
): Promise<TravisResult> {
  const history = messages.slice(-MAX_HISTORY_MESSAGES);
  let repairNote: string | undefined;
  // The first attempt's answer, kept in case the retry can't be completed.
  let priced: LlmTravisTurn | null = null;

  for (let attempt = 1; attempt <= 2; attempt++) {
    let turn: LlmTravisTurn;
    try {
      turn = await provider.converse({ messages: history, today }, repairNote);
    } catch (error) {
      const fixable = error instanceof AIProviderError && (error.code === "malformed-json" || error.code === "schema");
      if (fixable && attempt === 1) {
        repairNote = SHAPE_REPAIR;
        continue;
      }
      // The retry failed but the first answer was usable apart from its
      // prices: show that, minus the prices, rather than nothing.
      if (priced) return finish(redactPrices(priced), today, attempt, true);
      throw error;
    }

    if (turnPriceClaims(turn).length === 0) {
      return finish(turn, today, attempt, false);
    }

    if (attempt === 1) {
      priced = turn;
      repairNote = PRICE_REPAIR;
      continue;
    }
    return finish(redactPrices(turn), today, attempt, true);
  }

  // Unreachable: the loop returns or throws on its second pass.
  throw new AIProviderError("provider-error", "Travis could not produce an answer.");
}

function finish(turn: LlmTravisTurn, today: string, attempts: number, redacted: boolean): TravisResult {
  return { ...toReply(turn, today), attempts, redacted };
}
