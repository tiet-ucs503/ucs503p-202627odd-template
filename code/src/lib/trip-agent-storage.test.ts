import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearAllTripChats, clearTripChat, loadTripChat, saveTripChat } from "@/lib/trip-agent-storage";
import { describeTripFocus } from "@/lib/trip-agent-focus";
import type { TripAgentChatMessage } from "@/types/trip-agent";

const stats = { dayCount: 5, total: 100, estimatedTotal: 80, cityDays: [{ name: "Bangkok", days: 5 }], overfullDays: [] };
const message = (overrides: Partial<TripAgentChatMessage> = {}): TripAgentChatMessage => ({ id: "1", role: "user", content: "hi", ...overrides });
const withChange = (status: TripAgentChatMessage["status"]): TripAgentChatMessage => ({
  id: "2",
  role: "assistant",
  content: "ok",
  status,
  changeSet: {
    id: "c",
    baseVersion: "v",
    lines: ["Remove X (Day 1)."],
    warnings: [],
    before: stats,
    after: stats,
    patch: { cities: [], days: [], budget: { currency: "INR", total: 1, estimatedTotal: 1, categories: {} as never }, endDate: "2027-01-01", dayCount: 1 },
  },
});

beforeEach(() => {
  window.sessionStorage.clear();
  vi.restoreAllMocks();
});

describe("trip chat storage", () => {
  it("round-trips a conversation", () => {
    saveTripChat("asha", "t1", [message(), withChange("applied")]);
    const loaded = loadTripChat("asha", "t1");
    expect(loaded).toHaveLength(2);
    expect(loaded[1].changeSet?.lines).toEqual(["Remove X (Day 1)."]);
    expect(loaded[1].status).toBe("applied");
  });

  it("drops the patch before storing", () => {
    saveTripChat("asha", "t1", [withChange("pending")]);
    expect(window.sessionStorage.getItem("tripease:trip-agent:v1:asha:t1")).not.toContain("patch");
    expect(loadTripChat("asha", "t1")[0].changeSet).not.toHaveProperty("patch");
  });

  it("brings back a waiting proposal as discarded, never as pending", () => {
    saveTripChat("asha", "t1", [withChange("pending")]);
    expect(loadTripChat("asha", "t1")[0].status).toBe("discarded");
  });

  it("keeps each account's and each trip's conversation apart", () => {
    saveTripChat("asha", "t1", [message({ content: "a1" })]);
    saveTripChat("asha", "t2", [message({ content: "a2" })]);
    saveTripChat("ben", "t1", [message({ content: "b1" })]);
    expect(loadTripChat("asha", "t1")[0].content).toBe("a1");
    expect(loadTripChat("asha", "t2")[0].content).toBe("a2");
    expect(loadTripChat("ben", "t1")[0].content).toBe("b1");
  });

  it("keeps only the most recent messages", () => {
    saveTripChat("asha", "t1", Array.from({ length: 50 }, (_, i) => message({ id: String(i), content: `m${i}` })));
    const loaded = loadTripChat("asha", "t1");
    expect(loaded).toHaveLength(30);
    expect(loaded.at(-1)?.content).toBe("m49");
  });

  it.each([null, undefined, ""])("keeps nothing for nobody (%s)", (nobody) => {
    saveTripChat(nobody, "t1", [message()]);
    saveTripChat("asha", nobody, [message()]);
    expect(window.sessionStorage.length).toBe(0);
    expect(loadTripChat(nobody, "t1")).toEqual([]);
  });

  it("throws away stored data that does not fit, instead of showing it", () => {
    window.sessionStorage.setItem("tripease:trip-agent:v1:asha:t1", JSON.stringify([{ id: 1, role: "system", content: "x" }]));
    expect(loadTripChat("asha", "t1")).toEqual([]);
    window.sessionStorage.setItem("tripease:trip-agent:v1:asha:t1", "{not json");
    expect(loadTripChat("asha", "t1")).toEqual([]);
  });

  it("clears one conversation", () => {
    saveTripChat("asha", "t1", [message()]);
    saveTripChat("asha", "t2", [message()]);
    clearTripChat("asha", "t1");
    expect(loadTripChat("asha", "t1")).toEqual([]);
    expect(loadTripChat("asha", "t2")).toHaveLength(1);
  });

  it("forgets every conversation on sign-out, and nothing else", () => {
    saveTripChat("asha", "t1", [message()]);
    saveTripChat("ben", "t2", [message()]);
    window.sessionStorage.setItem("tripease:travis:v1:asha", "[]");
    window.sessionStorage.setItem("unrelated", "keep me");

    clearAllTripChats();

    expect(loadTripChat("asha", "t1")).toEqual([]);
    expect(loadTripChat("ben", "t2")).toEqual([]);
    expect(window.sessionStorage.getItem("tripease:travis:v1:asha")).toBe("[]");
    expect(window.sessionStorage.getItem("unrelated")).toBe("keep me");
  });

  it("clears them all however many there are", () => {
    for (let i = 0; i < 12; i++) saveTripChat(`u${i}`, `t${i}`, [message()]);
    clearAllTripChats();
    expect(window.sessionStorage.length).toBe(0);
  });

  it("does not throw when storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("full");
    });
    expect(() => saveTripChat("asha", "t1", [message()])).not.toThrow();
    vi.spyOn(Storage.prototype, "key").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => clearAllTripChats()).not.toThrow();
  });
});

describe("describeTripFocus", () => {
  const shape = {
    cities: [{ id: "c1", name: "Bangkok" }],
    days: [{ id: "d1", dayNumber: 1, cityId: "c1", date: "2027-01-01", activities: [{ id: "a1", name: "Wat Arun" }] }],
  } as never;

  it("names an activity, a day or a city", () => {
    expect(describeTripFocus(shape, { activityId: "a1" })).toBe("Wat Arun · Day 1");
    expect(describeTripFocus(shape, { dayId: "d1" })).toBe("Day 1 · Bangkok");
    expect(describeTripFocus(shape, { cityId: "c1" })).toBe("Bangkok");
  });

  it("prefers the most specific thing", () => {
    expect(describeTripFocus(shape, { activityId: "a1", dayId: "d1", cityId: "c1" })).toBe("Wat Arun · Day 1");
  });

  it("falls back when the most specific thing is gone", () => {
    expect(describeTripFocus(shape, { activityId: "gone", dayId: "d1" })).toBe("Day 1 · Bangkok");
  });

  it("is null for nothing, or for something that no longer exists", () => {
    expect(describeTripFocus(shape, null)).toBeNull();
    expect(describeTripFocus(shape, {})).toBeNull();
    expect(describeTripFocus(shape, { activityId: "gone" })).toBeNull();
    expect(describeTripFocus(shape, { cityId: "gone" })).toBeNull();
  });
});
