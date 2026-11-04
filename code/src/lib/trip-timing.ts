import { parseDateInput } from "@/lib/date";

export type TripPhase = "upcoming" | "now" | "past";

export interface TripTiming {
  phase: TripPhase;
  /** Short enough for a badge: "In 12 days", "Happening now", "Ended 3 weeks ago". */
  label: string;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function days(from: string, to: string): number {
  return Math.round((parseDateInput(to).getTime() - parseDateInput(from).getTime()) / MS_PER_DAY);
}

function plural(count: number, unit: string): string {
  return `${count} ${unit}${count === 1 ? "" : "s"}`;
}

/** Whole calendar days, so a trip never reads "In 0 days" or "In 11.6 days". */
function span(count: number): string {
  if (count < 14) return plural(count, "day");
  if (count < 60) return plural(Math.round(count / 7), "week");
  return plural(Math.round(count / 30), "month");
}

/**
 * Where a trip sits relative to today. All three arguments are `YYYY-MM-DD`
 * calendar dates, compared as dates and not as moments, so the answer doesn't
 * flip depending on the time of day or the traveller's time zone.
 */
export function tripTiming(startDate: string, endDate: string, today: string): TripTiming {
  const untilStart = days(today, startDate);
  if (untilStart > 0) {
    return { phase: "upcoming", label: untilStart === 1 ? "Tomorrow" : `In ${span(untilStart)}` };
  }

  const sinceEnd = days(endDate, today);
  if (sinceEnd <= 0) return { phase: "now", label: "Happening now" };

  return { phase: "past", label: sinceEnd === 1 ? "Ended yesterday" : `Ended ${span(sinceEnd)} ago` };
}
