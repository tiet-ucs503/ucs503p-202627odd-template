"use client";

import { Chip } from "@/components/ui";
import { Button } from "@/components/ui";
import { TravisAvatar } from "@/components/travis/travis-avatar";

/**
 * Travis, where the trip is: a card directly under the trip's header, so the
 * assistant is part of the trip rather than a control in a corner.
 *
 * It says what Travis is for in a sentence and offers three things worth
 * asking. Choosing one opens the conversation with that already asked, so the
 * first thing a traveller sees is an answer, not an empty box.
 */
export const TRIP_QUESTIONS = ["What will the weather be like?", "What should I try locally?", "Make the trip a day shorter"] as const;

export function TravisBanner({
  destination,
  onOpen,
  onAsk,
}: {
  destination: string;
  /** Open the conversation. */
  onOpen: () => void;
  /** Open the conversation with this already asked. */
  onAsk: (text: string) => void;
}) {
  return (
    <section
      aria-labelledby="travis-banner-title"
      className="flex flex-col gap-4 rounded-2xl border border-orange-200 bg-orange-50/70 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5 dark:border-orange-900/60 dark:bg-orange-950/20"
    >
      <div className="flex min-w-0 gap-3.5">
        <TravisAvatar size="lg" className="shrink-0" />
        <div className="min-w-0">
          <h2 id="travis-banner-title" className="font-display text-lg font-medium leading-tight tracking-tight text-zinc-900 dark:text-zinc-50">
            Ask Travis about your trip
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            The weather in {destination}, what&apos;s worth trying locally, or a change to the plan. Travis shows you what would change
            before anything is saved.
          </p>
          <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Things to ask Travis">
            {TRIP_QUESTIONS.map((text) => (
              <Chip key={text} className="px-3 py-1.5 text-xs" onClick={() => onAsk(text)}>
                {text}
              </Chip>
            ))}
          </div>
        </div>
      </div>
      <Button onClick={onOpen} className="shrink-0 self-start sm:self-center">
        Chat with Travis
      </Button>
    </section>
  );
}
