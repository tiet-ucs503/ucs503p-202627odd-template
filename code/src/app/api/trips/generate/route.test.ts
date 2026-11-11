// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireUser } from "@/lib/server/firebase-auth";
import { getPlacesProvider } from "@/lib/services/places";
import { PlacesProviderError } from "@/lib/services/places/errors";
import { ratedPlace, RatedPlacesProvider } from "@/test-support/places/rated-provider";
import { POST } from "./route";

vi.mock("@/lib/server/firebase-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server/firebase-auth")>();
  return { ...actual, requireUser: vi.fn() };
});
vi.mock("@/lib/services/places", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/services/places")>();
  return { ...actual, getPlacesProvider: vi.fn() };
});
// No model: the rule-based planner splits the trip, which is all these tests need.
vi.mock("@/lib/services/ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/services/ai")>();
  return { ...actual, getAIProvider: () => null };
});

const mockedUser = vi.mocked(requireUser);
const mockedProvider = vi.mocked(getPlacesProvider);

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  mockedUser.mockResolvedValue({ uid: "u1", email: null });
});

const trip = {
  destination: "Thailand",
  startDate: "2027-03-01",
  endDate: "2027-03-04",
  budget: 150_000,
  currency: "INR",
  travelers: 2,
  travelerType: "couple",
  preferences: ["culture"],
};

const post = (body: unknown = trip) =>
  POST(new NextRequest("http://localhost/api/trips/generate", { method: "POST", body: JSON.stringify(body) }));

const goodResults = () =>
  new RatedPlacesProvider({
    hotel: [ratedPlace("Fine Hotel", 4.6, 4_000)],
    attraction: Array.from({ length: 12 }, (_, i) => ratedPlace(`Sight ${i}`, 4.0 + i / 20, 1_000 + i * 500)),
    restaurant: Array.from({ length: 9 }, (_, i) => ratedPlace(`Restaurant ${i}`, 4.0 + i / 20, 900)),
    nightlife: [],
  });

describe("generating a trip", () => {
  it("builds it from the real places the provider returns", async () => {
    mockedProvider.mockReturnValue(goodResults());
    const response = await post();
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.itinerary.cities.length).toBeGreaterThan(0);
    const places = body.itinerary.days.flatMap((d: { activities: { name: string; isDemoData: boolean }[] }) => d.activities);
    expect(places.some((a: { isDemoData: boolean }) => a.isDemoData)).toBe(false);
    expect(JSON.stringify(body)).not.toMatch(/\(demo\)|Central Hotel/);
  });

  it.each([
    ["missing-key", 503, /isn't set up/],
    ["quota-exceeded", 503, /usage limit/],
    ["network", 503, /Couldn't reach/],
    ["malformed-response", 502, /unexpected response/],
  ] as const)("tells the traveller plainly when places fail (%s), and builds no trip", async (code, status, message) => {
    mockedProvider.mockImplementation(() => {
      throw new PlacesProviderError(code, "x");
    });
    const response = await post();
    const body = await response.json();
    expect(response.status).toBe(status);
    expect(body.error).toMatch(message);
    expect(body.itinerary).toBeUndefined();
    expect(body.error).not.toMatch(/demo/i);
  });

  it("says so when a city has no hotels in the places service, with a 422", async () => {
    mockedProvider.mockReturnValue(new RatedPlacesProvider({ hotel: [], attraction: [ratedPlace("Sight", 4.5, 900)] }));
    const response = await post();
    expect(response.status).toBe(422);
    expect((await response.json()).code).toBe("no-results");
  });

  it("does not leak what the provider said", async () => {
    mockedProvider.mockImplementation(() => {
      throw new PlacesProviderError("provider-error", "upstream said: key AIza-secret in project 12345");
    });
    const text = JSON.stringify(await (await post()).json());
    expect(text).not.toMatch(/AIza|12345|upstream/);
  });
});
