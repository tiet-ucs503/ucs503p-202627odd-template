import { z } from "zod";
import { travelStyleSchema } from "@/lib/validation/shared";
import type { TravisChatMessage } from "@/types/travis";

/**
 * Keeps a conversation across a page refresh.
 *
 * `sessionStorage`, not `localStorage` or Firestore, on purpose. A traveller
 * half-planning a surprise trip hasn't agreed to have that kept: it ends with
 * the tab, and nothing about it reaches our database. (The pilot study has
 * promised participants it records no more than it says.)
 *
 * Two further rules, because a tab can outlive a person. Each conversation is
 * stored under the account that had it, so whoever signs in next on a shared
 * machine never sees it; and signing out clears them all.
 *
 * Stored data is untrusted when it comes back: it may be from an older shape
 * of the app, or edited by hand. It is parsed, and anything that doesn't fit
 * is thrown away rather than rendered.
 */

const PREFIX = "tripease:travis:v1:";
const MAX_STORED_MESSAGES = 40;

const keyFor = (uid: string) => `${PREFIX}${uid}`;

const suggestionSchema = z.object({
  id: z.string(),
  destination: z.string(),
  headline: z.string(),
  startMonth: z.number(),
  endMonth: z.number(),
  windowLabel: z.string(),
  costOutlook: z.enum(["lower", "typical", "higher"]),
  costReason: z.string(),
  weatherNote: z.string(),
  watchOut: z.string().nullable(),
  suggestedDays: z.number(),
  styles: z.array(travelStyleSchema),
  startDate: z.string(),
  endDate: z.string(),
});

const messageSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  suggestions: z.array(suggestionSchema).optional(),
  followUps: z.array(z.string()).optional(),
});

type Uid = string | null | undefined;

export function loadConversation(uid: Uid): TravisChatMessage[] {
  if (typeof window === "undefined" || !uid) return [];
  try {
    const raw = window.sessionStorage.getItem(keyFor(uid));
    if (!raw) return [];
    const parsed = z.array(messageSchema).safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : [];
  } catch {
    // Private browsing, a corrupt value, or storage switched off: start fresh.
    return [];
  }
}

export function saveConversation(uid: Uid, messages: TravisChatMessage[]): void {
  // With nobody signed in there is nobody to keep a conversation for.
  if (typeof window === "undefined" || !uid) return;
  try {
    if (messages.length === 0) {
      window.sessionStorage.removeItem(keyFor(uid));
      return;
    }
    window.sessionStorage.setItem(keyFor(uid), JSON.stringify(messages.slice(-MAX_STORED_MESSAGES)));
  } catch {
    // Losing the history is an acceptable degradation, not a crash.
  }
}

export function clearConversation(uid: Uid): void {
  saveConversation(uid, []);
}

/** Forget every stored conversation in this tab. Used on sign-out. */
export function clearAllConversations(): void {
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
