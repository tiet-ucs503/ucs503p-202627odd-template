import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { TripAgentPanel } from "@/components/trip-agent/trip-agent-panel";
import { ApiError } from "@/lib/api-client";
import { getMockPlacesProvider } from "@/test-support/places";
import { buildChangeSet } from "@/lib/services/trip-agent";
import { buildThailandTrip } from "@/test-support/trip-fixture";
import type { Trip } from "@/types/trip";
import type { AgentTrip, ChangeSet, TripAgentResponse, TripPatch } from "@/types/trip-agent";

let currentUid: string | null = "user-1";
vi.mock("@/components/auth-provider", () => ({
  useAuth: () => ({ user: currentUid ? { uid: currentUid } : null, loading: false }),
}));

let agentTrip: AgentTrip;
let trip: Trip;
let removeFirst: ChangeSet;
let patched: Trip;

const asTrip = (t: AgentTrip): Trip =>
  ({ ...t, ownerId: "user-1", status: "planned", createdAt: new Date(0), updatedAt: new Date(0) }) as unknown as Trip;

beforeAll(async () => {
  agentTrip = await buildThailandTrip();
  trip = asTrip(agentTrip);
  const built = await buildChangeSet(agentTrip, [{ type: "remove_activity", activityId: agentTrip.days[0].activities[0].id }], { places: getMockPlacesProvider() });
  if (!built.ok) throw new Error("fixture change failed");
  removeFirst = built.changeSet;
  patched = { ...trip, ...removeFirst.patch };
});

beforeEach(() => {
  window.sessionStorage.clear();
  currentUid = "user-1";
});

