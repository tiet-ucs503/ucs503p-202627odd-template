"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useAuth } from "@/components/auth-provider";
import { Alert, Button } from "@/components/ui";
import { ApiError } from "@/lib/api-client";
import { photoForCountry } from "@/lib/destination-photos";
import { askTravis } from "@/lib/travis-client";
import { startTripFromSuggestion } from "@/lib/travis-draft";
import { clearConversation, loadConversation, saveConversation } from "@/lib/travis-storage";
import type { DestinationSuggestion, TravisChatMessage, TravisResponse } from "@/types/travis";
import { Composer } from "./composer";
import { TravisAvatar } from "./travis-avatar";
import { TravisMessage } from "./travis-message";

/**
 * Things worth asking, for someone staring at an empty box. Each is a real
 * question Travis can answer, covering the two jobs it has: where to go, and
 * when it costs less. `code` picks the photograph on its card; it does not
 * change what is asked.
 */
const STARTERS = [
  { prompt: "Where should I go this summer?", code: "CH" },
  { prompt: "When is the cheapest time to visit Japan?", code: "JP" },
  { prompt: "A week somewhere warm in December", code: "MV" },
  { prompt: "Long weekend ideas for food lovers", code: "IT" },
] as const;

export const STARTER_PROMPTS: string[] = STARTERS.map((starter) => starter.prompt);

interface ChatError {
  message: string;
  /** Travis itself isn't available (as opposed to a passing failure). */
  unavailable: boolean;
  /** Sending the same thing again might work. */
  canRetry: boolean;
}

function describeError(error: unknown): ChatError {
  if (error instanceof ApiError) {
    if (error.code === "unavailable") return { message: error.message, unavailable: true, canRetry: false };
    // Not signed in, or the message itself was refused: sending it again won't help.
    if (error.status === 401 || error.code === "bad-request" || error.code === "too-large") {
      return { message: error.message, unavailable: false, canRetry: false };
    }
    return { message: error.message, unavailable: false, canRetry: true };
  }
  return { message: "Something went wrong. Please try again.", unavailable: false, canRetry: true };
}

let counter = 0;
function newId(): string {
  counter += 1;
  return `m-${Date.now().toString(36)}-${counter}`;
}

type Ask = (messages: TravisChatMessage[]) => Promise<TravisResponse>;

const subscribeNever = () => () => {};

/**
 * True once the browser has taken over from the server-rendered HTML.
 *
 * The conversation lives in session storage, which the server cannot see. If
 * the first render read it, a server-rendered page would show an empty
 * conversation and the client would immediately disagree — a hydration error.
 * Rendering nothing until this is true makes the first client render match the
 * server's, and needs no state-setting effect to get there.
 */
function useHydrated(): boolean {
  return useSyncExternalStore(subscribeNever, () => true, () => false);
}

/**
 * Travis's conversation. Safe to mount anywhere, including somewhere that is
 * rendered on the server: it shows nothing until the browser has hydrated, and
 * only then reads the saved conversation.
 */
export function TravisChat({
  ask = askTravis,
}: {
  /** How a conversation gets answered. Injectable so tests and previews need no server. */
  ask?: Ask;
}) {
  const hydrated = useHydrated();
  if (!hydrated) return <div aria-hidden="true" className="min-h-64" />;
  return <Conversation ask={ask} />;
}

/**
 * The whole conversation: what's been said, the box to say more, and what
 * happens when it goes wrong.
 *
 * The conversation is kept in this tab's session storage so a refresh doesn't
 * lose it, and is never saved anywhere else. When the model can't be reached
 * the page says so plainly and points at planning a trip by hand, because the
 * rest of TripEase doesn't depend on Travis.
 */
