"use client";

import { AlertTriangle } from "lucide-react";
import { useEffect } from "react";
import { cn, formatDateShort } from "@/lib/utils";
import type { City, TripDay } from "@/types/itinerary";
import type { DayPlan } from "@/types/travel";

/** The id of a day's button, so it can be brought into view when it is chosen from somewhere else (the map, Travis). */
export const dayTabId = (dayId: string) => `day-tab-${dayId}`;

/**
 * Every day of the trip in one row, grouped under the city it is spent in.
 *
 * It replaces a page that listed every day of every city one after another.
 * Choosing a day shows that day alone; the strip is how you move through the
 * trip, and it reads the same on a phone, where it scrolls sideways, as on a
 * desktop. A day that may not fit in a day carries a warning mark, and the
 * line beneath the strip names those days so they can be reached in one tap.
 */
export function DayStrip({
  cities,
  days,
  selectedDayId,
  plans,
  onSelect,
}: {
  /** In visiting order. */
  cities: City[];
  days: TripDay[];
  selectedDayId: string | null;
  /** Derived travel and feasibility per day id. */
  plans?: Record<string, DayPlan>;
  onSelect: (dayId: string) => void;
}) {
  const groups = cities
    .map((city) => ({ city, days: days.filter((d) => d.cityId === city.id).sort((a, b) => a.dayNumber - b.dayNumber) }))
    .filter((group) => group.days.length > 0);

  const crowded = days.filter((d) => plans?.[d.id]?.feasibility.feasible === false).sort((a, b) => a.dayNumber - b.dayNumber);

  // Keep the chosen day in view, however it was chosen. `inline: "center"`
  // only moves the strip sideways; `block: "nearest"` leaves the page where it is.
  useEffect(() => {
    if (!selectedDayId) return;
    document.getElementById(dayTabId(selectedDayId))?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [selectedDayId]);

  return (
    <nav aria-label="Days of the trip">
      <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        <div className="flex w-max gap-5">
          {groups.map(({ city, days: cityDays }) => (
            <div key={city.id} className="flex flex-col gap-1.5">
              <p className="px-1 text-xs font-medium text-zinc-500">
                {city.name}
                <span className="font-normal"> · {cityDays.length} {cityDays.length === 1 ? "day" : "days"}</span>
              </p>
              <div className="flex gap-1.5">
                {cityDays.map((day) => {
                  const selected = day.id === selectedDayId;
                  const tight = plans?.[day.id]?.feasibility.feasible === false;
                  return (
                    <button
                      key={day.id}
                      id={dayTabId(day.id)}
                      type="button"
                      onClick={() => onSelect(day.id)}
                      aria-current={selected ? "true" : undefined}
                      aria-label={`Day ${day.dayNumber}, ${formatDateShort(day.date)}, ${city.name}${tight ? ", may be too full" : ""}`}
                      className={cn(
                        "relative min-w-[3.75rem] rounded-xl border px-3 py-2 text-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600",
                        selected
                          ? "border-orange-600 bg-orange-600 text-white shadow-sm shadow-orange-600/25"
                          : "border-zinc-200 bg-white text-zinc-700 hover:border-orange-300 hover:bg-orange-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-orange-800 dark:hover:bg-zinc-800",
                      )}
                    >
                      <span className="block text-sm font-semibold leading-tight">Day {day.dayNumber}</span>
                      <span className={cn("block text-[11px] leading-tight", selected ? "text-white/85" : "text-zinc-500")}>
                        {formatDateShort(day.date)}
                      </span>
                      {tight ? (
                        <AlertTriangle
                          className={cn("absolute right-1 top-1 h-3 w-3", selected ? "text-white" : "text-amber-500")}
                          aria-hidden="true"
                        />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {crowded.length > 0 ? (
        <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-amber-800 dark:text-amber-300">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>May be too full:</span>
          {crowded.map((day, index) => (
            <span key={day.id}>
              <button
                type="button"
                onClick={() => onSelect(day.id)}
                className="font-medium underline underline-offset-2 hover:text-amber-950 focus-visible:outline-2 focus-visible:outline-orange-600 dark:hover:text-amber-100"
              >
                Day {day.dayNumber}
              </button>
              {index < crowded.length - 1 ? "," : ""}
            </span>
          ))}
        </p>
      ) : null}
    </nav>
  );
}
