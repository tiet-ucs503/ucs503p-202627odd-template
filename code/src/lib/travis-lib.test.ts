import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearDraft,
  clearDraftOrigin,
  readDraft,
  readDraftOrigin,
  saveDraft,
  saveDraftOrigin,
} from "@/lib/draft-storage";
import { toRequestMessages } from "@/lib/travis-client";
import { startTripFromSuggestion, suggestionToDraft } from "@/lib/travis-draft";
import { clearAllConversations, clearConversation, loadConversation, saveConversation } from "@/lib/travis-storage";
import type { DestinationSuggestion, TravisChatMessage } from "@/types/travis";

function suggestion(overrides: Partial<DestinationSuggestion> = {}): DestinationSuggestion {
  return {
    id: "bali-0",
    destination: "Bali, Indonesia",
    headline: "Rice terraces.",
    startMonth: 4,
    endMonth: 6,
    windowLabel: "Apr–Jun",
    costOutlook: "lower",
    costReason: "Shoulder season.",
    weatherNote: "Mostly dry.",
    watchOut: null,
    suggestedDays: 8,
    styles: ["beaches"],
    startDate: "2027-04-01",
    endDate: "2027-04-08",
    ...overrides,
  };
}

beforeEach(() => {
  window.sessionStorage.clear();
  vi.restoreAllMocks();
});

describe("draft origin", () => {
  it("round-trips through session storage", () => {
    saveDraftOrigin({ source: "travis", destination: "Bali", windowLabel: "Apr–Jun" });
    expect(readDraftOrigin()).toEqual({ source: "travis", destination: "Bali", windowLabel: "Apr–Jun" });
  });

  it("is absent when nothing was saved", () => {
    expect(readDraftOrigin()).toBeNull();
  });

  it("is cleared on request", () => {
    saveDraftOrigin({ source: "travis", destination: "Bali", windowLabel: "Apr–Jun" });
    clearDraftOrigin();
    expect(readDraftOrigin()).toBeNull();
  });

  it.each([
    ["corrupt JSON", "{not json"],
    ["an unknown source", JSON.stringify({ source: "somewhere", destination: "x", windowLabel: "y" })],
    ["missing fields", JSON.stringify({ source: "travis" })],
    ["wrong field types", JSON.stringify({ source: "travis", destination: 5, windowLabel: [] })],
    ["null", "null"],
  ])("is ignored when it holds %s", (_label, raw) => {
    window.sessionStorage.setItem("tripease:draft-origin", raw);
    expect(readDraftOrigin()).toBeNull();
  });

  it("does not disturb the existing draft storage", () => {
    saveDraft({ destination: "Italy" });
    saveDraftOrigin({ source: "travis", destination: "Bali", windowLabel: "Apr–Jun" });
    clearDraftOrigin();
    expect(readDraft()).toEqual({ destination: "Italy" });
    clearDraft();
    expect(readDraft()).toBeNull();
  });

  it("does not throw when storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => saveDraftOrigin({ source: "travis", destination: "x", windowLabel: "y" })).not.toThrow();
  });
});

describe("suggestionToDraft", () => {
  it("carries the destination, the dates and the styles", () => {
    expect(suggestionToDraft(suggestion())).toEqual({
      destination: "Bali, Indonesia",
      startDate: "2027-04-01",
      endDate: "2027-04-08",
      preferences: ["beaches"],
    });
  });

  it("leaves styles out entirely when there are none", () => {
    expect(suggestionToDraft(suggestion({ styles: [] }))).not.toHaveProperty("preferences");
  });

  it("carries nothing it was not told", () => {
    const draft = suggestionToDraft(suggestion());
    expect(Object.keys(draft).sort()).toEqual(["destination", "endDate", "preferences", "startDate"]);
  });
});

describe("startTripFromSuggestion", () => {
  it("saves the draft and where it came from", () => {
    startTripFromSuggestion(suggestion());
    expect(readDraft()).toMatchObject({ destination: "Bali, Indonesia" });
    expect(readDraftOrigin()).toEqual({ source: "travis", destination: "Bali, Indonesia", windowLabel: "Apr–Jun" });
  });
});

function message(overrides: Partial<TravisChatMessage> & { id: string }): TravisChatMessage {
  return { role: "user", content: "hello", ...overrides };
}

describe("toRequestMessages", () => {
  it("sends only role and content for a traveller's message", () => {
    expect(toRequestMessages([message({ id: "1" })])).toEqual([{ role: "user", content: "hello" }]);
  });

  it("names the places Travis suggested, and nothing else about them", () => {
    const result = toRequestMessages([
      message({ id: "1", role: "assistant", content: "Try these.", suggestions: [suggestion(), suggestion({ destination: "Japan" })] }),
    ]);
    expect(result).toEqual([{ role: "assistant", content: "Try these.", suggested: ["Bali, Indonesia", "Japan"] }]);
  });

  it("does not add an empty list for a reply that suggested nothing", () => {
    const result = toRequestMessages([message({ id: "1", role: "assistant", content: "How long?", suggestions: [] })]);
    expect(result[0]).not.toHaveProperty("suggested");
  });

  it("never sends the display-only fields", () => {
    const result = toRequestMessages([
      message({ id: "1", role: "assistant", content: "x", followUps: ["a"], mode: "demo", suggestions: [suggestion()] }),
    ]);
    expect(result[0]).not.toHaveProperty("followUps");
    expect(result[0]).not.toHaveProperty("mode");
    expect(result[0]).not.toHaveProperty("id");
  });

  it("sends only the most recent turns of a long conversation", () => {
    const many = Array.from({ length: 30 }, (_, i) => message({ id: String(i), content: `m${i}` }));
    const result = toRequestMessages(many);
    expect(result).toHaveLength(12);
    expect(result.at(-1)?.content).toBe("m29");
  });
});

