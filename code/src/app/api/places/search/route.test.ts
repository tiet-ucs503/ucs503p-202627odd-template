// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthError, requireUser } from "@/lib/server/firebase-auth";
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

const mockedUser = vi.mocked(requireUser);
const mockedProvider = vi.mocked(getPlacesProvider);

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mockedUser.mockResolvedValue({ uid: "u1", email: null });
});

const post = (body: unknown) =>
  POST(new NextRequest("http://localhost/api/places/search", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) }));
const search = { query: "temple", destination: "Bangkok", country: "Thailand", type: "attraction" };

describe("the place search route", () => {
  it("refuses a request with no session before searching anything", async () => {
    mockedUser.mockRejectedValue(new AuthError(401, "Invalid or expired session."));
    const provider = new RatedPlacesProvider({ attraction: [ratedPlace("Wat Pho temple", 4.7, 50_000)] });
    mockedProvider.mockReturnValue(provider);
    expect((await post(search)).status).toBe(401);
    expect(provider.searches).toHaveLength(0);
  });

  it("returns real places, best rated first", async () => {
    mockedProvider.mockReturnValue(
      new RatedPlacesProvider({
        attraction: [ratedPlace("temple of the lesser", 4.0, 900), ratedPlace("temple of the best", 4.8, 30_000), ratedPlace("temple of the middle", 4.4, 5_000)],
      }),
    );
    const body = await (await post(search)).json();
    expect(body.places.map((p: { name: string }) => p.name)).toEqual(["temple of the best", "temple of the middle", "temple of the lesser"]);
    expect(body.notice).toBeNull();
    expect(body.places[0].isDemoData).toBe(false);
  });

  it("says so, and offers nothing, when nothing matches: no stand-in list", async () => {
    mockedProvider.mockReturnValue(new RatedPlacesProvider({ attraction: [] }));
    const response = await post(search);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.places).toEqual([]);
    expect(body.notice).toMatch(/No places matched/);
  });

  it.each([
    ["quota-exceeded", 503],
    ["invalid-key", 503],
    ["network", 503],
    ["provider-error", 503],
    ["malformed-response", 502],
  ] as const)("answers a %s failure with %i and a plain message, not demo places", async (code, status) => {
    mockedProvider.mockReturnValue(new RatedPlacesProvider({}, code));
    const response = await post(search);
    const body = await response.json();
    expect(response.status).toBe(status);
    expect(body.code).toBe(code);
    expect(body.places).toBeUndefined();
    expect(body.error).not.toMatch(/demo/i);
    expect(body.error.length).toBeGreaterThan(10);
  });

  it("says place search is not set up when there is no key, and never offers demo places", async () => {
    mockedProvider.mockImplementation(() => {
      throw new PlacesProviderError("missing-key", "GOOGLE_PLACES_API_KEY is not set.");
    });
    const response = await post(search);
    const body = await response.json();
    expect(response.status).toBe(503);
    expect(body.code).toBe("missing-key");
    expect(body.error).toMatch(/isn't set up/);
    expect(body.error).not.toMatch(/demo|GOOGLE_PLACES_API_KEY/i);
  });

  it("rejects a malformed search", async () => {
    expect((await post("not json")).status).toBe(400);
    expect((await post({ query: "x", destination: "Bangkok" })).status).toBe(400);
  });
});
