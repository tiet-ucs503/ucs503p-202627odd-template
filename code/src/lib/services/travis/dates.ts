import { parseDateInput, toDateInputValue } from "@/lib/date";

/**
 * Turning "best months to go" into dates.
 *
 * The model only ever says *months*. It is bad at calendars — it will happily
 * propose a window that ended last spring — so every concrete date Travis
 * shows is worked out here from the month range and today's date, and none of
 * it depends on what the model believes today is.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * A trip that starts in a fortnight is the soonest anyone can sensibly plan
 * from a chat. Suggesting tomorrow would be technically future-dated and
 * practically useless.
 */
export const MIN_LEAD_DAYS = 14;

const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const LONG_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** "Jun–Aug", "Nov–Feb", a single month in full, or "Year-round". */
export function windowLabel(startMonth: number, endMonth: number): string {
  if (startMonth === endMonth) return LONG_MONTHS[startMonth - 1];
  // A window that ends the month before it starts covers the whole year.
  const monthsCovered = ((endMonth - startMonth + 12) % 12) + 1;
  if (monthsCovered === 12) return "Year-round";
  return `${SHORT_MONTHS[startMonth - 1]}–${SHORT_MONTHS[endMonth - 1]}`;
}

function lastDayOfMonth(year: number, month: number): number {
  // Day 0 of the *next* month is the last day of this one (handles leap years).
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export interface SuggestedDates {
  startDate: string;
  endDate: string;
}

/**
 * Pick start and end dates for a trip of `days` days inside a month window.
 *
 * - Never in the past, and never sooner than `MIN_LEAD_DAYS` from `today`.
 * - Prefers a trip that fits wholly inside the window: if today is already
 *   late in the window, it moves on to next year's rather than offering a
 *   trip that hangs off the end of the good weather.
 * - If the window is simply shorter than the trip, it still returns the first
 *   upcoming window rather than nothing; the wizard lets the traveller adjust.
 *
 * `today` is a `YYYY-MM-DD` string so the whole thing is a pure function.
 */
export function suggestDates(window: {
  startMonth: number;
  endMonth: number;
  days: number;
  today: string;
}): SuggestedDates {
  const { startMonth, endMonth, today } = window;
  const days = Math.max(1, Math.floor(window.days));
  const todayMs = parseDateInput(today).getTime();
  const earliest = todayMs + MIN_LEAD_DAYS * DAY_MS;
  const todayYear = new Date(todayMs).getUTCFullYear();
  const wraps = endMonth < startMonth;

  let firstUpcoming: { start: number; end: number } | null = null;

  // Start a year back: a Nov–Feb window that began last November is still
  // running in January.
  for (let year = todayYear - 1; year <= todayYear + 2; year++) {
    const windowStart = Date.UTC(year, startMonth - 1, 1);
    const endYear = wraps ? year + 1 : year;
    const windowEnd = Date.UTC(endYear, endMonth - 1, lastDayOfMonth(endYear, endMonth));

    if (windowEnd < earliest) continue; // already over, or too soon to use

    const start = Math.max(windowStart, earliest);
    const end = start + (days - 1) * DAY_MS;

    if (end <= windowEnd) {
      return { startDate: toDateInputValue(new Date(start)), endDate: toDateInputValue(new Date(end)) };
    }
    firstUpcoming ??= { start, end };
  }

  // The loop spans four years, so a future window always exists.
  const fallback = firstUpcoming ?? { start: earliest, end: earliest + (days - 1) * DAY_MS };
  return { startDate: toDateInputValue(new Date(fallback.start)), endDate: toDateInputValue(new Date(fallback.end)) };
}