const answer = (overrides: Partial<TripAgentResponse> = {}): TripAgentResponse => ({
  reply: "I'll remove that.",
  changeSet: removeFirst,
  ...overrides,
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

type Props = Partial<React.ComponentProps<typeof TripAgentPanel>>;

function renderPanel(props: Props = {}) {
  const defaults = {
    trip,
    open: true,
    onOpenChange: vi.fn(),
    focus: null,
    onClearFocus: vi.fn(),
    onApply: vi.fn().mockResolvedValue(undefined),
    ask: vi.fn().mockResolvedValue(answer()),
  };
  const all = { ...defaults, ...props };
  const view = render(<TripAgentPanel {...all} />);
  return {
    ...all,
    ...view,
    // `props` may hold any function; what the tests inspect is always a spy.
    ask: all.ask as Mock,
    onApply: all.onApply as Mock,
    rerenderWith: (next: Props) => view.rerender(<TripAgentPanel {...all} {...next} />),
  };
}

const box = () => screen.getByRole("textbox", { name: "Ask Travis or tell him what to change" }) as HTMLTextAreaElement;

async function say(text: string) {
  fireEvent.change(box(), { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: "Send message" }));
}

async function ask(text = "remove the first thing") {
  await say(text);
  await screen.findByRole("region", { name: "Proposed change" });
}

describe("the empty state", () => {
  it("says what Travis can do, and that nothing is saved without a yes", () => {
    renderPanel();
    expect(screen.getByText("Hi, I'm Travis.")).toBeInTheDocument();
    expect(screen.getByText(/nothing is saved until you say so/i)).toBeInTheDocument();
    // Travis is friendly and says what he is for: questions as well as changes.
    expect(screen.getByText(/what the weather is usually like, what's worth trying locally/i)).toBeInTheDocument();
    expect(screen.getByText(/can't book anything or see live prices or forecasts/i)).toBeInTheDocument();
  });

  it("offers requests that make sense for this trip", () => {
    renderPanel();
    const group = screen.getByRole("group", { name: "Example requests" });
    expect(within(group).getByRole("button", { name: "What will the weather be like?" })).toBeInTheDocument();
    expect(within(group).getByRole("button", { name: "What are the famous local things to try?" })).toBeInTheDocument();
    expect(within(group).getByRole("button", { name: "Make the trip a day shorter" })).toBeInTheDocument();
    expect(within(group).getByRole("button", { name: "Add two more days" })).toBeInTheDocument();
    const lastCity = [...trip.cities].sort((a, b) => b.order - a.order)[0].name;
    expect(within(group).getByRole("button", { name: `Drop ${lastCity} from the trip` })).toBeInTheDocument();
  });

  it("does not offer to drop a city from a one-city trip", () => {
    const one = { ...trip, cities: [trip.cities[0]] };
    renderPanel({ trip: one });
    expect(screen.queryByRole("button", { name: /^Drop / })).not.toBeInTheDocument();
  });

  it("sends an example when it is picked", async () => {
    const { ask } = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Add two more days" }));
    await waitFor(() => expect(ask).toHaveBeenCalledTimes(1));
    expect(ask.mock.calls[0][0].messages).toEqual([{ role: "user", content: "Add two more days" }]);
  });

  it("renders nothing when closed", () => {
    renderPanel({ open: false });
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
});

describe("a question asked from the page", () => {
  it("is sent as soon as the panel is open, and the page is told", async () => {
    const onPromptSent = vi.fn();
    const { ask: askMock } = renderPanel({ prompt: { text: "What will the weather be like?", nonce: 1 }, onPromptSent });
    await screen.findByText("I'll remove that.");
    expect(askMock).toHaveBeenCalledTimes(1);
    expect(askMock.mock.calls[0][0].messages).toEqual([{ role: "user", content: "What will the weather be like?" }]);
    expect(onPromptSent).toHaveBeenCalledTimes(1);
  });

  it("is sent once, however often the page re-renders", async () => {
    const view = renderPanel({ prompt: { text: "hello", nonce: 1 } });
    await screen.findByText("I'll remove that.");
    view.rerenderWith({ prompt: { text: "hello", nonce: 1 } });
    view.rerenderWith({ prompt: { text: "hello", nonce: 1 } });
    expect(view.ask).toHaveBeenCalledTimes(1);
  });

  it("can be asked a second time when it is a new request", async () => {
    const view = renderPanel({ prompt: { text: "hello", nonce: 1 }, ask: vi.fn().mockResolvedValue(answer({ changeSet: null })) });
    await waitFor(() => expect(view.ask).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByText(/Travis is working on it/)).not.toBeInTheDocument());
    view.rerenderWith({ prompt: { text: "hello", nonce: 2 } });
    await waitFor(() => expect(view.ask).toHaveBeenCalledTimes(2));
  });

  it("waits until the panel is open", async () => {
    const view = renderPanel({ open: false, prompt: { text: "hello", nonce: 1 } });
    expect(view.ask).not.toHaveBeenCalled();
    view.rerenderWith({ open: true, prompt: { text: "hello", nonce: 1 } });
    await waitFor(() => expect(view.ask).toHaveBeenCalledTimes(1));
  });

  it("shows a plain answer to a question with nothing to confirm", async () => {
    renderPanel({
      prompt: { text: "What will the weather be like?", nonce: 1 },
      ask: vi.fn().mockResolvedValue(answer({ reply: "Mostly warm and dry in January, usually around 30 degrees.", changeSet: null })),
    });
    expect(await screen.findByText(/Mostly warm and dry in January/)).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Proposed change" })).not.toBeInTheDocument();
  });
});

describe("asking for a change", () => {
  it("sends the trip as it is now, the conversation, and where the traveller is looking", async () => {
    const day = trip.days[2];
    const { ask: askMock } = renderPanel({ focus: { dayId: day.id } });
    await ask("make this day lighter");

    const sent = askMock.mock.calls[0][0];
    expect(sent.trip.id).toBe(trip.id);
    expect(sent.trip.days).toHaveLength(trip.days.length);
    expect(sent.trip).not.toHaveProperty("ownerId");
    expect(sent.messages).toEqual([{ role: "user", content: "make this day lighter" }]);
    expect(sent.focus).toEqual({ dayId: day.id });
  });

  it("shows what it would change, and saves nothing yet", async () => {
    const { onApply } = renderPanel();
    await ask();

    expect(screen.getByText("I'll remove that.")).toBeInTheDocument();
    const preview = screen.getByRole("region", { name: "Proposed change" });
    expect(within(preview).getByText(removeFirst.lines[0])).toBeInTheDocument();
    expect(within(preview).getByRole("button", { name: "Apply changes" })).toBeInTheDocument();
    expect(onApply).not.toHaveBeenCalled();
  });

  it("shows the cost when it moved, and does not repeat what the lines already say", async () => {
    const changed: ChangeSet = {
      ...removeFirst,
      lines: ["The trip becomes 7 days (Jan 10 – Jan 16), from 9."],
      before: { ...removeFirst.before, dayCount: 9, cityDays: [{ name: "Bangkok", days: 5 }, { name: "Phuket", days: 4 }] },
      after: { ...removeFirst.after, dayCount: 7, cityDays: [{ name: "Bangkok", days: 4 }, { name: "Phuket", days: 3 }] },
    };
    renderPanel({ ask: vi.fn().mockResolvedValue(answer({ changeSet: changed })) });
    await ask();
    const preview = screen.getByRole("region", { name: "Proposed change" });
    expect(within(preview).getByText("Estimated cost")).toBeInTheDocument();
    expect(within(preview).queryByText("Length")).not.toBeInTheDocument();
    expect(within(preview).queryByText("Bangkok")).not.toBeInTheDocument();
  });

  it("shows no cost row when the cost did not move", async () => {
    const same: ChangeSet = { ...removeFirst, after: { ...removeFirst.after, estimatedTotal: removeFirst.before.estimatedTotal } };
    renderPanel({ ask: vi.fn().mockResolvedValue(answer({ changeSet: same })) });
    await ask();
    expect(within(screen.getByRole("region", { name: "Proposed change" })).queryByText("Estimated cost")).not.toBeInTheDocument();
  });

  it("shows warnings before the traveller decides", async () => {
    const warned: ChangeSet = { ...removeFirst, warnings: ["Day 3 looks very full."] };
    renderPanel({ ask: vi.fn().mockResolvedValue(answer({ changeSet: warned })) });
    await ask();
    expect(screen.getByText("Day 3 looks very full.")).toBeInTheDocument();
  });

  it("shows a plain answer with nothing to confirm when Travis is only talking", async () => {
    renderPanel({ ask: vi.fn().mockResolvedValue(answer({ reply: "Which city do you mean?", changeSet: null })) });
    await say("change the hotel");
    expect(await screen.findByText("Which city do you mean?")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Proposed change" })).not.toBeInTheDocument();
  });

  it("shows that Travis is working while it waits, and does not accept a second request meanwhile", async () => {
    const pending = deferred<TripAgentResponse>();
    const { ask: askMock } = renderPanel({ ask: vi.fn().mockReturnValue(pending.promise) });
    await say("shorter please");
    expect(await screen.findByText(/Travis is working on it/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send message" })).toBeDisabled();

    await act(async () => pending.resolve(answer()));
    await screen.findByRole("region", { name: "Proposed change" });
    expect(askMock).toHaveBeenCalledTimes(1);
  });

  it("sends only recent turns, each within the server's length limit", async () => {
    const long = "x".repeat(700);
    const { ask: askMock } = renderPanel({ ask: vi.fn().mockResolvedValue(answer({ reply: long, changeSet: null })) });
    for (let i = 0; i < 7; i++) {
      await say(`request ${i}`);
      await screen.findAllByText(long);
      await waitFor(() => expect(askMock).toHaveBeenCalledTimes(i + 1));
      await waitFor(() => expect(screen.getByRole("button", { name: "Send message" })).toBeDisabled()); // empty box
    }
    const history = askMock.mock.calls.at(-1)![0].messages;
    expect(history.length).toBeLessThanOrEqual(10);
    expect(history.at(-1)).toEqual({ role: "user", content: "request 6" });
    for (const m of history) expect(m.content.length).toBeLessThanOrEqual(800);
  });
});

describe("applying a change", () => {
  it("saves exactly the proposed patch, then says it is applied", async () => {
    const { onApply } = renderPanel();
    await ask();
    fireEvent.click(screen.getByRole("button", { name: "Apply changes" }));

    await screen.findByText("Applied to your trip");
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply).toHaveBeenCalledWith(removeFirst.patch);
  });

  it("shows it is saving, and cannot be applied twice", async () => {
    const saving = deferred<void>();
    const { onApply } = renderPanel({ onApply: vi.fn().mockReturnValue(saving.promise) });
    await ask();
    fireEvent.click(screen.getByRole("button", { name: "Apply changes" }));

    expect(await screen.findByRole("button", { name: "Saving…" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Saving…" }));
    await act(async () => saving.resolve());
    expect(onApply).toHaveBeenCalledTimes(1);
  });

  it("keeps the proposal and says nothing was changed when the save fails", async () => {
    const { onApply } = renderPanel({ onApply: vi.fn().mockRejectedValue(new Error("offline")) });
    await ask();
    fireEvent.click(screen.getByRole("button", { name: "Apply changes" }));

    expect(await screen.findByText(/your trip is unchanged/i)).toBeInTheDocument();
    expect(screen.queryByText("Applied to your trip")).not.toBeInTheDocument();
    // Still pending, so they can try again.
    expect(screen.getByRole("button", { name: "Apply changes" })).toBeEnabled();
    expect(onApply).toHaveBeenCalledTimes(1);
  });

  it("does nothing when a proposal is discarded", async () => {
    const { onApply } = renderPanel();
    await ask();
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));

    expect(screen.getByText("Not applied")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Apply changes" })).not.toBeInTheDocument();
    expect(onApply).not.toHaveBeenCalled();
  });

  it("replaces a waiting proposal when the traveller asks for something else", async () => {
    renderPanel();
    await ask("remove the first thing");
    await say("actually, something else");
    await waitFor(() => expect(screen.getAllByRole("region", { name: "Proposed change" })).toHaveLength(2));

    const [older, newer] = screen.getAllByRole("region", { name: "Proposed change" });
    expect(within(older).getByText("Not applied")).toBeInTheDocument();
    expect(within(newer).getByRole("button", { name: "Apply changes" })).toBeInTheDocument();
  });
});

describe("a trip that changed after the proposal", () => {
  it("refuses to apply it, and says why", async () => {
    const view = renderPanel();
    await ask();

    const edited = structuredClone(trip);
    edited.days[1].activities.shift();
    view.rerenderWith({ trip: edited });

    expect(screen.getByText(/This trip has changed since I suggested this/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Apply changes" })).not.toBeInTheDocument();
    expect(view.onApply).not.toHaveBeenCalled();
  });

  it("lets the traveller dismiss the out-of-date proposal", async () => {
    const view = renderPanel();
    await ask();
    const edited = structuredClone(trip);
    edited.days[1].activities.shift();
    view.rerenderWith({ trip: edited });

    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.getByText("Not applied")).toBeInTheDocument();
  });
});

describe("undo", () => {
  it("restores the trip as it was, exactly", async () => {
    const view = renderPanel();
    await ask();
    fireEvent.click(screen.getByRole("button", { name: "Apply changes" }));
    await screen.findByText("Applied to your trip");

    // The page's subscription delivers the saved trip.
    view.rerenderWith({ trip: patched });
    fireEvent.click(await screen.findByRole("button", { name: "Undo" }));

    await screen.findByText(/your trip is back as it was/i);
    expect(view.onApply).toHaveBeenCalledTimes(2);
    const restored = view.onApply.mock.calls[1][0] as TripPatch;
    expect(restored).toEqual({
      cities: trip.cities,
      days: trip.days,
      budget: trip.budget,
      endDate: trip.endDate,
      dayCount: trip.dayCount,
      // The saved flight quote goes back too, so an undone city change can't leave a new fare behind.
      flights: trip.flights,
    });
    expect(restored.flights).toBeTruthy();
  });

  it("is not offered once the traveller has edited the trip since, because it would erase that", async () => {
    const view = renderPanel();
    await ask();
    fireEvent.click(screen.getByRole("button", { name: "Apply changes" }));
    await screen.findByText("Applied to your trip");

    const editedAfter = structuredClone(patched);
    editedAfter.days[2].activities.pop();
    view.rerenderWith({ trip: editedAfter });

    expect(screen.queryByRole("button", { name: "Undo" })).not.toBeInTheDocument();
  });

  it("says nothing was changed if the undo cannot be saved", async () => {
    const onApply = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("offline"));
    const view = renderPanel({ onApply });
    await ask();
    fireEvent.click(screen.getByRole("button", { name: "Apply changes" }));
    await screen.findByText("Applied to your trip");
    view.rerenderWith({ trip: patched });

    fireEvent.click(await screen.findByRole("button", { name: "Undo" }));
    expect(await screen.findByText(/Couldn't undo that/)).toBeInTheDocument();
    expect(screen.getByText("Applied to your trip")).toBeInTheDocument();
  });
});

describe("when Travis cannot answer", () => {
  it("says so without offering a retry that cannot work", async () => {
    renderPanel({ ask: vi.fn().mockRejectedValue(new ApiError(503, "Travis can't change trips right now.", "unavailable")) });
    await say("shorter");
    expect(await screen.findByText("Travis can't change trips right now.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
  });

  it("offers a retry for a passing failure, and the retry works", async () => {
    const askMock = vi.fn().mockRejectedValueOnce(new ApiError(503, "Travis is busy right now.", "busy")).mockResolvedValue(answer());
    renderPanel({ ask: askMock });
    await say("shorter");
    fireEvent.click(await screen.findByRole("button", { name: "Try again" }));

    await screen.findByRole("region", { name: "Proposed change" });
    expect(askMock).toHaveBeenCalledTimes(2);
    expect(screen.queryByText("Travis is busy right now.")).not.toBeInTheDocument();
  });

  it("does not offer a retry for a request the server refused", async () => {
    renderPanel({ ask: vi.fn().mockRejectedValue(new ApiError(400, "Travis couldn't read that request.", "bad-request")) });
    await say("shorter");
    await screen.findByText("Travis couldn't read that request.");
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
  });

  it("copes with a failure it does not recognise", async () => {
    renderPanel({ ask: vi.fn().mockRejectedValue(new Error("boom")) });
    await say("shorter");
    expect(await screen.findByText("Something went wrong. Please try again.")).toBeInTheDocument();
  });
});

describe("what the traveller is looking at", () => {
  it("shows it, and lets them stop", async () => {
    const day = trip.days[2];
    const city = trip.cities.find((c) => c.id === day.cityId)!;
    const { onClearFocus } = renderPanel({ focus: { dayId: day.id } });

    expect(screen.getByText(`Day ${day.dayNumber} · ${city.name}`)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: `Stop looking at Day ${day.dayNumber} · ${city.name}` }));
    expect(onClearFocus).toHaveBeenCalled();
  });

  it("does not send a focus that no longer exists in the trip", async () => {
    const { ask: askMock } = renderPanel({ focus: { activityId: "gone" } });
    expect(screen.queryByText(/Looking at/)).not.toBeInTheDocument();
    await say("hello");
    await waitFor(() => expect(askMock).toHaveBeenCalled());
    expect(askMock.mock.calls[0][0].focus).toBeUndefined();
  });
});

describe("there is no demo mode", () => {
  it("never shows a demo-mode notice", async () => {
    renderPanel();
    await ask();
    expect(screen.queryByText(/Demo mode/i)).not.toBeInTheDocument();
  });
});

describe("each trip has its own conversation", () => {
  const stored = () => window.sessionStorage.getItem(`tripease:trip-agent:v1:user-1:${trip.id}`);

  it("keeps the conversation across a reload, under this account and this trip", async () => {
    const first = renderPanel();
    await ask("remove the first thing");
    expect(stored()).toContain("remove the first thing");
    first.unmount();

    renderPanel();
    expect(screen.getByText("remove the first thing")).toBeInTheDocument();
    expect(screen.getByText("I'll remove that.")).toBeInTheDocument();
  });

  it("brings back a waiting proposal as not applied, since the trip may have changed meanwhile", async () => {
    const first = renderPanel();
    await ask();
    first.unmount();

    renderPanel();
    const preview = screen.getByRole("region", { name: "Proposed change" });
    expect(within(preview).getByText("Not applied")).toBeInTheDocument();
    expect(within(preview).queryByRole("button", { name: "Apply changes" })).not.toBeInTheDocument();
  });

  it("never writes the full itinerary of a proposal to storage", async () => {
    renderPanel();
    await ask();
    expect(stored()).not.toContain('"patch"');
    expect(stored()).not.toContain(trip.days[0].id);
  });

  it("does not show one trip's conversation on another trip", async () => {
    const first = renderPanel();
    await ask("remove the first thing");
    first.unmount();

    renderPanel({ trip: { ...trip, id: "another-trip" } });
    expect(screen.queryByText("remove the first thing")).not.toBeInTheDocument();
    expect(screen.getByText("Hi, I'm Travis.")).toBeInTheDocument();
  });

  it("does not show one account's conversation to another", async () => {
    const first = renderPanel();
    await ask("remove the first thing");
    first.unmount();

    currentUid = "user-2";
    renderPanel();
    expect(screen.queryByText("remove the first thing")).not.toBeInTheDocument();
  });

  it("starts fresh on request, and forgets the old one", async () => {
    renderPanel();
    await ask();
    fireEvent.click(screen.getByRole("button", { name: /New chat/ }));

    expect(screen.getByText("Hi, I'm Travis.")).toBeInTheDocument();
    expect(stored()).toBeNull();
  });
});
