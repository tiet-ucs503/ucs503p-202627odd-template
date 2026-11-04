import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DestinationSlides } from "@/components/destinations/destination-slides";
import { countryByCode } from "@/lib/countries";

const INTERVAL = 5000;
const countries = ["JP", "IT", "IS"].map((code) => countryByCode(code)!);

function setup(extra: Partial<Parameters<typeof DestinationSlides>[0]> = {}) {
  const onPlan = vi.fn();
  const view = render(
    <DestinationSlides countries={countries} onPlan={onPlan} intervalMs={INTERVAL} label="Ideas" {...extra} />,
  );
  return { onPlan, ...view };
}

/** The slide a sighted person is looking at: the one that is not aria-hidden. */
const current = () =>
  screen
    .getAllByRole("group", { hidden: true })
    .find((slide) => slide.getAttribute("aria-hidden") === "false")
    ?.getAttribute("aria-label");

const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("structure", () => {
  it("is a named carousel of slides, each saying where it is in the set", () => {
    setup();
    expect(screen.getByRole("region", { name: "Ideas" })).toHaveAttribute("aria-roledescription", "carousel");
    const labels = screen.getAllByRole("group", { hidden: true }).map((g) => g.getAttribute("aria-label"));
    expect(labels).toEqual(["1 of 3: Japan", "2 of 3: Italy", "3 of 3: Iceland"]);
  });

  it("shows the first country, its tagline and best months", () => {
    setup();
    expect(screen.getByRole("heading", { name: "Japan" })).toBeInTheDocument();
    expect(screen.getByText(countries[0].tagline)).toBeInTheDocument();
    expect(screen.getByText(/Best Mar–May/)).toBeInTheDocument();
  });

  it("renders nothing for an empty list, and no controls for a single slide", () => {
    const { container, unmount } = setup({ countries: [] });
    expect(container).toBeEmptyDOMElement();
    unmount();

    setup({ countries: [countries[0]] });
    expect(screen.queryByRole("button", { name: "Next destination" })).not.toBeInTheDocument();
  });

  it("only the current slide's photo has a description; the others are decoration", () => {
    const { container } = setup();
    const alts = [...container.querySelectorAll("img")].map((img) => img.getAttribute("alt"));
    expect(alts[0]!.length).toBeGreaterThan(0);
    expect(alts.slice(1)).toEqual(["", ""]);
  });
});

describe("moving on its own", () => {
  it("advances after the interval, and wraps round", () => {
    setup();
    expect(current()).toBe("1 of 3: Japan");
    advance(INTERVAL);
    expect(current()).toBe("2 of 3: Italy");
    advance(INTERVAL);
    expect(current()).toBe("3 of 3: Iceland");
    advance(INTERVAL);
    expect(current()).toBe("1 of 3: Japan");
  });

  it("is quiet for screen readers while it moves", () => {
    setup();
    expect(screen.getByText("Japan, 1 of 3")).toHaveAttribute("aria-live", "off");
  });
});

describe("holding still", () => {
  it("stops while the pointer is over it, and carries on when it leaves", () => {
    setup();
    const carousel = screen.getByRole("region", { name: "Ideas" });
    fireEvent.mouseEnter(carousel);
    advance(INTERVAL * 3);
    expect(current()).toBe("1 of 3: Japan");

    fireEvent.mouseLeave(carousel);
    advance(INTERVAL);
    expect(current()).toBe("2 of 3: Italy");
  });

  it("stops while focus is inside it", () => {
    setup();
    fireEvent.focus(screen.getByRole("button", { name: "Next destination" }));
    advance(INTERVAL * 2);
    expect(current()).toBe("1 of 3: Japan");
  });

  it("stops when the person pauses it, and says so to screen readers", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Pause slideshow" }));
    advance(INTERVAL * 3);
    expect(current()).toBe("1 of 3: Japan");
    expect(screen.getByText("Japan, 1 of 3")).toHaveAttribute("aria-live", "polite");

    fireEvent.click(screen.getByRole("button", { name: "Resume slideshow" }));
    advance(INTERVAL);
    expect(current()).toBe("2 of 3: Italy");
  });

  it("stops while the tab is hidden", () => {
    setup();
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    act(() => void document.dispatchEvent(new Event("visibilitychange")));
    advance(INTERVAL * 2);
    expect(current()).toBe("1 of 3: Japan");

    Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
    act(() => void document.dispatchEvent(new Event("visibilitychange")));
    advance(INTERVAL);
    expect(current()).toBe("2 of 3: Italy");
  });

  it("does not start moving for someone who asked their device for reduced motion", () => {
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query.includes("prefers-reduced-motion"),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    })) as unknown as typeof window.matchMedia;
    try {
      setup();
      advance(INTERVAL * 3);
      expect(current()).toBe("1 of 3: Japan");
    } finally {
      window.matchMedia = original;
    }
  });
});

describe("moving by hand", () => {
  it("goes to the next and previous slides, wrapping at both ends", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Previous destination" }));
    expect(current()).toBe("3 of 3: Iceland");
    fireEvent.click(screen.getByRole("button", { name: "Next destination" }));
    expect(current()).toBe("1 of 3: Japan");
  });

  it("jumps to a slide from the progress bar", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Show Iceland" }));
    expect(current()).toBe("3 of 3: Iceland");
    expect(screen.getByRole("button", { name: "Show Iceland" })).toHaveAttribute("aria-current", "true");
  });

  it("answers the arrow keys", () => {
    setup();
    const carousel = screen.getByRole("region", { name: "Ideas" });
    fireEvent.keyDown(carousel, { key: "ArrowRight" });
    expect(current()).toBe("2 of 3: Italy");
    fireEvent.keyDown(carousel, { key: "ArrowLeft" });
    fireEvent.keyDown(carousel, { key: "ArrowLeft" });
    expect(current()).toBe("3 of 3: Iceland");
  });

  it("answers a swipe, but not a tap or a small wobble", () => {
    setup();
    const carousel = screen.getByRole("region", { name: "Ideas" });

    fireEvent.pointerDown(carousel, { clientX: 300 });
    fireEvent.pointerUp(carousel, { clientX: 290 });
    expect(current()).toBe("1 of 3: Japan");

    fireEvent.pointerDown(carousel, { clientX: 300 });
    fireEvent.pointerUp(carousel, { clientX: 200 });
    expect(current()).toBe("2 of 3: Italy");

    fireEvent.pointerDown(carousel, { clientX: 200 });
    fireEvent.pointerUp(carousel, { clientX: 320 });
    expect(current()).toBe("1 of 3: Japan");
  });

  it("gives a slide reached by hand a full interval before moving on", () => {
    setup();
    advance(INTERVAL - 500);
    fireEvent.click(screen.getByRole("button", { name: "Next destination" }));
    advance(INTERVAL - 500);
    expect(current()).toBe("2 of 3: Italy");
    advance(600);
    expect(current()).toBe("3 of 3: Iceland");
  });
});

describe("planning", () => {
  it("offers to plan the country on screen", () => {
    const { onPlan } = setup();
    fireEvent.click(screen.getByRole("button", { name: /Plan Japan/ }));
    expect(onPlan).toHaveBeenCalledWith(expect.objectContaining({ code: "JP", name: "Japan" }));
  });

  it("offers the new country after moving on", () => {
    const { onPlan } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Next destination" }));
    fireEvent.click(screen.getByRole("button", { name: /Plan Italy/ }));
    expect(onPlan).toHaveBeenCalledWith(expect.objectContaining({ code: "IT" }));
  });
});
