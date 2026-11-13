import { resolveCountry } from "@/lib/countries";
import { isOriginAirport } from "@/lib/flights/airports";
import type { DraftOrigin, PartialDraft } from "@/lib/draft-storage";
import { TRAVEL_STYLES, TRAVELER_TYPES } from "@/types/itinerary";
import type { WizardData } from "./steps";

/**
 * What the wizard opens with: its own defaults, overlaid with whatever a draft
 * (from the landing page, or from Travis) already knows.
 *
 * A draft is untrusted input — it comes out of session storage — so each field
 * is checked before it is used, and anything unusable falls back to the default.
 */

const KNOWN_STYLES = new Set<string>(TRAVEL_STYLES.map((style) => style.id));
const KNOWN_CURRENCIES = new Set(["INR", "USD", "EUR", "GBP"]);
const KNOWN_TRAVELER_TYPES = new Set<string>(TRAVELER_TYPES.map((type) => type.id));

export interface WizardDefaults {
  startDate: string;
  endDate: string;
}

export function buildInitialWizardData(draft: PartialDraft | null, defaults: WizardDefaults): WizardData {
  const travelerType =
    draft?.travelerType && KNOWN_TRAVELER_TYPES.has(draft.travelerType) ? draft.travelerType : "couple";

  const travelers =
    typeof draft?.travelers === "number" && Number.isInteger(draft.travelers) && draft.travelers >= 1 && draft.travelers <= 20
      ? draft.travelers
      : 2;

  return {
    // Only a supported country can fill the field. A draft from before the list
    // existed ("Bali, Indonesia") becomes the country it names; anything that is
    // not a country becomes empty rather than a value the picker can't show.
    destination: (typeof draft?.destination === "string" && resolveCountry(draft.destination)?.name) || "",
    startDate: draft?.startDate ?? defaults.startDate,
    endDate: draft?.endDate ?? defaults.endDate,
    budget: typeof draft?.budget === "number" && draft.budget > 0 ? String(draft.budget) : "150000",
    currency: draft?.currency && KNOWN_CURRENCIES.has(draft.currency) ? draft.currency : "INR",
    travelerType,
    travelers,
    preferences: Array.isArray(draft?.preferences)
      ? draft.preferences.filter((style) => KNOWN_STYLES.has(style))
      : [],
    includeFlights: typeof draft?.includeFlights === "boolean" ? draft.includeFlights : null,
    flyingFrom: typeof draft?.origin === "string" && isOriginAirport(draft.origin) ? draft.origin.toUpperCase() : null,
  };
}

/**
 * Which wizard step to open on.
 *
 * Normally the first. After a Travis suggestion the destination is settled, so
 * the traveller lands on the dates — the one thing in the draft they didn't
 * choose and most need to look at.
 */
export function startingStep(origin: DraftOrigin | null): number {
  return origin ? 1 : 0;
}
