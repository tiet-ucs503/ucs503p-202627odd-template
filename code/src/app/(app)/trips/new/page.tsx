"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { Alert, Button } from "@/components/ui";
import { GenerationLoader, type GenerationStage } from "@/components/trips/wizard/generation-loader";
import {
  BudgetStep,
  DatesStep,
  DestinationStep,
  ReviewStep,
  StyleStep,
  TravelersStep,
  flightsIncluded,
  flightsReady,
  type WizardData,
} from "@/components/trips/wizard/steps";
import { buildInitialWizardData, startingStep } from "@/components/trips/wizard/initial-data";
import { WizardShell } from "@/components/trips/wizard/wizard-shell";
import { postAuthenticated } from "@/lib/api-client";
import { clearDraft, clearDraftOrigin, readDraft, readDraftOrigin } from "@/lib/draft-storage";
import { isSupportedCountry } from "@/lib/countries";
import { toDateInputValue } from "@/lib/date";
import { saveGeneratedTrip } from "@/lib/services/trips";
import type { CityPlan } from "@/types/planning";
import type { GeneratedItinerary, TripDraftInput } from "@/types/trip";

function defaultDates() {
  const start = new Date();
  start.setDate(start.getDate() + 30);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { startDate: toDateInputValue(start), endDate: toDateInputValue(end) };
}

function initialData(): WizardData {
  return buildInitialWizardData(readDraft(), defaultDates());
}

function stepIsValid(step: number, data: WizardData): boolean {
  switch (step) {
    case 0:
      return isSupportedCountry(data.destination);
    case 1:
      return Boolean(data.startDate && data.endDate && data.endDate >= data.startDate);
    case 2:
      return Number(data.budget) > 0 && flightsReady(data);
    case 3:
      return data.travelers >= 1;
    default:
      return true;
  }
}

export default function NewTripPage() {
  const router = useRouter();
  const { user } = useAuth();
  // Read once, before the effect below clears it: the wizard needs to know a
  // draft came from Travis for as long as the page is open.
  const [origin] = useState(readDraftOrigin);
  const [step, setStep] = useState(() => startingStep(origin));
  const [data, setDataState] = useState<WizardData>(initialData);
  const [phase, setPhase] = useState<"wizard" | "generating">("wizard");
  const [stage, setStage] = useState<GenerationStage>("planning");
  const [plan, setPlan] = useState<CityPlan | null>(null);
  const [itinerary, setItinerary] = useState<GeneratedItinerary | null>(null);
  const [fetchDone, setFetchDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    clearDraft();
    clearDraftOrigin();
  }, []);

  function setData(patch: Partial<WizardData> | ((prev: WizardData) => Partial<WizardData>)) {
    setDataState((prev) => ({ ...prev, ...(typeof patch === "function" ? patch(prev) : patch) }));
  }

  async function handleGenerate() {
    setError(null);
    setFetchDone(false);
    setPlan(null);
    setStage("planning");
    setPhase("generating");

    const draft: TripDraftInput = {
      destination: data.destination.trim(),
      startDate: data.startDate,
      endDate: data.endDate,
      budget: Number(data.budget),
      currency: data.currency,
      travelers: data.travelers,
      travelerType: data.travelerType,
      preferences: data.preferences,
      includeFlights: flightsIncluded(data),
      ...(flightsIncluded(data) && data.flyingFrom ? { origin: data.flyingFrom } : {}),
    };

    try {
      if (!user) throw new Error("Not signed in.");

      // Stage 1 — decide the cities. Surfacing this separately is what lets
      // the loader show real progress (and the chosen cities) instead of a
      // made-up percentage.
      const planned = await postAuthenticated<{ plan: CityPlan }>("/api/trips/plan", draft);
      setPlan(planned.plan);

      // Stage 2 — real places, itinerary and budget for those cities.
      setStage("places");
      const built = await postAuthenticated<{ itinerary: GeneratedItinerary; plan: CityPlan }>(
        "/api/trips/generate",
        { ...draft, plan: planned.plan },
      );

      setStage("saving");
      const tripId = await saveGeneratedTrip(draft, built.itinerary, built.plan ?? planned.plan);

      setStage("roadmap");
      setItinerary(built.itinerary);
      setFetchDone(true);
      setTimeout(() => router.push(`/trips/${tripId}`), 600);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setPhase("wizard");
    }
  }

  if (phase === "generating") {
    return (
      <GenerationLoader
        destination={data.destination}
        stage={stage}
        plan={plan}
        done={fetchDone && itinerary !== null}
      />
    );
  }

  const isLastStep = step === 5;
  const canAdvance = stepIsValid(step, data);

  return (
    <WizardShell step={step}>
      {/* The dates were Travis's suggestion, not the traveller's choice. Say so
          on the step where they appear, so they get checked rather than trusted. */}
      {origin && step === 1 ? (
        <div className="mb-6">
          <Alert tone="info">
            <p className="font-medium">Started from Travis: {origin.destination}</p>
            <p className="mt-0.5">
              It&apos;s usually best in {origin.windowLabel}, so we&apos;ve filled in dates in that window. Check
              them, then answer a few quick questions and TripEase will build your plan.
            </p>
          </Alert>
        </div>
      ) : null}
      {step === 0 && <DestinationStep data={data} setData={setData} />}
      {step === 1 && <DatesStep data={data} setData={setData} />}
      {step === 2 && <BudgetStep data={data} setData={setData} />}
      {step === 3 && <TravelersStep data={data} setData={setData} />}
      {step === 4 && <StyleStep data={data} setData={setData} />}
      {step === 5 && <ReviewStep data={data} />}

      {error ? (
        <div className="mt-4">
          <Alert>{error}</Alert>
        </div>
      ) : null}

      <div className="mt-8 flex items-center justify-between">
        <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>

        {isLastStep ? (
          <Button size="lg" onClick={handleGenerate}>
            <Sparkles className="h-4 w-4" />
            Generate my trip
          </Button>
        ) : (
          <Button onClick={() => setStep((s) => Math.min(5, s + 1))} disabled={!canAdvance}>
            Next
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </WizardShell>
  );
}
