import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { formatSuggestedRange, MonthStrip, SuggestionCard } from "@/components/travis/suggestion-card";
import { photoForCountry } from "@/lib/destination-photos";
import type { DestinationSuggestion } from "@/types/travis";

function suggestion(overrides: Partial<DestinationSuggestion> = {}): DestinationSuggestion {
  return {
    id: "bali-0",
    destination: "Bali, Indonesia",
    headline: "Rice terraces and surf beaches.",
    startMonth: 4,
    endMonth: 6,
    windowLabel: "Apr–Jun",
    costOutlook: "lower",
    costReason: "These shoulder months fall between the wet season and the summer rush.",
    weatherNote: "Mostly dry, with the heat building.",
    watchOut: "Crowds build from July.",
    suggestedDays: 8,
    styles: ["beaches"],
    startDate: "2027-04-01",
    endDate: "2027-04-08",
    ...overrides,
  };
}

describe("formatSuggestedRange", () => {
  it("shows the year once for a trip within one year", () => {
    expect(formatSuggestedRange("2027-06-01", "2027-06-08")).toBe("Jun 1 – Jun 8, 2027");
  });

  it("shows both years when the trip crosses New Year", () => {
    expect(formatSuggestedRange("2026-12-28", "2027-01-04")).toBe("Dec 28, 2026 – Jan 4, 2027");
  });
});

describe("SuggestionCard", () => {
  it("shows the place and why it fits", () => {
    render(<SuggestionCard suggestion={suggestion()} onPlan={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Bali, Indonesia" })).toBeInTheDocument();
    expect(screen.getByText("Rice terraces and surf beaches.")).toBeInTheDocument();
  });

  it("gives the best time, the cost and its reason, the weather and what to watch for", () => {
    render(<SuggestionCard suggestion={suggestion()} onPlan={vi.fn()} />);
    expect(screen.getByText("Best time to go").nextSibling).toHaveTextContent("Apr–Jun");
    expect(screen.getByText(/shoulder months fall between/)).toBeInTheDocument();
    expect(screen.getByText("Mostly dry, with the heat building.")).toBeInTheDocument();
    expect(screen.getByText("Crowds build from July.")).toBeInTheDocument();
  });

  it.each([
    ["lower", "Usually lower cost"],
    ["typical", "Typical cost"],
    ["higher", "Usually higher cost"],
  ] as const)("writes a %s outlook out in words, not just colour", (costOutlook, label) => {
    render(<SuggestionCard suggestion={suggestion({ costOutlook })} onPlan={vi.fn()} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("never shows an amount of money", () => {
    const { container } = render(<SuggestionCard suggestion={suggestion()} onPlan={vi.fn()} />);
    expect(container.textContent).not.toMatch(/[₹$€£]\s?\d/);
  });

  it("leaves out the watch-out line when there is nothing to watch for", () => {
    render(<SuggestionCard suggestion={suggestion({ watchOut: null })} onPlan={vi.fn()} />);
    expect(screen.queryByText("Worth knowing")).not.toBeInTheDocument();
  });

  it("says which dates and how many days it is proposing, and that they can change", () => {
    render(<SuggestionCard suggestion={suggestion()} onPlan={vi.fn()} />);
    expect(screen.getByText(/Apr 1 – Apr 8, 2027 · 8 days/)).toBeInTheDocument();
    expect(screen.getByText(/You can change these next/)).toBeInTheDocument();
  });

  it("hands the whole suggestion back when planning is chosen", () => {
    const onPlan = vi.fn();
    const chosen = suggestion();
    render(<SuggestionCard suggestion={chosen} onPlan={onPlan} />);

    fireEvent.click(screen.getByRole("button", { name: "Plan this trip to Bali, Indonesia" }));

    expect(onPlan).toHaveBeenCalledWith(chosen);
  });

  it("names the place in the button, so several cards are tellable apart by a screen reader", () => {
    render(
      <>
        <SuggestionCard suggestion={suggestion()} onPlan={vi.fn()} />
        <SuggestionCard suggestion={suggestion({ id: "japan-1", destination: "Japan" })} onPlan={vi.fn()} />
      </>,
    );
    expect(screen.getByRole("button", { name: "Plan this trip to Bali, Indonesia" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Plan this trip to Japan" })).toBeInTheDocument();
  });

  it("is a labelled article, so each card is a landmark of its own", () => {
    render(<SuggestionCard suggestion={suggestion()} onPlan={vi.fn()} />);
    expect(screen.getByRole("article", { name: "Bali, Indonesia" })).toBeInTheDocument();
  });
});

describe("MonthStrip", () => {
  const filled = (container: HTMLElement) =>
    [...container.querySelectorAll('[aria-hidden="true"] > span:first-child')].map((segment) => segment.className.includes("bg-orange-500"));

  it("fills in the best months and leaves the rest empty", () => {
    const { container } = render(<MonthStrip startMonth={4} endMonth={6} />);
    expect(filled(container)).toEqual([false, false, false, true, true, true, false, false, false, false, false, false]);
  });

  it("fills in a window that crosses New Year at both ends of the year", () => {
    const { container } = render(<MonthStrip startMonth={11} endMonth={2} />);
    expect(filled(container)).toEqual([true, true, false, false, false, false, false, false, false, false, true, true]);
  });

  it("fills in a single month", () => {
    const { container } = render(<MonthStrip startMonth={9} endMonth={9} />);
    expect(filled(container).filter(Boolean)).toHaveLength(1);
  });

  it("describes itself as a sentence, not as twelve letters", () => {
    render(<MonthStrip startMonth={11} endMonth={2} />);
    expect(screen.getByRole("img", { name: "Best months: November to February" })).toBeInTheDocument();
    render(<MonthStrip startMonth={9} endMonth={9} />);
    expect(screen.getByRole("img", { name: "Best month: September" })).toBeInTheDocument();
  });
});

describe("SuggestionCard photograph", () => {
  it("shows a photograph of the country, described in its alt text", () => {
    const { container } = render(<SuggestionCard suggestion={suggestion({ destination: "Japan" })} onPlan={vi.fn()} />);
    const img = container.querySelector("img");
    expect(decodeURIComponent(img?.getAttribute("src") ?? "")).toContain(photoForCountry("JP").src);
    expect(img?.getAttribute("alt")).toBe(photoForCountry("JP").alt);
  });

  it("recognises a place inside a country, as older saved conversations name it", () => {
    const { container } = render(<SuggestionCard suggestion={suggestion({ destination: "Bali, Indonesia" })} onPlan={vi.fn()} />);
    expect(decodeURIComponent(container.querySelector("img")?.getAttribute("src") ?? "")).toContain(photoForCountry("ID").src);
  });

  it("has no photograph, rather than a wrong one, for somewhere it does not know", () => {
    const { container } = render(<SuggestionCard suggestion={suggestion({ destination: "Narnia" })} onPlan={vi.fn()} />);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByRole("heading", { name: "Narnia" })).toBeInTheDocument();
  });

  it("keeps the facts and the way to plan the trip either way", () => {
    render(<SuggestionCard suggestion={suggestion({ destination: "Narnia" })} onPlan={vi.fn()} />);
    expect(screen.getByText("Best time to go")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Plan this trip to Narnia" })).toBeInTheDocument();
  });
});
