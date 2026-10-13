"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Sparkles, Loader2, Square, RotateCcw, MessageSquare, Mic, MicOff } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { FullAnalysis } from "@/lib/schema";
import { SUGGESTED_PROMPTS } from "@/lib/chatPrompt";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string };

export function ChatPanel({ session }: { session: FullAnalysis }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const recogRef = useRef<unknown>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const W = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
    const SR = W.SpeechRecognition || W.webkitSpeechRecognition;
    setVoiceSupported(!!SR);
  }, []);

  function toggleVoice() {
    if (typeof window === "undefined") return;
    const W = window as unknown as { SpeechRecognition?: new () => unknown; webkitSpeechRecognition?: new () => unknown };
    const SR = (W.SpeechRecognition || W.webkitSpeechRecognition) as
      | (new () => {
          continuous?: boolean;
          interimResults?: boolean;
          lang?: string;
          start: () => void;
          stop: () => void;
          onresult: ((e: { results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>; resultIndex: number }) => void) | null;
          onerror: ((e: { error: string }) => void) | null;
          onend: (() => void) | null;
        })
      | undefined;
    if (!SR) return;

    if (listening) {
      const r = recogRef.current as { stop: () => void } | null;
      r?.stop();
      return;
    }

    const r = new SR();
    r.continuous = true;
    r.interimResults = true;
    r.lang = navigator.language || "en-US";
    let finalText = "";
    r.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finalText += res[0].transcript;
        else interim += res[0].transcript;
      }
      setInput((prev) => {
        // replace previous draft with finalText + interim
        return (finalText + interim).trim();
      });
    };
    r.onerror = (e) => {
      console.warn("speech recognition error:", e.error);
      setListening(false);
    };
    r.onend = () => {
      setListening(false);
    };
    r.start();
    recogRef.current = r;
    setListening(true);
  }

  // Autoscroll on new tokens
  useEffect(() => {
    const el = threadRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || streaming) return;
      setError(null);
      const next: Msg[] = [...messages, { role: "user", content: trimmed }, { role: "assistant", content: "" }];
      setMessages(next);
      setInput("");
      setStreaming(true);

      const ctl = new AbortController();
      abortRef.current = ctl;

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session, messages: next.slice(0, -1) }),
          signal: ctl.signal,
        });
        if (!res.ok || !res.body) {
          const txt = await res.text().catch(() => "");
          throw new Error(txt || `Request failed (${res.status})`);
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        let acc = "";
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let i;
          while ((i = buf.indexOf("\n")) >= 0) {
            const line = buf.slice(0, i).trim();
            buf = buf.slice(i + 1);
            if (!line) continue;
            try {
              const evt = JSON.parse(line);
              if (evt.type === "delta" && typeof evt.text === "string") {
                acc += evt.text;
                setMessages((m) => {
                  const copy = m.slice();
                  copy[copy.length - 1] = { role: "assistant", content: acc };
                  return copy;
                });
              } else if (evt.type === "error") {
                setError(String(evt.error ?? "Stream error"));
              }
            } catch {
              /* noop */
            }
          }
        }
      } catch (e) {
        if ((e as { name?: string })?.name === "AbortError") {
          /* user stopped, keep partial */
        } else {
          setError(e instanceof Error ? e.message : "Network error");
          setMessages((m) => {
            const copy = m.slice();
            const last = copy[copy.length - 1];
            if (last && last.role === "assistant" && last.content === "") {
              copy.pop();
            }
            return copy;
          });
        }
      } finally {
        setStreaming(false);
        abortRef.current = null;
      }
    },
    [messages, session, streaming]
  );

  function stop() {
    abortRef.current?.abort();
  }

  function clearThread() {
    setMessages([]);
    setError(null);
  }

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div ref={threadRef} className="flex-1 min-h-0 overflow-y-auto px-1 py-6 md:py-8 space-y-5">
        {messages.length === 0 && (
          <EmptyState onPick={(p) => send(p)} />
        )}
        <AnimatePresence initial={false}>
          {messages.map((m, i) => (
            <MessageBubble key={i} role={m.role} content={m.content} streaming={streaming && i === messages.length - 1 && m.role === "assistant"} />
          ))}
        </AnimatePresence>

        {error && (
          <div className="card p-4 border-[rgba(239,35,60,0.4)]">
            <div className="severity-pill critical mb-2">Error</div>
            <p className="body-md text-[14px]">{error}</p>
          </div>
        )}
      </div>

      <div className="sticky bottom-0 pt-4 pb-2 bg-gradient-to-t from-[var(--bg)] via-[var(--bg)] to-transparent">
        <div className="card-elev p-3 md:p-4 flex items-end gap-3">
          <textarea
            ref={taRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKey}
            placeholder={streaming ? "SOLPOP is typing…" : "Ask anything about this inspection."}
            rows={1}
            className="flex-1 resize-none bg-transparent outline-none text-[15.5px] leading-[1.55] placeholder-[var(--fg-mute)] py-2.5 px-2 max-h-[160px]"
            style={{ fontFamily: "var(--font-sans)" }}
          />
          {voiceSupported && !streaming && (
            <button
              type="button"
              onClick={toggleVoice}
              title={listening ? "Stop dictating" : "Dictate"}
              aria-label={listening ? "Stop dictating" : "Dictate"}
              className={cn(
                "w-10 h-10 rounded-full grid place-items-center border transition-all",
                listening
                  ? "bg-[var(--accent)] text-[#0a0a0a] border-transparent shadow-[0_0_22px_var(--accent-glow)] animate-pulse"
                  : "border-[var(--line-strong)] text-[var(--fg-dim)] hover:text-[var(--fg)] hover:border-[var(--accent)]"
              )}
            >
              {listening ? <MicOff size={15} /> : <Mic size={15} />}
            </button>
          )}
          {streaming ? (
            <button
              type="button"
              onClick={stop}
              className="btn-ghost text-sm inline-flex items-center gap-2 !py-2.5 !px-4"
              aria-label="Stop streaming"
            >
              <Square size={14} />
              Stop
            </button>
          ) : (
            <button
              type="button"
              onClick={() => send(input)}
              disabled={!input.trim()}
              className="btn-primary inline-flex items-center gap-2 !py-3 !px-5"
            >
              <Send size={14} />
              Send
            </button>
          )}
        </div>
        <div className="flex items-center justify-between mt-2 px-1">
          <div className="font-mono text-[11px] text-[var(--fg-mute)]">
            ⏎ to send · ⇧⏎ for newline
          </div>
          {messages.length > 0 && (
            <button
              onClick={clearThread}
              className="font-mono text-[11px] text-[var(--fg-mute)] hover:text-[var(--fg)] transition-colors inline-flex items-center gap-1"
            >
              <RotateCcw size={11} /> Clear thread
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onPick }: { onPick: (text: string) => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className="card-elev p-7 md:p-9"
    >
      <div className="flex items-center gap-3 mb-4">
        <Sparkles size={16} className="text-[var(--accent)]" />
        <span className="tick">Ask the inspection</span>
      </div>
      <h2 className="font-serif text-[28px] md:text-[36px] leading-[1.05] mb-3">
        I&apos;ve already read every panel. <span className="text-[var(--fg-dim)]">What do you want to know?</span>
      </h2>
      <p className="body-md max-w-[58ch] mb-6">
        I have full access to your inspection JSON: every panel&apos;s condition score, every defect, every recommended
        action. Pick a starter or type your own.
      </p>
      <div className="flex flex-wrap gap-2">
        {SUGGESTED_PROMPTS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onPick(p)}
            className="font-sans text-[13.5px] px-3.5 py-2 rounded-full border hairline-strong text-[var(--fg-dim)] hover:text-[var(--fg)] hover:border-[var(--accent)] hover:bg-[var(--surface-2)] transition-all duration-200"
          >
            {p}
          </button>
        ))}
      </div>
    </motion.div>
  );
}

