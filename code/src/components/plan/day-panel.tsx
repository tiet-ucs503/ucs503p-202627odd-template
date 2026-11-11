"use client";

import { ArrowLeft, ArrowRight, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui";
import { DayView } from "@/components/roadmap/day-view";
import { formatDateShort } from "@/lib/utils";
import type { Activity, City, TripDay } from "@/types/itinerary";
import type { DayPlan } from "@/types/travel";
import type { TripAgentFocus } from "@/types/trip-agent";
import { HotelCard } from "./hotel-card";

/**
 * One day of the trip, with the city it is in and a way to the days either side.
 *
 * The city's name, dates and hotel sit above the day because they are what
 * changes when you cross from one city to the next; the day itself is the
 * existing timeline, with its travel times and "may be too full" notes.
 */
export function DayPanel({
  city,
  day,
  previous,
  next,
  cityNameOf,
  currency,
  plan,
  selectedPlaceId,
  onSelectPlace,
  onSelectDay,
  onEditHotel,
  onAddActivity,
  onEditActivity,
  onDeleteActivity,
  onReorderActivities,
  onAskTravis,
}: {
  city: City;
  day: TripDay;
  previous: TripDay | null;
  next: TripDay | null;
  cityNameOf: (cityId: string) => string;
  currency: string;
  plan: DayPlan | null;
  selectedPlaceId: string | null;
  onSelectPlace: (id: string | null) => void;
  onSelectDay: (dayId: string) => void;
  onEditHotel: (patch: Partial<City["hotel"]>) => void;
  onAddActivity: (dayId: string, activity: Activity) => void;
  onEditActivity: (dayId: string, activityId: string, patch: Partial<Activity>) => void;
  onDeleteActivity: (dayId: string, activityId: string) => void;
  onReorderActivities: (dayId: string, orderedIds: string[]) => void;
  onAskTravis?: (focus: TripAgentFocus) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div>
          <h2 className="font-display text-2xl font-medium tracking-tight text-zinc-900 dark:text-zinc-50">{city.name}</h2>
          <p className="mt-0.5 text-sm text-zinc-500">
            {formatDateShort(city.startDate)} – {formatDateShort(city.endDate)} · {city.dayCount} {city.dayCount === 1 ? "day" : "days"}
          </p>
          {onAskTravis ? (
            <Button variant="ghost" size="sm" className="-ml-3 mt-1" onClick={() => onAskTravis({ cityId: city.id })}>
              <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
              Ask Travis about {city.name}
            </Button>
          ) : null}
        </div>
        <HotelCard city={city} currency={currency} selected={selectedPlaceId === `hotel:${city.id}`} onEdit={onEditHotel} />
      </div>

      <DayView
        // A different day is a different editor state; nothing should carry over.
        key={day.id}
        day={day}
        cityName={city.name}
        cityCountry={city.country}
        currency={currency}
        plan={plan}
        selectedPlaceId={selectedPlaceId}
        onSelectPlace={onSelectPlace}
        onAddActivity={(activity) => onAddActivity(day.id, activity)}
        onEditActivity={(id, patch) => onEditActivity(day.id, id, patch)}
        onDeleteActivity={(id) => onDeleteActivity(day.id, id)}
        onReorder={(ids) => onReorderActivities(day.id, ids)}
        onAskTravis={onAskTravis}
      />

      <div className="flex items-center justify-between gap-3">
        {previous ? (
          <Button variant="secondary" size="sm" onClick={() => onSelectDay(previous.id)}>
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Day {previous.dayNumber}
            <span className="hidden text-zinc-500 sm:inline">· {cityNameOf(previous.cityId)}</span>
          </Button>
        ) : (
          <span />
        )}
        {next ? (
          <Button variant="secondary" size="sm" onClick={() => onSelectDay(next.id)}>
            Day {next.dayNumber}
            <span className="hidden text-zinc-500 sm:inline">· {cityNameOf(next.cityId)}</span>
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}
