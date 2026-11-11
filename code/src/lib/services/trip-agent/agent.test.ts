import { beforeAll, describe, expect, it } from "vitest";
import { AIProviderError, type AIProvider, type TripEditRequest } from "@/lib/services/ai";
import { MockAIProvider } from "@/test-support/ai/mock-provider";
import { getMockPlacesProvider } from "@/test-support/places";
import { runTripAgent } from "@/lib/services/trip-agent";
import { buildThailandTrip } from "@/test-support/trip-fixture";
import type { LlmOperation, LlmTripEdit } from "@/lib/validation/trip-agent";
import type { AgentTrip, TripAgentMessageInput } from "@/types/trip-agent";

const places = getMockPlacesProvider();
let trip: AgentTrip;
beforeAll(async () => {
  trip = await buildThailandTrip();
});

const op = (fields: Partial<LlmOperation> & Pick<LlmOperation, "type">): LlmOperation => ({
  activityId: null,
  dayId: null,
  toDayId: null,
  cityId: null,
  query: null,
  category: null,
  dayCount: null,
  cities: null,
  ...fields,
});
const turn = (reply: string, operations: LlmOperation[] = []): LlmTripEdit => ({ reply, operations });
const ask = (content: string): TripAgentMessageInput[] => [{ role: "user", content }];

/** A provider that plays back a fixed script, so each failure mode is deliberate. */
class Scripted implements AIProvider {
  readonly name = "mock" as const;
  readonly model = "scripted";
  readonly simulated = true;
  readonly requests: TripEditRequest[] = [];
  readonly repairNotes: (string | undefined)[] = [];
  constructor(private readonly script: (LlmTripEdit | AIProviderError)[]) {}
  async planCities(): Promise<never> {
    throw new Error("not used");
  }
  async converse(): Promise<never> {
    throw new Error("not used");
  }
  async proposeTripEdit(request: TripEditRequest, repairNote?: string): Promise<LlmTripEdit> {
    this.requests.push(request);
    this.repairNotes.push(repairNote);
    const next = this.script[this.requests.length - 1];
    if (!next) throw new Error("script exhausted");
    if (next instanceof AIProviderError) throw next;
    return next;
  }
}

const run = (provider: AIProvider, text = "do something") => runTripAgent({ trip, messages: ask(text) }, provider, places, "2026-11-10");
const firstActivity = () => trip.days[0].activities[0];

describe("a request the agent can carry out", () => {
  it("returns the model's sentence and a change set to confirm", async () => {
    const provider = new Scripted([turn("I'll remove it.", [op({ type: "remove_activity", activityId: firstActivity().id })])]);
    const result = await run(provider);
    expect(result.attempts).toBe(1);
    expect(result.reply).toBe("I'll remove it.");
    expect(result.changeSet?.lines).toEqual([`Remove ${firstActivity().name} (Day 1).`]);
  });

  it("gives the model the trip, the conversation and today's date", async () => {
    const provider = new Scripted([turn("Fine.")]);
    await runTripAgent(
      { trip, messages: [{ role: "user", content: "hi" }, { role: "assistant", content: "hello" }, { role: "user", content: "shorter please" }], focus: { dayId: trip.days[1].id } },
      provider,
      places,
      "2026-11-10",
    );
    const request = provider.requests[0];
    expect(request.today).toBe("2026-11-10");
    expect(request.trip.id).toBe(trip.id);
    expect(request.messages.map((m) => m.content)).toEqual(["hi", "hello", "shorter please"]);
    expect(request.focus).toEqual({ dayId: trip.days[1].id });
  });

  it("sends only the most recent turns of a long conversation", async () => {
    const provider = new Scripted([turn("Fine.")]);
    const long: TripAgentMessageInput[] = Array.from({ length: 30 }, (_, i) => ({ role: i % 2 === 0 ? "user" : "assistant", content: `m${i}` }));
    long.push({ role: "user", content: "latest" });
    await runTripAgent({ trip, messages: long }, provider, places, "2026-11-10");
    expect(provider.requests[0].messages.length).toBeLessThanOrEqual(10);
    expect(provider.requests[0].messages.at(-1)?.content).toBe("latest");
  });

  it("ignores an operation the model repeats", async () => {
    const same = op({ type: "remove_activity", activityId: firstActivity().id });
    const result = await run(new Scripted([turn("Removing it.", [same, same])]));
    expect(result.changeSet?.lines).toHaveLength(1);
  });
});

