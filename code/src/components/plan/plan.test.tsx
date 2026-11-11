import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { DayPanel } from "@/components/plan/day-panel";
import { DayStrip, dayTabId } from "@/components/plan/day-strip";
import { StaysPanel } from "@/components/plan/stays-panel";
import { analyzeTrip } from "@/lib/services/feasibility";
import { buildThailandTrip } from "@/test-support/trip-fixture";
import type { Trip } from "@/types/trip";
import type { DayPlan } from "@/types/travel";

let trip: Trip;
let plans: Record<string, DayPlan>;

beforeAll(async () => {
  const agent = await buildThailandTrip();
  trip = { ...agent, ownerId: "u", status: "planned", createdAt: new Date(0), updatedAt: new Date(0) } as unknown as Trip;
  plans = analyzeTrip(trip).days;
});

const cities = () => [...trip.cities].sort((a, b) => a.order - b.order);
const days = () => [...trip.days].sort((a, b) => a.dayNumber - b.dayNumber);

describe("DayStrip", () => {
  it("shows every day of the trip, grouped under its city", () => {
    render(<DayStrip cities={cities()} days={days()} selectedDayId={null} plans={plans} onSelect={vi.fn()} />);
    const nav = screen.getByRole("navigation", { name: "Days of the trip" });

    for (const city of cities()) {
      const count = trip.days.filter((d) => d.cityId === city.id).length;
      expect(within(nav).getByText(new RegExp(`^${city.name}`))).toBeInTheDocument();
      expect(within(nav).getByText(`· ${count} days`)).toBeInTheDocument();
    }
    expect(within(nav).getAllByRole("button", { name: /^Day \d+, / })).toHaveLength(trip.days.length);
  });

  it("names a day by number, date and city for a screen reader", () => {
    render(<DayStrip cities={cities()} days={days()} selectedDayId={null} plans={undefined} onSelect={vi.fn()} />);
    const first = days()[0];
    const city = cities().find((c) => c.id === first.cityId)!;
    expect(screen.getByRole("button", { name: new RegExp(`^Day ${first.dayNumber}, .+, ${city.name}$`) })).toBeInTheDocument();
  });

  it("marks only the chosen day as current", () => {
    const chosen = days()[3];
    render(<DayStrip cities={cities()} days={days()} selectedDayId={chosen.id} plans={undefined} onSelect={vi.fn()} />);
    const current = screen.getAllByRole("button").filter((b) => b.getAttribute("aria-current") === "true");
    expect(current).toHaveLength(1);
    expect(current[0].id).toBe(dayTabId(chosen.id));
  });

  it("chooses a day when it is pressed", () => {
    const onSelect = vi.fn();
    render(<DayStrip cities={cities()} days={days()} selectedDayId={null} plans={undefined} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: /^Day 5, / }));
    expect(onSelect).toHaveBeenCalledWith(days()[4].id);
  });

  it("brings the chosen day into view, sideways only", () => {
    const scroll = vi.spyOn(Element.prototype, "scrollIntoView");
    render(<DayStrip cities={cities()} days={days()} selectedDayId={days()[6].id} plans={undefined} onSelect={vi.fn()} />);
    expect(scroll).toHaveBeenCalledWith({ inline: "center", block: "nearest", behavior: "smooth" });
    scroll.mockRestore();
  });

  it("says nothing about crowded days when there are none", () => {
    const relaxed = Object.fromEntries(Object.entries(plans).map(([id, p]) => [id, { ...p, feasibility: { ...p.feasibility, feasible: true } }]));
    render(<DayStrip cities={cities()} days={days()} selectedDayId={null} plans={relaxed} onSelect={vi.fn()} />);
    expect(screen.queryByText("May be too full:")).not.toBeInTheDocument();
  });

  it("flags a day that may not fit, and offers a way to it", () => {
    const target = days()[2];
    const crowded = { ...plans, [target.id]: { ...plans[target.id], feasibility: { ...plans[target.id].feasibility, feasible: false } } };
    const onSelect = vi.fn();
    render(<DayStrip cities={cities()} days={days()} selectedDayId={null} plans={crowded} onSelect={onSelect} />);

    expect(screen.getByRole("button", { name: new RegExp(`^Day 3, .*may be too full$`) })).toBeInTheDocument();
    expect(screen.getByText("May be too full:")).toBeInTheDocument();
    // The line beneath the strip is a second, quicker route to the same day.
    fireEvent.click(screen.getByRole("button", { name: "Day 3" }));
    expect(onSelect).toHaveBeenCalledWith(target.id);
  });

  it("lists several crowded days in order", () => {
    const crowded = { ...plans };
    for (const d of [days()[6], days()[1]]) crowded[d.id] = { ...plans[d.id], feasibility: { ...plans[d.id].feasibility, feasible: false } };
    render(<DayStrip cities={cities()} days={days()} selectedDayId={null} plans={crowded} onSelect={vi.fn()} />);
    const line = screen.getByText("May be too full:").closest("p")!;
    expect(line.textContent).toMatch(/Day 2,\s*Day 7/);
  });

  it("leaves out a city that has no days, instead of an empty heading", () => {
    const orphan = { ...cities()[0], id: "orphan", name: "Nowhere" };
    render(<DayStrip cities={[...cities(), orphan]} days={days()} selectedDayId={null} plans={undefined} onSelect={vi.fn()} />);
    expect(screen.queryByText(/Nowhere/)).not.toBeInTheDocument();
  });
});

