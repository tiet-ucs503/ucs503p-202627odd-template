import type { TravelStyle } from "@/types/itinerary";

/**
 * Canned seasonality for Travis's demo mode (`AI_PROVIDER=mock`).
 *
 * This is general, widely-known travel-season knowledge, hedged the way a
 * guidebook hedges it — typical patterns, never forecasts and never prices.
 * It exists so the app, the tests and a demo laptop with no API key can all
 * exercise the real Travis pipeline. The UI says plainly when an answer came
 * from here rather than from a language model.
 */

export interface DemoDestination {
  /** Lower-case words that mean this place when a traveller types them. */
  keywords: string[];
  destination: string;
  headline: string;
  suggestedDays: number;
  styles: TravelStyle[];
  weatherNote: string;
  watchOut: string;
  /** The window with the most settled weather, and how pricey it usually is. */
  best: { startMonth: number; endMonth: number; costOutlook: "typical" | "higher"; costReason: string };
  /** The quieter window, when it usually costs less. */
  cheap: { startMonth: number; endMonth: number; costReason: string; weatherNote: string };
}

export const DEMO_DESTINATIONS: DemoDestination[] = [
  {
    keywords: ["thailand", "bangkok", "phuket"],
    destination: "Thailand",
    headline: "Beaches, street food and temples, easy to combine in one trip.",
    suggestedDays: 9,
    styles: ["beaches", "food", "culture"],
    weatherNote: "Usually cooler and drier from November to February.",
    watchOut: "Heavy rain is common on the islands in the wetter months.",
    best: {
      startMonth: 11,
      endMonth: 2,
      costOutlook: "higher",
      costReason: "The dry season is peak season, and the weeks around Christmas are usually the busiest.",
    },
    cheap: {
      startMonth: 6,
      endMonth: 9,
      costReason: "The rainy season is quieter, and hotels typically discount to fill rooms.",
      weatherNote: "Warm and humid with regular showers, often short and in the afternoon.",
    },
  },
  {
    keywords: ["bali", "indonesia"],
    destination: "Bali, Indonesia",
    headline: "Rice terraces, surf beaches and a strong food and wellness scene.",
    suggestedDays: 8,
    styles: ["beaches", "relaxation", "nature"],
    weatherNote: "The dry season, April to October, usually has the sunniest days.",
    watchOut: "July and August are the busiest weeks, and popular spots get crowded.",
    best: {
      startMonth: 4,
      endMonth: 10,
      costOutlook: "typical",
      costReason: "Prices usually rise in July, August and over Christmas, and sit lower either side.",
    },
    cheap: {
      startMonth: 4,
      endMonth: 6,
      costReason: "These shoulder months fall between the wet season and the summer rush.",
      weatherNote: "Mostly dry, with the heat building towards the middle of the year.",
    },
  },
  {
    keywords: ["italy", "rome", "florence", "venice", "amalfi"],
    destination: "Italy",
    headline: "Art, food and history, comfortable to travel between by train.",
    suggestedDays: 9,
    styles: ["culture", "food"],
    weatherNote: "Spring and early autumn are usually mild, without the peak summer heat.",
    watchOut: "Midsummer is hot and crowded in the big cities, and some smaller places close in August.",
    best: {
      startMonth: 4,
      endMonth: 6,
      costOutlook: "higher",
      costReason: "Spring is a popular shoulder season, and Easter week is usually the dearest part of it.",
    },
    cheap: {
      startMonth: 11,
      endMonth: 3,
      costReason: "Outside the holidays, winter is the quietest stretch of the year.",
      weatherNote: "Cool to cold, often grey, with the best chance of empty museums.",
    },
  },
  {
    keywords: ["japan", "tokyo", "kyoto", "osaka"],
    destination: "Japan",
    headline: "Tokyo's energy and Kyoto's temples, with excellent trains between them.",
    suggestedDays: 10,
    styles: ["culture", "food"],
    weatherNote: "Spring and autumn are usually the most comfortable seasons.",
    watchOut: "Cherry blossom time and the autumn leaves draw big crowds.",
    best: {
      startMonth: 10,
      endMonth: 11,
      costOutlook: "higher",
      costReason: "Autumn colour is a peak season, so rooms in Kyoto in particular tend to book up.",
    },
    cheap: {
      startMonth: 1,
      endMonth: 2,
      costReason: "Midwinter is outside the big seasons and is usually the quietest and cheapest time.",
      weatherNote: "Cold and dry in most places, with snow in the mountains and the north.",
    },
  },
  {
    keywords: ["goa"],
    destination: "Goa, India",
    headline: "Easy beaches, seafood and a relaxed pace, reachable without a long flight.",
    suggestedDays: 5,
    styles: ["beaches", "nightlife", "relaxation"],
    weatherNote: "November to February is usually dry and pleasantly warm.",
    watchOut: "Late December is very crowded, and many beach shacks close during the monsoon.",
    best: {
      startMonth: 11,
      endMonth: 2,
      costOutlook: "higher",
      costReason: "The dry season is peak season, and New Year week is usually the busiest of all.",
    },
    cheap: {
      startMonth: 6,
      endMonth: 9,
      costReason: "The monsoon keeps visitors away, and stays usually cost less then.",
      weatherNote: "Heavy, steady rain with rough seas, so the beaches are for watching rather than swimming.",
    },
  },
  {
    keywords: ["portugal", "lisbon", "porto"],
    destination: "Portugal",
    headline: "Lisbon, Porto and the coast: compact, walkable and good value for Europe.",
    suggestedDays: 8,
    styles: ["culture", "food", "beaches"],
    weatherNote: "May to October is usually warm and dry, with long evenings.",
    watchOut: "July and August are hot in Lisbon and the Algarve beaches fill up.",
    best: {
      startMonth: 5,
      endMonth: 10,
      costOutlook: "typical",
      costReason: "Prices usually peak in July and August and ease off in early summer and September.",
    },
    cheap: {
      startMonth: 11,
      endMonth: 3,
      costReason: "Winter is the low season, outside Christmas and New Year.",
      weatherNote: "Mild but wet, and the coast is too cool for beach days.",
    },
  },
];
