"use client";

import Link from "next/link";
import { Minus, Plus } from "lucide-react";
import { Chip, SelectField, TextField } from "@/components/ui";
import { CountryCombobox } from "@/components/ui/country-combobox";
import { COUNTRIES } from "@/lib/countries";
import { ORIGIN_AIRPORTS, indianAirport, isOriginAirport } from "@/lib/flights/airports";
import { isDomestic } from "@/lib/flights/quote";
import { toInr } from "@/lib/fx";
import { cn, formatMoney } from "@/lib/utils";
import { TRAVEL_STYLES, TRAVELER_TYPES, type TravelerType, type TravelStyle } from "@/types/itinerary";
import { StepHeading } from "./wizard-shell";

export interface WizardData {
  destination: string;
  startDate: string;
  endDate: string;
  budget: string;
  currency: string;
  travelerType: TravelerType;
  travelers: number;
  preferences: TravelStyle[];
  /** null until the traveller chooses: flights then follow the destination. */
  includeFlights: boolean | null;
  /** IATA code of the airport the traveller flies from; null until chosen. */
  flyingFrom: string | null;
}

/**
 * Whether flights go into the budget. Until the traveller decides, a trip
 * inside India leaves them out (it is as likely to be a road trip or a train)
 * and every other trip includes them.
 */
export function flightsIncluded(data: Pick<WizardData, "includeFlights" | "destination">): boolean {
  return data.includeFlights ?? !isDomestic(data.destination);
}

/** Flights can only be priced from a known airport, so one must be chosen when they're included. */
export function flightsReady(data: Pick<WizardData, "includeFlights" | "destination" | "flyingFrom">): boolean {
  return !flightsIncluded(data) || isOriginAirport(data.flyingFrom);
}

/** The airports a trip can start from, A to Z, as "City (CODE)". */
const ORIGIN_CHOICES = [...ORIGIN_AIRPORTS].sort((a, b) => a.city.localeCompare(b.city));

type SetData = (patch: Partial<WizardData> | ((prev: WizardData) => Partial<WizardData>)) => void;

/** The countries shown as one-tap choices under the search box. */
const QUICK_PICKS = COUNTRIES.slice(0, 6);

export function DestinationStep({ data, setData }: { data: WizardData; setData: SetData }) {
  return (
    <div>
      <StepHeading
        title="Where do you want to go?"
        subtitle={`Search ${COUNTRIES.length} countries, or a city in one of them.`}
      />
      <CountryCombobox
        id="destination"
        label="Destination"
        value={data.destination}
        onChange={(destination) => setData({ destination })}
        autoFocus
      />
      <div className="mt-4 flex flex-wrap gap-2">
        {QUICK_PICKS.map((country) => (
          <Chip
            key={country.code}
            selected={data.destination === country.name}
            onClick={() => setData({ destination: country.name })}
          >
            {country.name}
          </Chip>
        ))}
      </div>
      <p className="mt-6 text-sm text-zinc-500">
        Not sure where to go, or when?{" "}
        <Link href="/travis" className="font-medium text-orange-700 hover:underline dark:text-orange-400">
          Ask Travis
        </Link>
      </p>
    </div>
  );
}

export function DatesStep({ data, setData }: { data: WizardData; setData: SetData }) {
  return (
    <div>
      <StepHeading title="When are you travelling?" />
      <div className="grid grid-cols-2 gap-4">
        <TextField
          id="start-date"
          label="Start date"
          type="date"
          value={data.startDate}
          onChange={(e) => setData({ startDate: e.target.value })}
        />
        <TextField
          id="end-date"
          label="End date"
          type="date"
          min={data.startDate}
          value={data.endDate}
          onChange={(e) => setData({ endDate: e.target.value })}
        />
      </div>
    </div>
  );
}

const CURRENCIES = ["INR", "USD", "EUR", "GBP"] as const;

