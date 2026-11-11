import { z } from "zod";
import type { ChangeSetView, TripAgentChatMessage } from "@/types/trip-agent";

/**
 * Keeps a trip's conversation with Travis across a page refresh.
 *
 * The same rules as `travis-storage`, for the same reasons: `sessionStorage`,
 * so it ends with the tab and never reaches our database; stored under the
 * account that had it, so the next person to sign in here never sees it;
 * cleared on sign-out; and treated as untrusted when it comes back.
 *
 * Each trip has its own conversation, keyed by account *and* trip, so "make it
 * shorter" on one trip is never answered with another trip's history.
 *
 * Two things are deliberately not kept. A proposal's `patch` (the whole new
 * itinerary, easily 100 KB) is dropped, so a stored conversation stays small;
 * and a proposal that was still waiting is stored as "not applied", because the
 * trip may have changed while the page was closed and applying it would then be
 * unsafe. The traveller can simply ask again.
 */

const PREFIX = "tripease:trip-agent:v1:";
const MAX_STORED_MESSAGES = 30;

const keyFor = (uid: string, tripId: string) => `${PREFIX}${uid}:${tripId}`;

const stats = z.object({
  dayCount: z.number(),
  total: z.number(),
  estimatedTotal: z.number(),
  cityDays: z.array(z.object({ name: z.string(), days: z.number() })),
  overfullDays: z.array(z.number()),
});

const changeSetSchema = z.object({
  id: z.string(),
  baseVersion: z.string(),
  lines: z.array(z.string()),
  warnings: z.array(z.string()),
  before: stats,
  after: stats,
});

const messageSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  changeSet: changeSetSchema.optional(),
  status: z.enum(["pending", "applied", "discarded", "undone"]).optional(),
});

type Id = string | null | undefined;

export function loadTripChat(uid: Id, tripId: Id): TripAgentChatMessage[] {
  if (typeof window === "undefined" || !uid || !tripId) return [];
  try {
    const raw = window.sessionStorage.getItem(keyFor(uid, tripId));
    if (!raw) return [];
    const parsed = z.array(messageSchema).safeParse(JSON.parse(raw));
    if (!parsed.success) return [];
    return parsed.data.map((message) => (message.status === "pending" ? { ...message, status: "discarded" as const } : message));
  } catch {
    return [];
  }
}

/** A change set as stored: what the traveller reads, without the patch. */
function summary(changeSet: ChangeSetView): ChangeSetView {
  const { patch: _patch, ...rest } = changeSet;
  void _patch;
  return rest;
}

export function saveTripChat(uid: Id, tripId: Id, messages: TripAgentChatMessage[]): void {
  if (typeof window === "undefined" || !uid || !tripId) return;
  try {
    if (messages.length === 0) {
      window.sessionStorage.removeItem(keyFor(uid, tripId));
      return;
    }
    const slim = messages.slice(-MAX_STORED_MESSAGES).map((m) => (m.changeSet ? { ...m, changeSet: summary(m.changeSet) } : m));
    window.sessionStorage.setItem(keyFor(uid, tripId), JSON.stringify(slim));
  } catch {
    // Losing the history is an acceptable degradation, not a crash.
  }
}

export function clearTripChat(uid: Id, tripId: Id): void {
  saveTripChat(uid, tripId, []);
}

/** Forget every stored trip conversation in this tab. Used on sign-out. */
export function clearAllTripChats(): void {
  if (typeof window === "undefined") return;
  try {
    // Walk backwards: removing a key shifts every index after it.
    for (let i = window.sessionStorage.length - 1; i >= 0; i--) {
      const key = window.sessionStorage.key(i);
      if (key?.startsWith(PREFIX)) window.sessionStorage.removeItem(key);
    }
  } catch {
    // Nothing more can be done if storage is unavailable.
  }
}
