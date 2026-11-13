import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import {
  BudgetStep,
  DestinationStep,
  ReviewStep,
  flightsIncluded,
  flightsReady,
  type WizardData,
} from "@/components/trips/wizard/steps";
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
  includeFlights: null,
  flyingFrom: null,
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

function BudgetHarness({
  currency = "INR",
  budget = "150000",
  destination = "",
}: {
  currency?: string;
  budget?: string;
  destination?: string;
}) {
  const [data, setData] = useState<WizardData>({ ...EMPTY, currency, budget, destination });
  return (
    <BudgetStep data={data} setData={(patch) => setData((prev) => ({ ...prev, ...(typeof patch === "function" ? patch(prev) : patch) }))} />
  );
}

describe("BudgetStep rupee preview", () => {
  it("shows the rupee equivalent next to a foreign-currency budget", () => {
    render(<BudgetHarness currency="USD" budget="3614" />);
    expect(screen.getByTestId("budget-inr")).toHaveTextContent("₹2,99,962");
  });

  it("does not repeat the amount when the budget is already in rupees", () => {
    render(<BudgetHarness currency="INR" budget="500000" />);
    expect(screen.queryByTestId("budget-inr")).not.toBeInTheDocument();
  });

  it("hides the preview until an amount is entered", () => {
    render(<BudgetHarness currency="EUR" budget="" />);
    expect(screen.queryByTestId("budget-inr")).not.toBeInTheDocument();
  });

  it("updates the preview when the currency changes", () => {
    render(<BudgetHarness currency="USD" budget="1000" />);
    expect(screen.getByTestId("budget-inr")).toHaveTextContent("₹83,000");
    fireEvent.change(screen.getByLabelText("Currency"), { target: { value: "GBP" } });
    expect(screen.getByTestId("budget-inr")).toHaveTextContent("₹1,05,000");
  });
});

describe("BudgetStep flights switch", () => {
  const box = () => screen.getByRole("checkbox", { name: /include flights/i });

  it("starts ticked for a trip abroad", () => {
    render(<BudgetHarness destination="Thailand" />);
    expect(box()).toBeChecked();
  });

  it("starts unticked for a trip inside India, which may well be a road trip", () => {
    render(<BudgetHarness destination="India" />);
    expect(box()).not.toBeChecked();
  });

  it("lets the traveller untick it abroad and tick it in India", () => {
    const { unmount } = render(<BudgetHarness destination="Thailand" />);
    fireEvent.click(box());
    expect(box()).not.toBeChecked();
    unmount();

    render(<BudgetHarness destination="India" />);
    fireEvent.click(box());
    expect(box()).toBeChecked();
  });
});

describe("flightsIncluded", () => {
  it("follows the destination until the traveller chooses, then follows the choice", () => {
    expect(flightsIncluded({ destination: "India", includeFlights: null })).toBe(false);
    expect(flightsIncluded({ destination: "Japan", includeFlights: null })).toBe(true);
    expect(flightsIncluded({ destination: "India", includeFlights: true })).toBe(true);
    expect(flightsIncluded({ destination: "Japan", includeFlights: false })).toBe(false);
  });
});

describe("BudgetStep flying from", () => {
  const picker = () => screen.queryByRole("combobox", { name: /flying from/i });

  it("asks where the traveller flies from only while flights are included", () => {
    render(<BudgetHarness destination="Thailand" />);
    expect(picker()).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: /include flights/i }));
    expect(picker()).not.toBeInTheDocument();
  });

  it("offers Indian airports by city, and keeps the choice", () => {
    render(<BudgetHarness destination="Thailand" />);
    const select = picker() as HTMLSelectElement;
    expect(screen.getByRole("option", { name: "Delhi (DEL)" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Chandigarh (IXC)" })).toBeInTheDocument();
    // Leh is a place to fly to, not a starting point.
    expect(screen.queryByRole("option", { name: /Leh/ })).not.toBeInTheDocument();
    fireEvent.change(select, { target: { value: "BOM" } });
    expect(select.value).toBe("BOM");
  });
});

describe("flightsReady", () => {
  it("needs an airport only when flights are included", () => {
    expect(flightsReady({ destination: "Japan", includeFlights: null, flyingFrom: null })).toBe(false);
    expect(flightsReady({ destination: "Japan", includeFlights: null, flyingFrom: "BLR" })).toBe(true);
    expect(flightsReady({ destination: "Japan", includeFlights: null, flyingFrom: "IXL" })).toBe(false);
    expect(flightsReady({ destination: "Japan", includeFlights: false, flyingFrom: null })).toBe(true);
    expect(flightsReady({ destination: "India", includeFlights: null, flyingFrom: null })).toBe(true);
  });
});

describe("ReviewStep flights", () => {
  it("says where the flights are from, or that they are left out", () => {
    const { unmount } = render(<ReviewStep data={{ ...EMPTY, destination: "Japan", flyingFrom: "CCU" }} />);
    expect(screen.getByText("From Kolkata (estimate)")).toBeInTheDocument();
    unmount();
    render(<ReviewStep data={{ ...EMPTY, destination: "Japan", includeFlights: false }} />);
    expect(screen.getByText("Not included")).toBeInTheDocument();
  });
});
