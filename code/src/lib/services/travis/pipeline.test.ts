import { describe, expect, it } from "vitest";
import { AIProviderError, type AIProvider, type TravisRequest } from "@/lib/services/ai";
import { MockAIProvider } from "@/test-support/ai/mock-provider";
import { chatWithTravis } from "@/lib/services/travis";
import type { LlmTravisTurn } from "@/lib/validation/travis";
import type { TravisMessageInput } from "@/types/travis";

const TODAY = "2026-03-10";
const ask = (content: string): TravisMessageInput[] => [{ role: "user", content }];

/** A provider that plays back a fixed script, so each failure mode is deliberate. */
class ScriptedProvider implements AIProvider {
  readonly name = "mock" as const;
  readonly model = "scripted";
  readonly simulated = true;
  readonly requests: TravisRequest[] = [];
  readonly repairNotes: (string | undefined)[] = [];

  constructor(private readonly script: (LlmTravisTurn | AIProviderError)[]) {}

  async planCities(): Promise<never> {
    throw new Error("not used");
  }

  async proposeTripEdit(): Promise<never> {
    throw new Error("not used");
  }

  async converse(request: TravisRequest, repairNote?: string): Promise<LlmTravisTurn> {
    this.requests.push(request);
    this.repairNotes.push(repairNote);
    const next = this.script[this.requests.length - 1];
    if (!next) throw new Error("script exhausted");
    if (next instanceof AIProviderError) throw next;
    return next;
  }
}

function suggestion(overrides: Partial<LlmTravisTurn["suggestions"][number]> = {}): LlmTravisTurn["suggestions"][number] {
  return {
    destination: "Bali, Indonesia",
    headline: "Surf, rice terraces and a strong food scene.",
    startMonth: 6,
    endMonth: 8,
    costOutlook: "typical",
    costReason: "Prices usually rise in July and August.",
    weatherNote: "The dry season is usually the sunniest.",
    watchOut: null,
    suggestedDays: 8,
    styles: ["beaches", "food"],
    ...overrides,
  };
}

function turn(overrides: Partial<LlmTravisTurn> = {}): LlmTravisTurn {
  return {
    reply: "Bali suits that well in the dry season.",
    suggestions: [suggestion()],
    followUps: ["What about somewhere cheaper?"],
    ...overrides,
  };
}

