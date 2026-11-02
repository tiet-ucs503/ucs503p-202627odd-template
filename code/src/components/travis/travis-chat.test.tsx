import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { STARTER_PROMPTS, TravisChat } from "@/components/travis/travis-chat";
import { ApiError } from "@/lib/api-client";
import { readDraft, readDraftOrigin } from "@/lib/draft-storage";
import type { DestinationSuggestion, TravisChatMessage, TravisResponse } from "@/types/travis";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

// Whoever is "signed in" for a test. Conversations are stored per account.
let currentUid: string | null = "user-1";
vi.mock("@/components/auth-provider", () => ({
  useAuth: () => ({ user: currentUid ? { uid: currentUid } : null, loading: false }),
}));

const STORAGE_KEY = "tripease:travis:v1:user-1";

function suggestion(overrides: Partial<DestinationSuggestion> = {}): DestinationSuggestion {
  return {
    id: "bali-0",
    destination: "Bali, Indonesia",
    headline: "Rice terraces and surf beaches.",
    startMonth: 4,
    endMonth: 6,
    windowLabel: "Apr–Jun",
    costOutlook: "lower",
    costReason: "These shoulder months fall between the wet season and the summer rush.",
    weatherNote: "Mostly dry.",
    watchOut: "Crowds build from July.",
    suggestedDays: 8,
    styles: ["beaches", "relaxation"],
    startDate: "2027-04-01",
    endDate: "2027-04-08",
    ...overrides,
  };
}

function response(overrides: Partial<TravisResponse> = {}): TravisResponse {
  return {
    reply: "Bali suits that well.",
    suggestions: [suggestion()],
    followUps: ["What about somewhere cheaper?"],
    mode: "live",
    ...overrides,
  };
}

