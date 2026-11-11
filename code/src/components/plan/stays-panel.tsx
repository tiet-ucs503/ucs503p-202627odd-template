"use client";

import { TravelSegmentRow } from "@/components/roadmap/travel-segment-row";
import { formatDateShort } from "@/lib/utils";
import type { City, TripDay } from "@/types/itinerary";
import type { DayPlan } from "@/types/travel";
import { HotelCard } from "./hotel-card";

/**
 * Where the trip sleeps, and how it gets from one city to the next: the parts
 * of a plan that belong to the trip as a whole rather than to one day.
 *
 * Travel times are the app's estimates, not live routes, and say so.
 */
export function StaysPanel({
  cities,
  days,
  currency,
  plans,
  selectedPlaceId,
  onEditHotel,
}: {
  /** In visiting order. */
  cities: City[];
  days: TripDay[];
  currency: string;
  plans?: Record<string, DayPlan>;
  selectedPlaceId: string | null;
  onEditHotel: (cityId: string, patch: Partial<City["hotel"]>) => void;
}) {
  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        Where you sleep in each city and how you get between them. Travel times are estimates, not live routes, so check them before you book.
      </p>

      {cities.map((city) => {
        const firstDay = days.filter((d) => d.cityId === city.id).sort((a, b) => a.dayNumber - b.dayNumber)[0];
        const transfer = firstDay ? (plans?.[firstDay.id]?.segments.find((s) => s.type === "city-transfer") ?? null) : null;

        return (
          <section key={city.id} aria-labelledby={`stay-${city.id}`} className="flex flex-col gap-3">
            <div>
              <h2 id={`stay-${city.id}`} className="font-display text-xl font-medium tracking-tight text-zinc-900 dark:text-zinc-50">
                {city.name}
              </h2>
              <p className="text-sm text-zinc-500">
                {formatDateShort(city.startDate)} – {formatDateShort(city.endDate)} · {city.hotel.nights} {city.hotel.nights === 1 ? "night" : "nights"}
              </p>
            </div>

            {transfer ? (
              <ul aria-label={`Getting to ${city.name}`}>
                <TravelSegmentRow segment={transfer} />
              </ul>
            ) : null}

            <HotelCard
              city={city}
              currency={currency}
              selected={selectedPlaceId === `hotel:${city.id}`}
              onEdit={(patch) => onEditHotel(city.id, patch)}
              className="self-start"
            />
          </section>
        );
      })}
    </div>
  );
}
