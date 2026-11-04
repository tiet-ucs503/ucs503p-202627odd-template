"use client";

import { ArrowUp } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import { MAX_USER_MESSAGE_CHARS } from "@/lib/validation/travis";

/** Show the character count only when it starts to matter. */
const COUNTER_FROM = 800;
const MAX_HEIGHT_PX = 160;

/**
 * The message box.
 *
 * Enter sends and Shift+Enter makes a new line, as in every chat people
 * already use. It stays editable while Travis is answering — only sending is
 * held back — so a traveller can keep typing their next question instead of
 * watching a locked box.
 */
export function Composer({ onSend, disabled }: { onSend: (text: string) => void; disabled: boolean }) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  const trimmed = value.trim();
  const tooLong = value.length > MAX_USER_MESSAGE_CHARS;
  const canSend = !disabled && trimmed.length > 0 && !tooLong;

  // Grow with the text, up to a ceiling, then scroll inside the box.
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, MAX_HEIGHT_PX)}px`;
  }, [value]);

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
      <label htmlFor="travis-message" className="sr-only">
        Message Travis
      </label>
      <div
        className={cn(
          "flex items-end gap-2 rounded-2xl border bg-white p-2 transition-colors dark:bg-zinc-900",
          "focus-within:border-orange-500 focus-within:ring-2 focus-within:ring-orange-500/25",
          tooLong ? "border-red-400" : "border-zinc-300 dark:border-zinc-700",
        )}
      >
        <textarea
          id="travis-message"
          ref={ref}
          rows={1}
          value={value}
          placeholder="Ask where or when to go"
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            // `isComposing` keeps Enter from sending while an input method
            // (Hindi, Japanese, Chinese…) is still choosing a character.
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              submit();
            }
          }}
          className="max-h-40 min-h-9 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-100"
        />
        <Button type="submit" size="icon" aria-label="Send message" disabled={!canSend}>
          <ArrowUp className="h-4 w-4" />
        </Button>
      </div>

      <div className="mt-1.5 flex items-center justify-between gap-3 px-1 text-xs text-zinc-500">
        <span className="hidden sm:inline">Enter to send · Shift+Enter for a new line</span>
        {value.length >= COUNTER_FROM ? (
          <span className={cn("ml-auto tabular-nums", tooLong && "font-medium text-red-600 dark:text-red-400")}>
            {tooLong
              ? `${value.length - MAX_USER_MESSAGE_CHARS} over the limit`
              : `${value.length} / ${MAX_USER_MESSAGE_CHARS}`}
          </span>
        ) : null}
      </div>
    </form>
  );
}
