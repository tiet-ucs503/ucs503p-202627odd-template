import type { PlacesProvider } from "@/lib/services/places/provider";
import { MockPlacesProvider } from "./mock-provider";

/**
 * TEST SUPPORT. Nothing the product runs may import from `@/test-support`
 * (an ESLint rule enforces it). TripEase shows only real places from a live
 * provider; this stands in for one so tests need no network and no key.
 */
export function getMockPlacesProvider(): PlacesProvider {
  return new MockPlacesProvider();
}

export { MockPlacesProvider };