describe("a normal answer", () => {
  it("returns the reply with a suggestion and calls the model once", async () => {
    const provider = new ScriptedProvider([turn()]);
    const result = await chatWithTravis(ask("Where should I go in June?"), provider, TODAY);

    expect(result.attempts).toBe(1);
    expect(result.redacted).toBe(false);
    expect(result.reply).toBe("Bali suits that well in the dry season.");
    expect(result.suggestions).toHaveLength(1);
    expect(result.suggestions[0]).toMatchObject({
      destination: "Indonesia", // the country, which is what the wizard's picker holds
      windowLabel: "Jun–Aug",
      costOutlook: "typical",
      suggestedDays: 8,
    });
  });

  it("works out the dates itself, from the months and today's date", async () => {
    const provider = new ScriptedProvider([turn()]);
    const result = await chatWithTravis(ask("June please"), provider, TODAY);
    expect(result.suggestions[0].startDate).toBe("2026-06-01");
    expect(result.suggestions[0].endDate).toBe("2026-06-08");
  });

  it("ignores a date the model tries to supply", async () => {
    const hostile = turn({
      suggestions: [{ ...suggestion(), startDate: "1999-01-01", endDate: "1999-01-08" } as never],
    });
    const result = await chatWithTravis(ask("June please"), new ScriptedProvider([hostile]), TODAY);
    expect(result.suggestions[0].startDate).toBe("2026-06-01");
  });

  it("gives each suggestion a distinct id", async () => {
    const provider = new ScriptedProvider([
      turn({ suggestions: [suggestion(), suggestion({ destination: "Thailand" }), suggestion({ destination: "Japan" })] }),
    ]);
    const ids = (await chatWithTravis(ask("Anywhere"), provider, TODAY)).suggestions.map((s) => s.id);
    expect(new Set(ids).size).toBe(3);
  });

  it("drops a place suggested twice", async () => {
    const provider = new ScriptedProvider([
      turn({ suggestions: [suggestion(), suggestion({ destination: "  bali,   indonesia " })] }),
    ]);
    const result = await chatWithTravis(ask("Anywhere"), provider, TODAY);
    expect(result.suggestions).toHaveLength(1);
  });

  it("drops a bracketed qualifier, since the wizard passes the name straight to the planner", async () => {
    const provider = new ScriptedProvider([
      turn({ suggestions: [suggestion({ destination: "Japan (Tokyo and surrounding)" })] }),
    ]);
    const result = await chatWithTravis(ask("Japan"), provider, TODAY);
    expect(result.suggestions[0].destination).toBe("Japan");
  });

  it("treats two qualified versions of one place as the same place", async () => {
    const provider = new ScriptedProvider([
      turn({
        suggestions: [
          suggestion({ destination: "Japan (Tokyo and surrounding)" }),
          suggestion({ destination: "Japan (Kyoto and Kansai region)" }),
        ],
      }),
    ]);
    const result = await chatWithTravis(ask("Japan"), provider, TODAY);
    expect(result.suggestions.map((s) => s.destination)).toEqual(["Japan"]);
  });

  it("turns a place inside a supported country into that country", async () => {
    const provider = new ScriptedProvider([
      turn({ suggestions: [suggestion({ destination: "Kyoto, Japan" }), suggestion({ destination: "Goa" })] }),
    ]);
    const result = await chatWithTravis(ask("Anywhere"), provider, TODAY);
    expect(result.suggestions.map((s) => s.destination)).toEqual(["Japan", "India"]);
  });

  it("treats a city and its country as the same place", async () => {
    const provider = new ScriptedProvider([
      turn({ suggestions: [suggestion({ destination: "Bali, Indonesia" }), suggestion({ destination: "Indonesia" })] }),
    ]);
    const result = await chatWithTravis(ask("Anywhere"), provider, TODAY);
    expect(result.suggestions.map((s) => s.destination)).toEqual(["Indonesia"]);
  });

  it("removes repeated styles and repeated follow-ups", async () => {
    const provider = new ScriptedProvider([
      turn({
        suggestions: [suggestion({ styles: ["beaches", "beaches", "food"] })],
        followUps: ["Cheaper?", "Cheaper?", "Shorter?"],
      }),
    ]);
    const result = await chatWithTravis(ask("Anywhere"), provider, TODAY);
    expect(result.suggestions[0].styles).toEqual(["beaches", "food"]);
    expect(result.followUps).toEqual(["Cheaper?", "Shorter?"]);
  });

  it("can answer with a question and no suggestions", async () => {
    const provider = new ScriptedProvider([turn({ reply: "How long do you have?", suggestions: [], followUps: [] })]);
    const result = await chatWithTravis(ask("Somewhere nice"), provider, TODAY);
    expect(result.suggestions).toEqual([]);
    expect(result.reply).toBe("How long do you have?");
  });

  it("passes today's date and the conversation to the model", async () => {
    const provider = new ScriptedProvider([turn()]);
    await chatWithTravis(ask("Hello"), provider, TODAY);
    expect(provider.requests[0]).toEqual({ messages: ask("Hello"), today: TODAY });
  });

  it("sends only the most recent turns of a long conversation", async () => {
    const long: TravisMessageInput[] = Array.from({ length: 30 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: `message ${i}`,
    }));
    long.push({ role: "user", content: "latest" });
    const provider = new ScriptedProvider([turn()]);
    await chatWithTravis(long, provider, TODAY);

    const sent = provider.requests[0].messages;
    expect(sent.length).toBeLessThanOrEqual(12);
    expect(sent.at(-1)?.content).toBe("latest");
  });
});

