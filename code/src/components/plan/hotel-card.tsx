"use client";

import { BedDouble, Pencil, Star } from "lucide-react";
import { useState } from "react";
import { cn, formatMoney } from "@/lib/utils";
import type { City } from "@/types/itinerary";
import { HotelEditorDialog } from "@/components/roadmap/hotel-editor-dialog";

/**
 * Where a city's nights are spent, as one tappable card that opens the hotel
 * editor. Used on the day view (so the stay is never more than a glance away)
 * and on the Stays tab. The element id is what the map scrolls to when a hotel
 * marker is selected.
 */
export function HotelCard({
  city,
  currency,
  selected = false,
  onEdit,
  className,
}: {
  city: City;
  currency: string;
  /** The map has this hotel selected. */
  selected?: boolean;
  onEdit: (patch: Partial<City["hotel"]>) => void;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const total = city.hotel.pricePerNight * city.hotel.nights;

  return (
    <>
      <button
        id={`hotel-${city.id}`}
        onClick={() => setEditing(true)}
        className={cn(
          "group flex scroll-mt-24 items-center gap-3 rounded-xl border border-zinc-200 px-3.5 py-2.5 text-left transition-colors hover:border-orange-300 hover:bg-orange-50 dark:border-zinc-800 dark:hover:bg-zinc-800",
          selected && "border-orange-300 bg-orange-50/70 dark:border-orange-800 dark:bg-orange-950/30",
          className,
        )}
      >
        <BedDouble className="h-4 w-4 shrink-0 text-orange-600" aria-hidden="true" />
        <span className="min-w-0">
          <span className="flex items-center gap-1.5 text-sm font-medium text-zinc-900 dark:text-zinc-100">
            <span className="truncate">{city.hotel.name}</span>
            {city.hotel.rating ? (
              <span className="inline-flex items-center gap-0.5 text-xs font-normal text-zinc-500">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" aria-hidden="true" />
                {city.hotel.rating.value.toFixed(1)}
              </span>
            ) : null}
            <Pencil className="h-3 w-3 shrink-0 text-zinc-400 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden="true" />
          </span>
          <span className="text-xs text-zinc-500">
            {formatMoney(city.hotel.pricePerNight, currency)}/night
            {city.hotel.priceIsEstimate !== false ? " (est.)" : ""} · {city.hotel.nights} nights · {formatMoney(total, currency)}
            {city.hotel.isDemoData ? " · not verified" : ""}
          </span>
        </span>
        <span className="sr-only">Edit hotel in {city.name}</span>
      </button>

      <HotelEditorDialog open={editing} onOpenChange={setEditing} hotel={city.hotel} onSave={onEdit} />
    </>
  );
}
