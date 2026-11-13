import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  type DocumentData,
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { COLLECTIONS } from "@/lib/collections";
import type { BudgetBreakdown } from "@/types/budget";
import type { City, TripDay } from "@/types/itinerary";
import type { CityPlan } from "@/types/planning";
import type { FlightQuote } from "@/types/flights";
import type { GeneratedItinerary, Trip, TripDraftInput } from "@/types/trip";

/**
 * The single place Firestore is touched for trip data. Components call these
 * functions; they never build queries themselves. Keeping data access here is
 * what makes the vendor-lock-in surface small enough to reason about.
 */

function tsToDate(value: unknown): Date {
  return value instanceof Timestamp ? value.toDate() : new Date(0);
}

const tripConverter: FirestoreDataConverter<Trip> = {
  toFirestore(trip): DocumentData {
    const data: Record<string, unknown> = { ...trip };
    delete data.id;
    return data;
  },
  fromFirestore(snapshot: QueryDocumentSnapshot): Trip {
    const data = snapshot.data();
    return {
      id: snapshot.id,
      ownerId: data.ownerId,
      status: data.status ?? "ready",
      destination: data.destination,
      title: data.title,
      startDate: data.startDate,
      endDate: data.endDate,
      dayCount: data.dayCount,
      currency: data.currency ?? "INR",
      travelers: data.travelers ?? 1,
      travelerType: data.travelerType ?? "solo",
      preferences: data.preferences ?? [],
      cities: (data.cities ?? []) as City[],
      days: (data.days ?? []) as TripDay[],
      budget: data.budget as BudgetBreakdown,
      planning: (data.planning ?? null) as CityPlan | null,
      // Left undefined for trips saved before quotes existed, so they can be told apart.
      flights: data.flights === undefined ? undefined : ((data.flights ?? null) as FlightQuote | null),
      createdAt: tsToDate(data.createdAt),
      updatedAt: tsToDate(data.updatedAt),
    };
  },
};

const tripsCollection = () =>
  collection(db, COLLECTIONS.trips).withConverter(tripConverter);
const tripDoc = (tripId: string) =>
  doc(db, COLLECTIONS.trips, tripId).withConverter(tripConverter);

function requireUid(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Not signed in.");
  return uid;
}

/** Persist a freshly generated itinerary as a new trip owned by the current user. */
export async function saveGeneratedTrip(
  draft: TripDraftInput,
  itinerary: GeneratedItinerary,
  planning?: CityPlan | null,
): Promise<string> {
  const uid = requireUid();
  const ref = doc(collection(db, COLLECTIONS.trips));
  await setDoc(ref, {
    ownerId: uid,
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
    // Only the structured decision — never prompts or raw model output.
    planning: planning ?? null,
    flights: itinerary.flights ?? null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function getTrip(tripId: string): Promise<Trip | null> {
  const snapshot = await getDoc(tripDoc(tripId));
  return snapshot.exists() ? snapshot.data() : null;
}

export async function listTripsForOwner(uid: string): Promise<Trip[]> {
  const snapshot = await getDocs(
    query(
      tripsCollection(),
      where("ownerId", "==", uid),
      orderBy("createdAt", "desc"),
    ),
  );
  return snapshot.docs.map((d) => d.data());
}

/** Realtime list of the signed-in user's trips. Returns an unsubscribe fn. */
export function subscribeToOwnerTrips(
  uid: string,
  onData: (trips: Trip[]) => void,
  onError?: (error: Error) => void,
): () => void {
  return onSnapshot(
    query(
      tripsCollection(),
      where("ownerId", "==", uid),
      orderBy("createdAt", "desc"),
    ),
    (snapshot) => onData(snapshot.docs.map((d) => d.data())),
    (error) => onError?.(error),
  );
}

/** Realtime single trip. Returns an unsubscribe fn. */
export function subscribeToTrip(
  tripId: string,
  onData: (trip: Trip | null) => void,
  onError?: (error: Error) => void,
): () => void {
  return onSnapshot(
    tripDoc(tripId),
    (snapshot) => onData(snapshot.exists() ? snapshot.data() : null),
    (error) => onError?.(error),
  );
}

export function renameTrip(tripId: string, title: string): Promise<void> {
  return updateDoc(doc(db, COLLECTIONS.trips, tripId), {
    title: title.trim(),
    updatedAt: serverTimestamp(),
  });
}

export function deleteTrip(tripId: string): Promise<void> {
  return deleteDoc(doc(db, COLLECTIONS.trips, tripId));
}

/**
 * Replace the trip's itinerary (days) and budget in one write. Every
 * itinerary edit (add/edit/delete/reorder activity, change hotel) goes
 * through this after recomputing the new `days`/`cities`/`budget` client-side
 * with `@/lib/services/budget-engine`, so a single round trip keeps the
 * itinerary and its budget consistent.
 */
export function updateTripItinerary(
  tripId: string,
  patch: {
    cities?: City[];
    days?: TripDay[];
    budget?: BudgetBreakdown;
    planning?: CityPlan;
    /** The flight quote behind the budget's flight cost; null when flights are left out. */
    flights?: FlightQuote | null;
    /** Changing the trip's length moves its last day and its day count. */
    endDate?: string;
    dayCount?: number;
  },
): Promise<void> {
  return updateDoc(doc(db, COLLECTIONS.trips, tripId), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}
