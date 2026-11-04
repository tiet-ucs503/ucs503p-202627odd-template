import { z } from "zod";
import { travelStyleSchema } from "@/lib/validation/shared";

/**
 * Two boundaries, both guarding something different.
 *
 * `travisChatRequestSchema` is the door into our own API route: it bounds how
 * much a client can make us pay a model to read. `llmTravisTurnSchema` is the
 * door out of the model: it is deliberately narrow, and everything it lets
 * through is still sanitised afterwards (dates, prices) before a traveller
 * sees it.
 */

export const MAX_USER_MESSAGE_CHARS = 1000;
/** A little above the model's own reply cap, so a real reply always round-trips. */
export const MAX_ASSISTANT_MESSAGE_CHARS = 1600;
export const MAX_HISTORY_MESSAGES = 12;

const messageSchema = z
  .object({
    role: z.enum(["user", "assistant"]),
    content: z.string().trim().min(1),
    suggested: z.array(z.string().trim().min(1).max(80)).max(3).optional(),
  })
  .superRefine((message, ctx) => {
    const max = message.role === "user" ? MAX_USER_MESSAGE_CHARS : MAX_ASSISTANT_MESSAGE_CHARS;
    if (message.content.length > max) {
      ctx.addIssue({ code: "custom", message: `Message is longer than ${max} characters.` });
    }
    // Only Travis suggests places; a traveller's message has no business carrying them.
    if (message.role === "user" && message.suggested !== undefined) {
      ctx.addIssue({ code: "custom", message: "Only Travis's messages can list suggested places." });
    }
  });

export const travisChatRequestSchema = z
  .object({
    messages: z.array(messageSchema).min(1).max(MAX_HISTORY_MESSAGES),
  })
  .superRefine((request, ctx) => {
    // The traveller's newest words must be last: Travis always answers a user.
    if (request.messages.at(-1)?.role !== "user") {
      ctx.addIssue({ code: "custom", message: "The last message must be from the traveller." });
    }
  });

const month = z.number().int().min(1).max(12);

const llmSuggestionSchema = z.object({
  destination: z.string().trim().min(2).max(80),
  headline: z.string().trim().min(1).max(160),
  startMonth: month,
  endMonth: month,
  costOutlook: z.enum(["lower", "typical", "higher"]),
  costReason: z.string().trim().min(1).max(240),
  weatherNote: z.string().trim().min(1).max(240),
  // Strict JSON-schema mode makes every field required, so "none" arrives as
  // null; plain JSON mode may omit it. Both mean the same thing.
  watchOut: z
    .string()
    .trim()
    .max(240)
    .nullish()
    .transform((value) => (value ? value : null)),
  suggestedDays: z.number().int().min(2).max(21),
  styles: z.array(travelStyleSchema).max(4),
});

export const llmTravisTurnSchema = z.object({
  reply: z.string().trim().min(1).max(1500),
  suggestions: z.array(llmSuggestionSchema).max(3),
  followUps: z.array(z.string().trim().min(1).max(80)).max(3),
});

export type LlmTravisTurn = z.infer<typeof llmTravisTurnSchema>;
export type LlmTravisSuggestion = z.infer<typeof llmSuggestionSchema>;
