import { describe, expect, it } from "vitest";
import { fromInr, toInr } from "@/lib/fx";

describe("toInr", () => {
  it("leaves rupees unchanged", () => {
    expect(toInr(250000, "INR")).toBe(250000);
  });

  it("converts the supported foreign currencies using the static rates", () => {
    expect(toInr(1000, "USD")).toBe(83000);
    expect(toInr(1000, "EUR")).toBe(90000);
    expect(toInr(1000, "GBP")).toBe(105000);
  });

  it("treats an unknown currency as rupees, like fromInr", () => {
    expect(toInr(500, "XYZ")).toBe(500);
  });

  it("round-trips with fromInr for whole-number amounts", () => {
    expect(fromInr(toInr(3614, "USD"), "USD")).toBe(3614);
  });

  it("handles zero", () => {
    expect(toInr(0, "USD")).toBe(0);
  });
});
