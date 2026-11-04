"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { CountryCombobox } from "@/components/ui/country-combobox";
import { Input } from "@/components/ui/input";
import { saveDraft } from "@/lib/draft-storage";
import { toDateInputValue } from "@/lib/date";

function defaultDates() {
  const start = new Date();
  start.setDate(start.getDate() + 30);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { start: toDateInputValue(start), end: toDateInputValue(end) };
}

const labelClass = "text-sm font-medium text-zinc-800 dark:text-zinc-200";

/**
 * The start of a trip, on the landing page, before anyone has signed in. What
 * is entered is kept in the tab (see `draft-storage`) across sign-up, so the
 * wizard opens already filled in.
 */
export function TripPlannerWidget() {
  const router = useRouter();
  const [dates] = useState(defaultDates);
  const [destination, setDestination] = useState("");
  const [startDate, setStartDate] = useState(dates.start);
  const [endDate, setEndDate] = useState(dates.end);
  const [budget, setBudget] = useState("150000");
  const [submitting, setSubmitting] = useState(false);

  const ready = destination !== "" && endDate >= startDate;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!ready) return;
    setSubmitting(true);
    saveDraft({
      destination,
      startDate,
      endDate,
      budget: Number(budget) || 150000,
      currency: "INR",
    });
    router.push("/sign-up");
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="animate-drift-up w-full max-w-md rounded-3xl bg-white/50 p-6 text-zinc-900 shadow-2xl shadow-black/30 [animation-delay:250ms] dark:bg-zinc-900/60 dark:text-zinc-100"
    >
      <h2 className="font-display text-2xl font-medium tracking-tight">
        Plan your trip
      </h2>
      <p className="mt-1 text-sm text-zinc-500">
        Pick a country, your dates and a budget.
      </p>

      <div className="mt-5 flex flex-col gap-4">
        <CountryCombobox
          id="hero-destination"
          label="Where to?"
          value={destination}
          onChange={setDestination}
        />

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="hero-start" className={labelClass}>
              From
            </label>
            <Input
              id="hero-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="hero-end" className={labelClass}>
              To
            </label>
            <Input
              id="hero-end"
              type="date"
              value={endDate}
              min={startDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="hero-budget" className={labelClass}>
            Budget (₹)
          </label>
          <Input
            id="hero-budget"
            type="number"
            min={0}
            inputMode="numeric"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            placeholder="150000"
          />
        </div>

        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={!ready || submitting}
        >
          {submitting ? "Taking you there…" : "Build my itinerary"}
        </Button>
        <p className="text-center text-xs text-zinc-500">
          Free to try. You&apos;ll sign up next, and your trip is saved to your
          account.
        </p>
      </div>
    </form>
  );
}
