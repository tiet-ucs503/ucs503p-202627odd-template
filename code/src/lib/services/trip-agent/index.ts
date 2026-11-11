import { toDateInputValue } from "@/lib/date";
import { AIProviderError, type AIProvider } from "@/lib/services/ai";
import type { PlacesProvider } from "@/lib/services/places/provider";
import { containsPriceClaim, stripPriceClaims } from "@/lib/services/travis/price-guard";
import { MAX_AGENT_HISTORY_MESSAGES, toEditOperation } from "@/lib/validation/trip-agent";
import type { AgentTrip, ChangeSet, EditOperation, TripAgentFocus, TripAgentMessageInput } from "@/types/trip-agent";
import { buildChangeSet, type EngineDeps } from "./apply";
import { gatherTopPlaces, wantsRecommendations } from "./recommendations";

export { buildChangeSet, nextFreeTime, statsOf } from "./apply";
export { tripVersion } from "./version";

/**
 * The trip agent's entry point: the model proposes, TripEase decides.
 *
 *   attempt → Zod → each operation checked → ids found, places found, days
 *   re-checked → (one repair retry) → a change set, or a plain explanation
 *
 * The same shape as the city planner's and Travis's pipelines, and the same
 * limits: exactly one retry, and only for things a model can fix (unusable
 * JSON, an operation missing a field, an id that isn't in the trip, a place
 * that can't be found). Never for auth, quota or timeouts, where a second call
 * only costs more.
 *
 * Whatever happens, the result is a sentence for the traveller and, when there
 * is one, a `ChangeSet` they can confirm. Nothing here changes a trip.
 */

export interface TripAgentResult {
  reply: string;
  changeSet: ChangeSet | null;
  /** Model calls made: 1 normally, 2 after a repair. For logs and tests; never shown. */
  attempts: number;
}

const SHAPE_REPAIR = "Your answer was not valid JSON in the required shape. Reply with JSON only, exactly matching the schema.";
const GENERIC_REPLY = "Here is what I'd change.";

/** The model's sentence, with any amount of money cut out: the agent never states a price. */
function safeReply(text: string): string {
  return containsPriceClaim(text) ? stripPriceClaims(text) || GENERIC_REPLY : text;
}

function withoutDuplicates(operations: EditOperation[]): EditOperation[] {
  const seen = new Set<string>();
  return operations.filter((op) => {
    const key = JSON.stringify(op);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function runTripAgent(
  input: { trip: AgentTrip; messages: TripAgentMessageInput[]; focus?: TripAgentFocus },
  provider: AIProvider,
  places: PlacesProvider,
  /** Injectable for tests. `YYYY-MM-DD`. */
  today: string = toDateInputValue(new Date()),
  /** Injectable for tests. */
  generate?: EngineDeps["generate"],
): Promise<TripAgentResult> {
  const messages = input.messages.slice(-MAX_AGENT_HISTORY_MESSAGES);
  let repairNote: string | undefined;

  // A question about what to see or eat is answered from real, top-rated places
  // rather than from memory. Looked up once, even if the model is asked twice.
  const latest = messages[messages.length - 1]?.content ?? "";
  const grounding = wantsRecommendations(latest) ? ((await gatherTopPlaces(input.trip, latest, input.focus, places)) ?? undefined) : undefined;

  for (let attempt = 1; attempt <= 2; attempt++) {
    let turn;
    try {
      turn = await provider.proposeTripEdit({ today, trip: input.trip, messages, focus: input.focus, grounding }, repairNote);
    } catch (error) {
      const fixable = error instanceof AIProviderError && (error.code === "malformed-json" || error.code === "schema");
      if (fixable && attempt === 1) {
        repairNote = SHAPE_REPAIR;
        continue;
      }
      throw error;
    }

    const reply = safeReply(turn.reply);

    // A question, or a polite no: nothing to confirm.
    if (turn.operations.length === 0) return { reply, changeSet: null, attempts: attempt };

    const operations: EditOperation[] = [];
    const malformed: string[] = [];
    turn.operations.forEach((raw, index) => {
      const checked = toEditOperation(raw, index);
      if ("error" in checked) malformed.push(checked.error);
      else operations.push(checked);
    });

    let problems = malformed;
    if (problems.length === 0) {
      const built = await buildChangeSet(input.trip, withoutDuplicates(operations), { places, generate });
      if (built.ok) return { reply, changeSet: built.changeSet, attempts: attempt };
      problems = built.problems;
    }

    if (attempt === 1) {
      repairNote = problems.join("\n");
      continue;
    }
    // Out of retries: say what went wrong, in words the traveller can act on.
    return { reply: `I couldn't make that change. ${problems[0]}`, changeSet: null, attempts: attempt };
  }

  // Unreachable: the loop returns or throws on its second pass.
  throw new AIProviderError("provider-error", "The trip agent could not produce an answer.");
}
