import { describe, expect, it } from "vitest";
import { llmTripEditSchema, toEditOperation, tripAgentRequestSchema, type LlmOperation } from "@/lib/validation/trip-agent";

const raw = (fields: Partial<LlmOperation> & Pick<LlmOperation, "type">): LlmOperation => ({
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

describe("toEditOperation", () => {
  it("accepts each operation with the fields it needs", () => {
    expect(toEditOperation(raw({ type: "remove_activity", activityId: "a1" }), 0)).toEqual({ type: "remove_activity", activityId: "a1" });
    expect(toEditOperation(raw({ type: "move_activity", activityId: "a1", toDayId: "d2" }), 0)).toEqual({ type: "move_activity", activityId: "a1", toDayId: "d2" });
    expect(toEditOperation(raw({ type: "replace_activity", activityId: "a1", query: "Wat Arun" }), 0)).toEqual({ type: "replace_activity", activityId: "a1", query: "Wat Arun" });
    expect(toEditOperation(raw({ type: "add_activity", dayId: "d1", query: "floating market" }), 0)).toEqual({ type: "add_activity", dayId: "d1", query: "floating market" });
    expect(toEditOperation(raw({ type: "change_hotel", cityId: "c1", query: "riverside hotel" }), 0)).toEqual({ type: "change_hotel", cityId: "c1", query: "riverside hotel" });
    expect(toEditOperation(raw({ type: "set_cities", cities: [{ name: "Bangkok", days: 3 }] }), 0)).toEqual({ type: "set_cities", cities: [{ name: "Bangkok", days: 3 }] });
    expect(toEditOperation(raw({ type: "set_trip_length", dayCount: 5 }), 0)).toEqual({ type: "set_trip_length", dayCount: 5 });
  });

  it("keeps an optional category, and leaves the key out when there is none", () => {
    expect(toEditOperation(raw({ type: "add_activity", dayId: "d1", query: "pad thai", category: "food" }), 0)).toMatchObject({ category: "food" });
    expect(toEditOperation(raw({ type: "add_activity", dayId: "d1", query: "pad thai" }), 0)).not.toHaveProperty("category");
  });

  it.each([
    [raw({ type: "remove_activity" }), 'Operation 1 (remove_activity) is missing "activityId".'],
    [raw({ type: "move_activity", activityId: "a1" }), 'Operation 1 (move_activity) is missing "toDayId".'],
    [raw({ type: "move_activity", toDayId: "d1" }), 'Operation 1 (move_activity) is missing "activityId".'],
    [raw({ type: "replace_activity", activityId: "a1" }), 'Operation 1 (replace_activity) is missing "query".'],
    [raw({ type: "add_activity", query: "x place" }), 'Operation 1 (add_activity) is missing "dayId".'],
    [raw({ type: "add_activity", dayId: "d1", query: "x" }), 'Operation 1 (add_activity) is missing "query".'],
    [raw({ type: "change_hotel", query: "hotel" }), 'Operation 1 (change_hotel) is missing "cityId".'],
    [raw({ type: "set_cities", cities: [] }), 'Operation 1 (set_cities) is missing "cities".'],
    [raw({ type: "set_trip_length" }), 'Operation 1 (set_trip_length) is missing "dayCount".'],
  ])("says exactly what is missing", (operation, error) => {
    expect(toEditOperation(operation, 0)).toEqual({ error });
  });

  it("numbers operations from one, as a person would", () => {
    expect(toEditOperation(raw({ type: "remove_activity" }), 2)).toEqual({ error: 'Operation 3 (remove_activity) is missing "activityId".' });
  });

  it.each([0, -3, 31, 99])("rejects a trip of %i days", (dayCount) => {
    expect(toEditOperation(raw({ type: "set_trip_length", dayCount }), 0)).toEqual({ error: "Operation 1 (set_trip_length): a trip can be 1 to 30 days long." });
  });

  it("accepts the limits themselves", () => {
    expect(toEditOperation(raw({ type: "set_trip_length", dayCount: 1 }), 0)).toMatchObject({ dayCount: 1 });
    expect(toEditOperation(raw({ type: "set_trip_length", dayCount: 30 }), 0)).toMatchObject({ dayCount: 30 });
  });
});

describe("llmTripEditSchema", () => {
  const ok = { reply: "I'll shorten it.", operations: [{ type: "set_trip_length", dayCount: 5 }] };

  it("accepts a reply with operations, and fills unused fields as absent", () => {
    const parsed = llmTripEditSchema.parse(ok);
    expect(parsed.operations[0].type).toBe("set_trip_length");
  });

  it("accepts a full-length answer to a question about a place, and nothing longer", () => {
    expect(llmTripEditSchema.safeParse({ reply: "x".repeat(1500), operations: [] }).success).toBe(true);
    expect(llmTripEditSchema.safeParse({ reply: "x".repeat(1501), operations: [] }).success).toBe(false);
  });

  it("accepts a reply with no operations", () => {
    expect(llmTripEditSchema.safeParse({ reply: "Which city?", operations: [] }).success).toBe(true);
  });

  it.each([
    ["an empty reply", { reply: "  ", operations: [] }],
    ["an unknown operation", { reply: "ok", operations: [{ type: "delete_trip" }] }],
    ["more than eight operations", { reply: "ok", operations: Array.from({ length: 9 }, () => ({ type: "remove_activity", activityId: "a" })) }],
    ["a missing operations list", { reply: "ok" }],
    ["a fractional day count", { reply: "ok", operations: [{ type: "set_trip_length", dayCount: 2.5 }] }],
    ["an unknown category", { reply: "ok", operations: [{ type: "add_activity", dayId: "d", query: "x y", category: "casino" }] }],
  ])("rejects %s", (_name, value) => {
    expect(llmTripEditSchema.safeParse(value).success).toBe(false);
  });

  it("trims whitespace in the reply", () => {
    expect(llmTripEditSchema.parse({ reply: "  Done.  ", operations: [] }).reply).toBe("Done.");
  });
});

describe("tripAgentRequestSchema", () => {
  const user = (content: string) => ({ role: "user" as const, content });

  it("requires the last message to be the traveller's", () => {
    const trip = {} as never;
    const result = tripAgentRequestSchema.safeParse({ trip, messages: [user("hi"), { role: "assistant", content: "hello" }] });
    expect(result.success).toBe(false);
    if (!result.success) expect(JSON.stringify(result.error.issues)).toContain("The last message must be the traveller's.");
  });

  it("rejects an empty conversation, too many turns, and an over-long message", () => {
    const base = { trip: {} as never };
    expect(tripAgentRequestSchema.safeParse({ ...base, messages: [] }).success).toBe(false);
    expect(tripAgentRequestSchema.safeParse({ ...base, messages: Array.from({ length: 11 }, () => user("hi")) }).success).toBe(false);
    expect(tripAgentRequestSchema.safeParse({ ...base, messages: [user("x".repeat(801))] }).success).toBe(false);
  });
});