describe("when the model quotes a price", () => {
  const priced = () => turn({ reply: "Bali is lovely in June. Flights are about $400. It is dry then." });

  it("asks again, naming the problem, and uses the clean answer", async () => {
    const provider = new ScriptedProvider([priced(), turn()]);
    const result = await chatWithTravis(ask("Cheap flights to Bali?"), provider, TODAY);

    expect(provider.requests).toHaveLength(2);
    expect(provider.repairNotes[1]).toMatch(/amounts of money/);
    expect(result.attempts).toBe(2);
    expect(result.redacted).toBe(false);
    expect(result.reply).not.toMatch(/\$/);
  });

  it("cuts the price out itself when the model repeats it", async () => {
    const provider = new ScriptedProvider([priced(), priced()]);
    const result = await chatWithTravis(ask("Cheap flights to Bali?"), provider, TODAY);

    expect(result.redacted).toBe(true);
    expect(result.reply).toBe("Bali is lovely in June. It is dry then.");
    expect(result.reply).not.toMatch(/\$/);
  });

  it("still shows the first answer, minus its prices, if the retry cannot be made", async () => {
    const provider = new ScriptedProvider([priced(), new AIProviderError("timeout", "slow")]);
    const result = await chatWithTravis(ask("Cheap flights to Bali?"), provider, TODAY);

    expect(result.redacted).toBe(true);
    expect(result.attempts).toBe(2);
    expect(result.reply).toBe("Bali is lovely in June. It is dry then.");
  });

  it("falls back to a plain sentence when nothing is left after cutting prices", async () => {
    const allPrices = turn({ reply: "Flights are $400. Rooms are $90." });
    const result = await chatWithTravis(ask("How much?"), new ScriptedProvider([allPrices, allPrices]), TODAY);
    expect(result.reply).toBe("Here are a few places that fit what you described.");
  });

  it("catches a price hidden in a suggestion card, not only in the reply", async () => {
    const sneaky = turn({ suggestions: [suggestion({ costReason: "Rooms start from $60 a night." })] });
    const provider = new ScriptedProvider([sneaky, sneaky]);
    const result = await chatWithTravis(ask("Cheap Bali"), provider, TODAY);

    expect(result.redacted).toBe(true);
    expect(result.suggestions[0].costReason).not.toMatch(/\$/);
    expect(result.suggestions[0].costReason.length).toBeGreaterThan(0);
  });

  it("drops a follow-up that contains a price", async () => {
    const sneaky = turn({ followUps: ["Is it under $500?", "What about June?"] });
    const result = await chatWithTravis(ask("Bali"), new ScriptedProvider([sneaky, sneaky]), TODAY);
    expect(result.followUps).toEqual(["What about June?"]);
  });
});

describe("when the model suggests somewhere that is not supported", () => {
  const patagonia = suggestion({ destination: "Patagonia" });

  it("asks again, naming the place, and uses the corrected answer", async () => {
    const provider = new ScriptedProvider([
      turn({ suggestions: [patagonia] }),
      turn({ suggestions: [suggestion({ destination: "Peru" })] }),
    ]);
    const result = await chatWithTravis(ask("Somewhere wild"), provider, TODAY);

    expect(result.attempts).toBe(2);
    expect(provider.repairNotes[1]).toContain("Patagonia");
    expect(result.suggestions.map((s) => s.destination)).toEqual(["Peru"]);
  });

  it("leaves it out, rather than offering a trip that cannot be planned, if it does it again", async () => {
    const provider = new ScriptedProvider([
      turn({ suggestions: [patagonia, suggestion({ destination: "Chile" })] }),
      turn({ suggestions: [patagonia, suggestion({ destination: "Japan" })] }),
    ]);
    const result = await chatWithTravis(ask("Somewhere wild"), provider, TODAY);

    expect(result.attempts).toBe(2);
    expect(result.suggestions.map((s) => s.destination)).toEqual(["Japan"]);
    expect(result.redacted).toBe(false);
  });

  it("still returns the reply, with no cards, if nothing it suggested is supported", async () => {
    const provider = new ScriptedProvider([turn({ suggestions: [patagonia] }), turn({ suggestions: [patagonia] })]);
    const result = await chatWithTravis(ask("Somewhere wild"), provider, TODAY);
    expect(result.suggestions).toEqual([]);
    expect(result.reply).toBeTruthy();
  });

  it("makes one repair call for a price and an unsupported place together, not two", async () => {
    const provider = new ScriptedProvider([
      turn({ reply: "Patagonia is about $900.", suggestions: [patagonia] }),
      turn({ suggestions: [suggestion({ destination: "Peru" })] }),
    ]);
    const result = await chatWithTravis(ask("Somewhere wild"), provider, TODAY);

    expect(result.attempts).toBe(2);
    expect(provider.repairNotes[1]).toMatch(/amounts of money/);
    expect(provider.repairNotes[1]).toContain("Patagonia");
  });

  it("does not retry when every suggestion is supported", async () => {
    const provider = new ScriptedProvider([turn({ suggestions: [suggestion({ destination: "Japan" })] })]);
    expect((await chatWithTravis(ask("Japan"), provider, TODAY)).attempts).toBe(1);
  });
});

