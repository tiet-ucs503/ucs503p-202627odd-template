import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { DestinationStep, type WizardData } from "@/components/trips/wizard/steps";
import { COUNTRIES } from "@/lib/countries";

const EMPTY: WizardData = {
  destination: "",
  startDate: "2027-01-10",
  endDate: "2027-01-17",
  budget: "150000",
  currency: "INR",
  travelerType: "couple",
  travelers: 2,
  preferences: [],
};

function Harness({ initial = "" }: { initial?: string }) {
  const [data, setData] = useState<WizardData>({ ...EMPTY, destination: initial });
  return (
    <>
      <DestinationStep data={data} setData={(patch) => setData((prev) => ({ ...prev, ...(typeof patch === "function" ? patch(prev) : patch) }))} />
      <output data-testid="chosen">{data.destination}</output>
    </>
  );
}

const chosen = () => screen.getByTestId("chosen").textContent;

describe("DestinationStep", () => {
  it("says how many countries can be searched", () => {
    render(<Harness />);
    expect(screen.getByText(new RegExp(`Search ${COUNTRIES.length} countries`))).toBeInTheDocument();
  });

  it("offers one-tap choices, all of them supported countries", () => {
    render(<Harness />);
    const supported = new Set(COUNTRIES.map((c) => c.name));
    const chips = screen.getAllByRole("button", { pressed: false });
    expect(chips.length).toBeGreaterThanOrEqual(5);
    for (const chip of chips) expect(supported.has(chip.textContent ?? "")).toBe(true);
  });

  it("fills the search box and the trip when a quick choice is tapped", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Singapore" }));
    expect(chosen()).toBe("Singapore");
    expect(screen.getByRole("combobox", { name: "Destination" })).toHaveValue("Singapore");
    expect(screen.getByRole("button", { name: "Singapore" })).toHaveAttribute("aria-pressed", "true");
  });

  it("leaves the destination empty for anything that is not a supported country", () => {
    render(<Harness />);
    fireEvent.change(screen.getByRole("combobox", { name: "Destination" }), { target: { value: "Narnia" } });
    expect(chosen()).toBe("");
  });

  it("takes a country typed in full", () => {
    render(<Harness />);
    fireEvent.change(screen.getByRole("combobox", { name: "Destination" }), { target: { value: "japan" } });
    expect(chosen()).toBe("Japan");
  });

  it("still points to Travis for someone who has not decided", () => {
    render(<Harness />);
    expect(screen.getByRole("link", { name: "Ask Travis" })).toHaveAttribute("href", "/travis");
  });
});
