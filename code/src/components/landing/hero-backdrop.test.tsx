import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HeroBackdrop } from "@/components/landing/hero-backdrop";
import { countryByCode } from "@/lib/countries";

const INTERVAL = 4000;
const countries = ["JP", "IT", "IS"].map((code) => countryByCode(code)!);
const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("HeroBackdrop", () => {
  it("captions the country on show, with its best months", () => {
    render(<HeroBackdrop countries={countries} intervalMs={INTERVAL} />);
    expect(screen.getByText("Japan")).toBeInTheDocument();
    expect(screen.getByText(/usually best Mar–May/)).toBeInTheDocument();
  });

  it("moves to the next country after the interval, and round again", () => {
    render(<HeroBackdrop countries={countries} intervalMs={INTERVAL} />);
    advance(INTERVAL);
    expect(screen.getByText("Italy")).toBeInTheDocument();
    advance(INTERVAL);
    expect(screen.getByText("Iceland")).toBeInTheDocument();
    advance(INTERVAL);
    expect(screen.getByText("Japan")).toBeInTheDocument();
  });

  it("describes only the photo on show to a screen reader", () => {
    const { container } = render(<HeroBackdrop countries={countries} intervalMs={INTERVAL} />);
    const alts = [...container.querySelectorAll("img")].map((img) => img.getAttribute("alt"));
    expect(alts[0]!.length).toBeGreaterThan(0);
    expect(alts.slice(1)).toEqual(["", ""]);
  });

  it("stays on one country while the tab is hidden", () => {
    render(<HeroBackdrop countries={countries} intervalMs={INTERVAL} />);
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    act(() => void document.dispatchEvent(new Event("visibilitychange")));
    advance(INTERVAL * 3);
    expect(screen.getByText("Japan")).toBeInTheDocument();
    Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
  });

  it("renders nothing without countries, and does not move with only one", () => {
    const { container, unmount } = render(<HeroBackdrop countries={[]} />);
    expect(container).toBeEmptyDOMElement();
    unmount();

    render(<HeroBackdrop countries={[countries[0]]} intervalMs={INTERVAL} />);
    advance(INTERVAL * 3);
    expect(screen.getByText("Japan")).toBeInTheDocument();
  });
});
