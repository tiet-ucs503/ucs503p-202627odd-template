"use client";

import { closestCenter, DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { MessageCircle, Plus } from "lucide-react";
import { Fragment, useState } from "react";
import { Button } from "@/components/ui";
import { formatDateLong, formatMoney } from "@/lib/utils";
import type { Activity, TripDay } from "@/types/itinerary";
import type { DayPlan } from "@/types/travel";
import type { TripAgentFocus } from "@/types/trip-agent";
import { DayTimeSummary, FeasibilityNotes } from "./feasibility-notes";
import { TravelSegmentRow } from "./travel-segment-row";
import {
  ActivityEditorDialog,
  activityFromForm,
  placeMetadataPatch,
  type ActivityFormValue,
} from "./activity-editor-dialog";
import { ActivityRow } from "./activity-row";

const BLANK_ACTIVITY: ActivityFormValue = {
  name: "",
  category: "sightseeing",
  time: "12:00",
  durationMinutes: 60,
  description: "",
  estimatedCost: 0,
  referenceUrl: null,
};

export function DayView({
  day,
  cityName,
  cityCountry,
  currency,
  plan,
  selectedPlaceId,
  onSelectPlace,
  onAddActivity,
  onEditActivity,
  onDeleteActivity,
  onReorder,
  onAskTravis,
}: {
  day: TripDay;
  cityName: string;
  cityCountry?: string | null;
  currency: string;
  /** Derived travel + feasibility for this day. Absent until analysis runs. */
  plan?: DayPlan | null;
  selectedPlaceId?: string | null;
  onSelectPlace?: (id: string | null) => void;
  onAddActivity: (activity: Activity) => void;
  onEditActivity: (activityId: string, patch: Partial<Activity>) => void;
  onDeleteActivity: (activityId: string) => void;
  onReorder: (orderedIds: string[]) => void;
  /** Open Travis looking at this day, or at one of its places. */
  onAskTravis?: (focus: TripAgentFocus) => void;
}) {
  const [editing, setEditing] = useState<Activity | null>(null);
  const [adding, setAdding] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const dayTotal = day.activities.reduce((sum, a) => sum + a.estimatedCost, 0);

  // A city transfer is shown as travel, not as somewhere you visit, so it's
  // lifted out of the activity list rather than sitting in it as a card.
  const visibleActivities = day.activities.filter((a) => a.category !== "transport");
  const cityTransfer = plan?.segments.find((s) => s.type === "city-transfer") ?? null;
  const arrivalSegments = new Map(
    (plan?.segments ?? [])
      .filter((s) => s.type === "local-transfer" && s.toPlaceId && !s.toPlaceId.startsWith("hotel:"))
      .map((s) => [s.toPlaceId as string, s]),
  );
  const returnSegment =
    plan?.segments.find((s) => s.type === "local-transfer" && s.toPlaceId?.startsWith("hotel:")) ?? null;

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = day.activities.map((a) => a.id);
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    const next = [...ids];
    next.splice(oldIndex, 1);
    next.splice(newIndex, 0, String(active.id));
    onReorder(next);
  }

  return (
    <div className="animate-rise-in flex flex-col gap-1 rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-orange-600">
            Day {day.dayNumber} · {cityName}
          </h3>
          <p className="text-xs text-zinc-500">{formatDateLong(day.date)}</p>
          {plan ? <DayTimeSummary feasibility={plan.feasibility} /> : null}
        </div>
        <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
          {formatMoney(dayTotal, currency)} planned
        </span>
      </div>

      {cityTransfer ? <ul className="mb-1 flex flex-col"><TravelSegmentRow segment={cityTransfer} /></ul> : null}

      {visibleActivities.length === 0 ? (
        <p className="py-6 text-center text-sm text-zinc-400">No activities yet — add the first one.</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          {/* Only activities are sortable; travel segments are derived from
              where the activities are, so they re-compute after a drag. */}
          <SortableContext items={visibleActivities.map((a) => a.id)} strategy={verticalListSortingStrategy}>
            <ul className="flex flex-col">
              {visibleActivities.map((activity) => (
                <Fragment key={activity.id}>
                  {arrivalSegments.get(activity.id) ? (
                    <TravelSegmentRow segment={arrivalSegments.get(activity.id)!} />
                  ) : null}
                  <ActivityRow
                    activity={activity}
                    selected={selectedPlaceId === activity.id}
                    onSelect={() =>
                      onSelectPlace?.(selectedPlaceId === activity.id ? null : activity.id)
                    }
                    onEdit={() => setEditing(activity)}
                    onDelete={() => onDeleteActivity(activity.id)}
                    onAskTravis={onAskTravis ? () => onAskTravis({ activityId: activity.id }) : undefined}
                  />
                </Fragment>
              ))}
              {returnSegment ? <TravelSegmentRow segment={returnSegment} /> : null}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      {plan ? <FeasibilityNotes feasibility={plan.feasibility} /> : null}

      <div className="mt-2 flex flex-wrap gap-1">
        <Button variant="ghost" size="sm" onClick={() => setAdding(true)}>
          <Plus className="h-3.5 w-3.5" />
          Add activity
        </Button>
        {onAskTravis ? (
          <Button variant="ghost" size="sm" onClick={() => onAskTravis({ dayId: day.id })}>
            <MessageCircle className="h-3.5 w-3.5" />
            Ask Travis about this day
          </Button>
        ) : null}
      </div>

      {editing ? (
        <ActivityEditorDialog
          open={Boolean(editing)}
          onOpenChange={(open) => !open && setEditing(null)}
          title="Edit activity"
          initial={{
            name: editing.name,
            category: editing.category,
            time: editing.time,
            durationMinutes: editing.durationMinutes,
            description: editing.description,
            estimatedCost: editing.estimatedCost,
            referenceUrl: editing.referenceUrl,
          }}
          onSave={({ place, ...value }) => {
            // Picked a real place from search: it brings its own identity, so
            // the whole provenance block is replaced rather than reset.
            if (place) {
              onEditActivity(editing.id, { ...value, ...placeMetadataPatch(place, value.estimatedCost) });
              return;
            }

            const nameChanged = value.name.trim() !== editing.name;
            const newReferenceUrl = value.referenceUrl?.trim() || null;
            // If the reference URL wasn't itself touched, it's just stale
            // form state left over from before the rename, not something the
            // traveller vouched for under the new name — drop it. If they
            // changed (or cleared) it themselves, that's their call, so keep it.
            const referenceUrlUntouched = newReferenceUrl === editing.referenceUrl;
            onEditActivity(editing.id, {
              ...value,
              referenceUrl: nameChanged && referenceUrlUntouched ? null : newReferenceUrl,
              // A renamed activity is no longer the real place the trip was
              // generated with, so its other provenance no longer applies —
              // just adjusting the cost/time/etc. of the same place keeps it,
              // and means the traveller has now given an exact price, not a guess.
              ...(nameChanged
                ? {
                    isDemoData: true,
                    rating: null,
                    imageUrl: null,
                    source: null,
                    location: null,
                    address: null,
                  }
                : {}),
              priceIsEstimate: false,
            });
          }}
          searchContext={{ destination: cityName, country: cityCountry, currency }}
        />
      ) : null}

      <ActivityEditorDialog
        open={adding}
        onOpenChange={setAdding}
        title="Add activity"
        initial={BLANK_ACTIVITY}
        onSave={(value) => onAddActivity(activityFromForm(value, currency))}
        searchContext={{ destination: cityName, country: cityCountry, currency }}
      />
    </div>
  );
}
