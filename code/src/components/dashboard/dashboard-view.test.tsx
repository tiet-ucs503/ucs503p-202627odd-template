import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import type { Trip } from "@/types/trip";

const today = "2026-11-03";

function trip(id: string, title: string, startDate: string, endDate: string): Trip {
  return {
    id,
    title,
    destination: "Thailand",
    startDate,
    endDate,
    dayCount: 5,
    travelers: 2,
    currency: "INR",
    budget: { total: 100000 },
    cities: [],
    days: [],
  } as unknown as Trip;
}

const view = (trips: Trip[] | null, extra: Partial<Parameters<typeof DashboardView>[0]> = {}) =>
  render(<DashboardView trips={trips} loadError={null} today={today} hour={9} {...extra} />);

describe("DashboardView", () => {
  it("offers both ways to start, whatever the trips", () => {
    view(null);
    expect(screen.getByRole("link", { name: /Plan a trip/ })).toHaveAttribute("href", "/trips/new");
    expect(screen.getByRole("link", { name: /Ask Travis/ })).toHaveAttribute("href", "/travis");
  });

  it("greets by name and time of day", () => {
    view([], { firstName: "Asha", hour: 9 });
    expect(screen.getByText("Good morning, Asha")).toBeInTheDocument();
  });

  it("changes the greeting through the day", () => {
    const { unmount } = view([], { hour: 14 });
    expect(screen.getByText("Good afternoon")).toBeInTheDocument();
    unmount();
    view([], { hour: 21 });
    expect(screen.getByText("Good evening")).toBeInTheDocument();
  });

  it("holds the place of the trips while they load", () => {
    view(null);
    expect(screen.queryByRole("heading", { name: "Your trips" })).not.toBeInTheDocument();
    expect(screen.queryByText("Your trips will live here")).not.toBeInTheDocument();
  });

  it("says what happens next when there are no trips", () => {
    view([]);
    expect(screen.getByText("Your trips will live here")).toBeInTheDocument();
  });

  it("puts the next trip first, and the most recent past trip first", () => {
    view([
      trip("late", "Later trip", "2027-03-01", "2027-03-05"),
      trip("soon", "Sooner trip", "2026-12-01", "2026-12-05"),
      trip("old", "Older trip", "2026-05-01", "2026-05-05"),
      trip("recent", "Recent trip", "2026-10-01", "2026-10-05"),
    ]);

    const names = (heading: string) =>
      within(screen.getByRole("region", { name: heading }))
        .getAllByRole("heading", { level: 3 })
        .map((h) => h.textContent);

    expect(names("Your trips")).toEqual(["Sooner trip", "Later trip"]);
    expect(names("Past trips")).toEqual(["Recent trip", "Older trip"]);
  });

  it("keeps a trip that is under way with the upcoming ones", () => {
    view([trip("now", "Right now", "2026-11-01", "2026-11-08")]);
    expect(within(screen.getByRole("region", { name: "Your trips" })).getByText("Right now")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Past trips" })).not.toBeInTheDocument();
  });

  it("shows a loading failure without hiding the way to start a trip", () => {
    view(null, { loadError: "Missing permissions" });
    expect(screen.getByText(/Couldn't load your trips: Missing permissions/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Plan a trip/ })).toBeInTheDocument();
  });

  it("credits its photographs", () => {
    view([]);
    expect(screen.getByRole("link", { name: "Photo credits" })).toHaveAttribute("href", "/credits");
  });
});
