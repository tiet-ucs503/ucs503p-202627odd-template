import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { HotelCard } from "@/components/plan/hotel-card";
import { buildThailandTrip } from "@/test-support/trip-fixture";
import type { City } from "@/types/itinerary";

let base: City;

beforeAll(async () => {
  const trip = await buildThailandTrip();
  base = trip.cities[0];
});

const withNights = (nights: number, dayCount = 3): City => ({ ...base, dayCount, hotel: { ...base.hotel, nights } });

describe("HotelCard", () => {
  it("says there is no overnight stay, and offers nothing to edit, when the city has no nights", () => {
    render(<HotelCard city={withNights(0, 1)} currency="INR" onEdit={vi.fn()} />);
    expect(screen.getByText(`No overnight stay in ${base.name}.`)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("writes one night in the singular", () => {
    render(<HotelCard city={withNights(1)} currency="INR" onEdit={vi.fn()} />);
    expect(screen.getByRole("button").textContent).toContain("· 1 night ·");
  });

  it("writes several nights in the plural", () => {
    render(<HotelCard city={withNights(2)} currency="INR" onEdit={vi.fn()} />);
    expect(screen.getByRole("button").textContent).toContain("· 2 nights ·");
  });

  it("will not save more nights than the city has days, and says why", () => {
    const onEdit = vi.fn();
    render(<HotelCard city={withNights(2, 3)} currency="INR" onEdit={onEdit} />);
    fireEvent.click(screen.getByRole("button", { name: new RegExp(`Edit hotel in ${base.name}`) }));
    fireEvent.change(screen.getByLabelText("Nights"), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    expect(screen.getByRole("alert").textContent).toBe("This city has 3 days, so it can have at most 3 nights.");
    expect(onEdit).not.toHaveBeenCalled();
  });

  it("saves a number of nights within the city's days", () => {
    const onEdit = vi.fn();
    render(<HotelCard city={withNights(2, 3)} currency="INR" onEdit={onEdit} />);
    fireEvent.click(screen.getByRole("button", { name: new RegExp(`Edit hotel in ${base.name}`) }));
    fireEvent.change(screen.getByLabelText("Nights"), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ nights: 3 }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
