import { z } from "zod";
import { ACTIVITY_CATEGORY_ICON, type ActivityCategory } from "@/types/itinerary";
import type { EditOperation } from "@/types/trip-agent";
import { travelStyleSchema } from "@/lib/validation/shared";
import { budgetBreakdownSchema, citySchema, flightQuoteSchema, travelerTypeSchema, tripDaySchema } from "@/lib/validation/trip";

/**
 * The two boundaries of the trip agent: what the browser may send, and what a
 * language model may send back.
 */

export const MAX_AGENT_MESSAGE_CHARS = 800;
/** Recent turns only: older ones cost tokens and rarely matter to the next edit. */
export const MAX_AGENT_HISTORY_MESSAGES = 10;
export const MAX_TRIP_DAYS = 30;
export const MAX_OPERATIONS = 8;
/** Room for an answer about a place; the prompt asks for about 120 words, well inside this. */
export const MAX_REPLY_CHARS = 1500;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** The trip, as the browser sends it. The server has no database access, so the trip travels with the request. */
export const agentTripSchema = z.object({
  id: z.string().min(1).max(120),
  title: z.string().max(200),
  destination: z.string().min(1).max(80),
  startDate: isoDate,
  endDate: isoDate,
  dayCount: z.number().int().min(1).max(60),
  currency: z.enum(["INR", "USD", "EUR", "GBP"]),
  travelers: z.number().int().min(1).max(20),
  travelerType: travelerTypeSchema,
  preferences: z.array(travelStyleSchema).max(8),
  cities: z.array(citySchema).min(1).max(12),
  days: z.array(tripDaySchema).min(1).max(120),
  budget: budgetBreakdownSchema,
  flights: flightQuoteSchema.nullable().optional(),
});

export const tripAgentRequestSchema = z.object({
  trip: agentTripSchema,
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(MAX_AGENT_MESSAGE_CHARS),
      }),
    )
    .min(1)
    .max(MAX_AGENT_HISTORY_MESSAGES)
    // Optional chaining: Zod still runs this when `.min(1)` has failed, on an empty list.
    .refine((messages) => messages[messages.length - 1]?.role === "user", {
      message: "The last message must be the traveller's.",
    }),
  focus: z
    .object({
      dayId: z.string().max(120).optional(),
      cityId: z.string().max(120).optional(),
      activityId: z.string().max(120).optional(),
    })
    .optional(),
});

const OPERATION_TYPES = [
  "remove_activity",
  "move_activity",
  "replace_activity",
  "add_activity",
  "change_hotel",
  "set_cities",
  "set_trip_length",
] as const;

const CATEGORIES = Object.keys(ACTIVITY_CATEGORY_ICON) as [ActivityCategory, ...ActivityCategory[]];

const optionalText = z.string().trim().max(120).nullish();

/**
 * One operation as a model writes it: every field optional, because a JSON
 * schema that every provider accepts is flat. It is turned into a strict
 * `EditOperation` by `toEditOperation`, which says exactly what is missing.
 */
export const llmOperationSchema = z.object({
  type: z.enum(OPERATION_TYPES),
  activityId: optionalText,
  dayId: optionalText,
  toDayId: optionalText,
  cityId: optionalText,
  query: optionalText,
  category: z.enum(CATEGORIES).nullish(),
  dayCount: z.number().int().nullish(),
  cities: z
    .array(z.object({ name: z.string().trim().min(1).max(80), days: z.number().int().min(1).max(60) }))
    .max(12)
    .nullish(),
});

export const llmTripEditSchema = z.object({
  /**
   * Shown to the traveller. For a change it describes what *would* happen
   * (before they confirm); for a question it is the answer, which needs more room.
   */
  reply: z.string().trim().min(1).max(MAX_REPLY_CHARS),
  operations: z.array(llmOperationSchema).max(MAX_OPERATIONS),
});

export type LlmOperation = z.infer<typeof llmOperationSchema>;
export type LlmTripEdit = z.infer<typeof llmTripEditSchema>;

/** A search phrase for a place: short, and nothing that reads like an instruction. */
const QUERY = z.string().trim().min(2).max(80);

/**
 * Strictly validate one operation. Returns the operation, or a sentence saying
 * what is wrong with it, which is what a model is shown when asked to correct itself.
 */
export function toEditOperation(raw: LlmOperation, position: number): EditOperation | { error: string } {
  const label = `Operation ${position + 1} (${raw.type})`;
  const need = (field: string) => ({ error: `${label} is missing "${field}".` });

  switch (raw.type) {
    case "remove_activity":
      return raw.activityId ? { type: raw.type, activityId: raw.activityId } : need("activityId");
    case "move_activity":
      if (!raw.activityId) return need("activityId");
      if (!raw.toDayId) return need("toDayId");
      return { type: raw.type, activityId: raw.activityId, toDayId: raw.toDayId };
    case "replace_activity": {
      if (!raw.activityId) return need("activityId");
      const query = QUERY.safeParse(raw.query ?? "");
      return query.success ? { type: raw.type, activityId: raw.activityId, query: query.data } : need("query");
    }
    case "add_activity": {
      if (!raw.dayId) return need("dayId");
      const query = QUERY.safeParse(raw.query ?? "");
      if (!query.success) return need("query");
      return { type: raw.type, dayId: raw.dayId, query: query.data, ...(raw.category ? { category: raw.category } : {}) };
    }
    case "change_hotel": {
      if (!raw.cityId) return need("cityId");
      const query = QUERY.safeParse(raw.query ?? "");
      return query.success ? { type: raw.type, cityId: raw.cityId, query: query.data } : need("query");
    }
    case "set_cities":
      return raw.cities && raw.cities.length > 0 ? { type: raw.type, cities: raw.cities } : need("cities");
    case "set_trip_length": {
      if (raw.dayCount == null) return need("dayCount");
      if (raw.dayCount < 1 || raw.dayCount > MAX_TRIP_DAYS) {
        return { error: `${label}: a trip can be 1 to ${MAX_TRIP_DAYS} days long.` };
      }
      return { type: raw.type, dayCount: raw.dayCount };
    }
  }
}
