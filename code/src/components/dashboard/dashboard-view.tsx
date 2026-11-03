"use client";

import { useId, useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { StartCard } from "@/components/dashboard/start-card";
import { TripCard, TripCardSkeleton } from "@/components/dashboard/trip-card";
import { Alert } from "@/components/ui";
import { PLAN_PHOTO, TRAVIS_PHOTO } from "@/lib/destination-photos";
import type { Trip } from "@/types/trip";

function greeting(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/**
 * Everything on the dashboard, given what it needs to show. Loading the trips
 * (and knowing who is signed in) is the page's job; this only draws.
 *
 * `trips` is null while they load, which shows placeholders the shape of the
 * cards so nothing jumps when they arrive.
 */
export function DashboardView({
  firstName,
  trips,
  loadError,
  today,
  hour,
}: {
  firstName?: string;
  trips: Trip[] | null;
  loadError: string | null;
  /** `YYYY-MM-DD`. */
  today: string;
  /** Local hour, 0 to 23, for the greeting. */
  hour: number;
}) {
  const { upcoming, past } = useMemo(() => {
    const list = trips ?? [];
    return {
      // The trip you'll take next comes first; the one you took last comes first.
      upcoming: list.filter((t) => t.endDate >= today).sort((a, b) => a.startDate.localeCompare(b.startDate)),
      past: list.filter((t) => t.endDate < today).sort((a, b) => b.endDate.localeCompare(a.endDate)),
    };
  }, [trips, today]);

  return (
    <div className="flex flex-col gap-12">
      <div className="flex flex-col gap-8">
        <div>
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="text-sm font-medium text-zinc-500"
          >
            {greeting(hour)}
            {firstName ? `, ${firstName}` : ""}
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.05 }}
            className="font-display mt-1 text-4xl font-medium tracking-tight text-zinc-900 sm:text-5xl dark:text-zinc-50"
          >
            Where are you going next?
          </motion.h1>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="grid gap-4 sm:grid-cols-2 sm:gap-5"
        >
          <StartCard
            href="/trips/new"
            title="Plan a trip"
            description="You know where you're going. Answer a few questions and TripEase builds a day-by-day plan you can edit."
            cta="Start planning"
            photo={PLAN_PHOTO}
          />
          <StartCard
            href="/travis"
            title="Ask Travis"
            description="You're still deciding. Talk through where to go and when it usually costs less, then turn an idea into a trip."
            cta="Talk to Travis"
            photo={TRAVIS_PHOTO}
          />
        </motion.div>
      </div>

      {loadError ? <Alert>Couldn&apos;t load your trips: {loadError}</Alert> : null}

      {trips === null ? (
        <div className="grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <TripCardSkeleton key={i} />
          ))}
        </div>
      ) : trips.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {upcoming.length > 0 ? <TripSection title="Your trips" trips={upcoming} today={today} /> : null}
          {past.length > 0 ? <TripSection title="Past trips" trips={past} today={today} /> : null}
        </>
      )}

      <p className="text-xs text-zinc-500">
        Photos from Wikimedia Commons contributors.{" "}
        <Link href="/credits" className="underline underline-offset-4 hover:text-zinc-700 dark:hover:text-zinc-300">
          Photo credits
        </Link>
      </p>
    </div>
  );
}

function TripSection({ title, trips, today }: { title: string; trips: Trip[]; today: string }) {
  const headingId = useId();
  return (
    <section className="flex flex-col gap-5" aria-labelledby={headingId}>
      <h2
        id={headingId}
        className="font-display text-2xl font-medium tracking-tight text-zinc-900 dark:text-zinc-50"
      >
        {title}
      </h2>
      <ul className="grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
        {trips.map((trip, i) => (
          <motion.li
            key={trip.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: Math.min(i * 0.05, 0.3) }}
          >
            <TripCard trip={trip} today={today} />
          </motion.li>
        ))}
      </ul>
    </section>
  );
}

function EmptyState() {
  return (
    <div className="rounded-3xl bg-zinc-100 px-6 py-12 text-center dark:bg-zinc-900">
      <p className="font-display text-2xl font-medium tracking-tight text-zinc-900 dark:text-zinc-50">
        Your trips will live here
      </p>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        Choose one of the two ways to start above. Once a trip is planned, it appears here with its dates and
        budget.
      </p>
    </div>
  );
}
