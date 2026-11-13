import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { BudgetPanel } from "@/components/budget/budget-panel";
import { quoteFlights } from "@/lib/flights/quote";
import { fromInr } from "@/lib/fx";
import { buildSavingsSuggestions } from "@/lib/services/budget-engine";
import type { FlightQuote } from "@/types/flights";
import { buildThailandTrip } from "@/test-support/trip-fixture";
import type { AgentTrip } from "@/types/trip-agent";

let trip: AgentTrip;
beforeAll(async () => {
  trip = await buildThailandTrip();
});

/** The same trip, but over its budget, so the engine has something to suggest. */
const overBudget = () => ({ ...trip.budget, total: Math.round(trip.budget.estimatedTotal * 0.7) });

describe("savings suggestions", () => {
  it("offers nothing while the trip is within its budget", () => {
    expect(buildSavingsSuggestions(trip.cities, trip.days, trip.budget)).toEqual([]);
  });

  it("each comes with the words to ask Travis to carry it out", () => {
    const suggestions = buildSavingsSuggestions(trip.cities, trip.days, overBudget());
    expect(suggestions.length).toBeGreaterThan(0);
    for (const s of suggestions) expect(s.askTravis.length).toBeGreaterThan(10);
  });

  it("names the real hotel city and the real activity it is about", () => {
    const suggestions = buildSavingsSuggestions(trip.cities, trip.days, overBudget());
    const hotel = suggestions.find((s) => s.kind === "hotel-downgrade");
    expect(hotel?.askTravis).toMatch(/cheaper, well-rated hotel in /);
    expect(trip.cities.some((c) => hotel?.askTravis.includes(c.name))).toBe(true);

    const activity = suggestions.find((s) => s.kind === "activity-swap");
    if (activity) {
      const target = trip.days.flatMap((d) => d.activities).find((a) => a.id === activity.targetId)!;
      expect(activity.askTravis).toContain(target.name);
    }
  });

  it("claims no star rating for a hotel it has not looked up", () => {
    const text = JSON.stringify(buildSavingsSuggestions(trip.cities, trip.days, overBudget()));
    expect(text).not.toMatch(/3-star/);
  });
});

describe("BudgetPanel", () => {
  const renderPanel = (onAskTravis = vi.fn()) => {
    const budget = overBudget();
    render(<BudgetPanel budget={budget} suggestions={buildSavingsSuggestions(trip.cities, trip.days, budget)} onAskTravis={onAskTravis} />);
    return onAskTravis;
  };

  it("hands a suggestion to Travis instead of editing the trip itself", () => {
    const onAskTravis = renderPanel();
    expect(screen.queryByRole("button", { name: "Apply" })).not.toBeInTheDocument();

    const buttons = screen.getAllByRole("button", { name: "Ask Travis" });
    fireEvent.click(buttons[0]);
    expect(onAskTravis).toHaveBeenCalledTimes(1);
    expect(onAskTravis.mock.calls[0][0]).toMatch(/cheaper, well-rated hotel in /);
  });

  it("calls a saving an estimate, not a promise", () => {
    renderPanel();
    expect(screen.getAllByText(/Est\. saving/).length).toBeGreaterThan(0);
  });
});

describe("the flight quote", () => {
  const quote = quoteFlights({
    origin: "BOM",
    destination: "Singapore",
    startDate: "2027-03-08",
    travelers: 2,
    now: new Date("2026-11-13T12:00:00Z"),
  })!;
  const renderWith = (flights: FlightQuote | null, currency = "INR") =>
    render(
      <BudgetPanel budget={{ ...trip.budget, currency }} flights={flights} suggestions={[]} onAskTravis={vi.fn()} />,
    );

  it("shows the route, the range per person and that it is an estimate", () => {
    renderWith(quote);
    expect(screen.getByText("Mumbai (BOM) → Singapore (SIN), return")).toBeInTheDocument();
    const range = screen.getByTestId("flight-range");
    expect(range).toHaveTextContent(`₹${quote.perTravelerInr.low.toLocaleString("en-IN")}`);
    expect(range).toHaveTextContent(`₹${quote.perTravelerInr.high.toLocaleString("en-IN")}`);
    expect(range).toHaveTextContent(`for 2`);
    expect(screen.getByText(quote.basis)).toBeInTheDocument();
    expect(screen.getByText(/not a live fare/)).toBeInTheDocument();
  });

  it("shows the range in the trip's currency", () => {
    renderWith(quote, "USD");
    expect(screen.getByTestId("flight-range")).toHaveTextContent(
      `$${fromInr(quote.perTravelerInr.typical, "USD").toLocaleString("en-IN")}`,
    );
  });

  it("explains a zero fare instead of showing a route", () => {
    const home = quoteFlights({
      origin: "DEL",
      destination: "India",
      firstCity: "Delhi",
      startDate: "2027-03-08",
      travelers: 2,
      now: new Date("2026-11-13T12:00:00Z"),
    })!;
    renderWith(home);
    expect(screen.queryByTestId("flight-range")).not.toBeInTheDocument();
    expect(screen.getByText(/no flight to pay for/)).toBeInTheDocument();
  });

  it("shows nothing for a trip without a quote", () => {
    renderWith(null);
    expect(screen.queryByText(/not a live fare/)).not.toBeInTheDocument();
  });
});