describe("when the model misbehaves", () => {
  it("retries once after unusable JSON and uses the second answer", async () => {
    const provider = new ScriptedProvider([new AIProviderError("malformed-json", "bad"), turn()]);
    const result = await chatWithTravis(ask("Bali"), provider, TODAY);

    expect(result.attempts).toBe(2);
    expect(provider.repairNotes[1]).toMatch(/valid JSON/);
  });

  it("retries once after a schema failure too", async () => {
    const provider = new ScriptedProvider([new AIProviderError("schema", "bad"), turn()]);
    expect((await chatWithTravis(ask("Bali"), provider, TODAY)).attempts).toBe(2);
  });

  it("gives up after a second unusable answer", async () => {
    const provider = new ScriptedProvider([
      new AIProviderError("malformed-json", "bad"),
      new AIProviderError("malformed-json", "bad again"),
    ]);
    await expect(chatWithTravis(ask("Bali"), provider, TODAY)).rejects.toMatchObject({ code: "malformed-json" });
    expect(provider.requests).toHaveLength(2);
  });

  it.each(["quota", "timeout", "auth", "provider-error"] as const)(
    "does not retry a %s failure, since asking again only costs more",
    async (code) => {
      const provider = new ScriptedProvider([new AIProviderError(code, "no"), turn()]);
      await expect(chatWithTravis(ask("Bali"), provider, TODAY)).rejects.toMatchObject({ code });
      expect(provider.requests).toHaveLength(1);
    },
  );
});

describe("with the demo stand-in", () => {
  it("answers deterministically and records no retries", async () => {
    const provider = new MockAIProvider();
    const result = await chatWithTravis(ask("Where should I go in June?"), provider, TODAY);
    expect(result.attempts).toBe(1);
    expect(result.suggestions.length).toBeGreaterThan(0);
    expect(provider.chatCalls).toBe(1);
  });

  it("recovers when it quotes a price once", async () => {
    const provider = new MockAIProvider("price-claim");
    const result = await chatWithTravis(ask("Thailand please"), provider, TODAY);
    expect(provider.chatCalls).toBe(2);
    expect(result.redacted).toBe(false);
    expect(result.reply).not.toMatch(/\$/);
  });

  it("is redacted when it quotes a price every time", async () => {
    const provider = new MockAIProvider("price-claim-always");
    const result = await chatWithTravis(ask("Thailand please"), provider, TODAY);
    expect(result.redacted).toBe(true);
    expect(result.reply).not.toMatch(/\$/);
    expect(result.reply.length).toBeGreaterThan(0);
  });

  it("fails like a real provider does, so the route's error handling is exercised", async () => {
    await expect(chatWithTravis(ask("Bali"), new MockAIProvider("error"), TODAY)).rejects.toMatchObject({
      code: "quota",
    });
    await expect(chatWithTravis(ask("Bali"), new MockAIProvider("malformed"), TODAY)).rejects.toMatchObject({
      code: "malformed-json",
    });
  });
});
