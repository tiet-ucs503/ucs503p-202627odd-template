"use client";

import { RotateCcw, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { Alert, Button, Chip } from "@/components/ui";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Composer } from "@/components/travis/composer";
import { TravisAvatar } from "@/components/travis/travis-avatar";
import { ApiError } from "@/lib/api-client";
import { tripVersion } from "@/lib/services/trip-agent/version";
import { askTripAgent, toAgentTrip } from "@/lib/trip-agent-client";
import { describeTripFocus } from "@/lib/trip-agent-focus";
import { clearTripChat, loadTripChat, saveTripChat } from "@/lib/trip-agent-storage";
import { MAX_AGENT_HISTORY_MESSAGES, MAX_AGENT_MESSAGE_CHARS } from "@/lib/validation/trip-agent";
import type { Trip } from "@/types/trip";
import type { ChangeStatus, TripAgentChatMessage, TripAgentFocus, TripPatch } from "@/types/trip-agent";
import { ChangePreview } from "./change-preview";

type Ask = typeof askTripAgent;

interface PanelError {
  message: string;
  unavailable: boolean;
  canRetry: boolean;
}

function describeError(error: unknown): PanelError {
  if (error instanceof ApiError) {
    if (error.code === "unavailable") return { message: error.message, unavailable: true, canRetry: false };
    // Not signed in, or the request itself was refused: sending it again won't help.
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
  return `a-${Date.now().toString(36)}-${counter}`;
}

/** The patch is only needed to apply; once a change is settled it is dropped. */
function settle(message: TripAgentChatMessage, status: ChangeStatus): TripAgentChatMessage {
  if (!message.changeSet) return message;
  const { patch: _patch, ...rest } = message.changeSet;
  void _patch;
  return { ...message, status, changeSet: rest };
}

/** What `onApply` is asked to write back to restore a trip as it was. */
function snapshotOf(trip: Trip): TripPatch {
  return {
    cities: trip.cities,
    days: trip.days,
    budget: trip.budget,
    endDate: trip.endDate,
    dayCount: trip.dayCount,
    // Only when the trip has one: a trip saved before quotes existed has none to put back.
    ...(trip.flights !== undefined ? { flights: trip.flights } : {}),
  };
}

interface Undo {
  messageId: string;
  before: TripPatch;
  /** The version of the trip right after the change. Undo is offered only while the trip still has it. */
  after: string;
}

/**
 * Travis, on a trip's page: say what you want changed, see exactly what would
 * change, then apply it or not.
 *
 * Nothing here edits the trip on its own. A request returns a proposal; "Apply"
 * is the only thing that saves, and it saves through `onApply`, the page's own
 * write, under the traveller's own permissions. Every apply can be undone until
 * the trip is changed again.
 *
 * Each trip has its own conversation (stored per account and trip, for this tab
 * only), and the agent is always sent the trip as it is *now*, so anything the
 * traveller edited by hand between requests is part of what it works from.
 */
export function TripAgentPanel({
  trip,
  open,
  onOpenChange,
  focus,
  onClearFocus,
  onApply,
  prompt = null,
  onPromptSent,
  ask = askTripAgent,
}: {
  trip: Trip;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** What the traveller pointed at ("Ask Travis" on a day, a city or a place). */
  focus: TripAgentFocus | null;
  onClearFocus: () => void;
  /** Save these parts of the trip. Rejects if the save fails. Also used to undo. */
  onApply: (patch: TripPatch) => Promise<void>;
  /**
   * Something to ask as soon as the panel is open, from a suggestion chip on the
   * page. `nonce` tells one request from the next, so the same words can be asked twice.
   */
  prompt?: { text: string; nonce: number } | null;
  /** Called once the prompt has been sent, so the page can let go of it. */
  onPromptSent?: () => void;
  /** How a request gets answered. Injectable so tests and previews need no server. */
  ask?: Ask;
}) {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const [messages, setMessages] = useState<TripAgentChatMessage[]>(() => loadTripChat(uid, trip.id));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<PanelError | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [undo, setUndo] = useState<Undo | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    saveTripChat(uid, trip.id, messages);
  }, [uid, trip.id, messages]);

  const agentTrip = useMemo(() => toAgentTrip(trip), [trip]);
  const version = useMemo(() => tripVersion(agentTrip), [agentTrip]);
  const focusLabel = describeTripFocus(trip, focus);

  // Keep the newest thing in view.
  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ block: "end" });
  }, [open, messages, pending, error]);

  const run = useCallback(
    async (history: TripAgentChatMessage[]) => {
      setPending(true);
      setError(null);
      try {
        const response = await ask({
          trip: agentTrip,
          // Older turns cost tokens and rarely matter; and each must fit the server's limit.
          messages: history
            .slice(-MAX_AGENT_HISTORY_MESSAGES)
            .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_AGENT_MESSAGE_CHARS) })),
          focus: focusLabel && focus ? focus : undefined,
        });
        if (!mounted.current) return;
        const reply: TripAgentChatMessage = {
          id: newId(),
          role: "assistant",
          content: response.reply,
          ...(response.changeSet ? { changeSet: response.changeSet, status: "pending" as const } : {}),
        };
        setMessages((current) => [...current, reply]);
      } catch (caught) {
        if (mounted.current) setError(describeError(caught));
      } finally {
        if (mounted.current) setPending(false);
      }
    },
    [ask, agentTrip, focus, focusLabel],
  );

  const send = useCallback(
    (text: string) => {
      if (pending) return;
      setActionError(null);
      // A new request replaces whatever was waiting: two open proposals to the same trip would conflict.
      const settled = messages.map((m) => (m.status === "pending" ? settle(m, "discarded") : m));
      const next = [...settled, { id: newId(), role: "user" as const, content: text }];
      setMessages(next);
      void run(next);
    },
    [messages, pending, run],
  );

  // A question asked from outside the panel (a chip on the page). Sent once per
  // `nonce`, and only when the panel is open and free to take it.
  const lastPrompt = useRef<number | null>(null);
  useEffect(() => {
    if (!prompt || !open || pending || lastPrompt.current === prompt.nonce) return;
    lastPrompt.current = prompt.nonce;
    onPromptSent?.();
    send(prompt.text);
  }, [prompt, open, pending, send, onPromptSent]);

  const retry = useCallback(() => {
    if (!pending) void run(messages);
  }, [messages, pending, run]);

  const startOver = useCallback(() => {
    clearTripChat(uid, trip.id);
    setMessages([]);
    setError(null);
    setActionError(null);
    setUndo(null);
  }, [uid, trip.id]);

  const apply = useCallback(
    async (messageId: string) => {
      const message = messages.find((m) => m.id === messageId);
      const patch = message?.changeSet?.patch;
      if (!message?.changeSet || !patch || savingId) return;
      // The trip may have moved on since this was proposed; the button is hidden then, this is the backstop.
      if (message.changeSet.baseVersion !== version) return;

      const before = snapshotOf(trip);
      setSavingId(messageId);
      setActionError(null);
      try {
        await onApply(patch);
        if (!mounted.current) return;
        setMessages((current) => current.map((m) => (m.id === messageId ? settle(m, "applied") : m)));
        setUndo({
          messageId,
          before,
          after: tripVersion({ endDate: patch.endDate, cities: patch.cities, days: patch.days, budget: patch.budget }),
        });
      } catch {
        if (mounted.current) setActionError("Couldn't save the change, so your trip is unchanged. Check your connection and try again.");
      } finally {
        if (mounted.current) setSavingId(null);
      }
    },
    [messages, savingId, version, trip, onApply],
  );

  const discard = useCallback((messageId: string) => {
    setMessages((current) => current.map((m) => (m.id === messageId ? settle(m, "discarded") : m)));
  }, []);

  const undoLast = useCallback(
    async (messageId: string) => {
      if (!undo || undo.messageId !== messageId || savingId) return;
      setSavingId(messageId);
      setActionError(null);
      try {
        await onApply(undo.before);
        if (!mounted.current) return;
        setMessages((current) => current.map((m) => (m.id === messageId ? settle(m, "undone") : m)));
        setUndo(null);
      } catch {
        if (mounted.current) setActionError("Couldn't undo that, so your trip is unchanged. Check your connection and try again.");
      } finally {
        if (mounted.current) setSavingId(null);
      }
    },
    [undo, savingId, onApply],
  );

  const multiCity = trip.cities.length > 1;
  const starters = [
    "What will the weather be like?",
    "What are the famous local things to try?",
    "Make the trip a day shorter",
    "Add two more days",
    ...(multiCity ? [`Drop ${[...trip.cities].sort((x, y) => y.order - x.order)[0].name} from the trip`] : []),
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        title="Travis, your trip assistant"
        description="Ask Travis about this trip, or tell him what to change. You see exactly what would change before anything is saved."
        icon={<TravisAvatar />}
        headerExtra={
          messages.length > 0 ? (
            <Button variant="ghost" size="sm" onClick={startOver} disabled={pending || savingId !== null} className="px-2">
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              New chat
            </Button>
          ) : null
        }
      >
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto px-4 py-4">
            <div role="log" aria-live="polite" aria-relevant="additions" aria-label="Conversation with Travis about this trip" className="flex flex-col gap-4">
              {messages.length === 0 ? (
                <div className="flex flex-col gap-4">
                  <div>
                    <h2 className="font-display text-xl font-medium tracking-tight text-zinc-900 dark:text-zinc-50">Hi, I&apos;m Travis.</h2>
                    <p className="mt-1.5 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                      Ask me about your trip: what the weather is usually like, what&apos;s worth trying locally, what to do on a rainy
                      day. Or tell me what to change, like a shorter trip, another city or a different place, and I&apos;ll show you
                      exactly what would change. Nothing is saved until you say so.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2" role="group" aria-label="Example requests">
                    {starters.map((text) => (
                      <Chip key={text} disabled={pending} className="px-3 py-1.5 text-xs disabled:opacity-50" onClick={() => send(text)}>
                        {text}
                      </Chip>
                    ))}
                  </div>
                  <p className="text-xs leading-relaxed text-zinc-500">
                    I can&apos;t book anything or see live prices or forecasts, and a trip stays in {trip.destination}.
                  </p>
                </div>
              ) : (
                messages.map((message) =>
                  message.role === "user" ? (
                    <div key={message.id} className="flex justify-end">
                      <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md border border-orange-100 bg-orange-50 px-3.5 py-2 text-sm leading-relaxed text-zinc-900 dark:border-orange-900/50 dark:bg-orange-950/30 dark:text-zinc-100">
                        <span className="sr-only">You said: </span>
                        {message.content}
                      </div>
                    </div>
                  ) : (
                    <div key={message.id} className="flex gap-2.5">
                      <TravisAvatar className="mt-0.5 h-7 w-7 text-sm" />
                      <div className="min-w-0 flex-1">
                        <p className="whitespace-pre-wrap pt-0.5 text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
                          <span className="sr-only">Travis said: </span>
                          {message.content}
                        </p>
                        {message.changeSet ? (
                          <ChangePreview
                            changeSet={message.changeSet}
                            status={message.status ?? "discarded"}
                            stale={message.status === "pending" && message.changeSet.baseVersion !== version}
                            busy={savingId === message.id}
                            canUndo={undo?.messageId === message.id && undo.after === version}
                            currency={trip.currency}
                            onApply={() => void apply(message.id)}
                            onDiscard={() => discard(message.id)}
                            onUndo={() => void undoLast(message.id)}
                          />
                        ) : null}
                      </div>
                    </div>
                  ),
                )
              )}

              {pending ? (
                <div className="flex items-center gap-2.5">
                  <TravisAvatar className="h-7 w-7 text-sm" />
                  <p className="text-sm text-zinc-500">Travis is working on it…</p>
                </div>
              ) : null}
            </div>

            {actionError ? (
              <div className="mt-4">
                <Alert tone="error">{actionError}</Alert>
              </div>
            ) : null}

            {error ? (
              <div className="mt-4 flex flex-col gap-3">
                <Alert tone={error.unavailable ? "info" : "error"}>{error.message}</Alert>
                {error.canRetry ? (
                  <div>
                    <Button size="sm" variant="secondary" onClick={retry} disabled={pending}>
                      Try again
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : null}
            <div ref={bottomRef} />
          </div>

          <div className="border-t border-zinc-200 px-4 pb-4 pt-3 dark:border-zinc-800">
            {focusLabel ? (
              <div className="mb-2 flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
                <span>Looking at</span>
                <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-zinc-100 py-0.5 pl-2.5 pr-1 font-medium text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
                  <span className="truncate">{focusLabel}</span>
                  <button
                    type="button"
                    onClick={onClearFocus}
                    aria-label={`Stop looking at ${focusLabel}`}
                    className="rounded-full p-0.5 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-800 focus-visible:outline-2 focus-visible:outline-orange-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
                  >
                    <X className="h-3 w-3" aria-hidden="true" />
                  </button>
                </span>
              </div>
            ) : null}
            <Composer
              onSend={send}
              disabled={pending}
              placeholder="Ask about the trip, or tell me what to change…"
              label="Ask Travis or tell him what to change"
              maxChars={MAX_AGENT_MESSAGE_CHARS}
              inputId="trip-agent-message"
              hint={false}
            />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