describe("DayPanel", () => {
  const handlers = () => ({
    onSelectPlace: vi.fn(),
    onSelectDay: vi.fn(),
    onEditHotel: vi.fn(),
    onAddActivity: vi.fn(),
    onEditActivity: vi.fn(),
    onDeleteActivity: vi.fn(),
    onReorderActivities: vi.fn(),
  });

  function renderDay(index: number, extra: Partial<React.ComponentProps<typeof DayPanel>> = {}) {
    const ordered = days();
    const day = ordered[index];
    const city = cities().find((c) => c.id === day.cityId)!;
    const h = handlers();
    render(
      <DayPanel
        city={city}
        day={day}
        previous={ordered[index - 1] ?? null}
        next={ordered[index + 1] ?? null}
        cityNameOf={(id) => cities().find((c) => c.id === id)?.name ?? ""}
        currency={trip.currency}
        plan={plans[day.id] ?? null}
        selectedPlaceId={null}
        {...h}
        {...extra}
      />,
    );
    return { ...h, day, city, ordered };
  }

  it("shows the city, its hotel and only this day's places", () => {
    const { day, city } = renderDay(1);
    expect(screen.getByRole("heading", { level: 2, name: city.name })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: new RegExp(`Edit hotel in ${city.name}`) })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent(`Day ${day.dayNumber} · ${city.name}`);
    for (const a of day.activities.filter((x) => x.category !== "transport")) {
      expect(screen.getAllByText(a.name).length).toBeGreaterThan(0);
    }
  });

  it("does not show another day's places", () => {
    const { ordered } = renderDay(1);
    const other = ordered[5].activities.find((a) => !ordered[1].activities.some((x) => x.name === a.name));
    if (other) expect(screen.queryByText(other.name)).not.toBeInTheDocument();
  });

  it("moves to the next and previous day", () => {
    const { onSelectDay, ordered } = renderDay(2);
    fireEvent.click(screen.getByRole("button", { name: new RegExp(`^Day ${ordered[1].dayNumber}`) }));
    fireEvent.click(screen.getByRole("button", { name: new RegExp(`^Day ${ordered[3].dayNumber}`) }));
    expect(onSelectDay).toHaveBeenNthCalledWith(1, ordered[1].id);
    expect(onSelectDay).toHaveBeenNthCalledWith(2, ordered[3].id);
  });

  it("has no previous button on the first day, and no next on the last", () => {
    renderDay(0);
    expect(screen.queryByRole("button", { name: /^Day 0/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Day \d/ })).toHaveLength(1);
  });

  it("has no next button on the last day", () => {
    const last = trip.days.length - 1;
    const { ordered } = renderDay(last);
    expect(screen.getAllByRole("button", { name: /^Day \d/ })).toHaveLength(1);
    expect(screen.getByRole("button", { name: new RegExp(`^Day ${ordered[last - 1].dayNumber}`) })).toBeInTheDocument();
  });

  it("points Travis at the city, the day, or a place", () => {
    const onAskTravis = vi.fn();
    const { city, day } = renderDay(0, { onAskTravis });

    fireEvent.click(screen.getByRole("button", { name: `Ask Travis about ${city.name}` }));
    fireEvent.click(screen.getByRole("button", { name: "Ask Travis about this day" }));
    const place = day.activities.find((a) => a.category !== "transport")!;
    fireEvent.click(screen.getByRole("button", { name: `Ask Travis about ${place.name}` }));

    expect(onAskTravis).toHaveBeenNthCalledWith(1, { cityId: city.id });
    expect(onAskTravis).toHaveBeenNthCalledWith(2, { dayId: day.id });
    expect(onAskTravis).toHaveBeenNthCalledWith(3, { activityId: place.id });
  });

  it("offers no Ask Travis buttons when there is no assistant to ask", () => {
    renderDay(0);
    expect(screen.queryByRole("button", { name: /Ask Travis/ })).not.toBeInTheDocument();
  });

  it("starts a fresh editor for each day, so nothing open carries over", () => {
    const ordered = days();
    const city = cities()[0];
    const h = handlers();
    const props = {
      city,
      cityNameOf: () => city.name,
      currency: trip.currency,
      selectedPlaceId: null,
      ...h,
    };
    const { rerender } = render(<DayPanel {...props} day={ordered[0]} previous={null} next={ordered[1]} plan={plans[ordered[0].id]} />);
    fireEvent.click(screen.getByRole("button", { name: "Add activity" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    rerender(<DayPanel {...props} day={ordered[1]} previous={ordered[0]} next={ordered[2]} plan={plans[ordered[1].id]} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("StaysPanel", () => {
  it("shows each city's hotel and nights, and says travel times are estimates", () => {
    render(<StaysPanel cities={cities()} days={days()} currency={trip.currency} plans={plans} selectedPlaceId={null} onEditHotel={vi.fn()} />);
    expect(screen.getByText(/estimates, not live routes/i)).toBeInTheDocument();
    for (const city of cities()) {
      const section = screen.getByRole("region", { name: city.name });
      expect(within(section).getByText(city.hotel.name)).toBeInTheDocument();
    }
  });

  it("shows how you get to a city only where there is a transfer", () => {
    render(<StaysPanel cities={cities()} days={days()} currency={trip.currency} plans={plans} selectedPlaceId={null} onEditHotel={vi.fn()} />);
    const [first, second] = cities();
    expect(screen.queryByRole("list", { name: `Getting to ${first.name}` })).not.toBeInTheDocument();
    const transfer = screen.getByRole("list", { name: `Getting to ${second.name}` });
    expect(transfer.textContent).toContain(`${first.name} → ${second.name}`);
  });

  it("edits the right city's hotel", () => {
    const onEditHotel = vi.fn();
    render(<StaysPanel cities={cities()} days={days()} currency={trip.currency} plans={plans} selectedPlaceId={null} onEditHotel={onEditHotel} />);
    fireEvent.click(screen.getByRole("button", { name: new RegExp(`Edit hotel in ${cities()[1].name}`) }));
    fireEvent.change(screen.getByLabelText(/hotel name|name/i), { target: { value: "Another hotel" } });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    expect(onEditHotel).toHaveBeenCalledWith(cities()[1].id, expect.objectContaining({ name: "Another hotel" }));
  });

  it("copes with no analysis yet", () => {
    render(<StaysPanel cities={cities()} days={days()} currency={trip.currency} plans={undefined} selectedPlaceId={null} onEditHotel={vi.fn()} />);
    expect(screen.getAllByRole("region")).toHaveLength(cities().length);
  });
});
