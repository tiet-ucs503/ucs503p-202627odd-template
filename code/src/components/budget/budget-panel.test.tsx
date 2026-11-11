import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { BudgetPanel } from "@/components/budget/budget-panel";
import { buildSavingsSuggestions } from "@/lib/services/budget-engine";
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