describe("a question, or a polite no", () => {
  it("returns the sentence with nothing to confirm, without a retry", async () => {
    const provider = new Scripted([turn("Which city do you mean?")]);
    const result = await run(provider);
    expect(result).toEqual({ reply: "Which city do you mean?", changeSet: null, attempts: 1 });
  });
});

describe("when the model gets an operation wrong", () => {
  it("asks again naming the problem, and uses the corrected answer", async () => {
    const provider = new Scripted([
      turn("Removing it.", [op({ type: "remove_activity", activityId: "act-made-up" })]),
      turn("Removing the right one.", [op({ type: "remove_activity", activityId: firstActivity().id })]),
    ]);
    const result = await run(provider);
    expect(result.attempts).toBe(2);
    expect(provider.repairNotes[1]).toContain('There\'s no activity "act-made-up" in this trip.');
    expect(result.changeSet).not.toBeNull();
    expect(result.reply).toBe("Removing the right one.");
  });

  it("tells it what field was missing", async () => {
    const provider = new Scripted([
      turn("Replacing it.", [op({ type: "replace_activity", activityId: firstActivity().id })]),
      turn("Never mind.", []),
    ]);
    await run(provider);
    expect(provider.repairNotes[1]).toContain('Operation 1 (replace_activity) is missing "query".');
  });

  it("tells it when a place could not be found", async () => {
    const provider = new Scripted([
      turn("Adding it.", [op({ type: "add_activity", dayId: trip.days[0].id, query: "Quidditch stadium tour" })]),
      turn("Sorry, I can't find that.", []),
    ]);
    const result = await run(provider);
    expect(provider.repairNotes[1]).toMatch(/couldn't find "Quidditch stadium tour"/);
    expect(result.changeSet).toBeNull();
  });

  it("explains in plain words, and offers nothing, if it is still wrong the second time", async () => {
    const bad = turn("Removing it.", [op({ type: "remove_activity", activityId: "act-made-up" })]);
    const result = await run(new Scripted([bad, bad]));
    expect(result.attempts).toBe(2);
    expect(result.changeSet).toBeNull();
    expect(result.reply).toBe('I couldn\'t make that change. There\'s no activity "act-made-up" in this trip.');
  });

  it("does not retry a third time", async () => {
    const bad = turn("x", [op({ type: "remove_activity", activityId: "nope" })]);
    const provider = new Scripted([bad, bad, bad]);
    await run(provider);
    expect(provider.requests).toHaveLength(2);
  });
});

describe("when the model misbehaves", () => {
  it("retries once after unusable JSON and uses the second answer", async () => {
    const provider = new Scripted([new AIProviderError("malformed-json", "not json"), turn("Fine.")]);
    const result = await run(provider);
    expect(result.attempts).toBe(2);
    expect(provider.repairNotes[1]).toMatch(/not valid JSON/);
  });

  it("retries once after a schema failure too", async () => {
    const result = await run(new Scripted([new AIProviderError("schema", "x"), turn("Fine.")]));
    expect(result.attempts).toBe(2);
  });

  it("gives up after a second unusable answer", async () => {
    await expect(run(new Scripted([new AIProviderError("malformed-json", "x"), new AIProviderError("malformed-json", "x")]))).rejects.toMatchObject({
      code: "malformed-json",
    });
  });

  it.each(["quota", "timeout", "auth", "provider-error"] as const)("does not retry a %s, where a second call only costs more", async (code) => {
    const provider = new Scripted([new AIProviderError(code, "x"), turn("Fine.")]);
    await expect(run(provider)).rejects.toMatchObject({ code });
    expect(provider.requests).toHaveLength(1);
  });
});

describe("the agent never states a price", () => {
  it("cuts an amount out of its sentence", async () => {
    const result = await run(new Scripted([turn("I'll remove it. That saves about ₹4,000. Anything else?", [op({ type: "remove_activity", activityId: firstActivity().id })])]));
    expect(result.reply).not.toMatch(/₹|4,000/);
    expect(result.reply.length).toBeGreaterThan(0);
  });

  it("falls back to a plain sentence if nothing is left", async () => {
    const result = await run(new Scripted([turn("It costs ₹4,000.", [op({ type: "remove_activity", activityId: firstActivity().id })])]));
    expect(result.reply).toBe("Here is what I'd change.");
  });
});

describe("answers to questions are not mistaken for prices", () => {
  it("keeps a weather answer with temperatures and rain intact", async () => {
    const text = "January is usually dry and sunny, around 30 degrees by day and cooler at night. Pack light clothes and a thin rain jacket.";
    const result = await run(new Scripted([turn(text)]));
    expect(result.reply).toBe(text);
    expect(result.changeSet).toBeNull();
  });

  it("returns a long answer whole, with no change to confirm", async () => {
    const text = "Bangkok is famous for its street food. Try pad thai, mango sticky rice and boat noodles.\n\nThe Damnoen Saduak market is a classic morning out. Want me to add it to Day 2?";
    const result = await run(new Scripted([turn(text)]));
    expect(result).toEqual({ reply: text, changeSet: null, attempts: 1 });
  });

  it("still cuts a sentence that states an amount", async () => {
    const result = await run(new Scripted([turn("Try the boat noodles. A bowl is about 60 baht. They are delicious.")]));
    expect(result.reply).toBe("Try the boat noodles. They are delicious.");
  });
});

describe("with the demo stand-in", () => {
  const demo = (text: string) => runTripAgent({ trip, messages: ask(text) }, new MockAIProvider(), places, "2026-11-10");

  it("shortens the trip", async () => {
    const result = await demo("make it 7 days");
    expect(result.attempts).toBe(1);
    expect(result.changeSet?.patch.dayCount).toBe(7);
    expect(result.reply).toMatch(/7 days/);
  });

  it("understands 'add two days' and 'cut 3 days'", async () => {
    expect((await demo("add 2 days")).changeSet?.patch.dayCount).toBe(11);
    expect((await demo("cut 3 days")).changeSet?.patch.dayCount).toBe(6);
  });

  it.each([
    // The example requests the panel itself offers must work in demo mode.
    ["Make the trip a day shorter", 8],
    ["Add two more days", 11],
    ["make it two days longer", 11],
    ["3 days shorter please", 6],
    ["2 fewer days", 7],
    ["add one day", 10],
    ["I want 3 extra days", 12],
    ["make it a 5-day trip", 5],
  ])("understands %j", async (request, days) => {
    expect((await demo(request)).changeSet?.patch.dayCount).toBe(days);
  });

  it("does not mistake other uses of 'a' or 'one' for a number of days", async () => {
    const result = await demo("add a floating market to day 2");
    expect(result.changeSet?.patch.dayCount).toBe(9);
    expect(result.changeSet?.lines[0]).toMatch(/^Add .* to Day 2/);
  });

  describe("talking", () => {
    it.each(["hi", "Hello!", "hey Travis", "Good morning"])("greets back when greeted (%s)", async (greeting) => {
      const result = await demo(greeting);
      expect(result.changeSet).toBeNull();
      expect(result.reply).toMatch(/^Hi! I'm Travis/);
      expect(result.reply).toContain("Thailand");
    });

    it("says you are welcome", async () => {
      const result = await demo("thanks!");
      expect(result.changeSet).toBeNull();
      expect(result.reply).toMatch(/Happy to help/);
    });

    it("answers a weather question from the country's best months and the trip's dates", async () => {
      // Thailand's best window is Nov-Feb and the trip is in January, so it is inside it.
      const result = await demo("What will the weather be like?");
      expect(result.changeSet).toBeNull();
      expect(result.reply).toMatch(/can't see a live forecast/);
      expect(result.reply).toMatch(/at its best from Nov.Feb/);
      expect(result.reply).toMatch(/falls in that window/);
      expect(result.reply).toContain("Jan 10 to Jan 18");
    });

    it("says so when the trip falls outside the best months", async () => {
      const summer = { ...trip, startDate: "2027-07-10", endDate: "2027-07-18" };
      const result = await runTripAgent({ trip: summer, messages: ask("what's the weather like in July?") }, new MockAIProvider(), places, "2026-11-10");
      expect(result.reply).toMatch(/falls outside that window/);
    });

    it("never claims to know a forecast, or a temperature it does not have", async () => {
      const result = await demo("is it going to rain?");
      expect(result.reply).not.toMatch(/\d+\s?(?:degrees|°)/);
      expect(result.reply).toMatch(/not a promise|can't see a live forecast/);
    });

    it("says what the country is known for, and what the trip covers, and is honest about its limits", async () => {
      const result = await demo("What are the famous local things to try?");
      expect(result.changeSet).toBeNull();
      expect(result.reply).toContain("Thailand:");
      expect(result.reply).toContain("Bangkok");
      expect(result.reply).toContain("Phuket");
      expect(result.reply).toMatch(/In demo mode I can't go into local food/);
    });

    it("states no price in anything it says", async () => {
      for (const question of ["hi", "what's the weather like?", "recommendations please", "what is famous here?"]) {
        expect((await demo(question)).reply).not.toMatch(/₹|\$|€|£/);
      }
    });

    it("treats a request to change the trip as a change, even when it mentions the weather", async () => {
      const result = await demo("make it 7 days because of the weather");
      expect(result.changeSet?.patch.dayCount).toBe(7);
    });

    it("does not take 'remove the hot springs' for a weather question", async () => {
      const result = await demo(`remove ${firstActivity().name} because it is hot`);
      expect(result.changeSet?.lines[0]).toBe(`Remove ${firstActivity().name} (Day 1).`);
    });

    it("falls back to a friendly, specific admission when it cannot tell what was meant", async () => {
      const result = await demo("blorp");
      expect(result.changeSet).toBeNull();
      expect(result.reply).toMatch(/not sure what you mean/);
      expect(result.reply).toMatch(/weather/);
    });
  });

  it("removes an activity by name", async () => {
    const result = await demo(`remove ${firstActivity().name}`);
    expect(result.changeSet?.lines[0]).toBe(`Remove ${firstActivity().name} (Day 1).`);
  });

  it("moves an activity to another day", async () => {
    const result = await demo(`move ${firstActivity().name} to day 3`);
    expect(result.changeSet?.lines[0]).toBe(`Move ${firstActivity().name} from Day 1 to Day 3.`);
  });

  it("removes a city and gives its days to another", async () => {
    const result = await demo("remove Phuket");
    expect(result.changeSet?.patch.cities.map((c) => c.name)).toEqual(["Bangkok"]);
    expect(result.changeSet?.patch.dayCount).toBe(9);
  });

  it("adds a city, taking days from the longest stay", async () => {
    const result = await demo("add Chiang Mai to the trip");
    expect(result.changeSet?.patch.cities.map((c) => c.name)).toContain("Chiang Mai");
    expect(result.changeSet?.patch.dayCount).toBe(9);
  });

  it("says so when it cannot find what was named", async () => {
    const result = await demo("remove the moon landing");
    expect(result.changeSet).toBeNull();
    expect(result.reply).toMatch(/couldn't find/);
  });

  it("admits what it cannot do in demo mode instead of guessing", async () => {
    const result = await demo("make everything more romantic");
    expect(result.changeSet).toBeNull();
    expect(result.reply).toMatch(/demo mode/);
  });

  it("refuses an impossible length", async () => {
    expect((await demo("make it 99 days")).changeSet).toBeNull();
    expect((await demo("make it 0 days")).changeSet).toBeNull();
  });

  it("says when the trip is already that long", async () => {
    expect((await demo("make it 9 days")).reply).toMatch(/already 9 days/);
  });

  it("uses what the traveller is looking at for 'this'", async () => {
    const target = trip.days[2].activities[0];
    const result = await runTripAgent({ trip, messages: ask("remove this"), focus: { activityId: target.id } }, new MockAIProvider(), places, "2026-11-10");
    expect(result.changeSet?.lines[0]).toBe(`Remove ${target.name} (Day 3).`);
  });

  it("adds to the day the traveller is looking at", async () => {
    const day = trip.days[1];
    const candidate = (await places.searchPlaces({ destination: trip.cities.find((c) => c.id === day.cityId)!.name, country: "Thailand", type: "attraction", limit: 30 })).find(
      (p) => !day.activities.some((a) => a.name === p.name),
    )!;
    const result = await runTripAgent({ trip, messages: ask(`add ${candidate.name}`), focus: { dayId: day.id } }, new MockAIProvider(), places, "2026-11-10");
    expect(result.changeSet?.lines[0]).toMatch(new RegExp(`^Add ${candidate.name.replace(/[()]/g, ".")} to Day 2`));
  });

  it("fails like a real provider does, so the route's error handling is exercised", async () => {
    await expect(runTripAgent({ trip, messages: ask("hi") }, new MockAIProvider("error"), places)).rejects.toMatchObject({ code: "quota" });
  });
});
