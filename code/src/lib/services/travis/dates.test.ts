import { describe, expect, it } from "vitest";
import { MIN_LEAD_DAYS, suggestDates, windowLabel } from "@/lib/services/travis/dates";

const DAY_MS = 24 * 60 * 60 * 1000;
const ms = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

describe("windowLabel", () => {
  it("abbreviates a range of months", () => {
    expect(windowLabel(6, 8)).toBe("Jun–Aug");
  });

  it("writes a window that wraps the new year in order", () => {
    expect(windowLabel(11, 2)).toBe("Nov–Feb");
  });

  it("spells out a single month", () => {
    expect(windowLabel(4, 4)).toBe("April");
  });

  it("calls a window covering every month year-round", () => {
    expect(windowLabel(1, 12)).toBe("Year-round");
    expect(windowLabel(5, 4)).toBe("Year-round");
  });
});

describe("suggestDates", () => {
  it("starts at the beginning of a window that is still ahead", () => {
    expect(suggestDates({ startMonth: 6, endMonth: 8, days: 8, today: "2026-03-10" })).toEqual({
      startDate: "2026-06-01",
      endDate: "2026-06-08",
    });
  });

  it("starts after the lead time when the window is already under way", () => {
    // 1 Jul + 14 days = 15 Jul, still comfortably inside Jun–Aug.
    expect(suggestDates({ startMonth: 6, endMonth: 8, days: 8, today: "2026-07-01" })).toEqual({
      startDate: "2026-07-15",
      endDate: "2026-07-22",
    });
  });

  it("moves to next year when too little of the window is left to fit the trip", () => {
    // 20 Aug + 14 days is 3 Sep: past the end of Jun–Aug.
    expect(suggestDates({ startMonth: 6, endMonth: 8, days: 7, today: "2026-08-20" })).toEqual({
      startDate: "2027-06-01",
      endDate: "2027-06-07",
    });
  });

  it("does not offer a trip that hangs off the end of the window when next year fits it", () => {
    // 25 Jul + 14 = 8 Aug; a 30-day trip from there would run well past 31 Aug.
    const result = suggestDates({ startMonth: 6, endMonth: 8, days: 30, today: "2026-07-25" });
    expect(result.startDate).toBe("2027-06-01");
    expect(ms(result.endDate)).toBeLessThanOrEqual(ms("2027-08-31"));
  });

  it("handles a window that wraps the new year", () => {
    expect(suggestDates({ startMonth: 11, endMonth: 2, days: 7, today: "2026-03-01" })).toEqual({
      startDate: "2026-11-01",
      endDate: "2026-11-07",
    });
  });

  it("recognises that a wrapping window begun last year is still running", () => {
    // Nov 2026 – Feb 2027. On 5 Jan 2027 it is mid-window; +14 days is 19 Jan.
    expect(suggestDates({ startMonth: 11, endMonth: 2, days: 6, today: "2027-01-05" })).toEqual({
      startDate: "2027-01-19",
      endDate: "2027-01-24",
    });
  });

  it("knows February has 29 days in a leap year", () => {
    // 2028 is a leap year; a Jan–Feb window ends on the 29th.
    expect(suggestDates({ startMonth: 1, endMonth: 2, days: 10, today: "2027-12-01" })).toEqual({
      startDate: "2028-01-01",
      endDate: "2028-01-10",
    });

    // Starting 26 Feb 2028 a 4-day trip ends on the 29th, so it still fits.
    const lateFebruary = suggestDates({ startMonth: 2, endMonth: 2, days: 4, today: "2028-02-12" });
    expect(lateFebruary).toEqual({ startDate: "2028-02-26", endDate: "2028-02-29" });
  });

  it("still returns the first upcoming window when the trip is longer than the window", () => {
    const result = suggestDates({ startMonth: 7, endMonth: 7, days: 40, today: "2026-03-01" });
    expect(result.startDate).toBe("2026-07-01");
    expect(ms(result.endDate) - ms(result.startDate)).toBe(39 * DAY_MS);
  });

  it("never returns a trip of the wrong length", () => {
    const { startDate, endDate } = suggestDates({ startMonth: 3, endMonth: 5, days: 9, today: "2026-02-02" });
    expect((ms(endDate) - ms(startDate)) / DAY_MS + 1).toBe(9);
  });

  it("is never in the past and never inside the lead time, for any window on any day", () => {
    // Sweep a full year of "today" values against every window shape.
    for (let offset = 0; offset < 366; offset += 7) {
      const today = new Date(ms("2026-01-01") + offset * DAY_MS).toISOString().slice(0, 10);
      for (let start = 1; start <= 12; start++) {
        for (let end = 1; end <= 12; end++) {
          const { startDate } = suggestDates({ startMonth: start, endMonth: end, days: 7, today });
          expect(
            ms(startDate) - ms(today),
            `window ${start}-${end} from ${today} gave ${startDate}`,
          ).toBeGreaterThanOrEqual(MIN_LEAD_DAYS * DAY_MS);
        }
      }
    }
  });

  it("keeps the trip inside the window whenever it fits", () => {
    const { startDate, endDate } = suggestDates({ startMonth: 10, endMonth: 12, days: 10, today: "2026-04-04" });
    expect(startDate >= "2026-10-01" && endDate <= "2026-12-31").toBe(true);
  });
});