function MessageBubble({ role, content, streaming }: { role: "user" | "assistant"; content: string; streaming?: boolean }) {
  const isUser = role === "user";
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className={cn("flex gap-3 md:gap-4", isUser && "flex-row-reverse")}
    >
      <div
        className={cn(
          "shrink-0 w-9 h-9 rounded-full grid place-items-center mt-0.5 border hairline-strong",
          isUser ? "bg-[var(--accent)] text-[#0a0a0a] border-transparent" : "bg-[var(--surface-2)]"
        )}
      >
        {isUser ? <span className="font-mono text-[11px] tracking-[0.18em]">YOU</span> : <Sparkles size={15} className="text-[var(--accent)]" />}
      </div>
      <div
        className={cn(
          "min-w-0 max-w-[760px] rounded-2xl px-5 py-4",
          isUser
            ? "bg-[var(--surface-2)] border hairline-strong"
            : "bg-transparent border hairline"
        )}
      >
        {content === "" && streaming ? (
          <div className="flex items-center gap-2 text-[var(--fg-mute)]">
            <Loader2 size={14} className="animate-spin" />
            <span className="font-mono text-[12px] tracking-[0.14em] uppercase">Thinking…</span>
          </div>
        ) : (
          <div className="prose-solpop">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
            {streaming && <span className="inline-block w-2 h-4 align-text-bottom bg-[var(--accent)] ml-0.5 animate-pulse" />}
          </div>
        )}
      </div>
    </motion.div>
  );
}

export function ChatHeader({ session, sessionId, panelCount, healthScore }: {
  session?: FullAnalysis;
  sessionId: string;
  panelCount: number;
  healthScore: number;
}) {
  return (
    <div className="flex items-end justify-between flex-wrap gap-4 mb-2">
      <div>
        <div className="tick mb-3 inline-flex items-center gap-2">
          <MessageSquare size={11} /> Inspector chat
        </div>
        <h1 className="h-display text-[44px] md:text-[64px] leading-[1.02]">
          Talk to your <em className="italic text-[var(--accent-2)]">fleet</em>.
        </h1>
        <p className="body-md mt-3 font-mono text-[12px] text-[var(--fg-mute)]">
          session {sessionId.slice(0, 14)} · {panelCount} {panelCount === 1 ? "panel" : "panels"} · health {Math.round(healthScore)}
          {session ? `` : ""}
        </p>
      </div>
    </div>
  );
}
