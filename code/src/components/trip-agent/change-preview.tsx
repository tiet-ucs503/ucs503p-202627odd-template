"use client";

import { AlertTriangle, ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui";
import { formatMoney } from "@/lib/utils";
import type { ChangeSetView, ChangeStatus } from "@/types/trip-agent";

/**
 * What Travis is proposing, before anything is saved: each change in a line,
 * anything worth knowing before saying yes, and the numbers that moved.
 *
 * The numbers shown are the ones the lines don't already say: the cost, and
 * only when it moved.
 */
export function ChangePreview({
  changeSet,
  status,
  stale,
  busy,
  canUndo,
  currency,
  onApply,
  onDiscard,
  onUndo,
}: {
  changeSet: ChangeSetView;
  status: ChangeStatus;
  /** The trip changed after this was proposed, so applying it would overwrite that. */
  stale: boolean;
  /** A save is in flight. */
  busy: boolean;
  canUndo: boolean;
  currency: string;
  onApply: () => void;
  onDiscard: () => void;
  onUndo: () => void;
}) {
  const { before, after } = changeSet;

  // Only the cost is shown as a number. Everything else that moved (the trip's
  // length, a city's days) is already said in the lines above, in words, and
  // saying it twice makes the card look busier than the change is.
  const costChanged = Math.round(before.estimatedTotal) !== Math.round(after.estimatedTotal);

  return (
    <section
      aria-label="Proposed change"
      className="mt-3 overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
    >
      <ul className="flex flex-col gap-1.5 px-4 pt-3.5 text-sm leading-snug text-zinc-800 dark:text-zinc-200">
        {changeSet.lines.map((line, index) => (
          <li key={index} className="flex gap-2">
            <span aria-hidden="true" className="mt-[0.55em] h-1 w-1 shrink-0 rounded-full bg-orange-600" />
            <span>{line}</span>
          </li>
        ))}
      </ul>

      {costChanged ? (
        <dl className="mx-4 mt-3 border-t border-zinc-100 pt-2 text-xs dark:border-zinc-800">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-zinc-500">Estimated cost</dt>
            <dd className="flex items-center gap-1.5 tabular-nums text-zinc-800 dark:text-zinc-200">
              <span className="text-zinc-500">{formatMoney(before.estimatedTotal, currency)}</span>
              <ArrowRight className="h-3 w-3 text-zinc-400" aria-label="to" />
              <span className="font-medium">{formatMoney(after.estimatedTotal, currency)}</span>
            </dd>
          </div>
        </dl>
      ) : null}

      {changeSet.warnings.length > 0 ? (
        <ul className="mx-4 mt-3 flex flex-col gap-1.5">
          {changeSet.warnings.map((warning, index) => (
            <li
              key={index}
              className="flex gap-2 rounded-lg bg-amber-50 px-2.5 py-2 text-xs leading-snug text-amber-900 dark:bg-amber-950/30 dark:text-amber-200"
            >
              <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{warning}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-3.5 flex flex-wrap items-center gap-2 border-t border-zinc-100 px-4 py-3 dark:border-zinc-800">
        {status === "pending" ? (
          stale ? (
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              This trip has changed since I suggested this, so applying it could undo your edits. Ask me again and I&apos;ll
              work from the trip as it is now.
            </p>
          ) : (
            <>
              <Button size="sm" onClick={onApply} disabled={busy}>
                {busy ? "Saving…" : "Apply changes"}
              </Button>
              <Button size="sm" variant="ghost" onClick={onDiscard} disabled={busy}>
                Discard
              </Button>
            </>
          )
        ) : null}

        {status === "pending" && stale ? (
          <Button size="sm" variant="ghost" onClick={onDiscard}>
            Dismiss
          </Button>
        ) : null}

        {status === "applied" ? (
          <>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
              Applied to your trip
            </span>
            {canUndo ? (
              <Button size="sm" variant="ghost" onClick={onUndo} disabled={busy}>
                {busy ? "Undoing…" : "Undo"}
              </Button>
            ) : null}
          </>
        ) : null}

        {status === "discarded" ? <span className="text-xs text-zinc-500">Not applied</span> : null}
        {status === "undone" ? <span className="text-xs text-zinc-500">Undone: your trip is back as it was</span> : null}
      </div>
    </section>
  );
}
