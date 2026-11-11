import type { AgentTrip } from "@/types/trip-agent";

/**
 * A short fingerprint of the parts of a trip an edit can change.
 *
 * A proposal is worked out against one particular trip. If the trip changes
 * before the traveller confirms (they dragged something, or edited it in
 * another tab), applying the proposal would overwrite that work with a plan
 * based on the old trip. Comparing fingerprints catches it, and the page says
 * "this trip has changed, ask again" instead.
 *
 * Not a security measure, just a change detector, so a fast non-cryptographic
 * hash is plenty.
 */
export function tripVersion(trip: Pick<AgentTrip, "endDate" | "cities" | "days" | "budget">): string {
  const shape = JSON.stringify({
    end: trip.endDate,
    cities: trip.cities.map((c) => [c.id, c.name, c.order, c.dayCount, c.hotel.name, c.hotel.pricePerNight]),
    days: trip.days.map((d) => [
      d.id,
      d.dayNumber,
      d.cityId,
      d.activities.map((a) => [a.id, a.name, a.time, a.durationMinutes, a.estimatedCost]),
    ]),
    budget: [trip.budget.total, trip.budget.estimatedTotal],
  });

  // cyrb53: two 32-bit lanes mixed into one 53-bit number.
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < shape.length; i++) {
    const code = shape.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}
