import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getPlacesProvider, placesConfigured } from "@/lib/services/places";
import { PlacesProviderError } from "@/lib/services/places/errors";

beforeEach(() => {
  vi.stubEnv("GOOGLE_PLACES_API_KEY", "");
  vi.stubEnv("PLACES_PROVIDER", "");
});
afterEach(() => vi.unstubAllEnvs());

describe("getPlacesProvider", () => {
  it("is Google Places when there is a key", () => {
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "k");
    expect(getPlacesProvider().name).toBe("google");
    expect(placesConfigured()).toBe(true);
  });

  it("refuses, rather than handing back made-up places, when there is no key", () => {
    expect(() => getPlacesProvider()).toThrow(PlacesProviderError);
    try {
      getPlacesProvider();
    } catch (error) {
      expect((error as PlacesProviderError).code).toBe("missing-key");
    }
    expect(placesConfigured()).toBe(false);
  });

  it("does not offer a mock provider whatever PLACES_PROVIDER says", () => {
    vi.stubEnv("PLACES_PROVIDER", "mock");
    expect(() => getPlacesProvider()).toThrow(/GOOGLE_PLACES_API_KEY/);
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "k");
    expect(getPlacesProvider().name).toBe("google");
  });
});
