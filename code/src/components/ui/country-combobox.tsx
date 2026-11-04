"use client";

import Image from "next/image";
import { useEffect, useId, useMemo, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { COUNTRIES, bestMonthsLabel, normalise, searchCountries, type Country } from "@/lib/countries";
import { photoForCountry } from "@/lib/destination-photos";
import { cn } from "@/lib/utils";

const MAX_RESULTS = 8;

/**
 * Where to? A search box that only ever produces one of the supported
 * countries.
 *
 * `value` is the chosen country's name, or "" when nothing valid is chosen:
 * typing something that isn't a country clears it, so a form built on this can
 * never submit a destination the app doesn't support. A full name typed out
 * ("japan") counts as chosen straight away, without needing to click it.
 *
 * The list refreshes a moment after typing stops (`debounceMs`), which keeps
 * it from flickering on every keystroke. Pressing Enter in that gap still
 * searches what is typed *now*, never the stale list on screen.
 *
 * Follows the ARIA 1.2 combobox pattern: focus stays in the input, the
 * highlighted option is announced through `aria-activedescendant`, and the
 * number of matches is announced politely.
 */
export function CountryCombobox({
  id,
  label,
  value,
  onChange,
  placeholder = "Search 45 countries",
  autoFocus = false,
  debounceMs = 180,
  hint,
  error,
  hideLabel = false,
  labelClassName,
  className,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (country: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  debounceMs?: number;
  hint?: string;
  error?: string | null;
  hideLabel?: boolean;
  labelClassName?: string;
  className?: string;
}) {
  const listId = useId();
  const [text, setText] = useState(value);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  // The last country actually chosen, so abandoning an edit can bring it back.
  const [committed, setCommitted] = useState(value);

  // Follow the parent when it sets a country itself (a "popular" chip, or a draft).
  const [seenValue, setSeenValue] = useState(value);
  if (value !== seenValue) {
    setSeenValue(value);
    if (value) setCommitted(value);
    if (value && normalise(value) !== normalise(text)) {
      setText(value);
      setQuery("");
    }
  }

  // The list follows the text, a beat behind it.
  useEffect(() => {
    const timer = setTimeout(() => setQuery(text), debounceMs);
    return () => clearTimeout(timer);
  }, [text, debounceMs]);

  // With a country chosen and the text untouched, show the whole list rather
  // than a list of one, so changing your mind is one click.
  const untouched = value !== "" && normalise(text) === normalise(value);
  const results = useMemo(() => searchCountries(untouched ? "" : query, MAX_RESULTS), [untouched, query]);
  const settled = untouched || query === text;
  const showEmpty = open && settled && results.length === 0 && text.trim() !== "";

  function choose(country: Country) {
    setText(country.name);
    setQuery("");
    setOpen(false);
    setCommitted(country.name);
    onChange(country.name);
  }

  function handleType(next: string) {
    setText(next);
    setOpen(true);
    setActive(0);
    const exact = COUNTRIES.find((country) => normalise(country.name) === normalise(next));
    // A complete name is a choice; anything else is not one yet.
    if (exact) setCommitted(exact.name);
    onChange(exact ? exact.name : "");
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    const count = results.length;
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (!open) setOpen(true);
        else if (count > 0) setActive((i) => (i + 1) % count);
        break;
      case "ArrowUp":
        event.preventDefault();
        if (!open) setOpen(true);
        else if (count > 0) setActive((i) => (i - 1 + count) % count);
        break;
      case "Enter": {
        if (!open) return;
        // Search what is typed now, not the list the debounce hasn't refreshed yet.
        const live = settled ? results : searchCountries(text, MAX_RESULTS);
        const pick = live[Math.min(active, live.length - 1)];
        if (pick) {
          event.preventDefault();
          choose(pick);
        }
        break;
      }
      case "Escape":
        if (open) {
          event.preventDefault();
          setOpen(false);
          // Abandoning an edit puts the earlier choice back.
          if (committed && value !== committed) {
            setText(committed);
            onChange(committed);
          }
        }
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  }

  const activeId = open && results[active] ? `${listId}-${active}` : undefined;
  // Text left in the box that isn't a country is an error, but only once the
  // person has stopped typing: scolding someone halfway through "Switz" helps no one.
  const unrecognised = !open && value === "" && text.trim() !== "";
  const shownError =
    error ?? (unrecognised ? `Choose a country from the list. TripEase plans trips to ${COUNTRIES.length} countries.` : null);
  const describedBy = shownError ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className={cn("relative flex flex-col gap-1.5", className)}>
      <label
        htmlFor={id}
        className={cn(
          hideLabel ? "sr-only" : "text-sm font-medium text-zinc-800 dark:text-zinc-200",
          labelClassName,
        )}
      >
        {label}
      </label>

      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
          aria-hidden="true"
        />
        <input
          id={id}
          type="text"
          role="combobox"
          autoComplete="off"
          autoCapitalize="words"
          spellCheck={false}
          autoFocus={autoFocus}
          aria-expanded={open && results.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeId}
          aria-invalid={shownError ? true : undefined}
          aria-describedby={describedBy}
          placeholder={placeholder}
          value={text}
          onChange={(event) => handleType(event.target.value)}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={handleKeyDown}
          className={cn(
            "h-11 w-full rounded-xl border bg-white pl-10 pr-10 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus-visible:ring-2 dark:bg-zinc-900 dark:text-zinc-100",
            shownError
              ? "border-red-400 focus-visible:border-red-500 focus-visible:ring-red-500/25"
              : "border-zinc-300 focus-visible:border-orange-500 focus-visible:ring-orange-500/25 dark:border-zinc-700",
          )}
        />
        <ChevronDown
          className={cn(
            "pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 transition-transform",
            open && "rotate-180",
          )}
          aria-hidden="true"
        />
      </div>

      {open && results.length > 0 ? (
        <ul
          id={listId}
          role="listbox"
          aria-label={`${label} suggestions`}
          // Keep focus in the input while a mouse picks an option.
          onMouseDown={(event) => event.preventDefault()}
          className="absolute left-0 right-0 top-full z-40 mt-2 max-h-[22rem] overflow-y-auto overscroll-contain rounded-2xl border border-zinc-200 bg-white p-1.5 shadow-2xl shadow-zinc-900/10 dark:border-zinc-800 dark:bg-zinc-900"
        >
          {results.map((country, index) => {
            const photo = photoForCountry(country.code);
            const isActive = index === active;
            const isChosen = country.name === value;
            return (
              <li
                key={country.code}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={isChosen}
                onClick={() => choose(country)}
                onMouseMove={() => setActive(index)}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2",
                  isActive && "bg-orange-50 dark:bg-zinc-800",
                )}
              >
                <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-zinc-200 dark:bg-zinc-800">
                  <Image
                    src={photo.src}
                    alt=""
                    fill
                    sizes="44px"
                    style={{ objectPosition: photo.position }}
                    className="object-cover"
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    {country.name}
                  </span>
                  <span className="block truncate text-xs text-zinc-500">
                    {country.region} · Best {bestMonthsLabel(country)}
                  </span>
                </span>
                {isChosen ? <Check className="h-4 w-4 shrink-0 text-orange-600" aria-hidden="true" /> : null}
              </li>
            );
          })}
        </ul>
      ) : null}

      {showEmpty ? (
        <p
          role="status"
          className="absolute left-0 right-0 top-full z-40 mt-2 rounded-2xl border border-zinc-200 bg-white px-4 py-4 text-sm text-zinc-600 shadow-2xl shadow-zinc-900/10 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400"
        >
          No match for &ldquo;{text.trim()}&rdquo;. TripEase plans trips to {COUNTRIES.length} countries, so try a
          country or a well-known city in one.
        </p>
      ) : null}

      <p className="sr-only" aria-live="polite">
        {open && settled ? `${results.length} ${results.length === 1 ? "country" : "countries"} found` : ""}
      </p>

      {shownError ? (
        <p id={`${id}-error`} className="text-xs text-red-600 dark:text-red-400">
          {shownError}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-zinc-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
