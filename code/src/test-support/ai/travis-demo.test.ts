import { describe, expect, it } from "vitest";
import { DEMO_DESTINATIONS } from "@/test-support/ai/travis-demo";
import { MockAIProvider } from "@/test-support/ai/mock-provider";
import { containsPriceClaim } from "@/lib/services/travis/price-guard";
import { travelStyleSchema } from "@/lib/validation/shared";

/**
 * The demo catalogue is hand-written content, so it gets checked like data:
 * it must hold to the same rules Travis holds a real model to.
 */

const allText = (d: (typeof DEMO_DESTINATIONS)[number]) => [
  d.headline,
  d.weatherNote,
  d.watchOut,
  d.best.costReason,
  d.cheap.costReason,
  d.cheap.weatherNote,
];

describe("demo catalogue", () => {
  it("contains no amounts of money, which Travis must never state", () => {
    for (const d of DEMO_DESTINATIONS) {
      for (const text of allText(d)) {
        expect(containsPriceClaim(text), `${d.destination}: "${text}"`).toBe(false);
      }
    }
  });

  it("uses real month numbers and a sensible trip length", () => {
    for (const d of DEMO_DESTINATIONS) {
      for (const month of [d.best.startMonth, d.best.endMonth, d.cheap.startMonth, d.cheap.endMonth]) {
        expect(month).toBeGreaterThanOrEqual(1);
        expect(month).toBeLessThanOrEqual(12);
      }
      expect(d.suggestedDays).toBeGreaterThanOrEqual(2);
      expect(d.suggestedDays).toBeLessThanOrEqual(21);
    }
  });

  it("uses only travel styles the wizard understands", () => {
    for (const d of DEMO_DESTINATIONS) {
      for (const style of d.styles) expect(travelStyleSchema.safeParse(style).success).toBe(true);
    }
  });

  it("has unique destinations and lower-case keywords that do not overlap", () => {
    const names = DEMO_DESTINATIONS.map((d) => d.destination);
    expect(new Set(names).size).toBe(names.length);

    const keywords = DEMO_DESTINATIONS.flatMap((d) => d.keywords);
    expect(new Set(keywords).size).toBe(keywords.length);
    for (const keyword of keywords) expect(keyword).toBe(keyword.toLowerCase());
  });
});

describe("the demo stand-in's answers", () => {
  const converse = (content: string) =>
    new MockAIProvider().converse({ today: "2026-03-10", messages: [{ role: "user", content }] });

  it("answers about a place the traveller names", async () => {
    const turn = await converse("What is the best time to visit Japan?");
    expect(turn.suggestions.map((s) => s.destination)).toEqual(["Japan"]);
  });

  it("offers lower-cost windows when asked for cheap", async () => {
    const turn = await converse("When is Thailand cheapest?");
    expect(turn.suggestions[0].costOutlook).toBe("lower");
    // The monsoon months, not the dry-season peak.
    expect([turn.suggestions[0].startMonth, turn.suggestions[0].endMonth]).toEqual([6, 9]);
  });

  it("only offers places whose window includes a month the traveller asks about", async () => {
    const turn = await converse("Somewhere to go in December");
    expect(turn.suggestions.length).toBeGreaterThan(0);
    for (const s of turn.suggestions) {
      const inWindow =
        s.startMonth <= s.endMonth
          ? 12 >= s.startMonth && 12 <= s.endMonth
          : 12 >= s.startMonth || 12 <= s.endMonth;
      expect(inWindow, s.destination).toBe(true);
    }
  });

  it("still answers when it recognises nothing", async () => {
    const turn = await converse("hello");
    expect(turn.suggestions.length).toBeGreaterThan(0);
    expect(turn.suggestions.length).toBeLessThanOrEqual(3);
  });

  it("says plainly that its answers are demo data", async () => {
    const turn = await converse("Where should I go?");
    expect(turn.reply).toMatch(/demo data/i);
  });

  it("never states a price, whatever it is asked", async () => {
    for (const question of ["cheap flights to Bali", "how much is Japan", "budget trip in June"]) {
      const turn = await converse(question);
      expect(containsPriceClaim(turn.reply), question).toBe(false);
    }
  });
});
