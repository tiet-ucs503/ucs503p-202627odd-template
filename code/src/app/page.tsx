"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { ItineraryPreview } from "@/components/landing/itinerary-preview";
import { BudgetPreview } from "@/components/landing/budget-preview";
import { Features } from "@/components/landing/features";
import { FinalCta } from "@/components/landing/final-cta";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace("/dashboard");
    }
  }, [loading, user, router]);

  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <span className="font-display text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Trip<span className="text-orange-600">Ease</span>
        </span>
        <nav className="flex items-center gap-3 text-sm">
          <ThemeToggle />
          <Link
            href="/sign-in"
            className="rounded-full px-4 py-2 font-medium text-zinc-700 hover:bg-zinc-900/5 dark:text-zinc-300 dark:hover:bg-white/5"
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="rounded-full bg-zinc-900 px-4 py-2 font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Get started
          </Link>
        </nav>
      </header>

      <Hero />
      <HowItWorks />
      <ItineraryPreview />
      <BudgetPreview />
      <Features />
      <FinalCta />

      <footer className="border-t border-zinc-200 py-8 text-center text-xs text-zinc-500 dark:border-zinc-800">
        TripEase — a student project. Prices and hotel/restaurant names are demo data unless linked to a source.
      </footer>
    </div>
  );
}
