"use client";

import { Chip } from "@/components/ui";
import type { DestinationSuggestion, TravisChatMessage } from "@/types/travis";
import { SuggestionCard } from "./suggestion-card";

/**
 * One turn of the conversation.
 *
 * A traveller's words sit in a quiet bubble on the right. Travis's sit on the
 * page itself, with its suggestion cards underneath — there is no chat-bot
 * avatar or decoration, just a plain "T" so it's clear who is speaking. Each
 * turn also carries a visually hidden "You said" / "Travis said", because the
 * alignment that tells sighted people who is talking tells a screen reader
 * nothing.
 */
export function TravisMessage({
  message,
  isLatest,
  disabled,
  onPlan,
  onFollowUp,
}: {
  message: TravisChatMessage;
  /** Only the newest Travis turn offers follow-ups; older ones are history. */
  isLatest: boolean;
  disabled: boolean;
  onPlan: (suggestion: DestinationSuggestion) => void;
  onFollowUp: (text: string) => void;
}) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md border border-orange-100 bg-orange-50 px-4 py-2.5 text-sm text-zinc-900 dark:border-orange-900/50 dark:bg-orange-950/30 dark:text-zinc-100">
          <span className="sr-only">You said: </span>
          {message.content}
        </div>
      </div>
    );
  }

  const suggestions = message.suggestions ?? [];
  const followUps = isLatest ? (message.followUps ?? []) : [];

  return (
    <div className="flex gap-3">
      <div
        aria-hidden="true"
        className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-zinc-900 text-xs font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900"
      >
        T
      </div>

      <div className="min-w-0 flex-1">
        <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-zinc-800 dark:text-zinc-200">
          <span className="sr-only">Travis said: </span>
          {message.content}
        </p>

        {suggestions.length > 0 ? (
          <div className="mt-4 flex flex-col gap-3">
            {suggestions.map((suggestion) => (
              <SuggestionCard key={suggestion.id} suggestion={suggestion} onPlan={onPlan} />
            ))}
            <p className="text-xs text-zinc-500">
              Cost and weather describe a typical year, not live prices or a forecast. Check current fares
              before you book.
            </p>
          </div>
        ) : null}

        {followUps.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Suggested replies">
            {followUps.map((text) => (
              <Chip
                key={text}
                disabled={disabled}
                className="px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => onFollowUp(text)}
              >
                {text}
              </Chip>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
