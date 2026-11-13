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
      includeFlights: null,
      flyingFrom: null,
    });
  });

  it("fills in what a Travis suggestion knows", () => {
    const data = buildInitialWizardData(
      { destination: "Bali, Indonesia", startDate: "2027-04-01", endDate: "2027-04-08", preferences: ["beaches", "relaxation"] },
      defaults,
    );
    // The draft named a place inside a country; the field takes the country.
    expect(data).toMatchObject({
      destination: "Indonesia",
      startDate: "2027-04-01",
      endDate: "2027-04-08",
      preferences: ["beaches", "relaxation"],
    });
  });

  it("keeps a supported country exactly as given", () => {
    expect(buildInitialWizardData({ destination: "Japan" }, defaults).destination).toBe("Japan");
  });

  it("empties a destination that is not a supported country, instead of showing something the picker cannot", () => {
    expect(buildInitialWizardData({ destination: "Narnia" }, defaults).destination).toBe("");
    expect(buildInitialWizardData({ destination: "   " }, defaults).destination).toBe("");
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

describe("buildInitialWizardData flights choice", () => {
  it("leaves the choice open when the draft has none", () => {
    expect(buildInitialWizardData({ destination: "Japan" }, defaults).includeFlights).toBeNull();
  });

  it("keeps a choice the draft made", () => {
    expect(buildInitialWizardData({ includeFlights: false }, defaults).includeFlights).toBe(false);
  });
});

describe("buildInitialWizardData flying from", () => {
  it("keeps a known starting airport from the draft", () => {
    expect(buildInitialWizardData({ origin: "BOM" }, defaults).flyingFrom).toBe("BOM");
    expect(buildInitialWizardData({ origin: "blr" }, defaults).flyingFrom).toBe("BLR");
  });

  it("drops anything that isn't one of the offered airports", () => {
    expect(buildInitialWizardData({ origin: "IXL" }, defaults).flyingFrom).toBeNull();
    expect(buildInitialWizardData({ origin: "ZZZ" }, defaults).flyingFrom).toBeNull();
    expect(buildInitialWizardData({ origin: 42 as unknown as string }, defaults).flyingFrom).toBeNull();
    expect(buildInitialWizardData(null, defaults).flyingFrom).toBeNull();
  });
});