/** A promise the test settles by hand, to observe the "thinking" state. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const box = () => screen.getByRole("textbox", { name: "Message Travis" }) as HTMLTextAreaElement;
const sendButton = () => screen.getByRole("button", { name: "Send message" });

function type(text: string) {
  fireEvent.change(box(), { target: { value: text } });
}

beforeEach(() => {
  push.mockReset();
  window.sessionStorage.clear();
  currentUid = "user-1";
});

describe("the empty state", () => {
  it("explains what Travis does and what it cannot do", () => {
    render(<TravisChat ask={vi.fn()} />);
    expect(screen.getByText(/can't see live fares or availability/i)).toBeInTheDocument();
  });

  it("offers example questions", () => {
    render(<TravisChat ask={vi.fn()} />);
    const group = screen.getByRole("group", { name: "Example questions" });
    for (const prompt of STARTER_PROMPTS) expect(within(group).getByRole("button", { name: prompt })).toBeInTheDocument();
  });

  it("sends an example question when it is picked", async () => {
    const ask = vi.fn().mockResolvedValue(response());
    render(<TravisChat ask={ask} />);

    fireEvent.click(screen.getByRole("button", { name: STARTER_PROMPTS[0] }));

    await screen.findByText("Bali suits that well.");
    expect(ask).toHaveBeenCalledOnce();
    expect(ask.mock.calls[0][0]).toEqual([expect.objectContaining({ role: "user", content: STARTER_PROMPTS[0] })]);
  });

  it("has a labelled conversation region that announces new messages politely", () => {
    render(<TravisChat ask={vi.fn()} />);
    const log = screen.getByRole("log", { name: "Conversation with Travis" });
    expect(log).toHaveAttribute("aria-live", "polite");
  });
});

describe("sending a message", () => {
  it("shows the traveller's message, then Travis's reply with its suggestion", async () => {
    render(<TravisChat ask={vi.fn().mockResolvedValue(response())} />);

    type("somewhere warm in April");
    fireEvent.click(sendButton());

    expect(await screen.findByText("somewhere warm in April")).toBeInTheDocument();
    expect(await screen.findByText("Bali suits that well.")).toBeInTheDocument();
    expect(screen.getByRole("article", { name: "Bali, Indonesia" })).toBeInTheDocument();
  });

  it("clears the box once the message is sent", async () => {
    render(<TravisChat ask={vi.fn().mockResolvedValue(response())} />);
    type("hello");
    fireEvent.click(sendButton());
    await screen.findByText("Bali suits that well.");
    expect(box().value).toBe("");
  });

  it("sends on Enter", async () => {
    const ask = vi.fn().mockResolvedValue(response());
    render(<TravisChat ask={ask} />);

    type("hello");
    fireEvent.keyDown(box(), { key: "Enter" });

    await screen.findByText("Bali suits that well.");
    expect(ask).toHaveBeenCalledOnce();
  });

  it("makes a new line on Shift+Enter instead of sending", () => {
    const ask = vi.fn();
    render(<TravisChat ask={ask} />);

    type("hello");
    fireEvent.keyDown(box(), { key: "Enter", shiftKey: true });

    expect(ask).not.toHaveBeenCalled();
  });

  it("does not send while an input method is still composing a character", () => {
    const ask = vi.fn();
    render(<TravisChat ask={ask} />);

    type("こんにちは");
    fireEvent.keyDown(box(), { key: "Enter", isComposing: true });

    expect(ask).not.toHaveBeenCalled();
  });

  it("will not send an empty or whitespace-only message", () => {
    const ask = vi.fn();
    render(<TravisChat ask={ask} />);

    expect(sendButton()).toBeDisabled();
    type("    ");
    expect(sendButton()).toBeDisabled();
    fireEvent.keyDown(box(), { key: "Enter" });

    expect(ask).not.toHaveBeenCalled();
  });

  it("trims the message before sending it", async () => {
    const ask = vi.fn().mockResolvedValue(response());
    render(<TravisChat ask={ask} />);

    type("   padded   ");
    fireEvent.click(sendButton());

    await screen.findByText("Bali suits that well.");
    expect(ask.mock.calls[0][0][0].content).toBe("padded");
  });

  it("refuses a message over the length limit and says by how much", () => {
    render(<TravisChat ask={vi.fn()} />);

    type("a".repeat(1005));

    expect(sendButton()).toBeDisabled();
    expect(screen.getByText("5 over the limit")).toBeInTheDocument();
  });

  it("only shows the character count once it starts to matter", () => {
    render(<TravisChat ask={vi.fn()} />);
    type("a".repeat(100));
    expect(screen.queryByText(/ \/ 1000/)).not.toBeInTheDocument();

    type("a".repeat(850));
    expect(screen.getByText("850 / 1000")).toBeInTheDocument();
  });
});

describe("while Travis is thinking", () => {
  it("says so, and clears the message when the answer arrives", async () => {
    const pending = deferred<TravisResponse>();
    render(<TravisChat ask={() => pending.promise} />);

    type("hello");
    fireEvent.click(sendButton());

    expect(await screen.findByText("Travis is thinking…")).toBeInTheDocument();

    await act(async () => pending.resolve(response()));
    expect(screen.queryByText("Travis is thinking…")).not.toBeInTheDocument();
    expect(screen.getByText("Bali suits that well.")).toBeInTheDocument();
  });

  it("lets the traveller keep typing, but not send a second message", async () => {
    const pending = deferred<TravisResponse>();
    const ask = vi.fn().mockReturnValue(pending.promise);
    render(<TravisChat ask={ask} />);

    type("first");
    fireEvent.click(sendButton());
    await screen.findByText("Travis is thinking…");

    type("second, typed while waiting");
    expect(box().value).toBe("second, typed while waiting");
    expect(sendButton()).toBeDisabled();
    fireEvent.keyDown(box(), { key: "Enter" });
    expect(ask).toHaveBeenCalledOnce();

    await act(async () => pending.resolve(response()));
  });

  it("removes the example questions once a conversation has begun, so they cannot double-send", async () => {
    const pending = deferred<TravisResponse>();
    render(<TravisChat ask={() => pending.promise} />);

    fireEvent.click(screen.getByRole("button", { name: STARTER_PROMPTS[0] }));
    await screen.findByText("Travis is thinking…");

    expect(screen.queryByRole("group", { name: "Example questions" })).not.toBeInTheDocument();
    await act(async () => pending.resolve(response()));
  });
});

describe("what is sent to Travis", () => {
  it("sends the whole conversation each time, naming the places Travis suggested", async () => {
    const ask = vi
      .fn()
      .mockResolvedValueOnce(response({ reply: "Try Bali.", suggestions: [suggestion()] }))
      .mockResolvedValueOnce(response({ reply: "Bali is cheapest.", suggestions: [], followUps: [] }));
    render(<TravisChat ask={ask} />);

    type("somewhere warm");
    fireEvent.click(sendButton());
    await screen.findByText("Try Bali.");

    type("which is cheapest?");
    fireEvent.click(sendButton());
    await screen.findByText("Bali is cheapest.");

    const second: TravisChatMessage[] = ask.mock.calls[1][0];
    expect(second.map((m) => m.role)).toEqual(["user", "assistant", "user"]);
    expect(second[1].suggestions?.map((s) => s.destination)).toEqual(["Bali, Indonesia"]);
  });
});

describe("follow-ups", () => {
  it("offers them on the newest reply and sends one when picked", async () => {
    const ask = vi
      .fn()
      .mockResolvedValueOnce(response({ followUps: ["Show me a shorter trip"] }))
      .mockResolvedValueOnce(response({ reply: "Here is a shorter one.", followUps: [] }));
    render(<TravisChat ask={ask} />);

    type("hello");
    fireEvent.click(sendButton());
    fireEvent.click(await screen.findByRole("button", { name: "Show me a shorter trip" }));

    await screen.findByText("Here is a shorter one.");
    expect(ask.mock.calls[1][0].at(-1)).toMatchObject({ role: "user", content: "Show me a shorter trip" });
  });

  it("stops offering the old ones once the conversation has moved on", async () => {
    const ask = vi
      .fn()
      .mockResolvedValueOnce(response({ followUps: ["Old follow-up"] }))
      .mockResolvedValueOnce(response({ reply: "Second reply.", followUps: ["New follow-up"] }));
    render(<TravisChat ask={ask} />);

    type("one");
    fireEvent.click(sendButton());
    await screen.findByRole("button", { name: "Old follow-up" });

    type("two");
    fireEvent.click(sendButton());
    await screen.findByRole("button", { name: "New follow-up" });

    expect(screen.queryByRole("button", { name: "Old follow-up" })).not.toBeInTheDocument();
  });
});

describe("when something goes wrong", () => {
  it("says Travis is unavailable and points to planning by hand, with nothing to retry", async () => {
    const ask = vi
      .fn()
      .mockRejectedValue(new ApiError(503, "Travis isn't available right now. You can still plan your trip yourself.", "unavailable"));
    render(<TravisChat ask={ask} />);

    type("hello");
    fireEvent.click(sendButton());

    expect(await screen.findByText(/isn't available right now/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Plan a trip yourself" })).toHaveAttribute("href", "/trips/new");
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
  });

  it("keeps the traveller's message on screen after a failure", async () => {
    render(<TravisChat ask={vi.fn().mockRejectedValue(new ApiError(503, "Busy.", "busy"))} />);

    type("my question");
    fireEvent.click(sendButton());

    await screen.findByText("Busy.");
    expect(screen.getByText("my question")).toBeInTheDocument();
  });

  it("retries without repeating the traveller's message", async () => {
    const ask = vi
      .fn()
      .mockRejectedValueOnce(new ApiError(503, "Travis is busy right now. Try again in a minute.", "busy"))
      .mockResolvedValueOnce(response());
    render(<TravisChat ask={ask} />);

    type("hello");
    fireEvent.click(sendButton());
    fireEvent.click(await screen.findByRole("button", { name: "Try again" }));

    await screen.findByText("Bali suits that well.");
    expect(screen.getAllByText("hello")).toHaveLength(1);
    expect(ask.mock.calls[1][0]).toHaveLength(1);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("does not offer a retry for a message the server refused outright", async () => {
    render(<TravisChat ask={vi.fn().mockRejectedValue(new ApiError(400, "Travis couldn't read that.", "bad-request"))} />);

    type("hello");
    fireEvent.click(sendButton());

    await screen.findByText("Travis couldn't read that.");
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
  });

  it("does not offer a retry when the session has expired", async () => {
    render(<TravisChat ask={vi.fn().mockRejectedValue(new ApiError(401, "Your session expired.", undefined))} />);

    type("hello");
    fireEvent.click(sendButton());

    await screen.findByText("Your session expired.");
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
  });

  it("copes with an error that is not from the server at all", async () => {
    render(<TravisChat ask={vi.fn().mockRejectedValue(new TypeError("boom"))} />);

    type("hello");
    fireEvent.click(sendButton());

    expect(await screen.findByText("Something went wrong. Please try again.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("never shows the raw error text of an unexpected failure", async () => {
    render(<TravisChat ask={vi.fn().mockRejectedValue(new Error("secret internal stack detail"))} />);

    type("hello");
    fireEvent.click(sendButton());

    await screen.findByRole("alert");
    expect(screen.queryByText(/secret internal/)).not.toBeInTheDocument();
  });
});

describe("keeping the conversation", () => {
  it("restores it after the page is reloaded", async () => {
    const { unmount } = render(<TravisChat ask={vi.fn().mockResolvedValue(response())} />);
    type("hello");
    fireEvent.click(sendButton());
    await screen.findByText("Bali suits that well.");
    unmount();

    render(<TravisChat ask={vi.fn()} />);
    expect(screen.getByText("hello")).toBeInTheDocument();
    expect(screen.getByText("Bali suits that well.")).toBeInTheDocument();
    expect(screen.getByRole("article", { name: "Bali, Indonesia" })).toBeInTheDocument();
  });

  it("keeps it in session storage only, not anywhere that outlives the tab", async () => {
    const local = vi.spyOn(Storage.prototype, "setItem");
    render(<TravisChat ask={vi.fn().mockResolvedValue(response())} />);
    type("hello");
    fireEvent.click(sendButton());
    await screen.findByText("Bali suits that well.");

    expect(window.sessionStorage.getItem(STORAGE_KEY)).not.toBeNull();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    local.mockRestore();
  });

  it("does not show one account's conversation to the next account that signs in", async () => {
    const { unmount } = render(<TravisChat ask={vi.fn().mockResolvedValue(response())} />);
    type("a surprise trip to Santorini");
    fireEvent.click(sendButton());
    await screen.findByText("Bali suits that well.");
    unmount();

    // Same tab, different person.
    currentUid = "user-2";
    const second = render(<TravisChat ask={vi.fn()} />);
    expect(screen.queryByText("a surprise trip to Santorini")).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Example questions" })).toBeInTheDocument();
    second.unmount();

    // And the first account still has theirs.
    currentUid = "user-1";
    render(<TravisChat ask={vi.fn()} />);
    expect(screen.getByText("a surprise trip to Santorini")).toBeInTheDocument();
  });

  it("keeps nothing when nobody is signed in", async () => {
    currentUid = null;
    render(<TravisChat ask={vi.fn().mockResolvedValue(response())} />);
    type("hello");
    fireEvent.click(sendButton());
    await screen.findByText("Bali suits that well.");

    expect(window.sessionStorage.length).toBe(0);
  });

  it("starts fresh on request and forgets what was said", async () => {
    render(<TravisChat ask={vi.fn().mockResolvedValue(response())} />);
    type("hello");
    fireEvent.click(sendButton());
    await screen.findByText("Bali suits that well.");

    fireEvent.click(screen.getByRole("button", { name: "Start a new conversation" }));

    expect(screen.queryByText("hello")).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Example questions" })).toBeInTheDocument();
    expect(window.sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("does not offer a fresh start when there is nothing to start over from", () => {
    render(<TravisChat ask={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Start a new conversation" })).not.toBeInTheDocument();
  });

  it("ignores stored data that is not a valid conversation", () => {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify([{ nonsense: true }]));
    render(<TravisChat ask={vi.fn()} />);
    expect(screen.getByRole("group", { name: "Example questions" })).toBeInTheDocument();
  });
});

describe("demo mode", () => {
  it("says so when the answers come from the built-in stand-in", async () => {
    render(<TravisChat ask={vi.fn().mockResolvedValue(response({ mode: "demo" }))} />);
    type("hello");
    fireEvent.click(sendButton());

    expect(await screen.findByText(/Demo mode/)).toBeInTheDocument();
  });

  it("says nothing of the kind for a live answer", async () => {
    render(<TravisChat ask={vi.fn().mockResolvedValue(response({ mode: "live" }))} />);
    type("hello");
    fireEvent.click(sendButton());

    await screen.findByText("Bali suits that well.");
    expect(screen.queryByText(/Demo mode/)).not.toBeInTheDocument();
  });

  it("keeps saying so after a reload", async () => {
    const { unmount } = render(<TravisChat ask={vi.fn().mockResolvedValue(response({ mode: "demo" }))} />);
    type("hello");
    fireEvent.click(sendButton());
    await screen.findByText(/Demo mode/);
    unmount();

    render(<TravisChat ask={vi.fn()} />);
    expect(screen.getByText(/Demo mode/)).toBeInTheDocument();
  });
});

describe("turning a suggestion into a trip", () => {
  it("hands the destination, dates and styles to the wizard and opens it", async () => {
    render(<TravisChat ask={vi.fn().mockResolvedValue(response())} />);
    type("hello");
    fireEvent.click(sendButton());

    fireEvent.click(await screen.findByRole("button", { name: "Plan this trip to Bali, Indonesia" }));

    expect(push).toHaveBeenCalledWith("/trips/new");
    expect(readDraft()).toEqual({
      destination: "Bali, Indonesia",
      startDate: "2027-04-01",
      endDate: "2027-04-08",
      preferences: ["beaches", "relaxation"],
    });
    expect(readDraftOrigin()).toEqual({ source: "travis", destination: "Bali, Indonesia", windowLabel: "Apr–Jun" });
  });

  it("does not invent a budget, currency or party size Travis never asked about", async () => {
    render(<TravisChat ask={vi.fn().mockResolvedValue(response())} />);
    type("hello");
    fireEvent.click(sendButton());
    fireEvent.click(await screen.findByRole("button", { name: /Plan this trip to/ }));

    const draft = readDraft()!;
    expect(draft).not.toHaveProperty("budget");
    expect(draft).not.toHaveProperty("currency");
    expect(draft).not.toHaveProperty("travelers");
  });

  it("leaves styles to the traveller when Travis named none", async () => {
    render(<TravisChat ask={vi.fn().mockResolvedValue(response({ suggestions: [suggestion({ styles: [] })] }))} />);
    type("hello");
    fireEvent.click(sendButton());
    fireEvent.click(await screen.findByRole("button", { name: /Plan this trip to/ }));

    expect(readDraft()).not.toHaveProperty("preferences");
  });

  it("carries on working if the reply arrives after the page has been left", async () => {
    const pending = deferred<TravisResponse>();
    const { unmount } = render(<TravisChat ask={() => pending.promise} />);
    type("hello");
    fireEvent.click(sendButton());
    await waitFor(() => expect(screen.getByText("Travis is thinking…")).toBeInTheDocument());

    unmount();
    // Settling a request for a component that is gone must not throw or warn.
    await act(async () => pending.resolve(response()));
  });
});
