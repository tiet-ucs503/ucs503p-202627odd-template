import type { ActivityCategory, TravelStyle } from "@/types/itinerary";

/**
 * Curated demo content used by the mock itinerary generator
 * (`@/lib/services/itinerary-generator`) when no live AI/places provider is
 * configured. Real, stable reference links (Wikipedia articles for
 * well-known landmarks) are used where we can be confident they exist;
 * everything else — hotels, restaurants, local tour operators — is marked
 * `isDemoData: true` with no invented URL, per the "never fabricate a
 * source" rule for this product.
 */

export interface ActivityTemplate {
  name: string;
  category: ActivityCategory;
  description: string;
  estimatedCost: number; // INR, flat for the travelling party
  durationMinutes: number;
  referenceUrl: string | null;
  isDemoData: boolean;
  styles: TravelStyle[];
}

export interface CityTemplate {
  name: string;
  country: string;
  imageQuery: string;
  shareOfTrip: number; // relative weight when splitting days across cities
  hotel: { name: string; pricePerNight: number };
  breakfast: ActivityTemplate;
  lunch: ActivityTemplate[];
  dinner: ActivityTemplate[];
  attractions: ActivityTemplate[];
  eveningSpots: ActivityTemplate[];
}

export interface DestinationTemplate {
  label: string;
  flightTierPerTraveler: number; // INR, round trip
  cities: CityTemplate[];
}

