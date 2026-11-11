import { describe, expect, it } from "vitest";
import { analyzeTrip, cityAnchor } from "@/lib/services/feasibility/engine";
import { haversineKm, isValidCoordinate } from "@/lib/services/feasibility/geo";
import { generateItinerary } from "@/lib/services/itinerary-generator";
import { MockPlacesProvider } from "@/test-support/places/mock-provider";
import type { CityPlan } from "@/types/planning";
import type { GeneratedItinerary, Trip, TripDraftInput } from "@/types/trip";

/**
 * End-to-end: generate a real itinerary through the normal pipeline, then run
 * the feasibility engine over it. This is the check that the generator and the
 * engine agree — a generator that produced days the engine calls impossible
 * would ship a red warning on every trip.
 */

const draft: TripDraftInput = {
  destination: "Thailand",
  startDate: "2027-06-12",
  endDate: "2027-06-20", // 9 days
  budget: 150_000,
  currency: "INR",
  travelers: 2,
  travelerType: "couple",
  preferences: ["culture", "food"],
};

const bangkokPhuket: CityPlan = {
  destination: "Thailand",
  cities: [
    { name: "Bangkok", days: 5, reason: "" },
    { name: "Phuket", days: 4, reason: "" },
  ],
  source: "ai",
  plannerVersion: "test",
};

function asTrip(itinerary: GeneratedItinerary): Trip {
  return {
    id: "trip-1",
    ownerId: "user-1",
    status: "ready",
    destination: itinerary.destination,
    title: itinerary.title,
    startDate: itinerary.startDate,
    endDate: itinerary.endDate,
    dayCount: itinerary.dayCount,
    currency: itinerary.currency,
    travelers: draft.travelers,
    travelerType: draft.travelerType,
    preferences: draft.preferences,
    cities: itinerary.cities,
    days: itinerary.days,
    budget: itinerary.budget,
    createdAt: new Date("2027-01-01"),
    updatedAt: new Date("2027-01-01"),
  };
}

async function thailand(): Promise<Trip> {
  return asTrip(await generateItinerary(draft, bangkokPhuket, undefined, new MockPlacesProvider()));
}

describe("a generated Thailand itinerary", () => {
  it("gives every day a plan", async () => {
    const trip = await thailand();
    const result = analyzeTrip(trip);
    expect(Object.keys(result.days)).toHaveLength(trip.days.length);
  });

  it("makes the Bangkok → Phuket move an explicit part of the itinerary", async () => {
    const trip = await thailand();

    // The generator books it as a transport activity the budget can see...
    const transferActivities = trip.days.flatMap((d) =>
      d.activities.filter((a) => a.category === "transport"),
    );
    expect(transferActivities).toHaveLength(1);
    expect(transferActivities[0].name).toContain("Phuket");

    // ...and the engine surfaces it as a travel segment the traveller can see.
    const transfers = Object.values(analyzeTrip(trip).days).flatMap((plan) =>
      plan.segments.filter((s) => s.type === "city-transfer"),
    );
    expect(transfers).toHaveLength(1);
    expect(transfers[0].fromCity).toBe("Bangkok");
    expect(transfers[0].toCity).toBe("Phuket");
    expect(transfers[0].estimatedDurationMinutes).toBeGreaterThan(120);
  });

  it("puts the transfer on the first Phuket day, not inside the Bangkok block", async () => {
    const trip = await thailand();
    const phuket = trip.cities.find((c) => c.name === "Phuket")!;
    const phuketDays = trip.days.filter((d) => d.cityId === phuket.id).sort((a, b) => a.dayNumber - b.dayNumber);

    const plans = analyzeTrip(trip).days;
    expect(plans[phuketDays[0].id].segments.some((s) => s.type === "city-transfer")).toBe(true);
    for (const day of phuketDays.slice(1)) {
      expect(plans[day.id].segments.some((s) => s.type === "city-transfer")).toBe(false);
    }
  });

  it("never schedules a place from one city inside another city's day", async () => {
    const trip = await thailand();

    for (const day of trip.days) {
      const anchor = cityAnchor(trip.cities.find((c) => c.id === day.cityId)!, trip.days);
      if (!isValidCoordinate(anchor)) continue;
      for (const stop of day.activities) {
        if (stop.category === "transport" || !isValidCoordinate(stop.location)) continue;
        const km = haversineKm(anchor, stop.location);
        // Generous: even a big metro's outskirts sit well inside this.
        expect(km, `${stop.name} on day ${day.dayNumber}`).toBeLessThan(150);
      }
    }
  });

  it("produces days that actually fit in a day", async () => {
    const trip = await thailand();
    const result = analyzeTrip(trip);
    expect(result.infeasibleDayNumbers).toEqual([]);
  });

  it("gives the arrival day a lighter load than a full sightseeing day", async () => {
    const trip = await thailand();
    const phuket = trip.cities.find((c) => c.name === "Phuket")!;
    const phuketDays = trip.days.filter((d) => d.cityId === phuket.id).sort((a, b) => a.dayNumber - b.dayNumber);

    const minutesAt = (index: number) =>
      phuketDays[index].activities
        .filter((a) => a.category !== "transport")
        .reduce((sum, a) => sum + a.durationMinutes, 0);

    expect(minutesAt(0)).toBeLessThan(minutesAt(1));
  });

  it("schedules nothing on the arrival day until the transfer is over", async () => {
    const trip = await thailand();
    const phuket = trip.cities.find((c) => c.name === "Phuket")!;
    const arrival = trip.days
      .filter((d) => d.cityId === phuket.id)
      .sort((a, b) => a.dayNumber - b.dayNumber)[0];

    const transfer = arrival.activities.find((a) => a.category === "transport")!;
    const transferEnds = 9 * 60 + transfer.durationMinutes;

    for (const stop of arrival.activities) {
      if (stop.category === "transport") continue;
      const [hours, minutes] = stop.time.split(":").map(Number);
      expect(hours * 60 + minutes, `${stop.name} at ${stop.time}`).toBeGreaterThanOrEqual(transferEnds);
    }
  });

  it("never books two things at the same time", async () => {
    const trip = await thailand();

    for (const d of trip.days) {
      const spans = d.activities.map((a) => {
        const [hours, minutes] = a.time.split(":").map(Number);
        const start = hours * 60 + minutes;
        return { name: a.name, start, end: start + a.durationMinutes };
      });
      spans.sort((a, b) => a.start - b.start);
      for (let i = 1; i < spans.length; i++) {
        expect(spans[i].start, `${spans[i].name} overlaps ${spans[i - 1].name}`).toBeGreaterThanOrEqual(
          spans[i - 1].end,
        );
      }
    }
  });

  it("never lists the same place twice in one day", async () => {
    const trip = await thailand();
    for (const d of trip.days) {
      const names = d.activities.map((a) => a.name.toLowerCase());
      expect(new Set(names).size, `day ${d.dayNumber}`).toBe(names.length);
    }
  });

  it("gives every day something to do", async () => {
    const trip = await thailand();
    for (const d of trip.days) {
      const stops = d.activities.filter((a) => a.category !== "transport" && a.category !== "food");
      expect(stops.length, `day ${d.dayNumber} has no sights`).toBeGreaterThan(0);
    }
  });

  it("charges the transfer once, not twice", async () => {
    const trip = await thailand();
    const transferActivity = trip.days
      .flatMap((d) => d.activities)
      .find((a) => a.category === "transport")!;

    const segment = Object.values(analyzeTrip(trip).days)
      .flatMap((plan) => plan.segments)
      .find((s) => s.type === "city-transfer")!;

    expect(segment.estimatedCost).toBe(transferActivity.estimatedCost);
  });

  it("labels every travel figure as an estimate", async () => {
    const trip = await thailand();
    const segments = Object.values(analyzeTrip(trip).days).flatMap((plan) => plan.segments);
    expect(segments.length).toBeGreaterThan(0);
    expect(segments.every((s) => s.isEstimated)).toBe(true);
  });
});

