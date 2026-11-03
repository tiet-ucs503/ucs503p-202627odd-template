import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TripCard } from "@/components/dashboard/trip-card";
import type { Trip } from "@/types/trip";

const deleteTrip = vi.fn();
vi.mock("@/lib/services/trips", () => ({ deleteTrip: (id: string) => deleteTrip(id) }));

function trip(overrides: Partial<Trip> = {}): Trip {
  return {
    id: "t1",
    ownerId: "u1",
    status: "ready",
    destination: "Thailand",
    title: "9 days in Thailand",
    startDate: "2026-12-10",
    endDate: "2026-12-18",
    dayCount: 9,
    currency: "INR",
    travelers: 2,
    travelerType: "couple",
    preferences: [],
    cities: [],
    days: [],
    budget: { total: 150000 },
    createdAt: new Date("2026-11-01"),
    updatedAt: new Date("2026-11-01"),
    ...overrides,
  } as Trip;
}

const today = "2026-11-03";

beforeEach(() => {
  // A block, not an expression: a function returned from beforeEach is run as cleanup.
  deleteTrip.mockReset().mockResolvedValue(undefined);
});

describe("TripCard", () => {
  it("is one link to the trip, named by its title", () => {
    render(<TripCard trip={trip()} today={today} />);
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "/trips/t1");
    expect(links[0]).toHaveAccessibleName("9 days in Thailand");
  });

  it("states the facts plainly", () => {
    render(<TripCard trip={trip()} today={today} />);
    expect(screen.getByText(/Dec 10 – Dec 18 · 9 days/)).toBeInTheDocument();
    expect(screen.getByText(/2 travellers · ₹1,50,000/)).toBeInTheDocument();
  });

  it("says when the trip is, not how finished it is", () => {
    render(<TripCard trip={trip()} today={today} />);
    expect(screen.getByText("In 5 weeks")).toBeInTheDocument();
    expect(screen.queryByText(/% planned/)).not.toBeInTheDocument();
  });

  it("says so when the trip is under way", () => {
    render(<TripCard trip={trip({ startDate: "2026-11-01", endDate: "2026-11-08" })} today={today} />);
    expect(screen.getByText("Happening now")).toBeInTheDocument();
  });

  it("uses singular forms for one day and one traveller", () => {
    render(<TripCard trip={trip({ dayCount: 1, travelers: 1 })} today={today} />);
    expect(screen.getByText(/· 1 day$/)).toBeInTheDocument();
    expect(screen.getByText(/^1 traveller ·/)).toBeInTheDocument();
  });

  it("shows a photo of the place as decoration, with a neutral one for places it has no picture of", () => {
    const { container, rerender } = render(<TripCard trip={trip()} today={today} />);
    expect(container.querySelector("img")?.getAttribute("src")).toContain("thailand");
    expect(container.querySelector("img")).toHaveAttribute("alt", "");

    rerender(<TripCard trip={trip({ destination: "Iceland", title: "A week in Iceland" })} today={today} />);
    expect(container.querySelector("img")?.getAttribute("src")).toContain("elsewhere");
  });
});

describe("deleting", () => {
  it("asks first, and nothing is deleted until it is confirmed", () => {
    render(<TripCard trip={trip()} today={today} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete 9 days in Thailand" }));

    expect(screen.getByText("Delete this trip?")).toBeInTheDocument();
    expect(deleteTrip).not.toHaveBeenCalled();
  });

  it("can be cancelled, with the button or Escape", () => {
    render(<TripCard trip={trip()} today={today} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete 9 days in Thailand" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByText("Delete this trip?")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Delete 9 days in Thailand" }));
    fireEvent.keyDown(screen.getByRole("group", { name: /Confirm deleting/ }), { key: "Escape" });
    expect(screen.queryByText("Delete this trip?")).not.toBeInTheDocument();
    expect(deleteTrip).not.toHaveBeenCalled();
  });

  it("deletes the trip once confirmed", async () => {
    render(<TripCard trip={trip()} today={today} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete 9 days in Thailand" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(deleteTrip).toHaveBeenCalledWith("t1"));
  });

  it("says so and goes back to the card when it fails", async () => {
    deleteTrip.mockRejectedValue(new Error("Network down"));
    render(<TripCard trip={trip()} today={today} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete 9 days in Thailand" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(await screen.findByText("Network down")).toBeInTheDocument();
    expect(screen.queryByText("Delete this trip?")).not.toBeInTheDocument();
  });
});
