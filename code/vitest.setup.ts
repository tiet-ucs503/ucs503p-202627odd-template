import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

/**
 * jsdom implements neither of these, and both are things a map legitimately
 * uses: `matchMedia` for the OS colour scheme, `ResizeObserver` for
 * re-measuring a container that mounts at zero size. Stubbed here rather than
 * per-test so any component is free to use them.
 *
 * Both stubs report "nothing is happening" — light scheme, no resizes — which
 * is the neutral default a test should start from.
 */
// Guarded: some suites opt into the node environment, where there is no
// `window` at all (see the `@vitest-environment node` docblocks).
if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

// jsdom has no layout, so it never implemented scrolling an element into view.
if (typeof Element !== "undefined" && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

afterEach(() => {
  cleanup();
});