function Conversation({ ask }: { ask: Ask }) {
  const router = useRouter();
  // The conversation belongs to whoever is signed in, so it is stored under
  // their account: the next person to sign in on this tab doesn't inherit it.
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const [messages, setMessages] = useState<TravisChatMessage[]>(() => loadConversation(uid));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ChatError | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    saveConversation(uid, messages);
  }, [uid, messages]);

  // Keep the conversation in view as it grows.
  //
  // Where to land depends on who just spoke. After the traveller sends, or
  // while Travis is thinking, the bottom is right: that's where "thinking"
  // appears. After Travis answers it is not — a reply can be three cards
  // long, and scrolling to its *end* would leave the reader past the opening
  // sentence and having to scroll back up to read it. So land on its start.
  useEffect(() => {
    const last = messages.at(-1);
    if (!last) return;

    if (!pending && last.role === "assistant") {
      document.getElementById(`travis-${last.id}`)?.scrollIntoView({ block: "start" });
    } else {
      bottomRef.current?.scrollIntoView({ block: "end" });
    }
  }, [messages, pending, error]);

  const run = useCallback(async (history: TravisChatMessage[]) => {
    setPending(true);
    setError(null);
    try {
      const response = await ask(history);
      if (!mounted.current) return;
      const reply: TravisChatMessage = {
        id: newId(),
        role: "assistant",
        content: response.reply,
        suggestions: response.suggestions,
        followUps: response.followUps,
        mode: response.mode,
      };
      setMessages((current) => [...current, reply]);
    } catch (caught) {
      if (mounted.current) setError(describeError(caught));
    } finally {
      if (mounted.current) setPending(false);
    }
  }, [ask]);

  const send = useCallback(
    (text: string) => {
      if (pending) return;
      const next = [...messages, { id: newId(), role: "user" as const, content: text }];
      setMessages(next);
      void run(next);
    },
    [messages, pending, run],
  );

  const retry = useCallback(() => {
    if (!pending) void run(messages);
  }, [messages, pending, run]);

  const startOver = useCallback(() => {
    clearConversation(uid);
    setMessages([]);
    setError(null);
  }, [uid]);

  const plan = useCallback(
    (suggestion: DestinationSuggestion) => {
      startTripFromSuggestion(suggestion);
      router.push("/trips/new");
    },
    [router],
  );

  const latestAssistantId = [...messages].reverse().find((m) => m.role === "assistant")?.id;
  const inDemoMode = messages.some((m) => m.mode === "demo");

  return (
    <div className="flex flex-col gap-6">
      {inDemoMode ? (
        <Alert tone="info">
          Demo mode: these answers come from built-in sample data rather than a live assistant.
        </Alert>
      ) : null}

      {/* Where it can be found: at the top of a conversation, not at the foot of a long one. */}
      {messages.length > 0 ? (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={startOver} disabled={pending}>
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            Start a new conversation
          </Button>
        </div>
      ) : null}

      <div
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        aria-label="Conversation with Travis"
        className="flex flex-col gap-6"
      >
        {messages.length === 0 ? (
          <EmptyState onPick={send} disabled={pending} />
        ) : (
          messages.map((message) => (
            // The wrapper is the scroll target for "start of Travis's reply".
            <div key={message.id} id={`travis-${message.id}`} className="scroll-mt-4">
              <TravisMessage
                message={message}
                isLatest={message.id === latestAssistantId && !pending}
                disabled={pending}
                onPlan={plan}
                onFollowUp={send}
              />
            </div>
          ))
        )}

        {pending ? (
          <div className="flex items-center gap-3">
            <TravisAvatar />
            <p className="text-sm text-zinc-500">Travis is thinking…</p>
            <span aria-hidden="true" className="flex gap-1">
              {[0, 150, 300].map((delay) => (
                <span
                  key={delay}
                  style={{ animationDelay: `${delay}ms` }}
                  className="h-1.5 w-1.5 rounded-full bg-zinc-400 motion-safe:animate-bounce"
                />
              ))}
            </span>
          </div>
        ) : null}
      </div>

      {error ? (
        <div className="flex flex-col gap-3">
          <Alert tone={error.unavailable ? "info" : "error"}>{error.message}</Alert>
          <div className="flex flex-wrap gap-2">
            {error.canRetry ? (
              <Button size="sm" variant="secondary" onClick={retry} disabled={pending}>
                Try again
              </Button>
            ) : null}
            {error.unavailable ? (
              <Link href="/trips/new">
                <Button size="sm">Plan a trip yourself</Button>
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}

      <div ref={bottomRef} />

      <div className="sticky bottom-0 -mx-1 bg-background px-1 pb-4 pt-3 before:pointer-events-none before:absolute before:inset-x-0 before:-top-6 before:h-6 before:bg-gradient-to-t before:from-background before:to-transparent">
        <Composer onSend={send} disabled={pending} />
      </div>
    </div>
  );
}

function EmptyState({ onPick, disabled }: { onPick: (text: string) => void; disabled: boolean }) {
  return (
    <div className="flex flex-col gap-8 pt-2">
      <div>
        <h2 className="font-display text-2xl font-medium tracking-tight text-zinc-900 sm:text-3xl dark:text-zinc-50">
          Where are you thinking of going?
        </h2>
        <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-zinc-600 dark:text-zinc-400">
          Tell me roughly when you want to travel and what you enjoy, and I&apos;ll suggest places, the best time
          of year to go, and when it usually costs less.
        </p>
      </div>

      <div>
        <p className="mb-3 text-sm font-medium text-zinc-800 dark:text-zinc-200">Try asking</p>
        <div className="grid gap-3 sm:grid-cols-2" role="group" aria-label="Example questions">
          {STARTERS.map(({ prompt, code }) => {
            const photo = photoForCountry(code);
            return (
              <button
                key={prompt}
                type="button"
                disabled={disabled}
                onClick={() => onPick(prompt)}
                className="group flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-2 pr-4 text-left transition-all hover:border-orange-400 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-orange-500"
              >
                {/* Decoration: the question beside it is the button's name. */}
                <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-zinc-200 dark:bg-zinc-800">
                  <Image
                    src={photo.src}
                    alt=""
                    fill
                    sizes="56px"
                    style={{ objectPosition: photo.position }}
                    className="object-cover transition-transform duration-500 motion-safe:group-hover:scale-110"
                  />
                </span>
                <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{prompt}</span>
              </button>
            );
          })}
        </div>
      </div>

      <p className="max-w-xl text-xs leading-relaxed text-zinc-500">
        I can&apos;t see live fares or availability, so I&apos;ll always say when something is a typical pattern
        rather than a price.
      </p>
    </div>
  );
}
