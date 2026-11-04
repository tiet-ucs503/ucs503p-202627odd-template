import { COUNTRY_PHOTOS, ELSEWHERE_PHOTO, PLAN_PHOTO, TRAVIS_PHOTO } from "@/lib/country-photos";
import { resolveCountry } from "@/lib/countries";

/**
 * Photographs for the app.
 *
 * Every supported country has one (see `country-photos.ts`, which is generated
 * with the credits in each photo's alt text). A trip's destination is free
 * text from before the list existed or from the AI, so it is resolved to a
 * country first; anything that doesn't resolve gets a neutral landscape and
 * never a photo of a different place standing in for the real one.
 */

export interface DestinationPhoto {
  src: string;
  /** What the photo shows, and who took it. */
  alt: string;
  /** Where to anchor the crop when the frame is narrower than the photo. */
  position: string;
}

export { ELSEWHERE_PHOTO, PLAN_PHOTO, TRAVIS_PHOTO };

export function photoForCountry(code: string): DestinationPhoto {
  return COUNTRY_PHOTOS[code.toUpperCase()] ?? ELSEWHERE_PHOTO;
}

interface PhotoSubject {
  destination: string;
  title?: string;
  cities?: { name: string; country: string }[];
}

/**
 * The photo for a trip. The destination wins; the cities the planner chose
 * come next (so "Southeast Asia" with Bangkok in it still resolves); the title
 * is the last resort.
 */
export function photoForTrip(trip: PhotoSubject): DestinationPhoto {
  const country =
    resolveCountry(trip.destination) ??
    resolveCountry((trip.cities ?? []).map((city) => `${city.name} ${city.country}`).join(" ")) ??
    (trip.title ? resolveCountry(trip.title) : null);

  return country ? photoForCountry(country.code) : ELSEWHERE_PHOTO;
}
