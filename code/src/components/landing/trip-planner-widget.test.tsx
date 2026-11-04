import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TripPlannerWidget } from "@/components/landing/trip-planner-widget";
import { readDraft } from "@/lib/draft-storage";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));

const country = () => screen.getByRole("combobox", { name: "Where to?" });
const submit = () => screen.getByRole("button", { name: /Build my itinerary|Taking you there/ });

beforeEach(() => {
  push.mockReset();
  window.sessionStorage.clear();
});

describe("TripPlannerWidget", () => {
  it("cannot be submitted until a country is chosen", () => {
    render(<TripPlannerWidget />);
    expect(submit()).toBeDisabled();

    fireEvent.change(country(), { target: { value: "Narnia" } });
    expect(submit()).toBeDisabled();

    fireEvent.change(country(), { target: { value: "japan" } });
    expect(submit()).toBeEnabled();
  });

  it("keeps the chosen country, dates and budget for after sign-up, and goes there", () => {
    render(<TripPlannerWidget />);
    fireEvent.change(country(), { target: { value: "Japan" } });
    fireEvent.change(screen.getByLabelText("Budget (₹)"), { target: { value: "220000" } });
    fireEvent.click(submit());

    expect(readDraft()).toMatchObject({ destination: "Japan", budget: 220000, currency: "INR" });
    expect(push).toHaveBeenCalledWith("/sign-up");
  });

  it("does not save or move on without a country, even if the form is submitted", () => {
    render(<TripPlannerWidget />);
    fireEvent.submit(country().closest("form")!);
    expect(readDraft()).toBeNull();
    expect(push).not.toHaveBeenCalled();
  });

  it("is not ready when the trip ends before it starts", () => {
    render(<TripPlannerWidget />);
    fireEvent.change(country(), { target: { value: "Japan" } });
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2001-01-01" } });
    expect(submit()).toBeDisabled();
  });

  it("saves the draft as a supported country, never as the typed text", () => {
    render(<TripPlannerWidget />);
    fireEvent.change(country(), { target: { value: "ThAiLaNd" } });
    fireEvent.click(submit());
    expect(readDraft()?.destination).toBe("Thailand");
  });
});
