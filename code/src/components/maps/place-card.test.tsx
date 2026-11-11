import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PlaceCard } from "@/components/maps/place-card";
import type { MapPoint } from "@/lib/services/map-points";

/**
 * The card is plain React with no dependency on any mapping library, and its
 * whole job is to show what the trip already knows and nothing else — so a
 * marker click never costs a Places request. These pin that down.
 */
function point(overrides: Partial<MapPoint> = {}): MapPoint {
  return {
    id: "act-1",
    kind: "activity",
    name: "Wat Chalong",
    location: { lat: 7.8464, lng: 98.3381 },
    cityId: "city-1",
    cityName: "Phuket",
    dayId: "day-6",
    dayNumber: 6,
    category: "culture",
    estimatedCost: 0,
    currency: "INR",
    verification: "live",
    order: 2,
    time: "10:30",
    durationMinutes: 90,
    rating: { value: 4.7, count: 2140 },
    priceIsEstimate: true,
    address: "Chalong, Mueang Phuket District",
    referenceUrl: "https://maps.google.com/?cid=123",
    sourceName: "Google Maps",
    ...overrides,
  };
}

function renderCard(overrides: Partial<MapPoint> = {}) {
  const onClose = vi.fn();
  const onViewActivity = vi.fn();
  render(<PlaceCard point={point(overrides)} onClose={onClose} onViewActivity={onViewActivity} />);
  return { onClose, onViewActivity };
}

describe("what the card shows", () => {
  it("shows the place, its category and its city", () => {
    renderCard();
    expect(screen.getByText("Wat Chalong")).toBeInTheDocument();
    expect(screen.getByText(/Culture · Phuket/)).toBeInTheDocument();
  });

  it("shows the day and the scheduled time", () => {
    renderCard();
    expect(screen.getByText("Day 6 · 10:30")).toBeInTheDocument();
  });

  it("shows duration and a free entry, separated", () => {
    renderCard();
    expect(screen.getByText("1h 30m · Free")).toBeInTheDocument();
  });

  it("separates duration from a priced entry too", () => {
    renderCard({ estimatedCost: 1500, priceIsEstimate: true });
    expect(screen.getByText(/1h 30m · .*1,500 est\./)).toBeInTheDocument();
  });

  it("shows the duration alone when there is no price to show", () => {
    // A hotel with no nightly rate: "Free" would be a claim the trip never made.
    renderCard({ kind: "hotel", category: null, estimatedCost: null, dayNumber: null, time: null });
    expect(screen.queryByText(/Free/)).not.toBeInTheDocument();
  });

  it("marks a cost as an estimate when that's what it is", () => {
    renderCard({ estimatedCost: 1500, priceIsEstimate: true });
    expect(screen.getByText(/est\./)).toBeInTheDocument();
  });

  it("does not add 'est.' to a verified price", () => {
    renderCard({ estimatedCost: 1500, priceIsEstimate: false });
    expect(screen.queryByText(/est\./)).not.toBeInTheDocument();
  });

  it("prices a hotel per night", () => {
    renderCard({ kind: "hotel", category: null, estimatedCost: 5200, dayNumber: null, time: null });
    expect(screen.getByText(/\/ night/)).toBeInTheDocument();
    expect(screen.getByText(/Hotel · Phuket/)).toBeInTheDocument();
  });
});

describe("things the card must not invent", () => {
  it("shows a rating when the provider gave one", () => {
    renderCard();
    expect(screen.getByText("4.7")).toBeInTheDocument();
    expect(screen.getByText("(2140)")).toBeInTheDocument();
  });

  it("shows no rating at all when the provider gave none", () => {
    renderCard({ rating: null });
    expect(screen.queryByText("4.7")).not.toBeInTheDocument();
  });

  it("shows no link at all when the place has no reference URL", () => {
    renderCard({ referenceUrl: null, sourceName: null });
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("shows no time or day for something that isn't scheduled", () => {
    renderCard({ dayNumber: null, time: null, durationMinutes: null });
    expect(screen.queryByText(/Day /)).not.toBeInTheDocument();
    expect(screen.queryByText(/10:30/)).not.toBeInTheDocument();
  });

  it("omits an address the provider didn't supply", () => {
    renderCard({ address: null });
    expect(screen.queryByText(/Mueang Phuket District/)).not.toBeInTheDocument();
  });

  it("shows the address when there is one", () => {
    renderCard();
    expect(screen.getByText(/Mueang Phuket District/)).toBeInTheDocument();
  });
});

describe("provenance", () => {
  it("calls a Google place link 'Open in Google Maps'", () => {
    renderCard();
    const link = screen.getByRole("link", { name: /Open in Google Maps/ });
    expect(link).toHaveAttribute("href", "https://maps.google.com/?cid=123");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  it("calls any other source a reference, not Google Maps", () => {
    renderCard({
      referenceUrl: "https://en.wikipedia.org/wiki/Wat_Chalong",
      sourceName: "Wikipedia",
    });
    expect(screen.getByRole("link", { name: /View reference/ })).toBeInTheDocument();
    expect(screen.queryByText(/Open in Google Maps/)).not.toBeInTheDocument();
  });

  it("says so when a place is not verified", () => {
    renderCard({ verification: "unverified" });
    expect(screen.getByText("Not verified")).toBeInTheDocument();
  });

  it("says when a place came from a live provider", () => {
    renderCard();
    expect(screen.getByText(/Live place data/)).toBeInTheDocument();
    expect(screen.queryByText("Not verified")).not.toBeInTheDocument();
  });
});

describe("actions", () => {
  it("offers a way back to the roadmap row", () => {
    renderCard();
    expect(screen.getByRole("button", { name: "View activity" })).toBeInTheDocument();
  });

  it("calls the hotel a hotel", () => {
    renderCard({ kind: "hotel", category: null });
    expect(screen.getByRole("button", { name: "View hotel" })).toBeInTheDocument();
  });

  it("can be dismissed", () => {
    const { onClose } = renderCard();
    screen.getByRole("button", { name: /Close Wat Chalong/ }).click();
    expect(onClose).toHaveBeenCalledOnce();
  });
});