describe("conversation storage is per account", () => {
  it("never shows one account's conversation to another", () => {
    saveConversation("asha", [message({ id: "1", content: "a surprise trip to Santorini" })]);

    expect(loadConversation("ben")).toEqual([]);
    expect(loadConversation("asha")).toHaveLength(1);
  });

  it("keeps each account's own conversation side by side", () => {
    saveConversation("asha", [message({ id: "1", content: "asha's question" })]);
    saveConversation("ben", [message({ id: "2", content: "ben's question" })]);

    expect(loadConversation("asha")[0].content).toBe("asha's question");
    expect(loadConversation("ben")[0].content).toBe("ben's question");
  });

  it("clears only the account it is asked to", () => {
    saveConversation("asha", [message({ id: "1" })]);
    saveConversation("ben", [message({ id: "2" })]);

    clearConversation("asha");

    expect(loadConversation("asha")).toEqual([]);
    expect(loadConversation("ben")).toHaveLength(1);
  });

  it.each([null, undefined, ""])("keeps nothing for nobody (%s)", (nobody) => {
    saveConversation(nobody, [message({ id: "1" })]);
    expect(loadConversation(nobody)).toEqual([]);
    expect(window.sessionStorage.length).toBe(0);
  });

  it("forgets every account's conversation on sign-out, and nothing else", () => {
    saveConversation("asha", [message({ id: "1" })]);
    saveConversation("ben", [message({ id: "2" })]);
    window.sessionStorage.setItem("tripease:draft", "{}");
    window.sessionStorage.setItem("unrelated", "keep me");

    clearAllConversations();

    expect(loadConversation("asha")).toEqual([]);
    expect(loadConversation("ben")).toEqual([]);
    expect(window.sessionStorage.getItem("tripease:draft")).toBe("{}");
    expect(window.sessionStorage.getItem("unrelated")).toBe("keep me");
  });

  it("clears them all however many there are", () => {
    // Removing a key shifts every index after it, which breaks a forward loop.
    for (let i = 0; i < 12; i++) saveConversation(`user-${i}`, [message({ id: String(i) })]);
    clearAllConversations();
    expect(window.sessionStorage.length).toBe(0);
  });

  it("does not throw when storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "key").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => clearAllConversations()).not.toThrow();
  });
});

describe("conversation storage", () => {
  it("round-trips a conversation, suggestions included", () => {
    const conversation = [
      message({ id: "1", content: "somewhere warm" }),
      message({ id: "2", role: "assistant", content: "Bali.", suggestions: [suggestion()], followUps: ["Cheaper?"], mode: "demo" }),
    ];
    saveConversation("u1", conversation);
    expect(loadConversation("u1")).toEqual(conversation);
  });

  it("is empty when nothing was saved", () => {
    expect(loadConversation("u1")).toEqual([]);
  });

  it("forgets everything when cleared", () => {
    saveConversation("u1", [message({ id: "1" })]);
    clearConversation("u1");
    expect(loadConversation("u1")).toEqual([]);
    expect(window.sessionStorage.getItem("tripease:travis:v1:u1")).toBeNull();
  });

  it("removes the entry rather than storing an empty list", () => {
    saveConversation("u1", [message({ id: "1" })]);
    saveConversation("u1", []);
    expect(window.sessionStorage.getItem("tripease:travis:v1:u1")).toBeNull();
  });

  it("keeps only the most recent messages, so storage cannot grow without bound", () => {
    const many = Array.from({ length: 60 }, (_, i) => message({ id: String(i), content: `m${i}` }));
    saveConversation("u1", many);
    const loaded = loadConversation("u1");
    expect(loaded).toHaveLength(40);
    expect(loaded.at(-1)?.content).toBe("m59");
  });

  it.each([
    ["corrupt JSON", "{oops"],
    ["not a list", JSON.stringify({ messages: [] })],
    ["a message of the wrong shape", JSON.stringify([{ id: 1, role: "user", content: "x" }])],
    ["an unknown role", JSON.stringify([{ id: "1", role: "system", content: "x" }])],
    ["a suggestion with an invented cost outlook", JSON.stringify([{ id: "1", role: "assistant", content: "x", suggestions: [{ ...suggestion(), costOutlook: "free" }] }])],
    ["a suggestion with an unknown travel style", JSON.stringify([{ id: "1", role: "assistant", content: "x", suggestions: [{ ...suggestion(), styles: ["skiing"] }] }])],
  ])("discards stored data holding %s", (_label, raw) => {
    window.sessionStorage.setItem("tripease:travis:v1:u1", raw);
    expect(loadConversation("u1")).toEqual([]);
  });

  it("does not throw when storage refuses a write", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    expect(() => saveConversation("u1", [message({ id: "1" })])).not.toThrow();
  });

  it("does not throw when storage refuses a read", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(loadConversation("u1")).toEqual([]);
  });
});
