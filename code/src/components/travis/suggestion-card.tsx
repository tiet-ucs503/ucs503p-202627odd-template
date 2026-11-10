"use client";

import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { Badge, Button } from "@/components/ui";
import { MONTH_FULL_NAMES, monthInWindow, resolveCountry } from "@/lib/countries";
import { photoForCountry } from "@/lib/destination-photos";
import { cn, formatDateShort } from "@/lib/utils";
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

const MONTH_INITIALS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

/**
 * The year as twelve segments, the best months filled in. The words next to it
 * ("Apr–Jun") say the same thing; this shows it at a glance, including how
 * wide the window is and where in the year it falls. Described to a screen
 * reader as a sentence, not as twelve letters.
 */
export function MonthStrip({ startMonth, endMonth }: { startMonth: number; endMonth: number }) {
  const label =
    startMonth === endMonth
      ? `Best month: ${MONTH_FULL_NAMES[startMonth - 1]}`
      : `Best months: ${MONTH_FULL_NAMES[startMonth - 1]} to ${MONTH_FULL_NAMES[endMonth - 1]}`;

  return (
    <div role="img" aria-label={label} className="mt-2 grid grid-cols-12 gap-0.5">
      {MONTH_INITIALS.map((initial, index) => {
        const inWindow = monthInWindow(index + 1, startMonth, endMonth);
        return (
          <div key={index} aria-hidden="true" className="flex flex-col items-center gap-1">
            <span className={cn("h-1.5 w-full rounded-full", inWindow ? "bg-orange-500" : "bg-zinc-200 dark:bg-zinc-800")} />
            <span className={cn("text-[10px] leading-none", inWindow ? "font-medium text-zinc-700 dark:text-zinc-300" : "text-zinc-400")}>
              {initial}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function SuggestionCard({
  suggestion,
  onPlan,
}: {
  suggestion: DestinationSuggestion;
  onPlan: (suggestion: DestinationSuggestion) => void;
}) {
  const cost = COST_LABEL[suggestion.costOutlook];
  // A photograph of the country, when it is one we have. Older saved
  // conversations can name somewhere that is no longer on the list; that card
  // simply has no picture rather than a wrong one.
  const country = resolveCountry(suggestion.destination);
  const photo = country ? photoForCountry(country.code) : null;

  const title = (
    <h3
      className={cn(
        "font-display text-2xl font-medium tracking-tight",
        photo ? "text-white" : "text-xl text-zinc-900 dark:text-zinc-50",
      )}
    >
      {suggestion.destination}
    </h3>
  );

  return (
    <article
      aria-label={suggestion.destination}
      className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
    >
      {photo ? (
        <div className="relative isolate flex h-40 items-end bg-zinc-900 p-5 sm:h-44">
          <Image
            src={photo.src}
            alt={photo.alt}
            fill
            sizes="(min-width: 768px) 700px, 100vw"
            style={{ objectPosition: photo.position }}
            className="-z-20 object-cover"
          />
          <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
          {title}
        </div>
      ) : null}

      <div className="p-5">
        {photo ? null : title}
        <p className={cn("text-sm text-zinc-600 dark:text-zinc-400", photo ? "" : "mt-1")}>{suggestion.headline}</p>

        <dl className="mt-5 grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2">
          <Fact label="Best time to go">
            {suggestion.windowLabel}
            <MonthStrip startMonth={suggestion.startMonth} endMonth={suggestion.endMonth} />
          </Fact>
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
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
          <p className="text-xs text-zinc-500">
            {formatSuggestedRange(suggestion.startDate, suggestion.endDate)} · {suggestion.suggestedDays} days.
            You can change these next.
          </p>
        </div>
      </div>
    </article>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-zinc-500">{label}</dt>
      <dd className="mt-1 text-zinc-800 dark:text-zinc-200">{children}</dd>
    </div>
  );
}
