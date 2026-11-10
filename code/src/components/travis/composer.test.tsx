import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Composer } from "@/components/travis/composer";

const box = () => screen.getByRole("textbox", { name: "Message Travis" }) as HTMLTextAreaElement;
const send = () => screen.getByRole("button", { name: "Send message" });
const type = (value: string) => fireEvent.change(box(), { target: { value } });

describe("sending", () => {
  it("sends on Enter and empties the box", () => {
    const onSend = vi.fn();
    render(<Composer onSend={onSend} disabled={false} />);
    type("  somewhere warm in April ");
    fireEvent.keyDown(box(), { key: "Enter" });
    expect(onSend).toHaveBeenCalledWith("somewhere warm in April");
    expect(box()).toHaveValue("");
  });

  it("starts a new line on Shift+Enter instead of sending", () => {
    const onSend = vi.fn();
    render(<Composer onSend={onSend} disabled={false} />);
    type("one");
    fireEvent.keyDown(box(), { key: "Enter", shiftKey: true });
    expect(onSend).not.toHaveBeenCalled();
  });

  it("does not send while an input method is still choosing a character", () => {
    const onSend = vi.fn();
    render(<Composer onSend={onSend} disabled={false} />);
    type("日本");
    fireEvent.keyDown(box(), { key: "Enter", isComposing: true });
    expect(onSend).not.toHaveBeenCalled();
  });

  it("will not send nothing", () => {
    const onSend = vi.fn();
    render(<Composer onSend={onSend} disabled={false} />);
    expect(send()).toBeDisabled();
    type("   ");
    fireEvent.keyDown(box(), { key: "Enter" });
    expect(onSend).not.toHaveBeenCalled();
  });

  it("stays editable while Travis is answering, but holds the send", () => {
    const onSend = vi.fn();
    render(<Composer onSend={onSend} disabled />);
    type("my next question");
    expect(box()).toHaveValue("my next question");
    expect(send()).toBeDisabled();
    fireEvent.keyDown(box(), { key: "Enter" });
    expect(onSend).not.toHaveBeenCalled();
  });

  it("refuses a message over the limit and says by how much", () => {
    render(<Composer onSend={vi.fn()} disabled={false} />);
    type("x".repeat(1005));
    expect(screen.getByText("5 over the limit")).toBeInTheDocument();
    expect(send()).toBeDisabled();
  });
});

describe("its height", () => {
  let observe: () => void;
  let width = 0;
  let contentHeight = 0;

  beforeEach(() => {
    observe = () => {};
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: () => void) {
          observe = callback;
        }
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(() => width);
    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockImplementation(() => contentHeight);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("grows with its text, up to a ceiling", () => {
    width = 700;
    contentHeight = 300;
    render(<Composer onSend={vi.fn()} disabled={false} />);
    expect(box().style.height).toBe("160px");
  });

  it("is fitted again when the box gets its real width, so a bad first measurement does not stick", () => {
    // Mounted somewhere that has no width yet (a background tab, say): the
    // placeholder wraps into a sliver and measures as far too tall.
    width = 0;
    contentHeight = 400;
    render(<Composer onSend={vi.fn()} disabled={false} />);
    expect(box().style.height).toBe("160px");

    // The page becomes visible and the box gets its width: one line again.
    width = 700;
    contentHeight = 39;
    observe();
    expect(box().style.height).toBe("39px");
  });

  it("does not refit for a change that is not in width", () => {
    width = 700;
    contentHeight = 39;
    render(<Composer onSend={vi.fn()} disabled={false} />);
    box().style.height = "77px";
    observe(); // the width is the same, so nothing to do
    expect(box().style.height).toBe("77px");
  });
});
