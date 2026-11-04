import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TripHeader } from "@/components/roadmap/trip-header";
import { photoForCountry } from "@/lib/destination-photos";
import type { Trip } from "@/types/trip";

const renameTrip = vi.fn();
vi.mock("@/lib/services/trips", () => ({ renameTrip: (id: string, title: string) => renameTrip(id, title) }));

function trip(overrides: Partial<Trip> = {}): Trip {
  return {
    id: "t1",
    title: "9 days in Thailand",
    destination: "Thailand",
    startDate: "2026-12-10",
    endDate: "2026-12-18",
    dayCount: 9,
    currency: "INR",
    cities: [{ name: "Bangkok" }, { name: "Phuket" }],
    budget: { total: 150000, estimatedTotal: 90000 },
    ...overrides,
  } as unknown as Trip;
}

const today = "2026-11-03";

beforeEach(() => {
  renameTrip.mockReset().mockResolvedValue(undefined);
});

describe("TripHeader", () => {
  it("names the trip, when it is, and the route in order", () => {
    render(<TripHeader trip={trip()} today={today} />);
    expect(screen.getByRole("heading", { level: 1, name: "9 days in Thailand" })).toBeInTheDocument();
    expect(screen.getByText("In 5 weeks")).toBeInTheDocument();
    expect(screen.getByText(/Dec 10 – Dec 18 · 8 nights · Bangkok → Phuket/)).toBeInTheDocument();
  });

  it("uses a photograph of the trip's country", () => {
    const { container } = render(<TripHeader trip={trip()} today={today} />);
    const img = container.querySelector("img");
    expect(decodeURIComponent(img?.getAttribute("src") ?? "")).toContain(photoForCountry("TH").src);
    expect(img?.getAttribute("alt")).toBe(photoForCountry("TH").alt);
  });

  it("says so when the trip is under way", () => {
    render(<TripHeader trip={trip({ startDate: "2026-11-01", endDate: "2026-11-08" })} today={today} />);
    expect(screen.getByText("Happening now")).toBeInTheDocument();
  });

  it("shows how much of the budget the plan uses, and exposes it as a progress bar", () => {
    render(<TripHeader trip={trip()} today={today} />);
    expect(screen.getByText(/₹90,000 of ₹1,50,000/)).toBeInTheDocument();
    const bar = screen.getByRole("progressbar", { name: "Estimated cost against budget" });
    expect(bar).toHaveAttribute("aria-valuenow", "60");
  });

  it("says how far over, not just a full bar", () => {
    render(<TripHeader trip={trip({ budget: { total: 100000, estimatedTotal: 130000 } } as Partial<Trip>)} today={today} />);
    expect(screen.getByText("30% over")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
  });
});

describe("the best-months note", () => {
  it("stays quiet when the dates are in the country's usual best months", () => {
    render(<TripHeader trip={trip()} today={today} />); // December, Thailand's window is Nov to Feb
    expect(screen.queryByText(/outside Thailand's usual best months/)).not.toBeInTheDocument();
  });

  it("speaks up when the whole trip is outside them", () => {
    render(<TripHeader trip={trip({ startDate: "2027-06-10", endDate: "2027-06-18" })} today={today} />);
    expect(screen.getByText(/outside Thailand's usual best months \(Nov–Feb\)/)).toBeInTheDocument();
  });

  it("stays quiet when only part of the trip is outside, since part of it is good", () => {
    render(<TripHeader trip={trip({ startDate: "2027-02-25", endDate: "2027-03-05" })} today={today} />);
    expect(screen.queryByText(/outside Thailand's usual best months/)).not.toBeInTheDocument();
  });

  it("has nothing to say about a destination it does not recognise", () => {
    render(<TripHeader trip={trip({ destination: "Narnia", startDate: "2027-06-10", endDate: "2027-06-18" })} today={today} />);
    expect(screen.queryByText(/best months/)).not.toBeInTheDocument();
  });
});

describe("renaming", () => {
  it("saves the new name", async () => {
    render(<TripHeader trip={trip()} today={today} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit trip name" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Trip name" }), { target: { value: "Thailand with Asha" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(renameTrip).toHaveBeenCalledWith("t1", "Thailand with Asha"));
    await waitFor(() => expect(screen.queryByRole("textbox")).not.toBeInTheDocument());
  });

  it("does not save an empty name", () => {
    render(<TripHeader trip={trip()} today={today} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit trip name" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Trip name" }), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(renameTrip).not.toHaveBeenCalled();
  });

  it("can be cancelled", () => {
    render(<TripHeader trip={trip()} today={today} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit trip name" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(renameTrip).not.toHaveBeenCalled();
  });
});
