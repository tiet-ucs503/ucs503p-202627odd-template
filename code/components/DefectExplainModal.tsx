"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Severity } from "@/lib/schema";
import { cn } from "@/lib/utils";

const cache = new Map<string, string>();

export function DefectExplainModal({
  open,
  onClose,
  defectType,
  severity,
}: {
  open: boolean;
  onClose: () => void;
  defectType: string | null;
  severity?: Severity;
}) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !defectType) return;
    const key = `${defectType.toLowerCase()}:${severity ?? ""}`;
    if (cache.has(key)) {
      setContent(cache.get(key)!);
      setLoading(false);
      return;
    }
    const ctl = new AbortController();
    setContent("");
    setError(null);
    setLoading(true);
    (async () => {
      try {
        const res = await fetch("/api/explain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ defectType, severity }),
          signal: ctl.signal,
        });
        if (!res.ok || !res.body) throw new Error(`request failed (${res.status})`);
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
                setContent(acc);
              } else if (evt.type === "error") {
                throw new Error(evt.error || "stream error");
              }
            } catch {
              /* noop */
            }
          }
        }
        cache.set(key, acc);
      } catch (e) {
        if ((e as { name?: string })?.name !== "AbortError") {
          setError(e instanceof Error ? e.message : String(e));
        }
      } finally {
        setLoading(false);
      }
    })();
    return () => ctl.abort();
  }, [open, defectType, severity]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && defectType && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[60] frosted no-print"
            onClick={onClose}
          />
          <motion.div
            key="modal"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="fixed left-1/2 top-1/2 z-[60] -translate-x-1/2 -translate-y-1/2 w-[min(720px,92vw)] max-h-[82vh] card-elev overflow-hidden flex flex-col no-print"
            data-lenis-prevent
          >
            <div className="px-6 py-4 border-b hairline flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Sparkles size={15} className="text-[var(--accent)]" />
                <span className="tick">Defect explainer</span>
                <span className="font-serif text-[20px] leading-none">{defectType}</span>
                {severity && <span className={cn("severity-pill", severity)}>{severity}</span>}
              </div>
              <button
                onClick={onClose}
                className="w-9 h-9 rounded-full grid place-items-center border hairline-strong hover:border-[var(--accent)] transition-colors"
                aria-label="Close"
              >
                <X size={15} />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-6 md:p-7">
              {loading && content === "" && (
                <div className="flex items-center gap-2 text-[var(--fg-mute)]">
                  <Loader2 size={14} className="animate-spin" />
                  <span className="font-mono text-[12px] tracking-[0.14em] uppercase">Loading…</span>
                </div>
              )}
              {error && (
                <div className="card p-4 border-[rgba(239,35,60,0.4)]">
                  <div className="severity-pill critical mb-2">Error</div>
                  <p className="body-md text-[14px]">{error}</p>
                </div>
              )}
              {content && (
                <div className="prose-solpop">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
                  {loading && <span className="inline-block w-2 h-4 align-text-bottom bg-[var(--accent)] ml-0.5 animate-pulse" />}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
