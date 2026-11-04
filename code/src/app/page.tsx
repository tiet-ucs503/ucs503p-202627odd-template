"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { BudgetPreview } from "@/components/landing/budget-preview";
import { CountryRail } from "@/components/landing/country-rail";
import { FinalCta } from "@/components/landing/final-cta";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { ItineraryPreview } from "@/components/landing/itinerary-preview";
import { WhyItHoldsUp } from "@/components/landing/why-it-holds-up";
import { saveDraft } from "@/lib/draft-storage";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace("/dashboard");
    }
  }, [loading, user, router]);

  // `w-full` on the sections: in a flex column a `mx-auto` block otherwise sizes to its
  // content, and the country rail's scroller is as wide as all its cards.
  return (
    <div className="flex flex-1 flex-col [&>section]:w-full">
      <Hero />
      <CountryRail
        onPick={(country) => {
          // Same hand-off as the form above: remember the choice, sign up, and
          // the wizard opens with this country already chosen.
          saveDraft({ destination: country.name });
          router.push("/sign-up");
        }}
      />
      <HowItWorks />
      <ItineraryPreview />
      <BudgetPreview />
      <WhyItHoldsUp />
      <FinalCta />

      <footer className="border-t border-zinc-200 py-8 text-center text-xs text-zinc-500 dark:border-zinc-800">
        TripEase is a student project. Prices and hotel and restaurant names are demo data unless linked to a source.
      </footer>
    </div>
  );
}