const THAILAND: DestinationTemplate = {
  label: "Thailand",
  flightTierPerTraveler: 17_500,
  cities: [
    {
      name: "Bangkok",
      country: "Thailand",
      imageQuery: "bangkok skyline temple",
      shareOfTrip: 0.4,
      hotel: { name: "Riverside Boutique Hotel, Bangkok (demo)", pricePerNight: 4_500 },
      breakfast: {
        name: "Breakfast at the hotel",
        category: "food",
        description: "Start the day with a Thai-and-continental breakfast spread.",
        estimatedCost: 500,
        durationMinutes: 45,
        referenceUrl: null,
        isDemoData: true,
        styles: ["food", "relaxation"],
      },
      lunch: [
        {
          name: "Local Thai lunch",
          category: "food",
          description: "Pad thai, som tam and mango sticky rice at a local spot.",
          estimatedCost: 800,
          durationMinutes: 60,
          referenceUrl: null,
          isDemoData: true,
          styles: ["food"],
        },
        {
          name: "Riverside lunch cruise",
          category: "food",
          description: "A short lunch cruise along the Chao Phraya river.",
          estimatedCost: 1_400,
          durationMinutes: 90,
          referenceUrl: null,
          isDemoData: true,
          styles: ["food", "relaxation"],
        },
      ],
      dinner: [
        {
          name: "Street food at Chinatown (Yaowarat)",
          category: "food",
          description: "Grilled skewers, noodles and seafood along Yaowarat Road.",
          estimatedCost: 1_000,
          durationMinutes: 90,
          referenceUrl: "https://en.wikipedia.org/wiki/Yaowarat_Road",
          isDemoData: false,
          styles: ["food", "nightlife"],
        },
        {
          name: "Rooftop dinner",
          category: "food",
          description: "Dinner with a skyline view at a rooftop restaurant.",
          estimatedCost: 2_200,
          durationMinutes: 90,
          referenceUrl: null,
          isDemoData: true,
          styles: ["food", "nightlife"],
        },
      ],
      attractions: [
        {
          name: "Grand Palace",
          category: "culture",
          description: "The ornate former royal residence and Thailand's most famous landmark.",
          estimatedCost: 1_200,
          durationMinutes: 150,
          referenceUrl: "https://en.wikipedia.org/wiki/Grand_Palace",
          isDemoData: false,
          styles: ["culture", "beaches", "adventure", "food", "nightlife", "shopping", "nature", "relaxation"],
        },
        {
          name: "Wat Pho",
          category: "culture",
          description: "Temple of the Reclining Buddha, next to the Grand Palace.",
          estimatedCost: 600,
          durationMinutes: 90,
          referenceUrl: "https://en.wikipedia.org/wiki/Wat_Pho",
          isDemoData: false,
          styles: ["culture"],
        },
        {
          name: "Wat Arun",
          category: "culture",
          description: "The Temple of Dawn, on the west bank of the Chao Phraya.",
          estimatedCost: 400,
          durationMinutes: 75,
          referenceUrl: "https://en.wikipedia.org/wiki/Wat_Arun",
          isDemoData: false,
          styles: ["culture"],
        },
        {
          name: "Chatuchak Weekend Market",
          category: "shopping",
          description: "One of the world's largest weekend markets — thousands of stalls.",
          estimatedCost: 1_500,
          durationMinutes: 150,
          referenceUrl: "https://en.wikipedia.org/wiki/Chatuchak_Market",
          isDemoData: false,
          styles: ["shopping"],
        },
        {
          name: "Damnoen Saduak Floating Market",
          category: "sightseeing",
          description: "A half-day trip to the classic floating market outside the city.",
          estimatedCost: 1_800,
          durationMinutes: 240,
          referenceUrl: "https://en.wikipedia.org/wiki/Damnoen_Saduak_Floating_Market",
          isDemoData: false,
          styles: ["culture"],
        },
        {
          name: "Jim Thompson House",
          category: "culture",
          description: "A silk entrepreneur's teak house, now a museum and garden.",
          estimatedCost: 700,
          durationMinutes: 75,
          referenceUrl: "https://en.wikipedia.org/wiki/Jim_Thompson_House",
          isDemoData: false,
          styles: ["culture", "relaxation"],
        },
        {
          name: "Thai cooking class",
          category: "food",
          description: "Hands-on class covering three or four classic Thai dishes.",
          estimatedCost: 1_600,
          durationMinutes: 180,
          referenceUrl: null,
          isDemoData: true,
          styles: ["food"],
        },
        {
          name: "Lumphini Park morning walk",
          category: "relaxation",
          description: "A quiet loop around Bangkok's largest central park.",
          estimatedCost: 0,
          durationMinutes: 60,
          referenceUrl: "https://en.wikipedia.org/wiki/Lumphini_Park",
          isDemoData: false,
          styles: ["relaxation", "nature"],
        },
      ],
      eveningSpots: [
        {
          name: "Chinatown (Yaowarat)",
          category: "nightlife",
          description: "Neon-lit streets, seafood stalls and gold shops.",
          estimatedCost: 0,
          durationMinutes: 90,
          referenceUrl: "https://en.wikipedia.org/wiki/Yaowarat_Road",
          isDemoData: false,
          styles: ["nightlife", "food"],
        },
        {
          name: "Khao San Road",
          category: "nightlife",
          description: "Bangkok's famous backpacker strip — bars, stalls and street performers.",
          estimatedCost: 0,
          durationMinutes: 90,
          referenceUrl: "https://en.wikipedia.org/wiki/Khao_San_Road",
          isDemoData: false,
          styles: ["nightlife"],
        },
      ],
    },
    {
      name: "Phuket",
      country: "Thailand",
      imageQuery: "phuket beach longtail boats",
      shareOfTrip: 0.6,
      hotel: { name: "Patong Beachfront Resort, Phuket (demo)", pricePerNight: 5_200 },
      breakfast: {
        name: "Breakfast with a beach view",
        category: "food",
        description: "Breakfast at the hotel before heading to the beach.",
        estimatedCost: 550,
        durationMinutes: 45,
        referenceUrl: null,
        isDemoData: true,
        styles: ["food", "beaches"],
      },
      lunch: [
        {
          name: "Beachside seafood lunch",
          category: "food",
          description: "Fresh grilled seafood at a beach shack.",
          estimatedCost: 1_100,
          durationMinutes: 75,
          referenceUrl: null,
          isDemoData: true,
          styles: ["food", "beaches"],
        },
      ],
      dinner: [
        {
          name: "Street food on Bangla Road",
          category: "food",
          description: "Night-market food stalls near Bangla Road.",
          estimatedCost: 900,
          durationMinutes: 90,
          referenceUrl: "https://en.wikipedia.org/wiki/Bangla_Road",
          isDemoData: false,
          styles: ["food", "nightlife"],
        },
        {
          name: "Old Town dinner",
          category: "food",
          description: "Dinner in a restored Sino-Portuguese shophouse in Phuket Old Town.",
          estimatedCost: 1_300,
          durationMinutes: 90,
          referenceUrl: null,
          isDemoData: true,
          styles: ["food", "culture"],
        },
      ],
      attractions: [
        {
          name: "Patong Beach",
          category: "beach",
          description: "Phuket's liveliest beach — swimming, jet skis and beach bars.",
          estimatedCost: 0,
          durationMinutes: 180,
          referenceUrl: "https://en.wikipedia.org/wiki/Patong_Beach",
          isDemoData: false,
          styles: ["beaches", "relaxation"],
        },
        {
          name: "Phi Phi Islands day trip",
          category: "adventure",
          description: "Speedboat day trip to Maya Bay and the Phi Phi Islands, with snorkelling.",
          estimatedCost: 3_500,
          durationMinutes: 480,
          referenceUrl: "https://en.wikipedia.org/wiki/Phi_Phi_Islands",
          isDemoData: false,
          styles: ["adventure", "beaches"],
        },
        {
          name: "Big Buddha Phuket",
          category: "culture",
          description: "A 45-metre marble Buddha statue with panoramic island views.",
          estimatedCost: 300,
          durationMinutes: 90,
          referenceUrl: "https://en.wikipedia.org/wiki/Big_Buddha_Phuket",
          isDemoData: false,
          styles: ["culture"],
        },
        {
          name: "Phuket Old Town walk",
          category: "sightseeing",
          description: "Sino-Portuguese architecture, murals and local cafes.",
          estimatedCost: 0,
          durationMinutes: 120,
          referenceUrl: "https://en.wikipedia.org/wiki/Phuket_City",
          isDemoData: false,
          styles: ["culture"],
        },
        {
          name: "Kata Beach",
          category: "beach",
          description: "A quieter beach south of Patong, good for swimming.",
          estimatedCost: 0,
          durationMinutes: 150,
          referenceUrl: "https://en.wikipedia.org/wiki/Kata_Beach",
          isDemoData: false,
          styles: ["beaches", "relaxation"],
        },
        {
          name: "Wat Chalong",
          category: "culture",
          description: "Phuket's largest and most important Buddhist temple.",
          estimatedCost: 0,
          durationMinutes: 60,
          referenceUrl: "https://en.wikipedia.org/wiki/Wat_Chalong",
          isDemoData: false,
          styles: ["culture"],
        },
        {
          name: "Phang Nga Bay kayaking",
          category: "adventure",
          description: "Sea-kayaking through limestone karsts and hidden lagoons.",
          estimatedCost: 2_800,
          durationMinutes: 300,
          referenceUrl: "https://en.wikipedia.org/wiki/Phang_Nga_Bay",
          isDemoData: false,
          styles: ["adventure", "nature"],
        },
        {
          name: "ATV jungle ride",
          category: "adventure",
          description: "Guided ATV ride through Phuket's inland jungle trails.",
          estimatedCost: 1_900,
          durationMinutes: 120,
          referenceUrl: null,
          isDemoData: true,
          styles: ["adventure"],
        },
      ],
      eveningSpots: [
        {
          name: "Bangla Road nightlife",
          category: "nightlife",
          description: "Patong's neon nightlife strip — bars, music and night markets.",
          estimatedCost: 0,
          durationMinutes: 120,
          referenceUrl: "https://en.wikipedia.org/wiki/Bangla_Road",
          isDemoData: false,
          styles: ["nightlife"],
        },
      ],
    },
  ],
};

