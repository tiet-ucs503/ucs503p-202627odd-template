"use client";

import { ArrowRight } from "lucide-react";
import { Badge, Button } from "@/components/ui";
import { formatDateShort } from "@/lib/utils";
import type { CostOutlook, DestinationSuggestion } from "@/types/travis";

/**
 * One place Travis suggests, with the facts a traveller needs to decide
 * whether to plan a trip around it: when it's best, what it usually costs,
 * what the weather is like, and what to watch for.
 *
 * Cost is a label with a reason, never a number. The label is written out
 * ("Usually lower cost") rather than carried by colour alone, so it reads the
 * same to someone who can't tell the colours apart.
 */

const COST_LABEL: Record<CostOutlook, { text: string; tone: "green" | "neutral" | "amber" }> = {
  lower: { text: "Usually lower cost", tone: "green" },
  typical: { text: "Typical cost", tone: "neutral" },
  higher: { text: "Usually higher cost", tone: "amber" },
};

/** "Jun 1 – Jun 8, 2027", with both years when the trip crosses New Year. */
export function formatSuggestedRange(startDate: string, endDate: string): string {
  const startYear = startDate.slice(0, 4);
  const endYear = endDate.slice(0, 4);
  if (startYear === endYear) {
    return `${formatDateShort(startDate)} – ${formatDateShort(endDate)}, ${endYear}`;
  }
  return `${formatDateShort(startDate)}, ${startYear} – ${formatDateShort(endDate)}, ${endYear}`;
}

export function SuggestionCard({
  suggestion,
  onPlan,
}: {
  suggestion: DestinationSuggestion;
  onPlan: (suggestion: DestinationSuggestion) => void;
}) {
  const cost = COST_LABEL[suggestion.costOutlook];

  return (
    <article
      aria-label={suggestion.destination}
      className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
    >
      <h3 className="font-display text-xl font-medium tracking-tight text-zinc-900 dark:text-zinc-50">
        {suggestion.destination}
      </h3>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{suggestion.headline}</p>

      <dl className="mt-4 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
        <Fact label="Best time to go">{suggestion.windowLabel}</Fact>
        <Fact label="Typical cost then">
          <Badge tone={cost.tone}>{cost.text}</Badge>
          <span className="mt-1 block text-zinc-600 dark:text-zinc-400">{suggestion.costReason}</span>
        </Fact>
        <Fact label="Weather">{suggestion.weatherNote}</Fact>
        {suggestion.watchOut ? <Fact label="Worth knowing">{suggestion.watchOut}</Fact> : null}
      </dl>

      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-zinc-100 pt-4 dark:border-zinc-800">
        <Button size="sm" onClick={() => onPlan(suggestion)} aria-label={`Plan this trip to ${suggestion.destination}`}>
          Plan this trip
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
        <p className="text-xs text-zinc-500">
          {formatSuggestedRange(suggestion.startDate, suggestion.endDate)} · {suggestion.suggestedDays} days.
          You can change these next.
        </p>
      </div>
    </article>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</dt>
      <dd className="mt-0.5 text-zinc-800 dark:text-zinc-200">{children}</dd>
    </div>
  );
}
