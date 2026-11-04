/**
 * Light / dark / follow-the-device.
 *
 * Three things have to agree: what the person chose, what the device prefers,
 * and what is painted. The choice lives in `localStorage` (a per-browser
 * convenience, nothing to do with their account), the device preference is a
 * media query, and what is painted is the `data-theme` attribute on `<html>`:
 * the CSS variables in `globals.css` and Tailwind's `dark:` variant both key
 * off it, so nothing else in the app needs to know which theme is on.
 *
 * The attribute is first set by `themeInitScript`, inline in `<head>`, before
 * the page paints. Doing it after hydration would flash the wrong theme.
 */

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "tripease:theme";
export const DARK_QUERY = "(prefers-color-scheme: dark)";

export function parsePreference(raw: unknown): ThemePreference {
  return raw === "light" || raw === "dark" ? raw : "system";
}

export function resolveTheme(preference: ThemePreference, systemIsDark: boolean): ResolvedTheme {
  if (preference === "system") return systemIsDark ? "dark" : "light";
  return preference;
}

/**
 * Runs in `<head>` before first paint, so it can't import anything: this is the
 * same logic as above, as a string. Each step is guarded separately because
 * storage can be blocked while the media query still works.
 */
export const themeInitScript = `(function(){var p=null;try{p=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)})}catch(e){}var d=p==="dark";try{if(p!=="light"&&p!=="dark")d=matchMedia(${JSON.stringify(
  DARK_QUERY,
)}).matches}catch(e){}document.documentElement.setAttribute("data-theme",d?"dark":"light")})()`;

function systemIsDark(): boolean {
  return window.matchMedia(DARK_QUERY).matches;
}

export function readPreference(): ThemePreference {
  if (typeof window === "undefined") return "system";
  try {
    return parsePreference(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    // Storage switched off (some private windows): follow the device.
    return "system";
  }
}

/** Paint whatever the stored preference and the device currently say. */
export function syncTheme(): ResolvedTheme {
  const resolved = resolveTheme(readPreference(), systemIsDark());
  document.documentElement.setAttribute("data-theme", resolved);
  return resolved;
}

const listeners = new Set<() => void>();

/**
 * Subscribing also keeps the page painted correctly: a device switching to
 * dark at sunset, or another tab changing the choice, repaints this one.
 * Components read the theme through this with `useSyncExternalStore`.
 */
export function subscribeToTheme(onChange: () => void): () => void {
  const query = window.matchMedia(DARK_QUERY);
  const handle = () => {
    syncTheme();
    onChange();
  };
  listeners.add(onChange);
  query.addEventListener("change", handle);
  window.addEventListener("storage", handle);
  return () => {
    listeners.delete(onChange);
    query.removeEventListener("change", handle);
    window.removeEventListener("storage", handle);
  };
}

export function setThemePreference(preference: ThemePreference): void {
  try {
    if (preference === "system") window.localStorage.removeItem(THEME_STORAGE_KEY);
    else window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // The choice still applies to this page, it just won't survive a reload.
  }
  if (preference !== "system") {
    document.documentElement.setAttribute("data-theme", preference);
  } else {
    syncTheme();
  }
  listeners.forEach((notify) => notify());
}

/** What is painted right now, which is what the map's tile styling needs. */
export function isDarkPainted(): boolean {
  return document.documentElement.getAttribute("data-theme") === "dark";
}
