import { describe, expect, it } from "vitest";
import { tripTiming } from "@/lib/trip-timing";

const today = "2026-11-03";

describe("tripTiming", () => {
  it("counts the days to a trip that has not started", () => {
    expect(tripTiming("2026-11-10", "2026-11-17", today)).toEqual({ phase: "upcoming", label: "In 7 days" });
  });

  it("says tomorrow, not 'in 1 day'", () => {
    expect(tripTiming("2026-11-04", "2026-11-09", today).label).toBe("Tomorrow");
  });

  it("moves to weeks, then months, as the trip gets further away", () => {
    expect(tripTiming("2026-11-17", "2026-11-20", today).label).toBe("In 2 weeks");
    expect(tripTiming("2027-02-03", "2027-02-10", today).label).toBe("In 3 months");
  });

  it("is happening now on the first day, in the middle and on the last day", () => {
    expect(tripTiming("2026-11-03", "2026-11-09", today)).toEqual({ phase: "now", label: "Happening now" });
    expect(tripTiming("2026-10-30", "2026-11-09", today).phase).toBe("now");
    expect(tripTiming("2026-10-28", "2026-11-03", today).phase).toBe("now");
  });

  it("is a single-day trip today", () => {
    expect(tripTiming("2026-11-03", "2026-11-03", today).phase).toBe("now");
  });

  it("is past the day after it ends", () => {
    expect(tripTiming("2026-10-20", "2026-11-02", today)).toEqual({ phase: "past", label: "Ended yesterday" });
  });

  it("says how long ago a trip ended", () => {
    expect(tripTiming("2026-10-01", "2026-10-20", today).label).toBe("Ended 2 weeks ago");
    expect(tripTiming("2026-06-01", "2026-06-10", today).label).toBe("Ended 5 months ago");
  });

  it("does not read as '1 weeks' or '1 months'", () => {
    // 14 days is the smallest span shown in weeks, and 60 the smallest in months.
    expect(tripTiming("2026-11-17", "2026-11-20", today).label).toBe("In 2 weeks");
    expect(tripTiming("2027-01-02", "2027-01-05", today).label).toBe("In 2 months");
  });
});
