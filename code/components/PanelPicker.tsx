"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, Crosshair } from "lucide-react";
import type { PanelAnalysis } from "@/lib/schema";
import { listSessions, type SessionRecord } from "@/lib/store";
import { cn } from "@/lib/utils";

export type PickedPanel = {
  sessionId: string;
  sessionLabel: string;
  sessionDate: number;
  panel: PanelAnalysis;
  thumbnail: string; // data URL
};

export function PanelPicker({
  open,
  onClose,
  onPick,
  excludeKeys = [],
}: {
  open: boolean;
  onClose: () => void;
  onPick: (picked: PickedPanel) => void;
  excludeKeys?: string[]; // "sessionId:panelId" already chosen in another slot
}) {
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const list = await listSessions();
        setSessions(list);
      } catch (e) {
        console.error("listSessions failed", e);
      }
    })();
  }, [open]);

  const items: PickedPanel[] = useMemo(() => {
    const out: PickedPanel[] = [];
    for (const s of sessions) {
      for (const p of s.data.panels) {
        out.push({
          sessionId: s.id,
          sessionLabel: s.label,
          sessionDate: s.createdAt,
          panel: p,
          thumbnail:
            p.imageDataUrl ||
            s.sourceThumbnails[p.sourceFileName ?? p.fileName] ||
            s.thumbnail ||
            "",
        });
      }
    }
    return out;
  }, [sessions]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const excluded = new Set(excludeKeys);
    return items
      .filter((it) => !excluded.has(`${it.sessionId}:${it.panel.panelId}`))
      .filter((it) => {
        if (!q) return true;
        const blob = `${it.panel.panelId} ${it.panel.fileName} ${it.panel.panelTypeGuess} ${it.panel.observations} ${it.panel.defects.map((d) => d.type).join(" ")}`.toLowerCase();
        return blob.includes(q);
      })
      .sort((a, b) => b.sessionDate - a.sessionDate);
  }, [items, query, excludeKeys]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-50 frosted no-print"
            onClick={onClose}
          />
          <motion.div
            key="modal"
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[min(960px,92vw)] max-h-[82vh] card-elev overflow-hidden flex flex-col no-print"
          >
            <div className="px-6 py-4 border-b hairline flex items-center gap-3">
              <Search size={16} className="text-[var(--fg-mute)]" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search panels by ID, type, defect…"
                className="flex-1 bg-transparent outline-none text-[15.5px] placeholder-[var(--fg-mute)]"
              />
              <button
                onClick={onClose}
                className="w-9 h-9 rounded-full grid place-items-center border hairline-strong hover:border-[var(--accent)] transition-colors"
                aria-label="Close"
              >
                <X size={15} />
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-4">
              {filtered.length === 0 && (
                <div className="text-center py-16 body-md">
                  {items.length === 0 ? "No saved panels yet — run an inspection first." : "No matches."}
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filtered.map((it) => (
                  <button
                    key={`${it.sessionId}:${it.panel.panelId}`}
                    type="button"
                    onClick={() => onPick(it)}
                    className={cn(
                      "card overflow-hidden text-left flex flex-col group",
                      "hover:border-[var(--accent)] hover:bg-[var(--surface-2)] transition-colors duration-200"
                    )}
                  >
                    <div className="relative aspect-[16/10] bg-black overflow-hidden">
                      {it.thumbnail ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={it.thumbnail} alt={it.panel.panelId} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full grid place-items-center text-[var(--fg-mute)] text-sm">no image</div>
                      )}
                      <div className="absolute top-2 left-2 flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-[10px] tracking-[0.16em] uppercase text-white/85 px-2 py-0.5 rounded-full bg-black/55 backdrop-blur">
                          {it.panel.panelId}
                        </span>
                        {it.panel.defects.some((d) => Array.isArray(d.bbox)) && (
                          <span className="px-2 py-0.5 rounded-full bg-black/55 backdrop-blur flex items-center gap-1 text-white/85 font-mono text-[10px]">
                            <Crosshair size={10} className="text-[var(--accent-2)]" /> grounded
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="px-3 py-2.5">
                      <div className="font-serif text-[16px] leading-tight truncate">
                        {it.panel.panelTypeGuess}
                        <span className="text-[var(--fg-mute)] text-[12px] ml-1.5">
                          · cond {Math.round(it.panel.conditionScore)}
                        </span>
                      </div>
                      <div className="font-mono text-[10.5px] text-[var(--fg-mute)] mt-0.5 truncate">
                        {new Date(it.sessionDate).toLocaleDateString()} · {it.panel.defects.length} defects
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="px-6 py-3 border-t hairline flex items-center justify-between">
              <div className="font-mono text-[11px] text-[var(--fg-mute)]">
                {filtered.length} match{filtered.length === 1 ? "" : "es"}
              </div>
              <div className="font-mono text-[11px] text-[var(--fg-mute)]">esc to close</div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
