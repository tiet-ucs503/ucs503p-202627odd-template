"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Alert, Button } from "@/components/ui";
import { photoForTrip } from "@/lib/destination-photos";
import { deleteTrip } from "@/lib/services/trips";
import { tripTiming } from "@/lib/trip-timing";
import { formatDateShort, formatMoney } from "@/lib/utils";
import type { Trip } from "@/types/trip";

/**
 * A trip, led by a photograph of where it goes. The whole card is one link
 * (the title's link is stretched over it), so there is a single thing to tab
 * to and no clickable element nested in another. Delete sits on top of the
 * photo, always visible, because a hover-only control can't be used on a phone.
 */
export function TripCard({ trip, today }: { trip: Trip; today: string }) {
  const [deleting, setDeleting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const photo = photoForTrip(trip);
  const timing = tripTiming(trip.startDate, trip.endDate, today);

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      await deleteTrip(trip.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete this trip.");
      setDeleting(false);
      setConfirming(false);
    }
  }

  return (
    <article className="group relative flex flex-col gap-3">
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-zinc-200 dark:bg-zinc-800">
        <Image
          src={photo.src}
          alt={photo.alt}
          fill
          sizes="(min-width: 1152px) 360px, (min-width: 640px) 33vw, 100vw"
          style={{ objectPosition: photo.position }}
          className="object-cover transition-transform duration-500 ease-out motion-safe:group-hover:scale-[1.04]"
        />

        <span
          className={
            timing.phase === "now"
              ? "absolute left-3 top-3 rounded-full bg-orange-600 px-2.5 py-1 text-xs font-medium text-white shadow-sm"
              : "absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-xs font-medium text-zinc-900 shadow-sm"
          }
        >
          {timing.label}
        </span>

        <button
          type="button"
          onClick={() => setConfirming(true)}
          aria-label={`Delete ${trip.title}`}
          className="absolute right-3 top-3 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-zinc-700 shadow-sm transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </button>

        {confirming ? (
          <div
            role="group"
            aria-label={`Confirm deleting ${trip.title}`}
            onKeyDown={(event) => {
              if (event.key === "Escape") setConfirming(false);
            }}
            className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/75 p-4 text-center text-white"
          >
            <p className="text-sm font-medium">Delete this trip?</p>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => setConfirming(false)} autoFocus>
                Cancel
              </Button>
              <Button variant="danger" size="sm" onClick={handleDelete} disabled={deleting}>
                {deleting ? "Deleting…" : "Delete"}
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-0.5">
        <h3 className="font-medium text-zinc-900 dark:text-zinc-50">
          <Link
            href={`/trips/${trip.id}`}
            className="after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-600"
          >
            {trip.title}
          </Link>
        </h3>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {formatDateShort(trip.startDate)} – {formatDateShort(trip.endDate)} · {trip.dayCount}{" "}
          {trip.dayCount === 1 ? "day" : "days"}
        </p>
        <p className="text-sm text-zinc-500">
          {trip.travelers} {trip.travelers === 1 ? "traveller" : "travellers"} ·{" "}
          {formatMoney(trip.budget?.total ?? 0, trip.currency)}
        </p>
      </div>

      {error ? <Alert>{error}</Alert> : null}
    </article>
  );
}

/** Holds a card's place while trips load, with the same shape so nothing jumps. */
export function TripCardSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-hidden="true">
      <div className="aspect-[4/3] animate-pulse rounded-2xl bg-zinc-200 dark:bg-zinc-800" />
      <div className="flex flex-col gap-2">
        <div className="h-4 w-2/3 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-3.5 w-1/2 animate-pulse rounded bg-zinc-100 dark:bg-zinc-900" />
      </div>
    </div>
  );
}
