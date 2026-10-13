"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight, Trash2, Clock, Sparkles, AlertTriangle } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { listSessions, deleteSession, type SessionRecord } from "@/lib/store";
import { cn } from "@/lib/utils";

export default function SessionsPage() {
  const [sessions, setSessions] = useState<SessionRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const list = await listSessions();
        setSessions(list);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load sessions");
        setSessions([]);
      }
    })();
  }, []);

  async function onDelete(id: string) {
    if (!confirm("Delete this saved inspection? This cannot be undone.")) return;
    await deleteSession(id);
    setSessions((curr) => (curr ?? []).filter((s) => s.id !== id));
  }

  return (
    <>
      <Header />
      <main className="flex-1">
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 grid-bg opacity-25 pointer-events-none" />
          <div className="absolute -top-32 right-[-10%] w-[520px] h-[520px] rounded-full blur-3xl opacity-50 pointer-events-none"
            style={{ background: "radial-gradient(circle, var(--accent-glow), transparent 60%)" }} />

          <div className="relative max-w-[1400px] mx-auto px-6 md:px-10 pt-20 md:pt-32 pb-12 md:pb-16">
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              className="flex items-center gap-3 mb-10"
            >
              <Clock size={14} className="text-[var(--accent)]" />
              <span className="tick">Saved inspections · stored locally on this browser</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
              className="h-display text-[56px] md:text-[112px] lg:text-[136px]"
            >
              Your <em className="italic text-[var(--accent-2)]">history</em>.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.85, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
              className="mt-8 max-w-[60ch] body-lg"
            >
              Every inspection auto-saves to your browser. Open one to relive the report,
              drill into any panel, or compare against a fresh run later.
            </motion.p>
          </div>
          <div className="divider" />
        </section>

        <section className="relative">
          <div className="max-w-[1400px] mx-auto px-6 md:px-10 py-16 md:py-20">
            {error && (
              <div className="card p-6 border-[rgba(239,35,60,0.4)] mb-8">
                <div className="severity-pill critical mb-2">Error</div>
                <p className="body-md">{error}</p>
              </div>
            )}

            {sessions === null && (
              <div className="body-md">Loading…</div>
            )}

            {sessions && sessions.length === 0 && !error && (
              <div className="card-elev p-10 md:p-14 text-center">
                <Sparkles size={20} className="text-[var(--accent)] mx-auto mb-4" />
                <h2 className="font-serif text-[36px] md:text-[44px] leading-tight mb-3">
                  No inspections yet.
                </h2>
                <p className="body-md max-w-md mx-auto mb-8">
                  Run your first one and it&apos;ll show up here automatically.
                </p>
                <div className="flex items-center justify-center gap-3">
                  <Link href="/inspect" className="btn-primary">Start an inspection</Link>
                  <Link href="/gallery" className="btn-ghost">Open the gallery</Link>
                </div>
              </div>
            )}

            {sessions && sessions.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {sessions.map((s, idx) => (
                  <motion.div
                    key={s.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, delay: Math.min(idx * 0.05, 0.45), ease: [0.16, 1, 0.3, 1] }}
                    className="card-elev card-interactive overflow-hidden flex flex-col group relative"
                  >
                    <Link href={`/sessions/${s.id}`} className="contents">
                      <div className="relative aspect-[16/10] overflow-hidden bg-black">
                        {s.thumbnail ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={s.thumbnail} alt={s.label} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full grid place-items-center text-[var(--fg-mute)] text-sm">
                            no thumbnail
                          </div>
                        )}
                        <div className="absolute inset-0 cell-pattern opacity-15 pointer-events-none" />
                        <div className="absolute top-3 left-3 font-mono text-[10.5px] tracking-[0.18em] uppercase px-2.5 py-1 rounded-full bg-black/55 text-white/90 backdrop-blur">
                          {s.panelCount} {s.panelCount === 1 ? "panel" : "panels"}
                        </div>
                        {s.criticalCount > 0 && (
                          <div className="absolute top-3 right-3 font-mono text-[10.5px] tracking-[0.18em] uppercase px-2.5 py-1 rounded-full bg-[rgba(239,35,60,0.22)] text-[#ffd5d9] backdrop-blur flex items-center gap-1.5">
                            <AlertTriangle size={11} /> {s.criticalCount}
                          </div>
                        )}
                      </div>
                      <div className="p-6 space-y-3 flex-1">
                        <div className="font-mono text-[11px] tracking-[0.16em] text-[var(--fg-mute)]">
                          {new Date(s.createdAt).toLocaleString()}
                        </div>
                        <div className="flex items-baseline justify-between gap-3">
                          <h3 className="font-serif text-[28px] leading-[1.05]">
                            Health{" "}
                            <span style={{ color: scoreColor(s.fleetHealthScore) }}>
                              {Math.round(s.fleetHealthScore)}
                            </span>
                          </h3>
                          <span className="font-mono text-[11px] text-[var(--fg-mute)]">
                            -{s.fleetEfficiencyLossPct.toFixed(1)}%
                          </span>
                        </div>
                        <div className="flex items-center justify-between pt-3 border-t hairline">
                          <span className="tick">Open</span>
                          <ArrowUpRight size={16} className="text-[var(--fg-mute)] group-hover:text-[var(--accent)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-300" />
                        </div>
                      </div>
                    </Link>
                    <button
                      onClick={() => onDelete(s.id)}
                      className={cn(
                        "absolute bottom-5 right-5 w-9 h-9 rounded-full grid place-items-center",
                        "bg-[var(--surface-2)] border hairline-strong text-[var(--fg-mute)]",
                        "hover:text-[var(--sev-critical)] hover:border-[var(--sev-critical)]",
                        "transition-colors duration-200 opacity-0 group-hover:opacity-100"
                      )}
                      aria-label="Delete session"
                    >
                      <Trash2 size={14} />
                    </button>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

function scoreColor(s: number) {
  if (s >= 80) return "var(--sev-low)";
  if (s >= 60) return "var(--sev-medium)";
  if (s >= 35) return "var(--sev-high)";
  return "var(--sev-critical)";
}