export const DESTINATION_TEMPLATES: Record<string, DestinationTemplate> = {
  thailand: THAILAND,
};

export function findDestinationTemplate(destination: string): DestinationTemplate | null {
  const key = destination.trim().toLowerCase();
  return DESTINATION_TEMPLATES[key] ?? null;
}

/** Generic activity name bank for destinations without curated content. */
export const GENERIC_ACTIVITY_BANK: Record<TravelStyle, ActivityTemplate[]> = {
  beaches: [
    {
      name: "Beach morning",
      category: "beach",
      description: "Relax and swim at the main beach near the city.",
      estimatedCost: 0,
      durationMinutes: 180,
      referenceUrl: null,
      isDemoData: true,
      styles: ["beaches"],
    },
  ],
  food: [
    {
      name: "Local food market tour",
      category: "food",
      description: "Sample regional specialties at the central food market.",
      estimatedCost: 900,
      durationMinutes: 120,
      referenceUrl: null,
      isDemoData: true,
      styles: ["food"],
    },
  ],
  culture: [
    {
      name: "Old town walking tour",
      category: "culture",
      description: "A guided walk through the historic centre and its landmarks.",
      estimatedCost: 700,
      durationMinutes: 150,
      referenceUrl: null,
      isDemoData: true,
      styles: ["culture"],
    },
  ],
  adventure: [
    {
      name: "Adventure park excursion",
      category: "adventure",
      description: "A half-day of zip-lining, hiking or water sports.",
      estimatedCost: 2_200,
      durationMinutes: 240,
      referenceUrl: null,
      isDemoData: true,
      styles: ["adventure"],
    },
  ],
  nightlife: [
    {
      name: "Evening entertainment district",
      category: "nightlife",
      description: "Bars, live music and night markets in the entertainment quarter.",
      estimatedCost: 500,
      durationMinutes: 120,
      referenceUrl: null,
      isDemoData: true,
      styles: ["nightlife"],
    },
  ],
  shopping: [
    {
      name: "Local market shopping",
      category: "shopping",
      description: "Browse the main market or shopping district for souvenirs.",
      estimatedCost: 1_500,
      durationMinutes: 120,
      referenceUrl: null,
      isDemoData: true,
      styles: ["shopping"],
    },
  ],
  nature: [
    {
      name: "Nature reserve visit",
      category: "sightseeing",
      description: "A scenic trail or nature reserve just outside the city.",
      estimatedCost: 400,
      durationMinutes: 180,
      referenceUrl: null,
      isDemoData: true,
      styles: ["nature"],
    },
  ],
  relaxation: [
    {
      name: "Spa & wellness afternoon",
      category: "relaxation",
      description: "A relaxing massage or spa treatment.",
      estimatedCost: 1_800,
      durationMinutes: 120,
      referenceUrl: null,
      isDemoData: true,
      styles: ["relaxation"],
    },
  ],
};
