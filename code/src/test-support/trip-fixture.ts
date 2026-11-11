import { generateItinerary } from "@/lib/services/itinerary-generator";
import { getMockPlacesProvider } from "./places";
import type { AgentTrip } from "@/types/trip-agent";

/**
 * A real nine-day Thailand trip, built by the real generator from the demo
 * data, for tests of everything that edits a trip. Not a hand-written fixture:
 * it has the shape, ids and costs a saved trip really has, so an edit that
 * works on it works on one.
 */
export async function buildThailandTrip(): Promise<AgentTrip> {
  const places = getMockPlacesProvider();
  const draft = {
    destination: "Thailand",
    startDate: "2027-01-10",
    endDate: "2027-01-18",
    budget: 200000,
    currency: "INR",
    travelers: 2,
    travelerType: "couple" as const,
    preferences: ["culture" as const, "food" as const],
  };
  // Fixed, not planned: this trip must not change when the real planner's choices do.
  const cities = [
    { name: "Bangkok", days: 5, reason: "fixture" },
    { name: "Phuket", days: 4, reason: "fixture" },
  ];
  const itinerary = await generateItinerary(
    draft,
    { destination: "Thailand", cities, source: "fallback", plannerVersion: "test", fallbackReason: null },
    undefined,
    places,
  );
  return { ...itinerary, id: "t1", title: "Thailand Adventure", travelerType: "couple", preferences: draft.preferences, travelers: 2 };
}
