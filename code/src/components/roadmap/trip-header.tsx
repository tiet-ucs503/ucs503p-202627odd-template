"use client";

import Image from "next/image";
import { useState, type FormEvent } from "react";
import { Pencil } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { bestMonthsLabel, isBestMonth, resolveCountry } from "@/lib/countries";
import { toDateInputValue } from "@/lib/date";
import { photoForTrip } from "@/lib/destination-photos";
import { renameTrip } from "@/lib/services/trips";
import { tripTiming } from "@/lib/trip-timing";
import { formatDateShort, formatMoney } from "@/lib/utils";
import type { Trip } from "@/types/trip";

/** 1 to 12, from a `YYYY-MM-DD` date. */
const monthOf = (isoDate: string) => Number(isoDate.slice(5, 7));

/**
 * The top of a trip: the country as a photograph, then what a traveller wants
 * to know at a glance. When it is, where it goes, whether the budget holds.
 * It also says so, quietly, when the dates fall outside the months the country
 * is usually at its best, because that is worth knowing before you book.
 */
export function TripHeader({ trip, today }: { trip: Trip; today?: string }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(trip.title);
  const [busy, setBusy] = useState(false);

  const photo = photoForTrip(trip);
  const timing = tripTiming(trip.startDate, trip.endDate, today ?? toDateInputValue(new Date()));
  const country = resolveCountry(trip.destination);
  const outsideBestMonths =
    country !== null &&
    !isBestMonth(country, monthOf(trip.startDate)) &&
    !isBestMonth(country, monthOf(trip.endDate));

  const percent = trip.budget.total > 0 ? Math.round((trip.budget.estimatedTotal / trip.budget.total) * 100) : 0;
  const nights = Math.max(0, trip.dayCount - 1);
  const route = trip.cities.map((city) => city.name);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    try {
      await renameTrip(trip.id, title);
      setEditing(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <header className="relative isolate flex min-h-72 flex-col justify-end gap-5 overflow-hidden rounded-3xl bg-zinc-900 p-6 text-white sm:min-h-80 sm:p-8">
      <Image
        src={photo.src}
        alt={photo.alt}
        fill
        loading="eager"
        fetchPriority="high"
        sizes="(min-width: 1152px) 1104px, 100vw"
        style={{ objectPosition: photo.position }}
        className="-z-20 object-cover"
      />
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-t from-black/85 via-black/35 to-black/15" />

      <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
        <span
          className={
            timing.phase === "now"
              ? "rounded-full bg-orange-600 px-2.5 py-1 text-white"
              : "rounded-full bg-white/90 px-2.5 py-1 text-zinc-900"
          }
        >
          {timing.label}
        </span>
        {country ? <span className="text-white/85">{country.name}</span> : null}
      </div>

      <div className="flex flex-col gap-2">
        {editing ? (
          <form onSubmit={save} className="flex flex-wrap items-center gap-2">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              aria-label="Trip name"
              autoFocus
              className="max-w-sm border-white/30 bg-white/95 text-zinc-900"
            />
            <Button type="submit" size="sm" disabled={busy}>
              Save
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-white hover:bg-white/15 dark:text-white dark:hover:bg-white/15"
              onClick={() => setEditing(false)}
            >
              Cancel
            </Button>
          </form>
        ) : (
          <div className="flex items-start gap-2">
            <h1 className="font-display text-3xl font-medium leading-tight tracking-tight sm:text-5xl">{trip.title}</h1>
            <button
              onClick={() => setEditing(true)}
              aria-label="Edit trip name"
              className="mt-1.5 rounded-full p-1.5 text-white/70 transition-colors hover:bg-white/15 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white"
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}

        <p className="text-sm text-white/85">
          {formatDateShort(trip.startDate)} – {formatDateShort(trip.endDate)} · {nights}{" "}
          {nights === 1 ? "night" : "nights"}
          {route.length > 0 ? <> · {route.join(" → ")}</> : null}
        </p>

        {outsideBestMonths && country ? (
          <p className="text-sm text-amber-200">
            These dates are outside {country.name}&apos;s usual best months ({bestMonthsLabel(country)}), so expect
            different weather.
          </p>
        ) : null}
      </div>

      <div className="max-w-md">
        <div className="mb-1.5 flex items-baseline justify-between text-sm">
          <span className="font-medium">
            {formatMoney(trip.budget.estimatedTotal, trip.currency)} of {formatMoney(trip.budget.total, trip.currency)}
          </span>
          <span className={percent > 100 ? "font-medium text-red-300" : "text-white/80"}>
            {percent > 100 ? `${percent - 100}% over` : `${percent}%`}
          </span>
        </div>
        <div
          role="progressbar"
          aria-label="Estimated cost against budget"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.min(100, percent)}
          className="h-2 w-full overflow-hidden rounded-full bg-white/25"
        >
          <div
            className={`h-full rounded-full transition-all duration-700 ${percent > 100 ? "bg-red-400" : "bg-orange-500"}`}
            style={{ width: `${Math.min(100, percent)}%` }}
          />
        </div>
      </div>
    </header>
  );
}
