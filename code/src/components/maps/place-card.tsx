"use client";

import { ExternalLink, MapPin, Star, X } from "lucide-react";
import { Badge } from "@/components/ui";
import { formatDurationShort, formatMoney } from "@/lib/utils";
import { ACTIVITY_CATEGORY_ICON } from "@/types/itinerary";
import type { MapPoint } from "@/lib/services/map-points";

/**
 * The card shown when a marker is picked.
 *
 * Every field comes from the `MapPoint` the itinerary already produced — no
 * provider is called when a marker is clicked, and nothing is filled in when
 * the trip doesn't have it: a place with no rating shows no rating, a place
 * with no real reference URL shows no link. That's the same contract the
 * roadmap rows follow, so the two never disagree about what's verified.
 */

const CATEGORY_LABEL: Record<string, string> = {
  sightseeing: "Sightseeing",
  food: "Food",
  adventure: "Adventure",
  beach: "Beach",
  culture: "Culture",
  relaxation: "Relaxation",
  shopping: "Shopping",
  nightlife: "Nightlife",
  transport: "Transport",
};

/** Only Google's own place links get the "Open in Google Maps" wording. */
function isGoogleMapsLink(point: MapPoint): boolean {
  return point.sourceName === "Google Maps";
}

function durationLabel(point: MapPoint): string {
  return point.durationMinutes !== null ? formatDurationShort(point.durationMinutes) : "";
}

/**
 * A price, "Free", or nothing at all. "Free" is only honest for an activity
 * whose cost the itinerary actually records as zero — a hotel or a place with
 * no price at all says nothing rather than implying it costs nothing.
 */
function costLabel(point: MapPoint): string {
  if (point.estimatedCost !== null && point.estimatedCost > 0) {
    const nightly = point.kind === "hotel" ? " / night" : "";
    const estimated = point.priceIsEstimate ? " est." : "";
    return `${formatMoney(point.estimatedCost, point.currency)}${nightly}${estimated}`;
  }
  return point.kind === "activity" && point.estimatedCost === 0 ? "Free" : "";
}

export function PlaceCard({
  point,
  onClose,
  onViewActivity,
}: {
  point: MapPoint;
  onClose: () => void;
  /** Reveals the matching row in the roadmap. */
  onViewActivity: () => void;
}) {
  const kindLabel =
    point.kind === "hotel" ? "Hotel" : CATEGORY_LABEL[point.category ?? ""] ?? "Place";
  const schedule = [durationLabel(point), costLabel(point)].filter(Boolean).join(" · ");

  return (
    <div className="w-[260px] overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
      <div className="flex items-start gap-2 px-3.5 pt-3.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span aria-hidden className="text-sm">
              {point.kind === "hotel" ? "🏨" : ACTIVITY_CATEGORY_ICON[point.category ?? "sightseeing"]}
            </span>
            <h3 className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">{point.name}</h3>
          </div>

          {point.rating ? (
            <span className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              {point.rating.value.toFixed(1)}
              {point.rating.count ? <span className="text-zinc-400">({point.rating.count})</span> : null}
            </span>
          ) : null}

          <p className="mt-0.5 text-xs text-zinc-500">
            {kindLabel}
            {point.cityName ? ` · ${point.cityName}` : ""}
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label={`Close ${point.name}`}
          className="-mr-1 -mt-1 rounded-full p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {point.dayNumber !== null || schedule ? (
        <div className="mt-2.5 space-y-1 border-t border-zinc-100 px-3.5 pt-2.5 text-xs text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
          {point.dayNumber !== null ? (
            <p className="font-medium text-zinc-800 dark:text-zinc-200">
              Day {point.dayNumber}
              {point.time ? ` · ${point.time}` : ""}
            </p>
          ) : null}
          {schedule ? <p>{schedule}</p> : null}
        </div>
      ) : null}

      {point.address ? (
        <p className="mt-1.5 flex items-start gap-1 px-3.5 text-[11px] leading-snug text-zinc-500">
          <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
          <span className="line-clamp-2">{point.address}</span>
        </p>
      ) : null}

      <div className="mt-3 flex items-center gap-2 border-t border-zinc-100 px-3.5 py-2.5 dark:border-zinc-800">
        <button
          type="button"
          onClick={onViewActivity}
          className="rounded-full bg-orange-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600"
        >
          View {point.kind === "hotel" ? "hotel" : "activity"}
        </button>

        {point.referenceUrl ? (
          <a
            href={point.referenceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-orange-700 hover:underline dark:text-orange-400"
          >
            {isGoogleMapsLink(point) ? "Open in Google Maps" : "View reference"}
            <ExternalLink className="h-3 w-3" />
          </a>
        ) : null}
      </div>

      <div className="border-t border-zinc-100 px-3.5 py-1.5 dark:border-zinc-800">
        {point.verification === "unverified" ? (
          <Badge tone="amber">Not verified</Badge>
        ) : (
          <span className="text-[10px] uppercase tracking-wide text-zinc-400">
            {point.verification === "live" ? "Live place data" : "Cited source"}
            {point.sourceName ? ` · ${point.sourceName}` : ""}
          </span>
        )}
      </div>
    </div>
  );
}