export function BudgetStep({ data, setData }: { data: WizardData; setData: SetData }) {
  return (
    <div>
      <StepHeading title="What's your trip budget?" subtitle="An estimate is fine — you can fine-tune it later." />
      <div className="flex gap-3">
        <div className="w-28">
          <SelectField
            id="currency"
            label="Currency"
            value={data.currency}
            onChange={(e) => setData({ currency: e.target.value })}
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </SelectField>
        </div>
        <div className="flex-1">
          <TextField
            id="budget"
            label="Total budget"
            type="number"
            inputMode="numeric"
            min={0}
            value={data.budget}
            onChange={(e) => setData({ budget: e.target.value })}
          />
        </div>
      </div>
      <p className="mt-4 font-display text-3xl font-medium text-orange-600">
        {formatMoney(Number(data.budget) || 0, data.currency)}
      </p>
      {data.currency !== "INR" && Number(data.budget) > 0 && (
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400" data-testid="budget-inr">
          ≈ {formatMoney(toInr(Number(data.budget), data.currency), "INR")}
          <span className="ml-1">(approximate rate)</span>
        </p>
      )}
      <label htmlFor="include-flights" className="mt-6 flex cursor-pointer items-start gap-3">
        <input
          id="include-flights"
          type="checkbox"
          checked={flightsIncluded(data)}
          onChange={(e) => setData({ includeFlights: e.target.checked })}
          className="mt-1 h-4 w-4 accent-orange-600"
        />
        <span>
          <span className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Include flights in the budget
          </span>
          <span className="block text-sm text-zinc-500 dark:text-zinc-400">
            Untick this for a road trip, or if your tickets are already booked.
          </span>
        </span>
      </label>
      {flightsIncluded(data) && (
        <div className="mt-4 max-w-xs">
          <SelectField
            id="flying-from"
            label="Flying from"
            hint="Fares are estimated from this airport to your first city."
            value={data.flyingFrom ?? ""}
            onChange={(e) => setData({ flyingFrom: e.target.value || null })}
          >
            <option value="">Choose a city</option>
            {ORIGIN_CHOICES.map((airport) => (
              <option key={airport.code} value={airport.code}>
                {airport.city} ({airport.code})
              </option>
            ))}
          </SelectField>
        </div>
      )}
    </div>
  );
}

export function TravelersStep({ data, setData }: { data: WizardData; setData: SetData }) {
  return (
    <div>
      <StepHeading title="Who's coming?" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {TRAVELER_TYPES.map((t) => (
          <Chip
            key={t.id}
            selected={data.travelerType === t.id}
            onClick={() => setData({ travelerType: t.id, travelers: t.defaultCount })}
            className="w-full justify-center"
          >
            {t.label}
          </Chip>
        ))}
      </div>

      <div className="mt-6 flex items-center gap-4">
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Number of travellers</span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() =>
              setData((prev) => ({ travelers: Math.max(1, prev.travelers - 1), travelerType: "custom" }))
            }
            className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-300 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
            aria-label="Decrease travellers"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <span className="w-6 text-center font-medium">{data.travelers}</span>
          <button
            type="button"
            onClick={() =>
              setData((prev) => ({ travelers: Math.min(20, prev.travelers + 1), travelerType: "custom" }))
            }
            className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-300 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
            aria-label="Increase travellers"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function StyleStep({ data, setData }: { data: WizardData; setData: SetData }) {
  function toggle(style: TravelStyle) {
    setData((prev) => ({
      preferences: prev.preferences.includes(style)
        ? prev.preferences.filter((p) => p !== style)
        : [...prev.preferences, style],
    }));
  }

  return (
    <div>
      <StepHeading title="What's your travel style?" subtitle="Pick as many as you like." />
      <div className="flex flex-wrap gap-2.5">
        {TRAVEL_STYLES.map((s) => (
          <Chip key={s.id} selected={data.preferences.includes(s.id)} onClick={() => toggle(s.id)}>
            <span>{s.icon}</span> {s.label}
          </Chip>
        ))}
      </div>
    </div>
  );
}

export function ReviewStep({ data }: { data: WizardData }) {
  const styleLabels = data.preferences
    .map((p) => TRAVEL_STYLES.find((s) => s.id === p)?.label)
    .filter(Boolean)
    .join(" · ");

  return (
    <div>
      <StepHeading title="Ready to generate your trip" subtitle="Double-check the details below." />
      <div className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-900/60">
        <Row label="Destination" value={data.destination || "—"} big />
        <Row label="Dates" value={`${data.startDate || "—"} → ${data.endDate || "—"}`} />
        <Row label="Travellers" value={`${data.travelers} (${data.travelerType})`} />
        <Row
          label="Budget"
          value={
            data.currency !== "INR" && Number(data.budget) > 0
              ? `${formatMoney(Number(data.budget), data.currency)} (≈ ${formatMoney(toInr(Number(data.budget), data.currency), "INR")})`
              : formatMoney(Number(data.budget) || 0, data.currency)
          }
        />
        <Row
          label="Flights"
          value={
            flightsIncluded(data)
              ? `From ${indianAirport(data.flyingFrom)?.city ?? "—"} (estimate)`
              : "Not included"
          }
        />
        <Row label="Style" value={styleLabels || "No preferences selected"} />
      </div>
    </div>
  );
}

function Row({ label, value, big = false }: { label: string; value: string; big?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between gap-4", big && "pb-2")}>
      <span className="text-sm text-zinc-500">{label}</span>
      <span className={cn("text-right font-medium text-zinc-900 dark:text-zinc-100", big && "font-display text-xl")}>
        {value}
      </span>
    </div>
  );
}
