import { GooglePlacesProvider } from "./google-provider";
import { PlacesProviderError } from "./errors";
import type { PlacesProvider } from "./provider";

export type { Place, PlaceType, LatLng, Rating, PriceInfo, SourceRef } from "@/types/place";
export type { PlaceSearchParams, PlacesProvider } from "./provider";
export { PlacesProviderError, friendlyPlacesMessage, statusForPlacesError } from "./errors";

/**
 * The one place a provider gets chosen. Everything else in the app depends
 * only on the `PlacesProvider` interface, so adding another provider later
 * means adding a branch here and nothing else changes.
 *
 * There is no stand-in. Every hotel, sight and restaurant in TripEase comes from
 * Google Places, so without `GOOGLE_PLACES_API_KEY` this throws
 * `PlacesProviderError("missing-key")` and the routes tell the traveller that
 * place search isn't available, instead of building a trip out of invented
 * places. (Tests use their own double, in `src/test-support`.)
 *
 * Server-only: the key has no `NEXT_PUBLIC_` prefix, so calling this from a
 * client component would fail. Call it from route handlers and server code.
 */
export function getPlacesProvider(): PlacesProvider {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    throw new PlacesProviderError("missing-key", "GOOGLE_PLACES_API_KEY is not set.");
  }
  return new GooglePlacesProvider(apiKey);
}

/**
 * Whether place search is configured. Safe to send to the client: it reports
 * only *that* a key exists, never the key itself.
 */
export function placesConfigured(): boolean {
  return Boolean(process.env.GOOGLE_PLACES_API_KEY);
}
