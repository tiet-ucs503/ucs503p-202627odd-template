"use client";

import { useState } from "react";
import { Button, Dialog, DialogContent, DialogFooter, TextField } from "@/components/ui";
import type { Hotel } from "@/types/itinerary";

export function HotelEditorDialog({
  open,
  onOpenChange,
  hotel,
  maxNights,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hotel: Hotel;
  /** The most nights this city can have: its days. Without it nights are only kept above zero. */
  maxNights?: number;
  onSave: (patch: Partial<Hotel>) => void;
}) {
  const [name, setName] = useState(hotel.name);
  const [price, setPrice] = useState(String(hotel.pricePerNight));
  const [nights, setNights] = useState(String(hotel.nights));
  const [error, setError] = useState<string | null>(null);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setName(hotel.name);
          setPrice(String(hotel.pricePerNight));
          setNights(String(hotel.nights));
          setError(null);
        }
        onOpenChange(next);
      }}
    >
      <DialogContent title="Change hotel" description="Updates the trip's estimated cost immediately.">
        <div className="flex flex-col gap-4">
          <TextField id="hotel-name" label="Hotel name" value={name} onChange={(e) => setName(e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <TextField
              id="hotel-price"
              label="Price per night"
              type="number"
              min={0}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
            <TextField
              id="hotel-nights"
              label="Nights"
              type="number"
              min={1}
              max={maxNights}
              value={nights}
              onChange={(e) => {
                setNights(e.target.value);
                setError(null);
              }}
            />
          </div>
          {error ? (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              const nightsValue = Math.max(1, Math.floor(Number(nights)) || 1);
              if (maxNights !== undefined && nightsValue > maxNights) {
                setError(`This city has ${maxNights} ${maxNights === 1 ? "day" : "days"}, so it can have at most ${maxNights} ${maxNights === 1 ? "night" : "nights"}.`);
                return;
              }
              const nameChanged = name.trim() !== hotel.name;
              onSave({
                name: name.trim(),
                pricePerNight: Math.max(0, Number(price) || 0),
                nights: nightsValue,
                // Renaming means it's no longer the place the trip was generated
                // with, so its real-place provenance no longer applies. Just
                // adjusting price/nights for the same hotel keeps it — the price
                // the traveller entered is exact, not an estimate.
                ...(nameChanged
                  ? { isDemoData: true, referenceUrl: null, rating: null, imageUrl: null, source: null }
                  : {}),
                priceIsEstimate: false,
              });
              onOpenChange(false);
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
