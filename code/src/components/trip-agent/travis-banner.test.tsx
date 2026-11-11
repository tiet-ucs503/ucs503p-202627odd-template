import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TRIP_QUESTIONS, TravisBanner } from "@/components/trip-agent/travis-banner";
import { TravisLauncher } from "@/components/trip-agent/travis-launcher";

describe("TravisBanner", () => {
  it("says what Travis is for, naming the trip's destination", () => {
    render(<TravisBanner destination="Thailand" onOpen={vi.fn()} onAsk={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Ask Travis about your trip" })).toBeInTheDocument();
    expect(screen.getByText(/The weather in Thailand, what's worth trying locally/)).toBeInTheDocument();
    expect(screen.getByText(/before anything is saved/)).toBeInTheDocument();
  });

  it("opens the conversation from its button", () => {
    const onOpen = vi.fn();
    render(<TravisBanner destination="Thailand" onOpen={onOpen} onAsk={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Chat with Travis" }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("offers questions worth asking, covering both talking and changing", () => {
    render(<TravisBanner destination="Thailand" onOpen={vi.fn()} onAsk={vi.fn()} />);
    const group = screen.getByRole("group", { name: "Things to ask Travis" });
    expect(within(group).getAllByRole("button")).toHaveLength(TRIP_QUESTIONS.length);
    expect(within(group).getByRole("button", { name: "What will the weather be like?" })).toBeInTheDocument();
    expect(within(group).getByRole("button", { name: "Make the trip a day shorter" })).toBeInTheDocument();
  });

  it("opens the conversation with the chosen question already asked", () => {
    const onAsk = vi.fn();
    const onOpen = vi.fn();
    render(<TravisBanner destination="Thailand" onOpen={onOpen} onAsk={onAsk} />);
    fireEvent.click(screen.getByRole("button", { name: "What should I try locally?" }));
    expect(onAsk).toHaveBeenCalledWith("What should I try locally?");
    expect(onOpen).not.toHaveBeenCalled();
  });
});

describe("TravisLauncher", () => {
  it("is a button named for what it does, and opens Travis", () => {
    const onOpen = vi.fn();
    render(<TravisLauncher onOpen={onOpen} />);
    fireEvent.click(screen.getByRole("button", { name: "Ask Travis" }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("stays in the corner of the screen as the page scrolls", () => {
    render(<TravisLauncher onOpen={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Ask Travis" }).className).toMatch(/\bfixed\b/);
  });
});
