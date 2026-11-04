import type { TripDraftInput } from "@/types/trip";

/**
 * The landing-page hero widget captures a trip idea before the visitor has
 * signed in. Sessionstorage carries that partial draft across the
 * sign-up/sign-in redirect so the wizard can open pre-filled instead of
 * throwing the visitor's input away.
 */
const KEY = "tripease:draft";

export type PartialDraft = Partial<TripDraftInput>;

export function saveDraft(draft: PartialDraft) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(draft));
  } catch {
    // sessionStorage can throw in private-browsing contexts; losing the
    // draft is an acceptable degradation, not a crash.
  }
}

export function readDraft(): PartialDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as PartialDraft) : null;
  } catch {
    return null;
  }
}

export function clearDraft() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    // See saveDraft.
  }
}

/**
 * Where a draft came from, when it didn't come from the traveller typing.
 *
 * A trip started from one of Travis's suggestions arrives in the wizard with
 * dates the traveller never chose. The wizard uses this to say so — "these
 * came from Travis, check them" — rather than presenting them as if they had
 * entered them. It travels alongside the draft and is cleared with it.
 */
const ORIGIN_KEY = "tripease:draft-origin";

export interface DraftOrigin {
  source: "travis";
  destination: string;
  /** The suggested window in words, e.g. "Jun–Aug". */
  windowLabel: string;
}

export function saveDraftOrigin(origin: DraftOrigin) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(ORIGIN_KEY, JSON.stringify(origin));
  } catch {
    // See saveDraft.
  }
}

export function readDraftOrigin(): DraftOrigin | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(ORIGIN_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<DraftOrigin> | null;
    if (
      value?.source === "travis" &&
      typeof value.destination === "string" &&
      typeof value.windowLabel === "string"
    ) {
      return { source: value.source, destination: value.destination, windowLabel: value.windowLabel };
    }
    return null;
  } catch {
    return null;
  }
}

export function clearDraftOrigin() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(ORIGIN_KEY);
  } catch {
    // See saveDraft.
  }
}
