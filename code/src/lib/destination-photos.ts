/**
 * Photographs for the dashboard.
 *
 * A trip's destination is free text, so there is no photo for most of what
 * someone might type. This maps the places TripEase actually has a picture of
 * (by whole word, so "goa" never matches "mogoa") and falls back to a neutral
 * landscape for everything else. It never shows a photo of a different place
 * to stand in for the real one: a sunset over water is true of anywhere, a
 * Portuguese street for a trip to Brazil is not.
 *
 * The files are in `public/images/destinations`, and `public/images/CREDITS.md`
 * names every photographer and licence.
 */

export interface DestinationPhoto {
  src: string;
  /** What the photo shows, for the few places it is not purely decorative. */
  alt: string;
  /** Where to anchor the crop when the frame is narrower than the photo. */
  position: string;
}

const dir = "/images/destinations";

const PHOTOS = {
  thailand: { src: `${dir}/thailand.jpg`, alt: "Limestone cliffs and turquoise water at Koh Phi Phi, Thailand", position: "50% 55%" },
  bali: { src: `${dir}/bali.jpg`, alt: "Terraced rice fields in East Bali", position: "50% 50%" },
  italy: { src: `${dir}/italy.jpg`, alt: "Colourful houses on the cliffs of Manarola, Cinque Terre", position: "35% 50%" },
  japan: { src: `${dir}/japan.jpg`, alt: "Mount Fuji behind cherry blossom at Lake Kawaguchiko", position: "50% 40%" },
  goa: { src: `${dir}/goa.jpg`, alt: "Palm trees on Mandrem beach, Goa", position: "50% 50%" },
  portugal: { src: `${dir}/portugal.jpg`, alt: "Coloured houses along the Douro in Porto", position: "50% 45%" },
} as const satisfies Record<string, DestinationPhoto>;

export const PLAN_PHOTO: DestinationPhoto = {
  src: `${dir}/plan.jpg`,
  alt: "Mountains reflected in a still lake at sunrise",
  position: "50% 60%",
};

export const TRAVIS_PHOTO: DestinationPhoto = {
  src: `${dir}/travis.jpg`,
  alt: "A wing and a coastline seen from a plane window",
  position: "50% 50%",
};

export const ELSEWHERE_PHOTO: DestinationPhoto = {
  src: `${dir}/elsewhere.jpg`,
  alt: "Sunset reflected in a calm lake",
  position: "50% 50%",
};

type PlaceKey = keyof typeof PHOTOS;

/** Whole words that mean each place. Longest-specific first is not needed: a
 *  trip is matched on its destination, then its cities, then its title. */
const KEYWORDS: Record<PlaceKey, string[]> = {
  thailand: ["thailand", "bangkok", "phuket", "krabi", "chiang mai", "pattaya", "koh samui", "phi phi"],
  bali: ["bali", "ubud", "indonesia"],
  italy: ["italy", "rome", "venice", "florence", "milan", "naples", "amalfi", "tuscany", "cinque terre"],
  japan: ["japan", "tokyo", "kyoto", "osaka", "hokkaido"],
  goa: ["goa"],
  portugal: ["portugal", "lisbon", "lisboa", "algarve"],
};

const PATTERNS = (Object.keys(KEYWORDS) as PlaceKey[]).map((key) => ({
  key,
  pattern: new RegExp(`\\b(?:${KEYWORDS[key].join("|")})\\b`, "i"),
}));

function match(text: string): PlaceKey | null {
  for (const { key, pattern } of PATTERNS) {
    if (pattern.test(text)) return key;
  }
  return null;
}

interface PhotoSubject {
  destination: string;
  title?: string;
  cities?: { name: string; country: string }[];
}

/**
 * The photo for a trip. The destination the traveller typed wins; the cities
 * the planner chose come next (so "Southeast Asia" with Bangkok in it still
 * resolves); the title is the last resort.
 */
export function photoForTrip(trip: PhotoSubject): DestinationPhoto {
  const fromDestination = match(trip.destination);
  if (fromDestination) return PHOTOS[fromDestination];

  const cityText = (trip.cities ?? []).map((c) => `${c.name} ${c.country}`).join(" ");
  const fromCities = cityText ? match(cityText) : null;
  if (fromCities) return PHOTOS[fromCities];

  const fromTitle = trip.title ? match(trip.title) : null;
  return fromTitle ? PHOTOS[fromTitle] : ELSEWHERE_PHOTO;
}
