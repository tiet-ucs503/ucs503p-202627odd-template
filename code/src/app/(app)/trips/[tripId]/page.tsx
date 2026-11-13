"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Map as MapIcon, Pencil } from "lucide-react";
import { Alert, Button, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui";
import { CityManagerDialog } from "@/components/roadmap/city-manager-dialog";
import { TripHeader } from "@/components/roadmap/trip-header";
import { DayPanel } from "@/components/plan/day-panel";
import { DayStrip } from "@/components/plan/day-strip";
import { StaysPanel } from "@/components/plan/stays-panel";
import { TripAgentPanel } from "@/components/trip-agent/trip-agent-panel";
import { TravisBanner } from "@/components/trip-agent/travis-banner";
import { TravisLauncher } from "@/components/trip-agent/travis-launcher";
import { BudgetPanel } from "@/components/budget/budget-panel";
import { TripMap } from "@/components/maps/trip-map";
import { flightDraftFields } from "@/lib/flights/draft";
import { buildSavingsSuggestions } from "@/lib/services/budget-engine";
import { analyzeTrip } from "@/lib/services/feasibility";
import { subscribeToTrip, updateTripItinerary } from "@/lib/services/trips";
import {
  addActivity,
  deleteActivity,
  reorderActivities,
  updateActivity,
  updateHotel,
} from "@/lib/services/trip-mutations";
import { roadmapElementId, type MapFilter, type MapFilterMode } from "@/lib/services/map-points";
import { postAuthenticated } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { Activity, City } from "@/types/itinerary";
import type { SavingsSuggestion } from "@/types/budget";
import type { CityAllocation } from "@/types/planning";
import type { GeneratedItinerary, Trip } from "@/types/trip";
import type { TripAgentFocus, TripPatch } from "@/types/trip-agent";

export default function TripPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = use(params);
  const [trip, setTrip] = useState<Trip | null | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [mapMode, setMapMode] = useState<MapFilterMode>("all");
  const [mapOpenOnMobile, setMapOpenOnMobile] = useState(false);
  const [editingCities, setEditingCities] = useState(false);
  const [agentOpen, setAgentOpen] = useState(false);
  const [agentFocus, setAgentFocus] = useState<TripAgentFocus | null>(null);
  const [agentPrompt, setAgentPrompt] = useState<{ text: string; nonce: number } | null>(null);

  useEffect(() => {
    return subscribeToTrip(
      tripId,
      (next) => {
        setTrip(next);
        setLoadError(null);
        if (next && next.days.length > 0) {
          setSelectedDayId((cur) => cur ?? next.days[0].id);
        }
      },
      (err) => setLoadError(err.message),
    );
  }, [tripId]);

  const suggestions = useMemo<SavingsSuggestion[]>(
    () => (trip ? buildSavingsSuggestions(trip.cities, trip.days, trip.budget) : []),
    [trip],
  );

  // Travel and feasibility are derived, not stored — so they're recomputed
  // here after every edit, and trips saved before this existed analyse fine.
  const feasibility = useMemo(() => (trip ? analyzeTrip(trip) : null), [trip]);

  /**
   * Selecting a place from the map has to reveal it in the plan: show the day
   * it lives in, then scroll it into view once that day has rendered.
   * Selecting from the plan runs through the same path: the day is already
   * showing, and `block: "nearest"` means an already-visible row doesn't
   * jump around.
   */
  const handleSelectPlace = useCallback(
    (id: string | null) => {
      setSelectedPlaceId(id);
      if (!id || !trip) return;

      if (id.startsWith("hotel:")) {
        // A hotel belongs to a city, and is shown above that city's days.
        const cityId = id.slice("hotel:".length);
        setSelectedDayId((current) => {
          const currentDay = trip.days.find((d) => d.id === current);
          if (currentDay?.cityId === cityId) return current;
          return trip.days.filter((d) => d.cityId === cityId).sort((a, b) => a.dayNumber - b.dayNumber)[0]?.id ?? current;
        });
        return;
      }

      const day = trip.days.find((d) => d.activities.some((a) => a.id === id));
      if (day) setSelectedDayId(day.id);
    },
    [trip],
  );

  useEffect(() => {
    if (!selectedPlaceId) return;
    const elementId = roadmapElementId(selectedPlaceId);
    // One frame for the newly-expanded day to mount before we measure it.
    const timer = window.setTimeout(() => {
      document.getElementById(elementId)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [selectedPlaceId]);

  const sortedCities = useMemo(
    () => (trip ? [...trip.cities].sort((a, b) => a.order - b.order) : []),
    [trip],
  );

  // The map's city/day filters follow whichever day is showing, rather than
  // duplicating the plan's navigation with its own pickers.
  const focusedDay = useMemo(
    () => trip?.days.find((d) => d.id === selectedDayId) ?? trip?.days[0] ?? null,
    [trip, selectedDayId],
  );
  const mapFilter = useMemo<MapFilter>(
    () => ({ mode: mapMode, dayId: focusedDay?.id ?? null, cityId: focusedDay?.cityId ?? null }),
    [mapMode, focusedDay],
  );

  const orderedDays = useMemo(() => (trip ? [...trip.days].sort((a, b) => a.dayNumber - b.dayNumber) : []), [trip]);
  const focusedIndex = focusedDay ? orderedDays.findIndex((d) => d.id === focusedDay.id) : -1;
  const focusedCity = focusedDay ? (sortedCities.find((c) => c.id === focusedDay.cityId) ?? null) : null;

  if (loadError) {
    return <Alert>Couldn&apos;t load this trip: {loadError}</Alert>;
  }
  if (trip === undefined) {
    return <TripSkeleton />;
  }
  if (trip === null) {
    return (
      <div className="flex flex-col items-center gap-4 py-24 text-center">
        <p className="text-zinc-500">This trip doesn&apos;t exist, or it isn&apos;t yours.</p>
        <Link href="/dashboard" className="text-sm font-medium text-orange-700 hover:underline dark:text-orange-400">
          ← Back to your trips
        </Link>
      </div>
    );
  }

  async function persist(patch: Partial<Pick<Trip, "cities" | "days" | "budget">>) {
    await updateTripItinerary(tripId, patch);
  }

  /**
   * Saves a confirmed change from Travis, or the undo of one. Cities, days,
   * budget and the trip's length move in one write, so the roadmap, budget and
   * map never disagree about what the trip is.
   */
  async function handleApplyAgentPatch(patch: TripPatch) {
    await updateTripItinerary(tripId, patch);
    // A selection or open day that belonged to something removed would now dangle.
    setSelectedPlaceId(null);
    setSelectedDayId((current) => (current && patch.days.some((d) => d.id === current) ? current : (patch.days[0]?.id ?? null)));
  }

  /** Choosing a day by hand. A place selected on the map belonged to another day, so it is let go. */
  function selectDay(dayId: string) {
    setSelectedDayId(dayId);
    setSelectedPlaceId(null);
  }

  /** "Ask Travis" from a day, a city or a place: open the panel already looking at it. */
  function askTravis(focus: TripAgentFocus) {
    setAgentFocus(focus);
    setAgentOpen(true);
  }

  /** Open Travis, optionally with a question already asked (a chip on the page). */
  function openTravis(text?: string) {
    if (text) setAgentPrompt({ text, nonce: Date.now() });
    setAgentOpen(true);
  }

  function handleAddActivity(dayId: string, activity: Activity) {
    if (!trip) return;
    const { days, budget } = addActivity(trip, dayId, activity);
    persist({ days, budget });
  }

  function handleEditActivity(dayId: string, activityId: string, patch: Partial<Activity>) {
    if (!trip) return;
    const { days, budget } = updateActivity(trip, dayId, activityId, patch);
    persist({ days, budget });
  }

  function handleDeleteActivity(dayId: string, activityId: string) {
    if (!trip) return;
    const { days, budget } = deleteActivity(trip, dayId, activityId);
    persist({ days, budget });
    if (selectedPlaceId === activityId) setSelectedPlaceId(null);
  }

  function handleReorder(dayId: string, orderedIds: string[]) {
    if (!trip) return;
    const { days, budget } = reorderActivities(trip, dayId, orderedIds);
    persist({ days, budget });
  }

  function handleEditHotel(cityId: string, patch: Partial<City["hotel"]>) {
    if (!trip) return;
    const { cities, budget } = updateHotel(trip, cityId, patch);
    persist({ cities, budget });
  }

  /**
   * Applying an edited city list. The rebuild happens server-side (new cities
   * need a places lookup), then the whole itinerary — cities, days and the
   * recomputed budget — is persisted in one write, so the roadmap, budget and
   * map all move together.
   */
  async function handleSaveCities(nextCities: CityAllocation[]) {
    if (!trip) throw new Error("Trip not loaded.");

    const { itinerary } = await postAuthenticated<{ itinerary: GeneratedItinerary }>(
      "/api/trips/rebuild",
      {
        draft: {
          destination: trip.destination,
          startDate: trip.startDate,
          endDate: trip.endDate,
          budget: trip.budget.total,
          currency: trip.currency,
          travelers: trip.travelers,
          travelerType: trip.travelerType,
          preferences: trip.preferences,
          // Same flight settings the trip was priced with, so the fare only moves
          // if the first city (and so the arrival airport) changes.
          ...flightDraftFields(trip),
        },
        cities: nextCities,
        existing: { cities: trip.cities, days: trip.days },
      },
    );

    await updateTripItinerary(tripId, {
      cities: itinerary.cities,
      days: itinerary.days,
      budget: itinerary.budget,
      flights: itinerary.flights ?? null,
      planning: {
        destination: trip.destination,
        cities: nextCities,
        source: "fallback",
        plannerVersion: "manual-1",
        fallbackReason: "Cities edited by the traveller.",
      },
    });

    // A selection or chosen day belonging to a removed city would now dangle.
    setSelectedPlaceId(null);
    setSelectedDayId(itinerary.days[0]?.id ?? null);
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-8",
        // Beside the open panel rather than under it, wherever the page is wide enough to have both.
        agentOpen && "xl:pr-[max(0px,calc(26rem_-_(100vw_-_72rem)/2))]",
      )}
    >
      <Link
        href="/dashboard"
        className="inline-flex w-fit items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Your trips
      </Link>

      <TripHeader trip={trip} />

      {/* Travis belongs to the trip, so he sits with its header. While the chat is open the card is not needed. */}
      {agentOpen ? null : <TravisBanner destination={trip.destination} onOpen={() => openTravis()} onAsk={openTravis} />}

      <Tabs defaultValue="itinerary">
        <TabsList>
          <TabsTrigger value="itinerary">Itinerary</TabsTrigger>
          <TabsTrigger value="stays">Stays &amp; transport</TabsTrigger>
          <TabsTrigger value="budget">Budget</TabsTrigger>
        </TabsList>

        <TabsContent value="itinerary" className="mt-6 focus:outline-none">
          <div className="mb-5 flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setEditingCities(true)}>
              <Pencil className="h-3.5 w-3.5" />
              Edit cities
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="lg:hidden"
              onClick={() => setMapOpenOnMobile((open) => !open)}
            >
              <MapIcon className="h-3.5 w-3.5" />
              {mapOpenOnMobile ? "Hide map" : "Show map"}
            </Button>
          </div>

          <DayStrip
            cities={sortedCities}
            days={trip.days}
            selectedDayId={focusedDay?.id ?? null}
            plans={feasibility?.days}
            onSelect={selectDay}
          />

          <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(320px,400px)]">
            <aside className={cn("order-1 lg:order-2", !mapOpenOnMobile && "hidden lg:block")}>
              <TripMap
                trip={trip}
                filter={mapFilter}
                onFilterChange={(next) => setMapMode(next.mode)}
                selectedId={selectedPlaceId}
                onSelect={handleSelectPlace}
                className="h-[360px] lg:sticky lg:top-24 lg:h-[calc(100vh-9rem)]"
              />
            </aside>

            <div className="order-2 min-w-0 lg:order-1">
              {focusedDay && focusedCity ? (
                <DayPanel
                  city={focusedCity}
                  day={focusedDay}
                  previous={orderedDays[focusedIndex - 1] ?? null}
                  next={orderedDays[focusedIndex + 1] ?? null}
                  cityNameOf={(cityId) => sortedCities.find((c) => c.id === cityId)?.name ?? ""}
                  currency={trip.currency}
                  plan={feasibility?.days[focusedDay.id] ?? null}
                  selectedPlaceId={selectedPlaceId}
                  onSelectPlace={handleSelectPlace}
                  onSelectDay={selectDay}
                  onEditHotel={(patch) => handleEditHotel(focusedCity.id, patch)}
                  onAddActivity={handleAddActivity}
                  onEditActivity={handleEditActivity}
                  onDeleteActivity={handleDeleteActivity}
                  onReorderActivities={handleReorder}
                  onAskTravis={askTravis}
                />
              ) : null}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="stays" className="mt-6 focus:outline-none">
          <StaysPanel
            cities={sortedCities}
            days={trip.days}
            currency={trip.currency}
            plans={feasibility?.days}
            selectedPlaceId={selectedPlaceId}
            onEditHotel={handleEditHotel}
          />
        </TabsContent>

        <TabsContent value="budget" className="mt-6 max-w-2xl focus:outline-none">
          <BudgetPanel
            budget={trip.budget}
            flights={trip.flights ?? null}
            suggestions={suggestions}
            onAskTravis={openTravis}
          />
        </TabsContent>
      </Tabs>

      <TripAgentPanel
        key={trip.id}
        trip={trip}
        open={agentOpen}
        onOpenChange={setAgentOpen}
        focus={agentFocus}
        onClearFocus={() => setAgentFocus(null)}
        onApply={handleApplyAgentPatch}
        prompt={agentPrompt}
        onPromptSent={() => setAgentPrompt(null)}
      />

      {agentOpen ? null : <TravisLauncher onOpen={() => openTravis()} />}

      <CityManagerDialog
        open={editingCities}
        onOpenChange={setEditingCities}
        cities={sortedCities.map((c) => ({
          name: c.name,
          days: c.dayCount,
          reason: trip.planning?.cities.find((p) => p.name === c.name)?.reason ?? "",
        }))}
        dayCount={trip.dayCount}
        destination={trip.destination}
        travelers={trip.travelers}
        budget={trip.budget.total}
        onSave={handleSaveCities}
      />
    </div>
  );
}

function TripSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="h-4 w-24 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
      <div className="h-10 w-72 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
      <div className="h-2.5 w-full max-w-md animate-pulse rounded-full bg-zinc-100 dark:bg-zinc-800" />
      <div className="grid gap-4 sm:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-800" />
        ))}
      </div>
    </div>
  );
}
