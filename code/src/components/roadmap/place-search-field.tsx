"use client";

import { Loader2, MapPin, Search, Star } from "lucide-react";
import { useState } from "react";
import { Badge, Button, Input } from "@/components/ui";
import { ApiError, postAuthenticated } from "@/lib/api-client";
import { cn, formatMoney } from "@/lib/utils";
import type { Place, PlaceType } from "@/types/place";

/**
 * Lets a traveller replace an activity with a *real* place instead of typing
 * a free-text name. Calls `/api/places/search`, which runs the configured
 * provider server-side — this component never talks to a provider or sees an
 * API key. Results are real places, best rated first.
 */
export function PlaceSearchField({
  destination,
  country,
  type,
  currency,
  onPick,
}: {
  destination: string;
  country?: string | null;
  type: PlaceType;
  currency: string;
  onPick: (place: Place) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Place[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function search() {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setError("Type at least two characters to search.");
      return;
    }
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const body = await postAuthenticated<{ places?: Place[]; notice?: string | null }>(
        "/api/places/search",
        { query: trimmed, destination, country: country ?? undefined, type, currency },
      );
      setResults(body.places ?? []);
      setNotice(body.notice ?? null);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Couldn't search for places right now. You can still type a name yourself.",
      );
      setResults(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
      <label htmlFor="place-search" className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
        Replace with a real place
      </label>
      <p className="mb-2 text-xs text-zinc-500">
        Search {destination} and pick a place to keep its location and source attached.
      </p>

      <div className="flex gap-2">
        <Input
          id="place-search"
          value={query}
          placeholder="e.g. temple, rooftop bar, museum"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              search();
            }
          }}
        />
        <Button type="button" variant="secondary" onClick={search} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          <span className="sr-only">Search places</span>
        </Button>
      </div>

      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
      {notice ? <p className="mt-2 text-xs text-amber-700 dark:text-amber-500">{notice}</p> : null}

      {results !== null && results.length === 0 && !loading ? (
        <p className="mt-3 text-xs text-zinc-500">
          No places matched “{query}”. Try a broader search, or just type the name in the field above.
        </p>
      ) : null}

      {results && results.length > 0 ? (
        <ul className="mt-3 flex max-h-56 flex-col gap-1 overflow-y-auto">
          {results.map((place) => (
            <li key={place.id}>
              <button
                type="button"
                onClick={() => onPick(place)}
                className={cn(
                  "flex w-full flex-col items-start gap-0.5 rounded-lg px-2.5 py-2 text-left transition-colors",
                  "hover:bg-orange-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600 dark:hover:bg-zinc-800",
                )}
              >
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{place.name}</span>
                  {place.isDemoData ? <Badge tone="amber">Not verified</Badge> : null}
                  {place.rating ? (
                    <span className="inline-flex items-center gap-0.5 text-xs text-zinc-500">
                      <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                      {place.rating.value.toFixed(1)}
                    </span>
                  ) : null}
                </span>
                <span className="flex flex-wrap items-center gap-x-3 text-xs text-zinc-500">
                  {place.address ? <span className="line-clamp-1">{place.address}</span> : null}
                  {place.location ? (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {place.location.lat.toFixed(3)}, {place.location.lng.toFixed(3)}
                    </span>
                  ) : null}
                  {place.price && place.price.amount > 0 ? (
                    <span>{formatMoney(place.price.amount, place.price.currency)} (est.)</span>
                  ) : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
