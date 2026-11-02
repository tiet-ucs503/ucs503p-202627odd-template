"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Compass } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { StartCard } from "@/components/dashboard/start-card";
import { TripCard } from "@/components/dashboard/trip-card";
import { Alert } from "@/components/ui";
import { subscribeToOwnerTrips } from "@/lib/services/trips";
import { toDateInputValue } from "@/lib/date";
import type { Trip } from "@/types/trip";

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [trips, setTrips] = useState<Trip[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    return subscribeToOwnerTrips(
      user.uid,
      (next) => {
        setTrips(next);
        setLoadError(null);
      },
      (err) => setLoadError(err.message),
    );
  }, [user]);

  const today = toDateInputValue(new Date());
  const { upcoming, past } = useMemo(() => {
    const list = trips ?? [];
    return {
      upcoming: list.filter((t) => t.endDate >= today),
      past: list.filter((t) => t.endDate < today),
    };
  }, [trips, today]);

  const firstName = user?.displayName?.split(" ")[0];

  return (
    <div className="flex flex-col gap-10">
      <div>
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-sm font-medium text-zinc-500"
        >
          {greeting()}
          {firstName ? `, ${firstName}` : ""}
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
          className="font-display mt-1 text-3xl font-medium tracking-tight text-zinc-900 dark:text-zinc-50"
        >
          Where are you going next?
        </motion.h1>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="grid gap-4 sm:grid-cols-2"
      >
        <StartCard
          href="/trips/new"
          title="Plan a trip"
          description="You know where you're going. Answer a few questions and TripEase builds a day-by-day plan you can edit."
          cta="Start planning"
        />
        <StartCard
          href="/travis"
          title="Ask Travis"
          description="You're still deciding. Talk through where to go and when it usually costs less, then turn an idea into a trip."
          cta="Talk to Travis"
        />
      </motion.div>

      {loadError ? <Alert>Couldn&apos;t load your trips: {loadError}</Alert> : null}

      {trips === null ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-44 animate-pulse rounded-2xl border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900"
            />
          ))}
        </div>
      ) : trips.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {upcoming.length > 0 ? (
            <TripSection title="Your trips" trips={upcoming} />
          ) : null}
          {past.length > 0 ? <TripSection title="Past trips" trips={past} /> : null}
        </>
      )}
    </div>
  );
}

function TripSection({ title, trips }: { title: string; trips: Trip[] }) {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">{title}</h2>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {trips.map((trip, i) => (
          <motion.li
            key={trip.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: Math.min(i * 0.05, 0.3) }}
          >
            <TripCard trip={trip} />
          </motion.li>
        ))}
      </ul>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-zinc-300 py-20 text-center dark:border-zinc-700">
      <Compass className="h-10 w-10 text-orange-500" />
      <p className="text-lg font-medium text-zinc-900 dark:text-zinc-100">No trips yet.</p>
      <p className="max-w-xs text-sm text-zinc-500">
        Choose how to start above, and your trip will appear here once it&apos;s planned.
      </p>
    </div>
  );
}
