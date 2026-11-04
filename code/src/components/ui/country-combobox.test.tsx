import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CountryCombobox } from "@/components/ui/country-combobox";

const DEBOUNCE = 180;

function Harness({ initial = "", onChange }: { initial?: string; onChange?: (value: string) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <CountryCombobox
        id="dest"
        label="Destination"
        value={value}
        debounceMs={DEBOUNCE}
        onChange={(next) => {
          setValue(next);
          onChange?.(next);
        }}
      />
      <button onClick={() => setValue("Italy")}>Pick Italy for me</button>
    </>
  );
}

const input = () => screen.getByRole("combobox", { name: "Destination" });
const options = () => screen.queryAllByRole("option").map((o) => o.textContent ?? "");
const type = (text: string) => fireEvent.change(input(), { target: { value: text } });
const settle = () => act(() => void vi.advanceTimersByTime(DEBOUNCE + 20));

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("opening", () => {
  it("is closed until focused, then offers the first countries", () => {
    render(<Harness />);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

    fireEvent.focus(input());
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(options()).toHaveLength(8);
    expect(options()[0]).toContain("Thailand");
  });

  it("says each country's region and best months", () => {
    render(<Harness />);
    fireEvent.focus(input());
    expect(options()[0]).toContain("Southeast Asia · Best Nov–Feb");
  });

  it("is announced as a combobox with a list", () => {
    render(<Harness />);
    fireEvent.focus(input());
    expect(input()).toHaveAttribute("aria-expanded", "true");
    expect(input()).toHaveAttribute("aria-autocomplete", "list");
    expect(input()).toHaveAttribute("aria-controls", screen.getByRole("listbox").id);
  });
});

describe("searching", () => {
  it("waits for a pause in typing before it refreshes the list", () => {
    render(<Harness />);
    fireEvent.focus(input());
    type("jap");

    // Not yet: the list on screen is still the one from before the typing.
    expect(options()).toHaveLength(8);
    expect(options().some((o) => o.includes("Japan"))).toBe(false);

    settle();
    expect(options()).toHaveLength(1);
    expect(options()[0]).toContain("Japan");
  });

  it("restarts the wait on every keystroke", () => {
    render(<Harness />);
    fireEvent.focus(input());
    type("j");
    act(() => void vi.advanceTimersByTime(DEBOUNCE - 40));
    type("ja");
    act(() => void vi.advanceTimersByTime(DEBOUNCE - 40));
    // Two keystrokes within the wait: still nothing has refreshed.
    expect(options()).toHaveLength(8);

    settle();
    expect(options().length).toBeLessThan(8);
  });

  it("finds a country from a city it is known for", () => {
    render(<Harness />);
    fireEvent.focus(input());
    type("dubai");
    settle();
    expect(options()[0]).toContain("United Arab Emirates");
  });

  it("says so when nothing matches, and does not offer a wrong guess", () => {
    render(<Harness />);
    fireEvent.focus(input());
    type("atlantis");
    settle();
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/No match for .atlantis./);
    expect(input()).toHaveAttribute("aria-expanded", "false");
  });

  it("announces how many countries it found", () => {
    render(<Harness />);
    fireEvent.focus(input());
    type("jap");
    settle();
    expect(screen.getByText("1 country found")).toBeInTheDocument();
  });
});

describe("choosing", () => {
  it("picks the highlighted option with Enter", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.focus(input());
    type("jap");
    settle();
    fireEvent.keyDown(input(), { key: "Enter" });

    expect(onChange).toHaveBeenLastCalledWith("Japan");
    expect(input()).toHaveValue("Japan");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("searches what is typed now when Enter comes before the list has refreshed", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.focus(input());
    type("japa"); // the list on screen is still the default eight
    fireEvent.keyDown(input(), { key: "Enter" }); // no waiting

    expect(onChange).toHaveBeenLastCalledWith("Japan");
  });

  it("picks with the mouse", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.focus(input());
    fireEvent.click(screen.getByRole("option", { name: /Singapore/ }));
    expect(onChange).toHaveBeenLastCalledWith("Singapore");
  });

  it("moves through the options with the arrow keys, wrapping round", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.focus(input());
    fireEvent.keyDown(input(), { key: "ArrowDown" });
    fireEvent.keyDown(input(), { key: "ArrowDown" });
    expect(input()).toHaveAttribute("aria-activedescendant", screen.getAllByRole("option")[2].id);

    fireEvent.keyDown(input(), { key: "ArrowUp" });
    fireEvent.keyDown(input(), { key: "ArrowUp" });
    fireEvent.keyDown(input(), { key: "ArrowUp" });
    expect(input()).toHaveAttribute("aria-activedescendant", screen.getAllByRole("option")[7].id);

    fireEvent.keyDown(input(), { key: "Enter" });
    expect(onChange).toHaveBeenLastCalledWith("Sri Lanka"); // the eighth in the default list
  });

  it("closes on Escape without choosing anything", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.focus(input());
    fireEvent.keyDown(input(), { key: "Escape" });
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("treats a country typed out in full as chosen, without a click", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    type("japan");
    expect(onChange).toHaveBeenLastCalledWith("Japan");
  });

  it("is not chosen until it is a country, and un-chooses when edited away", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    type("jap");
    expect(onChange).toHaveBeenLastCalledWith("");

    type("japan");
    expect(onChange).toHaveBeenLastCalledWith("Japan");
    type("japa");
    expect(onChange).toHaveBeenLastCalledWith("");
  });
});

describe("with a country already chosen", () => {
  it("shows it, and offers the whole list again rather than a list of one", () => {
    render(<Harness initial="Thailand" />);
    expect(input()).toHaveValue("Thailand");
    fireEvent.focus(input());
    expect(options()).toHaveLength(8);
    expect(screen.getByRole("option", { selected: true })).toHaveTextContent("Thailand");
  });

  it("follows the parent when it picks one itself", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Pick Italy for me" }));
    expect(input()).toHaveValue("Italy");
  });

  it("puts the chosen country back when Escape abandons an edit, and tells the parent", () => {
    const onChange = vi.fn();
    render(<Harness initial="Japan" onChange={onChange} />);
    type("jap");
    expect(onChange).toHaveBeenLastCalledWith("");

    fireEvent.keyDown(input(), { key: "Escape" });
    expect(input()).toHaveValue("Japan");
    expect(onChange).toHaveBeenLastCalledWith("Japan");
  });
});

describe("errors", () => {
  it("does not scold while the list is open and the person is still typing", () => {
    render(<Harness />);
    fireEvent.focus(input());
    type("Switz");
    expect(input()).not.toBeInvalid();
  });

  it("asks for a country from the list once they leave with something else in the box", () => {
    render(<Harness />);
    fireEvent.focus(input());
    type("Narnia");
    fireEvent.blur(input());
    expect(input()).toBeInvalid();
    expect(input()).toHaveAccessibleDescription(/Choose a country from the list/);
  });

  it("is fine to leave empty, and fine to leave with a country in it", () => {
    render(<Harness />);
    fireEvent.focus(input());
    fireEvent.blur(input());
    expect(input()).not.toBeInvalid();

    fireEvent.focus(input());
    type("japan");
    fireEvent.blur(input());
    expect(input()).not.toBeInvalid();
  });

  it("shows an error against the field", () => {
    render(
      <CountryCombobox id="d" label="Destination" value="" onChange={() => {}} error="Pick a country from the list" />,
    );
    expect(input()).toBeInvalid();
    expect(input()).toHaveAccessibleDescription("Pick a country from the list");
  });
});
