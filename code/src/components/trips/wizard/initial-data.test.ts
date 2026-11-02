import { describe, expect, it } from "vitest";
import { buildInitialWizardData, startingStep } from "@/components/trips/wizard/initial-data";

const defaults = { startDate: "2026-12-01", endDate: "2026-12-08" };

describe("buildInitialWizardData", () => {
  it("opens on the wizard's own defaults when there is no draft", () => {
    expect(buildInitialWizardData(null, defaults)).toEqual({
      destination: "",
      startDate: "2026-12-01",
      endDate: "2026-12-08",
      budget: "150000",
      currency: "INR",
      travelerType: "couple",
      travelers: 2,
      preferences: [],
    });
  });

  it("fills in what a Travis suggestion knows", () => {
    const data = buildInitialWizardData(
      { destination: "Bali, Indonesia", startDate: "2027-04-01", endDate: "2027-04-08", preferences: ["beaches", "relaxation"] },
      defaults,
    );
    expect(data).toMatchObject({
      destination: "Bali, Indonesia",
      startDate: "2027-04-01",
      endDate: "2027-04-08",
      preferences: ["beaches", "relaxation"],
    });
  });

  it("leaves budget, currency and party size at their defaults when the draft does not say", () => {
    const data = buildInitialWizardData({ destination: "Bali, Indonesia" }, defaults);
    expect(data.budget).toBe("150000");
    expect(data.currency).toBe("INR");
    expect(data.travelers).toBe(2);
    expect(data.travelerType).toBe("couple");
  });

  it("keeps the landing page's budget and currency when it supplied them", () => {
    const data = buildInitialWizardData({ budget: 5000, currency: "USD" }, defaults);
    expect(data.budget).toBe("5000");
    expect(data.currency).toBe("USD");
  });

  it("drops a travel style the wizard does not know, rather than passing it through", () => {
    const data = buildInitialWizardData({ preferences: ["beaches", "skiing" as never] }, defaults);
    expect(data.preferences).toEqual(["beaches"]);
  });

  it("falls back for a currency the app does not support", () => {
    expect(buildInitialWizardData({ currency: "XYZ" as never }, defaults).currency).toBe("INR");
  });

  it.each([0, -3, 21, 2.5, Number.NaN])("falls back for an impossible traveller count: %s", (travelers) => {
    expect(buildInitialWizardData({ travelers }, defaults).travelers).toBe(2);
  });

  it("accepts a sensible traveller count and type", () => {
    const data = buildInitialWizardData({ travelers: 4, travelerType: "family" }, defaults);
    expect(data.travelers).toBe(4);
    expect(data.travelerType).toBe("family");
  });

  it("falls back for an unknown traveller type", () => {
    expect(buildInitialWizardData({ travelerType: "robots" as never }, defaults).travelerType).toBe("couple");
  });

  it("falls back for a budget that is not a positive number", () => {
    expect(buildInitialWizardData({ budget: -5 }, defaults).budget).toBe("150000");
    expect(buildInitialWizardData({ budget: 0 }, defaults).budget).toBe("150000");
  });

  it("survives a draft whose fields are the wrong type altogether", () => {
    const hostile = { destination: 42, preferences: "beaches", travelers: "many" } as never;
    const data = buildInitialWizardData(hostile, defaults);
    expect(data.destination).toBe("");
    expect(data.preferences).toEqual([]);
    expect(data.travelers).toBe(2);
  });
});

describe("startingStep", () => {
  it("opens on the first step normally", () => {
    expect(startingStep(null)).toBe(0);
  });

  it("opens on the dates after a Travis suggestion, since the destination is already settled", () => {
    expect(startingStep({ source: "travis", destination: "Bali", windowLabel: "Apr–Jun" })).toBe(1);
  });
});
