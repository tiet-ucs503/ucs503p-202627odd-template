"use client";

import { useState } from "react";
import { MapPin, LocateFixed, Loader2 } from "lucide-react";

export interface LocationValue {
  latitude: number;
  longitude: number;
  formattedAddress: string;
  locality?: string;
  city: string;
  district?: string;
  state: string;
  postalCode?: string;
  country: string;
}

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

// Sensible default so the dynamic-location flow always has a starting point
// around Thapar without ever hard-coding it as the user's actual location.
const THAPAR_FALLBACK: LocationValue = {
  latitude: 30.3548,
  longitude: 76.3649,
  formattedAddress: "Thapar Institute of Engineering & Technology, Patiala, Punjab",
  locality: "Thapar University Campus",
  city: "Patiala",
  district: "Patiala",
  state: "Punjab",
  postalCode: "147004",
  country: "India",
};

async function reverseGeocode(lat: number, lng: number): Promise<LocationValue> {
  if (!MAPBOX_TOKEN) {
    // DEMO MODE: no Mapbox token configured. We still use the real coordinates
    // captured from the browser, but cannot resolve them to a street address.
    return {
      latitude: lat,
      longitude: lng,
      formattedAddress: `Detected location (${lat.toFixed(4)}, ${lng.toFixed(4)}) — DEMO MODE, address lookup disabled`,
      city: "Patiala",
      state: "Punjab",
      country: "India",
    };
  }

  const res = await fetch(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${MAPBOX_TOKEN}`
  );
  const data = await res.json();
  const feature = data.features?.[0];
  const context: any[] = feature?.context ?? [];
  const find = (type: string) => context.find((c: any) => c.id.startsWith(type))?.text;

  return {
    latitude: lat,
    longitude: lng,
    formattedAddress: feature?.place_name ?? `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
    locality: find("neighborhood") ?? find("locality"),
    city: find("place") ?? "Patiala",
    district: find("district"),
    state: find("region") ?? "Punjab",
    postalCode: find("postcode"),
    country: find("country") ?? "India",
  };
}

export default function LocationPicker({ value, onChange }: { value: LocationValue | null; onChange: (v: LocationValue) => void }) {
  const [detecting, setDetecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function useCurrentLocation() {
    setError(null);
    if (!navigator.geolocation) {
      setError("Geolocation isn't supported in this browser. Please search your address instead.");
      return;
    }
    setDetecting(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const loc = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
          onChange(loc);
        } catch {
          setError("Couldn't resolve your address. You can enter it manually below.");
        } finally {
          setDetecting(false);
        }
      },
      () => {
        setError("Location permission denied. You can search your address instead.");
        setDetecting(false);
      }
    );
  }

  const current = value ?? THAPAR_FALLBACK;

  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-ink">Location</p>
        <button
          type="button"
          onClick={useCurrentLocation}
          disabled={detecting}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-primary hover:bg-secondary/20"
        >
          {detecting ? <Loader2 size={13} className="animate-spin" /> : <LocateFixed size={13} />}
          Use my current location
        </button>
      </div>

      {!MAPBOX_TOKEN && (
        <p className="mt-2 text-xs text-muted-foreground">
          Mapbox isn't configured for this deployment — running in DEMO MODE. Coordinates are still real; street-address lookup is disabled.
        </p>
      )}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      <div className="mt-3 flex items-start gap-2 text-sm text-ink">
        <MapPin size={16} className="mt-0.5 shrink-0 text-primary" />
        <input
          value={current.formattedAddress}
          onChange={(e) => onChange({ ...current, formattedAddress: e.target.value })}
          className="w-full bg-transparent text-sm outline-none"
          placeholder="Search your address"
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <input
          value={current.city}
          onChange={(e) => onChange({ ...current, city: e.target.value })}
          placeholder="City"
          className="rounded-lg border border-border bg-surface px-3 py-2 text-xs"
        />
        <input
          value={current.state}
          onChange={(e) => onChange({ ...current, state: e.target.value })}
          placeholder="State"
          className="rounded-lg border border-border bg-surface px-3 py-2 text-xs"
        />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">You can edit the detected address above before continuing.</p>
    </div>
  );
}
