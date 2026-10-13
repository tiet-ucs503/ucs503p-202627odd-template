"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Plus, ArrowRight, ArrowLeft } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { CompareView } from "@/components/CompareView";
import { PanelPicker, type PickedPanel } from "@/components/PanelPicker";
import { getSession } from "@/lib/store";

export default function ComparePage() {
  return (
    <Suspense
      fallback={
        <>
          <Header />
          <main className="flex-1">
            <div className="max-w-[1200px] mx-auto px-6 md:px-10 py-32 body-md">Loading…</div>
          </main>
          <Footer />
        </>
      }
    >
      <CompareInner />
    </Suspense>
  );
}

function CompareInner() {
  const router = useRouter();
  const params = useSearchParams();

  const [a, setA] = useState<PickedPanel | null>(null);
  const [b, setB] = useState<PickedPanel | null>(null);
  const [pickerSlot, setPickerSlot] = useState<"A" | "B" | null>(null);

  // Hydrate from URL: ?a=session:panelId&b=session:panelId
  useEffect(() => {
    const aRaw = params.get("a");
    const bRaw = params.get("b");
    (async () => {
      if (aRaw && !a) {
        const picked = await pickedFromKey(aRaw);
        if (picked) setA(picked);
      }
      if (bRaw && !b) {
        const picked = await pickedFromKey(bRaw);
        if (picked) setB(picked);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  function syncUrl(next: { a?: PickedPanel | null; b?: PickedPanel | null }) {
    const aV = next.a !== undefined ? next.a : a;
    const bV = next.b !== undefined ? next.b : b;
    const usp = new URLSearchParams();
    if (aV) usp.set("a", `${aV.sessionId}:${aV.panel.panelId}`);
    if (bV) usp.set("b", `${bV.sessionId}:${bV.panel.panelId}`);
    const q = usp.toString();
    router.replace(q ? `/compare?${q}` : "/compare");
  }

  function pickInto(slot: "A" | "B", picked: PickedPanel) {
    if (slot === "A") {
      setA(picked);
      syncUrl({ a: picked });
    } else {
      setB(picked);
      syncUrl({ b: picked });
    }
    setPickerSlot(null);
  }

  function clearSlot(slot: "A" | "B") {
    if (slot === "A") {
      setA(null);
      syncUrl({ a: null });
    } else {
      setB(null);
      syncUrl({ b: null });
    }
  }

  const excludeKeys = [a, b]
    .filter((x): x is PickedPanel => x != null)
    .map((p) => `${p.sessionId}:${p.panel.panelId}`);

  return (
    <>
      <Header />
      <main className="flex-1">
        <section className="relative">
          <div className="max-w-[1200px] mx-auto px-6 md:px-10 pt-12 md:pt-16 pb-20 space-y-10">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            >
              <Link
                href="/sessions"
                className="tick mb-3 inline-flex items-center gap-1.5 hover:text-[var(--fg)] transition-colors"
              >
                <ArrowLeft size={11} /> Sessions
              </Link>
              <h1 className="h-display text-[44px] md:text-[80px] leading-[1.02] mt-2">
                Pick two. <em className="italic text-[var(--accent-2)]">Compare.</em>
              </h1>
              <p className="body-md mt-3 max-w-[60ch]">
                Any two panels from any saved inspection. Same session, different sessions, doesn&apos;t matter.
                We&apos;ll surface what&apos;s shared, what&apos;s unique, and what changed.
              </p>
            </motion.div>

            {!(a && b) && (
              <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-stretch">
                <SlotCard slot="A" pick={a} onPick={() => setPickerSlot("A")} onClear={() => clearSlot("A")} />
                <div className="hidden md:flex items-center justify-center text-[var(--fg-mute)]">
                  <ArrowRight size={20} />
                </div>
                <SlotCard slot="B" pick={b} onPick={() => setPickerSlot("B")} onClear={() => clearSlot("B")} />
              </div>
            )}

            {a && b && (
              <>
                <div className="flex items-center gap-3 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setPickerSlot("A")}
                    className="btn-ghost text-sm inline-flex items-center gap-2"
                  >
                    Replace A
                  </button>
                  <button
                    type="button"
                    onClick={() => setPickerSlot("B")}
                    className="btn-ghost text-sm inline-flex items-center gap-2"
                  >
                    Replace B
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setA(null);
                      setB(null);
                      router.replace("/compare");
                    }}
                    className="btn-ghost text-sm inline-flex items-center gap-2"
                  >
                    Reset
                  </button>
                </div>
                <CompareView a={a} b={b} />
              </>
            )}
          </div>
        </section>
      </main>
      <Footer />

      <PanelPicker
        open={pickerSlot !== null}
        onClose={() => setPickerSlot(null)}
        excludeKeys={excludeKeys}
        onPick={(picked) => {
          if (pickerSlot) pickInto(pickerSlot, picked);
        }}
      />
    </>
  );
}

function SlotCard({
  slot,
  pick,
  onPick,
  onClear,
}: {
  slot: "A" | "B";
  pick: PickedPanel | null;
  onPick: () => void;
  onClear: () => void;
}) {
  if (!pick) {
    return (
      <button
        type="button"
        onClick={onPick}
        className="card-elev card-interactive aspect-[16/10] md:aspect-auto md:min-h-[260px] flex flex-col items-center justify-center text-center p-8"
      >
        <div
          className="w-12 h-12 rounded-full grid place-items-center mb-4"
          style={{ background: "var(--surface-2)", border: "1px solid var(--line-strong)" }}
        >
          <Plus size={20} className="text-[var(--accent)]" />
        </div>
        <div className="tick mb-2">SLOT {slot}</div>
        <div className="font-serif text-[24px] md:text-[28px] leading-tight">
          Pick a panel
        </div>
        <p className="body-md mt-2 max-w-xs">
          Any panel from any saved inspection.
        </p>
      </button>
    );
  }

  return (
    <div className="card-elev overflow-hidden flex flex-col">
      <div className="relative aspect-[16/10] bg-black overflow-hidden">
        {pick.thumbnail && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={pick.thumbnail} alt={pick.panel.panelId} className="w-full h-full object-cover" />
        )}
        <div className="absolute inset-0 cell-pattern opacity-15 pointer-events-none" />
        <div className="absolute top-3 left-3 flex items-center gap-2">
          <span className="font-mono text-[11px] tracking-[0.18em] uppercase text-[#0a0a0a] px-2.5 py-1 rounded-full bg-[var(--accent)] backdrop-blur font-bold">
            {slot}
          </span>
          <span className="font-mono text-[10.5px] tracking-[0.18em] uppercase text-white/85 px-2.5 py-1 rounded-full bg-black/55 backdrop-blur">
            {pick.panel.panelId}
          </span>
        </div>
      </div>
      <div className="p-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="font-serif text-[18px] leading-tight truncate">{pick.panel.panelTypeGuess}</div>
          <div className="font-mono text-[11px] text-[var(--fg-mute)] mt-0.5 truncate">
            {new Date(pick.sessionDate).toLocaleDateString()} · cond {Math.round(pick.panel.conditionScore)}
          </div>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="font-mono text-[11px] tracking-[0.14em] uppercase px-3 py-1.5 rounded-full border hairline-strong hover:border-[var(--sev-critical)] hover:text-[var(--sev-critical)] transition-colors"
        >
          Clear
        </button>
      </div>
    </div>
  );
}

async function pickedFromKey(raw: string): Promise<PickedPanel | null> {
  const idx = raw.indexOf(":");
  if (idx < 0) return null;
  const sessionId = raw.slice(0, idx);
  const panelId = raw.slice(idx + 1);
  try {
    const s = await getSession(sessionId);
    if (!s) return null;
    const panel = s.data.panels.find((p) => p.panelId === panelId);
    if (!panel) return null;
    const thumb =
      panel.imageDataUrl ||
      s.sourceThumbnails[panel.sourceFileName ?? panel.fileName] ||
      s.thumbnail ||
      "";
    return {
      sessionId: s.id,
      sessionLabel: s.label,
      sessionDate: s.createdAt,
      panel,
      thumbnail: thumb,
    };
  } catch {
    return null;
  }
}
