"use client";

import { ArrowUp } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import { MAX_USER_MESSAGE_CHARS } from "@/lib/validation/travis";

/** Size a textarea to its text, up to a ceiling, after which it scrolls inside. */
function fitToText(element: HTMLTextAreaElement) {
  element.style.height = "auto";
  element.style.height = `${Math.min(element.scrollHeight, MAX_HEIGHT_PX)}px`;
}

/** Show the character count only when it starts to matter. */
const COUNTER_FROM_RATIO = 0.8;
const MAX_HEIGHT_PX = 160;

/**
 * The message box.
 *
 * Enter sends and Shift+Enter makes a new line, as in every chat people
 * already use. It stays editable while Travis is answering — only sending is
 * held back — so a traveller can keep typing their next question instead of
 * watching a locked box.
 */
export function Composer({
  onSend,
  disabled,
  placeholder = "Where should I go, and when?",
  label = "Message Travis",
  maxChars = MAX_USER_MESSAGE_CHARS,
  inputId = "travis-message",
  hint = true,
}: {
  onSend: (text: string) => void;
  disabled: boolean;
  placeholder?: string;
  /** The accessible name of the box; it has no visible label. */
  label?: string;
  maxChars?: number;
  /** Two composers on one page need different ids for their labels to point at the right box. */
  inputId?: string;
  /** Show the "Enter to send" line. A narrow panel has no room for it. */
  hint?: boolean;
}) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  const trimmed = value.trim();
  const tooLong = value.length > maxChars;
  const canSend = !disabled && trimmed.length > 0 && !tooLong;

  // Grow with the text, up to a ceiling, then scroll inside the box.
  useLayoutEffect(() => {
    if (ref.current) fitToText(ref.current);
  }, [value]);

  // The height depends on how wide the box is, and on first mount the layout
  // around it may not have settled: measured then, the placeholder wraps in a
  // sliver of width and the box is stuck at its maximum height. So it is fitted
  // again whenever its width changes, not only when the text does.
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    let width = element.clientWidth;
    const observer = new ResizeObserver(() => {
      if (element.clientWidth === width) return;
      width = element.clientWidth;
      fitToText(element);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Focus on desktop only: on a phone it would throw the keyboard up before
  // the traveller has read a word of the page.
  useEffect(() => {
    if (window.matchMedia("(pointer: fine)").matches) ref.current?.focus();
  }, []);

  function submit() {
    if (!canSend) return;
    onSend(trimmed);
    setValue("");
    ref.current?.focus();
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      aria-busy={disabled}
    >
      <label htmlFor={inputId} className="sr-only">
        {label}
      </label>
      <div
        className={cn(
          "flex items-end gap-2 rounded-3xl border bg-white p-2 pl-3 shadow-lg shadow-zinc-900/5 transition-colors dark:bg-zinc-900",
          "focus-within:border-orange-500 focus-within:ring-2 focus-within:ring-orange-500/25",
          tooLong ? "border-red-400" : "border-zinc-300 dark:border-zinc-700",
        )}
      >
        <textarea
          id={inputId}
          ref={ref}
          rows={1}
          value={value}
          placeholder={placeholder}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            // `isComposing` keeps Enter from sending while an input method
            // (Hindi, Japanese, Chinese…) is still choosing a character.
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              submit();
            }
          }}
          className="max-h-40 min-h-9 flex-1 resize-none bg-transparent px-1 py-2 text-[15px] text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-100"
        />
        <Button type="submit" size="icon" aria-label="Send message" disabled={!canSend}>
          <ArrowUp className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>

      <div className="mt-1.5 flex items-center justify-between gap-3 px-1 text-xs text-zinc-500">
        {hint ? <span className="hidden sm:inline">Enter to send · Shift+Enter for a new line</span> : <span />}
        {value.length >= maxChars * COUNTER_FROM_RATIO ? (
          <span className={cn("ml-auto tabular-nums", tooLong && "font-medium text-red-600 dark:text-red-400")}>
            {tooLong
              ? `${value.length - maxChars} over the limit`
              : `${value.length} / ${maxChars}`}
          </span>
        ) : null}
      </div>
    </form>
  );
}