/**
 * The engine knows nothing about any particular country — it works off
 * coordinates and durations. These cases exist to prove that: a destination
 * with no mock template of its own goes through exactly the same path.
 */
describe.each([
  {
    label: "Japan, 14 days",
    endDate: "2027-06-25",
    cities: [
      { name: "Tokyo", days: 5, reason: "" },
      { name: "Kyoto", days: 5, reason: "" },
      { name: "Osaka", days: 4, reason: "" },
    ],
    destination: "Japan",
  },
  {
    label: "Italy, 9 days",
    endDate: "2027-06-20",
    cities: [
      { name: "Rome", days: 3, reason: "" },
      { name: "Florence", days: 3, reason: "" },
      { name: "Amalfi Coast", days: 3, reason: "" },
    ],
    destination: "Italy",
  },
  {
    label: "Peru, 6 days (no mock template)",
    endDate: "2027-06-17",
    cities: [
      { name: "Lima", days: 3, reason: "" },
      { name: "Cusco", days: 3, reason: "" },
    ],
    destination: "Peru",
  },
])("$label", ({ endDate, cities, destination }) => {
  async function trip(): Promise<Trip> {
    const itinerary = await generateItinerary(
      { ...draft, destination, endDate },
      { destination, cities, source: "ai", plannerVersion: "test" },
      undefined,
      new MockPlacesProvider(),
    );
    return asTrip(itinerary);
  }

  it("produces days that fit in a day", async () => {
    expect(analyzeTrip(await trip()).infeasibleDayNumbers).toEqual([]);
  });

  it("marks one transfer per city change", async () => {
    const built = await trip();
    const transfers = Object.values(analyzeTrip(built).days).flatMap((p) =>
      p.segments.filter((s) => s.type === "city-transfer"),
    );
    expect(transfers).toHaveLength(cities.length - 1);
  });

  it("never overlaps two activities", async () => {
    for (const d of (await trip()).days) {
      const spans = d.activities
        .map((a) => {
          const [h, m] = a.time.split(":").map(Number);
          return { start: h * 60 + m, end: h * 60 + m + a.durationMinutes };
        })
        .sort((a, b) => a.start - b.start);
      for (let i = 1; i < spans.length; i++) {
        expect(spans[i].start).toBeGreaterThanOrEqual(spans[i - 1].end);
      }
    }
  });
});

describe("a single-city itinerary", () => {
  it("has no city transfer at all", async () => {
    const itinerary = await generateItinerary(
      { ...draft, endDate: "2027-06-14" },
      {
        destination: "Thailand",
        cities: [{ name: "Bangkok", days: 3, reason: "" }],
        source: "ai",
        plannerVersion: "test",
      },
      undefined,
      new MockPlacesProvider(),
    );

    const result = analyzeTrip(asTrip(itinerary));
    const transfers = Object.values(result.days).flatMap((p) =>
      p.segments.filter((s) => s.type === "city-transfer"),
    );
    expect(transfers).toEqual([]);
    expect(result.infeasibleDayNumbers).toEqual([]);
  });
});
