import { z } from 'zod';
import { APP_LOCALES } from '../../common/locales.js';

const USER_MESSAGE_MAX = 800;
const HISTORY_TURN_MAX = 4000;

function clipTurnContent(value: string, max: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

export const assistantTurnSchema = z
  .object({
    role: z.enum(['user', 'assistant']),
    content: z
      .string()
      .trim()
      .min(1)
      .transform((value) => clipTurnContent(value, HISTORY_TURN_MAX)),
  })
  .strict();

export const queryAssistantBodySchema = z
  .object({
    message: z.string().trim().min(1).max(USER_MESSAGE_MAX),
    history: z.array(assistantTurnSchema).max(4).default([]),
    language: z.enum(APP_LOCALES).optional(),
  })
  .strict();

export const speakAssistantBodySchema = z
  .object({
    text: z.string().trim().min(1).max(2500),
    language: z.enum(APP_LOCALES).optional(),
  })
  .strict();

export type QueryAssistantBody = z.infer<typeof queryAssistantBodySchema>;
export type SpeakAssistantBody = z.infer<typeof speakAssistantBodySchema>;
export type AssistantTurn = z.infer<typeof assistantTurnSchema>;
