"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent, type PointerEvent } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { bestMonthsLabel, type Country } from "@/lib/countries";
import { photoForCountry } from "@/lib/destination-photos";
import { cn } from "@/lib/utils";

const DEFAULT_INTERVAL_MS = 6500;
/** How far a finger has to travel before it counts as a swipe, not a tap. */
const SWIPE_PX = 48;

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
function subscribeToMotionPreference(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
const prefersReducedMotion = () => window.matchMedia(REDUCED_MOTION).matches;

/**
 * A full-bleed carousel of destinations: one photograph at a time, the country
 * over it, and a way to start planning it.
 *
 * It moves on its own, and so it also has to be stoppable: there is a pause
 * button, it holds still while the pointer or keyboard focus is on it or the
 * tab is hidden, and it does not start moving at all for anyone who has asked
 * their device for reduced motion. While it is moving it stays quiet for
 * screen readers; once it is held still it announces each slide as it changes
 * (the ARIA carousel pattern).
 */
export function DestinationSlides({
  countries,
  onPlan,
  label = "Destinations",
  intervalMs = DEFAULT_INTERVAL_MS,
  className,
}: {
  countries: Country[];
  onPlan: (country: Country) => void;
  /** Names the carousel for assistive technology. */
  label?: string;
  intervalMs?: number;
  className?: string;
}) {
  const count = countries.length;
  const [index, setIndex] = useState(0);
  // The slide just left, which keeps its push-in running while it fades out.
  const [leaving, setLeaving] = useState<number | null>(null);
  const [userPaused, setUserPaused] = useState(false);
  const [held, setHeld] = useState(false);
  const [tabHidden, setTabHidden] = useState(false);
  const reducedMotion = useSyncExternalStore(subscribeToMotionPreference, prefersReducedMotion, () => false);
  const swipeStart = useRef<number | null>(null);

  const autoplay = count > 1 && !userPaused && !held && !tabHidden && !reducedMotion;

  const go = useCallback(
    (next: number) => {
      if (count === 0) return;
      const target = ((next % count) + count) % count;
      if (target === index) return;
      setLeaving(index);
      setIndex(target);
    },
    [count, index],
  );

  // Move on after a pause. Re-armed on every slide change, so a manual jump
  // gets a full interval too instead of being cut short by the old timer.
  useEffect(() => {
    if (!autoplay) return;
    const timer = setTimeout(() => go(index + 1), intervalMs);
    return () => clearTimeout(timer);
  }, [autoplay, index, intervalMs, go]);

  useEffect(() => {
    const onVisibility = () => setTabHidden(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  if (count === 0) return null;

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      go(index + 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      go(index - 1);
    }
  }

  function handlePointerDown(event: PointerEvent<HTMLElement>) {
    swipeStart.current = event.clientX;
  }

  function handlePointerUp(event: PointerEvent<HTMLElement>) {
    if (swipeStart.current === null) return;
    const travelled = event.clientX - swipeStart.current;
    swipeStart.current = null;
    if (Math.abs(travelled) >= SWIPE_PX) go(travelled < 0 ? index + 1 : index - 1);
  }

  return (
    <section
      aria-roledescription="carousel"
      aria-label={label}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={() => setHeld(false)}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => (swipeStart.current = null)}
      className={cn(
        "group/slides relative isolate overflow-hidden rounded-3xl bg-zinc-900 text-white",
        "aspect-[4/5] sm:aspect-[16/9] lg:aspect-[21/9]",
        className,
      )}
    >
      {countries.map((country, i) => {
        const photo = photoForCountry(country.code);
        const active = i === index;
        return (
          <div
            key={country.code}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${count}: ${country.name}`}
            aria-hidden={!active}
            className={cn(
              "absolute inset-0 transition-opacity duration-1000 ease-in-out",
              active ? "z-10 opacity-100" : "pointer-events-none opacity-0",
            )}
          >
            <Image
              src={photo.src}
              alt={active ? photo.alt : ""}
              fill
              loading={i <= 1 ? "eager" : "lazy"}
              fetchPriority={i === 0 ? "high" : "auto"}
              sizes="(min-width: 1152px) 1152px, 100vw"
              style={{ objectPosition: photo.position }}
              // The push-in starts when a slide becomes current and carries on while it fades out.
              className={cn("object-cover", (active || i === leaving) && "animate-push-in")}
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/10 sm:bg-gradient-to-r sm:from-black/70 sm:via-black/25 sm:to-transparent"
            />

            {active ? (
              <div className="absolute inset-x-0 bottom-0 flex flex-col items-start gap-3 p-6 pb-16 sm:inset-y-0 sm:max-w-xl sm:justify-center sm:p-10 sm:pb-10 lg:p-14">
                <p className="animate-drift-up text-xs font-medium tracking-wide text-white/80 [animation-delay:60ms]">
                  {country.region} · Best {bestMonthsLabel(country)}
                </p>
                <h3 className="animate-drift-up font-display text-4xl font-medium leading-none tracking-tight sm:text-5xl lg:text-6xl [animation-delay:120ms]">
                  {country.name}
                </h3>
                <p className="animate-drift-up max-w-sm text-sm leading-relaxed text-white/85 sm:text-base [animation-delay:200ms]">
                  {country.tagline}
                </p>
                <button
                  type="button"
                  onClick={() => onPlan(country)}
                  className="animate-drift-up mt-2 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-medium text-zinc-900 transition-colors hover:bg-orange-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white [animation-delay:280ms]"
                >
                  Plan {country.name}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            ) : null}
          </div>
        );
      })}

      {count > 1 ? (
        <>
          <div className="absolute inset-x-6 bottom-5 z-20 flex items-center gap-3 sm:inset-x-10 lg:inset-x-14">
            <ol className="flex flex-1 items-center gap-1.5" aria-label="Choose a slide">
              {countries.map((country, i) => (
                <li key={country.code} className="flex-1">
                  <button
                    type="button"
                    onClick={() => go(i)}
                    aria-label={`Show ${country.name}`}
                    aria-current={i === index ? "true" : undefined}
                    className="group/dot flex h-6 w-full items-center focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white"
                  >
                    <span className="relative block h-[3px] w-full overflow-hidden rounded-full bg-white/30">
                      <span
                        // Past slides are full, the current one fills as the clock runs, the rest are empty.
                        key={i === index ? `fill-${index}` : `static-${i}`}
                        className={cn(
                          "absolute inset-0 origin-left rounded-full bg-white",
                          i < index && "scale-x-100",
                          i > index && "scale-x-0",
                          i === index && autoplay && "animate-[slide-progress_linear_both]",
                          i === index && !autoplay && "scale-x-100",
                        )}
                        style={i === index && autoplay ? { animationDuration: `${intervalMs}ms` } : undefined}
                      />
                    </span>
                  </button>
                </li>
              ))}
            </ol>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => go(index - 1)}
                aria-label="Previous destination"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm transition-colors hover:bg-white/30 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => go(index + 1)}
                aria-label="Next destination"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm transition-colors hover:bg-white/30 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white"
              >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setUserPaused((paused) => !paused)}
                aria-label={userPaused ? "Resume slideshow" : "Pause slideshow"}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm transition-colors hover:bg-white/30 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white"
              >
                {userPaused ? <Play className="h-4 w-4" aria-hidden="true" /> : <Pause className="h-4 w-4" aria-hidden="true" />}
              </button>
            </div>
          </div>

          {/* Quiet while it moves on its own; announces each slide once it is held still. */}
          <p className="sr-only" aria-live={autoplay ? "off" : "polite"} aria-atomic="true">
            {countries[index].name}, {index + 1} of {count}
          </p>
        </>
      ) : null}
    </section>
  );
}
