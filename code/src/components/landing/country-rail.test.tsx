import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CountryRail } from "@/components/landing/country-rail";
import { COUNTRIES } from "@/lib/countries";

describe("CountryRail", () => {
  it("offers a row of countries, each a button that names it and its best months", () => {
    render(<CountryRail onPick={vi.fn()} />);
    const japan = screen.getByRole("button", { name: /Japan/ });
    expect(japan).toHaveTextContent("Usually best Mar–May");
  });

  it("only offers countries that are supported", () => {
    render(<CountryRail onPick={vi.fn()} />);
    const supported = new Set(COUNTRIES.map((country) => country.name));
    const names = screen
      .getAllByRole("button")
      .map((button) => button.querySelector(".font-display")?.textContent)
      .filter(Boolean);
    expect(names.length).toBeGreaterThanOrEqual(8);
    for (const name of names) expect(supported.has(name!), String(name)).toBe(true);
  });

  it("starts a trip to the one picked", () => {
    const onPick = vi.fn();
    render(<CountryRail onPick={onPick} />);
    fireEvent.click(screen.getByRole("button", { name: /Italy/ }));
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ code: "IT", name: "Italy" }));
  });

  it("says how many countries there are, from the list itself", () => {
    render(<CountryRail onPick={vi.fn()} />);
    expect(screen.getByRole("heading", { name: `Pick from ${COUNTRIES.length} countries` })).toBeInTheDocument();
  });

  it("has buttons to scroll for people without a touchscreen or trackpad", () => {
    render(<CountryRail onPick={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Scroll countries left" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Scroll countries right" })).toBeInTheDocument();
  });
});
