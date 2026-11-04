import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  THEME_STORAGE_KEY,
  isDarkPainted,
  parsePreference,
  readPreference,
  resolveTheme,
  setThemePreference,
  subscribeToTheme,
  syncTheme,
  themeInitScript,
} from "@/lib/theme";

function deviceIsDark(dark: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: dark,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
}

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  deviceIsDark(false);
});

afterEach(() => vi.restoreAllMocks());

describe("parsePreference", () => {
  it("accepts the three choices", () => {
    expect(parsePreference("light")).toBe("light");
    expect(parsePreference("dark")).toBe("dark");
    expect(parsePreference("system")).toBe("system");
  });

  it("treats anything else, including nothing, as following the device", () => {
    expect(parsePreference(null)).toBe("system");
    expect(parsePreference("sepia")).toBe("system");
    expect(parsePreference(42)).toBe("system");
  });
});

describe("resolveTheme", () => {
  it("lets an explicit choice beat the device", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("follows the device when asked to", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });
});

describe("the choice", () => {
  it("is remembered and painted", () => {
    setThemePreference("dark");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(readPreference()).toBe("dark");
    expect(isDarkPainted()).toBe(true);
  });

  it("can override a dark device with light", () => {
    deviceIsDark(true);
    setThemePreference("light");
    expect(isDarkPainted()).toBe(false);
  });

  it("goes back to the device when set to system, and forgets the stored choice", () => {
    setThemePreference("light");
    deviceIsDark(true);
    setThemePreference("system");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
    expect(isDarkPainted()).toBe(true);
  });

  it("ignores a corrupt stored value", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "{not a theme");
    expect(readPreference()).toBe("system");
  });

  it("still applies to the page when storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => setThemePreference("dark")).not.toThrow();
    expect(isDarkPainted()).toBe(true);
  });

  it("tells subscribers, so the map restyles", () => {
    const onChange = vi.fn();
    const unsubscribe = subscribeToTheme(onChange);
    setThemePreference("dark");
    expect(onChange).toHaveBeenCalledTimes(1);
    unsubscribe();
    setThemePreference("light");
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

describe("syncTheme", () => {
  it("paints the stored choice", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "dark");
    syncTheme();
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });
});

/** The script can't import `resolveTheme`, so it's a second copy of the rule.
 *  Running it against the same cases keeps the two from drifting apart. */
describe("the first-paint script", () => {
  function run(stored: string | null, dark: boolean): string | null {
    document.documentElement.removeAttribute("data-theme");
    window.localStorage.clear();
    if (stored) window.localStorage.setItem(THEME_STORAGE_KEY, stored);
    deviceIsDark(dark);
    new Function(themeInitScript)();
    return document.documentElement.getAttribute("data-theme");
  }

  it.each([
    [null, false, "light"],
    [null, true, "dark"],
    ["system", true, "dark"],
    ["light", true, "light"],
    ["dark", false, "dark"],
    ["garbage", true, "dark"],
  ] as const)("stored %s, device dark=%s → %s", (stored, dark, expected) => {
    expect(run(stored, dark)).toBe(expected);
    expect(resolveTheme(parsePreference(stored), dark)).toBe(expected);
  });

  it("still follows the device when storage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    deviceIsDark(true);
    new Function(themeInitScript)();
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });
});
