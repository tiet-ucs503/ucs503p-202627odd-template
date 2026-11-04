"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { saveDraft } from "@/lib/draft-storage";
import { subscribeToOwnerTrips } from "@/lib/services/trips";
import { toDateInputValue } from "@/lib/date";
import type { Trip } from "@/types/trip";

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
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

  return (
    <DashboardView
      firstName={user?.displayName?.split(" ")[0]}
      trips={trips}
      loadError={loadError}
      today={toDateInputValue(new Date())}
      hour={new Date().getHours()}
      onPlanCountry={(country) => {
        // The wizard opens with this country already chosen.
        saveDraft({ destination: country.name });
        router.push("/trips/new");
      }}
    />
  );
}
