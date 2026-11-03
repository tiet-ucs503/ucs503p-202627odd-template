"use client";

import { useLayoutEffect, useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { isDarkPainted, setThemePreference, subscribeToTheme, syncTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

/**
 * Keeps `data-theme` right for the life of the page. The inline script in
 * `<head>` sets it on first load; this covers the two things it can't: the
 * device changing theme while the page is open, and React's development
 * double-mount, which resets attributes on `<html>` back to what JSX declares.
 * A no-op in production beyond the subscription.
 */
export function ThemeSync() {
  useLayoutEffect(() => {
    syncTheme();
    return subscribeToTheme(() => {});
  }, []);
  return null;
}

/**
 * One button that flips between light and dark. Until someone presses it, the
 * page follows their device; after that it keeps what they chose. It shows the
 * theme you'd get (a moon in light mode), and its label says so in words.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const dark = useSyncExternalStore(subscribeToTheme, isDarkPainted, () => false);
  const Icon = dark ? Sun : Moon;
  const label = dark ? "Switch to light theme" : "Switch to dark theme";

  return (
    <button
      type="button"
      onClick={() => setThemePreference(dark ? "light" : "dark")}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-200 text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100",
        className,
      )}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}
