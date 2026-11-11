"use client";

import { useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  Input,
  SelectField,
  TextField,
  Textarea,
} from "@/components/ui";
import { ACTIVITY_CATEGORY_ICON, type Activity, type ActivityCategory } from "@/types/itinerary";
import type { Place } from "@/types/place";
import { PlaceSearchField } from "./place-search-field";

const CATEGORIES: ActivityCategory[] = [
  "sightseeing",
  "food",
  "adventure",
  "beach",
  "culture",
  "relaxation",
  "shopping",
  "nightlife",
  "transport",
];

export interface ActivityFormValue {
  name: string;
  category: ActivityCategory;
  time: string;
  durationMinutes: number;
  description: string;
  estimatedCost: number;
  referenceUrl: string | null;
  /**
   * Set when the traveller picked a real place from search rather than
   * typing a name. Carries that place's identity (coordinates, rating,
   * source, provider id) so the saved activity points at something real
   * instead of inheriting whatever the previous place's metadata was.
   */
  place?: Place | null;
}

/** Metadata an activity inherits from a picked place. Shared by add and edit. */
export function placeMetadataPatch(place: Place, enteredCost: number): Partial<Activity> {
  const suggested = place.price?.amount ?? null;
  return {
    referenceUrl: place.source.sourceUrl,
    isDemoData: place.isDemoData,
    location: place.location,
    address: place.address,
    rating: place.rating,
    imageUrl: place.imageUrl,
    source: place.source,
    // A cost the traveller changed away from the provider's suggestion is
    // their own exact figure; an untouched one is still just an estimate.
    priceIsEstimate: suggested !== null && enteredCost === suggested ? (place.price?.isEstimate ?? true) : false,
  };
}

function makeId(prefix: string) {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${rand}`;
}

export function activityFromForm(value: ActivityFormValue, currency: string): Activity {
  const base: Activity = {
    id: makeId("act"),
    name: value.name.trim(),
    category: value.category,
    time: value.time,
    durationMinutes: value.durationMinutes,
    description: value.description.trim(),
    estimatedCost: value.estimatedCost,
    currency,
    referenceUrl: value.referenceUrl?.trim() || null,
    isDemoData: true,
    priceIsEstimate: false,
  };
  // Typed by hand = not verified. Picked from search = whatever that place really is.
  return value.place ? { ...base, ...placeMetadataPatch(value.place, value.estimatedCost) } : base;
}

export function ActivityEditorDialog({
  open,
  onOpenChange,
  initial,
  onSave,
  title,
  searchContext,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: ActivityFormValue;
  onSave: (value: ActivityFormValue) => void;
  title: string;
  /** Where to search for replacement places. Omitted = no picker shown. */
  searchContext?: { destination: string; country?: string | null; currency: string };
}) {
  const [value, setValue] = useState<ActivityFormValue>(initial);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof ActivityFormValue>(key: K, val: ActivityFormValue[K]) {
    setValue((prev) => ({ ...prev, [key]: val }));
  }

  function handleSave() {
    if (!value.name.trim()) {
      setError("Give the activity a name.");
      return;
    }
    if (value.referenceUrl && value.referenceUrl.trim()) {
      try {
        new URL(value.referenceUrl);
      } catch {
        setError("The reference link must be a full URL (https://…).");
        return;
      }
    }
    setError(null);
    onSave(value);
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setValue(initial);
        onOpenChange(next);
      }}
    >
      <DialogContent title={title}>
        <div className="flex flex-col gap-4">
          {searchContext ? (
            <PlaceSearchField
              destination={searchContext.destination}
              country={searchContext.country}
              type={value.category === "food" ? "restaurant" : "attraction"}
              currency={searchContext.currency}
              onPick={(place) =>
                setValue((prev) => ({
                  ...prev,
                  name: place.name,
                  category: place.category,
                  description: place.description || prev.description,
                  durationMinutes: place.durationMinutes ?? prev.durationMinutes,
                  estimatedCost: place.price?.amount ?? prev.estimatedCost,
                  referenceUrl: place.source.sourceUrl,
                  place,
                }))
              }
            />
          ) : null}

          <TextField
            id="activity-name"
            label="Name"
            value={value.name}
            onChange={(e) =>
              // Typing over a picked place's name detaches it — the metadata
              // below belongs to what was picked, not to a hand-edited name.
              setValue((prev) => ({ ...prev, name: e.target.value, place: null }))
            }
            autoFocus
          />

          <div className="grid grid-cols-2 gap-3">
            <SelectField
              id="activity-category"
              label="Category"
              value={value.category}
              onChange={(e) => set("category", e.target.value as ActivityCategory)}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {ACTIVITY_CATEGORY_ICON[c]} {c}
                </option>
              ))}
            </SelectField>
            <TextField
              id="activity-time"
              label="Time"
              type="time"
              value={value.time}
              onChange={(e) => set("time", e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <TextField
              id="activity-duration"
              label="Duration (minutes)"
              type="number"
              min={0}
              value={value.durationMinutes}
              onChange={(e) => set("durationMinutes", Number(e.target.value) || 0)}
            />
            <TextField
              id="activity-cost"
              label="Estimated cost"
              type="number"
              min={0}
              value={value.estimatedCost}
              onChange={(e) => set("estimatedCost", Number(e.target.value) || 0)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="activity-description" className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
              Description
            </label>
            <Textarea
              id="activity-description"
              value={value.description}
              onChange={(e) => set("description", e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="activity-url" className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
              Reference URL (optional)
            </label>
            <Input
              id="activity-url"
              type="url"
              placeholder="https://…"
              value={value.referenceUrl ?? ""}
              onChange={(e) => set("referenceUrl", e.target.value)}
            />
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
