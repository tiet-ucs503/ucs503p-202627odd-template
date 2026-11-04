"use client";

import Image from "next/image";
import { useEffect, useState, useSyncExternalStore } from "react";
import { bestMonthsLabel, type Country } from "@/lib/countries";
import { photoForCountry } from "@/lib/destination-photos";
import { cn } from "@/lib/utils";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
function subscribe(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
const prefersReducedMotion = () => window.matchMedia(REDUCED_MOTION).matches;

/**
 * The photograph behind the landing page's first screen: one country at a
 * time, dissolving into the next with a slow push-in, and a small caption
 * saying where you are looking at and when it is usually at its best.
 *
 * Purely atmosphere, so it never takes focus and is not read out; it stands
 * still for anyone who has asked their device for reduced motion, and while
 * the tab is hidden.
 */
export function HeroBackdrop({
  countries,
  intervalMs = 7000,
}: {
  countries: Country[];
  intervalMs?: number;
}) {
  const [index, setIndex] = useState(0);
  const [leaving, setLeaving] = useState<number | null>(null);
  const [hidden, setHidden] = useState(false);
  const reduced = useSyncExternalStore(subscribe, prefersReducedMotion, () => false);
  const running = countries.length > 1 && !hidden && !reduced;

  useEffect(() => {
    const onVisibility = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    if (!running) return;
    const timer = setTimeout(() => {
      setLeaving(index);
      setIndex((index + 1) % countries.length);
    }, intervalMs);
    return () => clearTimeout(timer);
  }, [running, index, intervalMs, countries.length]);

  if (countries.length === 0) return null;
  const current = countries[index];

  return (
    <>
      <div className="absolute inset-0 -z-10 overflow-hidden bg-zinc-900">
        {countries.map((country, i) => {
          const photo = photoForCountry(country.code);
          const active = i === index;
          return (
            <Image
              key={country.code}
              src={photo.src}
              alt={active ? photo.alt : ""}
              fill
              loading={i === 0 ? "eager" : "lazy"}
              fetchPriority={i === 0 ? "high" : "auto"}
              sizes="100vw"
              style={{ objectPosition: photo.position }}
              className={cn(
                "object-cover transition-opacity duration-[1800ms] ease-in-out",
                active ? "opacity-100" : "opacity-0",
                (active || i === leaving) && "animate-push-in",
              )}
            />
          );
        })}
        {/* A dark floor for the text, heavier on the side the headline sits. */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-black/35" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-black/10 to-transparent" />
        {/* On a phone the text sits over the whole photograph, not just its left side. */}
        <div className="absolute inset-0 bg-black/25 lg:hidden" />
      </div>

      <p className="absolute bottom-6 left-6 z-10 hidden text-xs text-white/80 sm:block lg:left-10">
        <span className="font-medium text-white">{current.name}</span>
        <span aria-hidden="true"> · </span>
        usually best {bestMonthsLabel(current)}
      </p>
    </>
  );
}
