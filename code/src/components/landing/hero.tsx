"use client";

import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { countryByCode, type Country } from "@/lib/countries";
import { HeroBackdrop } from "./hero-backdrop";
import { TripPlannerWidget } from "./trip-planner-widget";

/** The places the first screen drifts through, chosen for how they photograph. */
const BACKDROP_CODES = ["JP", "IS", "MV", "IT", "PE", "NZ"];
const BACKDROP: Country[] = BACKDROP_CODES.map((code) => countryByCode(code)).filter((c): c is Country => c !== null);

/**
 * The first screen: a photograph of somewhere you would like to be, what the
 * product does in one sentence, and the form that starts a trip. The header
 * sits on the photograph so nothing frames it away.
 */
export function Hero() {
  return (
    <section className="relative isolate flex min-h-[100svh] flex-col text-white">
      <HeroBackdrop countries={BACKDROP} />

      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <span className="font-display text-xl font-semibold tracking-tight">
          Trip<span className="text-orange-400">Ease</span>
        </span>
        <nav aria-label="Account" className="flex items-center gap-2 text-sm sm:gap-3">
          <ThemeToggle onPhoto />
          <Link href="/sign-in" className="rounded-full px-4 py-2 font-medium text-white/90 transition-colors hover:bg-white/15">
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="rounded-full bg-white px-4 py-2 font-medium text-zinc-900 transition-colors hover:bg-orange-50"
          >
            Get started
          </Link>
        </nav>
      </header>

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-start justify-center gap-10 px-6 pb-20 pt-6 lg:flex-row lg:items-center lg:justify-between lg:gap-16">
        <div className="max-w-xl">
          <h1 className="animate-drift-up font-display text-5xl leading-[1.02] font-medium tracking-tight sm:text-6xl lg:text-7xl">
            Tell us where.
            <br />
            We&apos;ll plan every day.
          </h1>
          <p className="animate-drift-up mt-6 max-w-md text-lg leading-relaxed text-white/85 [animation-delay:120ms]">
            Choose a country, your dates and a budget. TripEase builds a day-by-day itinerary with places to stay
            and eat and a running cost, and you can change any of it.
          </p>
          <div className="animate-drift-up mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-white/80 [animation-delay:200ms]">
            <a href="#countries" className="underline decoration-white/40 underline-offset-4 transition-colors hover:text-white">
              Browse the countries
            </a>
            <a href="#how-it-works" className="underline decoration-white/40 underline-offset-4 transition-colors hover:text-white">
              How it works
            </a>
          </div>
        </div>

        <TripPlannerWidget />
      </div>
    </section>
  );
}
