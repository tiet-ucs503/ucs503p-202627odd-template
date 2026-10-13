"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { TimelineCompare } from "@/components/TimelineCompare";
import { getSession, type SessionRecord } from "@/lib/store";
import type { PanelAnalysis } from "@/lib/schema";

export default function TimelinePage() {
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
      <TimelineInner />
    </Suspense>
  );
}

function TimelineInner() {
  const params = useSearchParams();
  const sessionId = params.get("session");
  const panelId = params.get("panel");
  const [session, setSession] = useState<SessionRecord | null | "missing">(null);

  useEffect(() => {
    if (!sessionId) {
      setSession("missing");
      return;
    }
    (async () => {
      try {
        const rec = await getSession(sessionId);
        setSession(rec ?? "missing");
      } catch {
        setSession("missing");
      }
    })();
  }, [sessionId]);

  const panel: PanelAnalysis | null =
    session && session !== "missing" && panelId
      ? session.data.panels.find((p) => p.panelId === panelId) ?? null
      : null;

  return (
    <>
      <Header />
      <main className="flex-1">
        {session === null && (
          <div className="max-w-[1200px] mx-auto px-6 md:px-10 py-32 body-md">Loading session…</div>
        )}

        {(session === "missing" ||
          (typeof session === "object" && session !== null && !panel)) && (
          <div className="max-w-[900px] mx-auto px-6 md:px-10 py-32 text-center">
            <h1 className="h-display text-[44px] md:text-[80px] mb-4">Panel not found</h1>
            <p className="body-md max-w-md mx-auto mb-8">
              Open a saved session, click into a panel, then re-inspect it from there.
            </p>
            <div className="flex items-center justify-center gap-3">
              <Link href="/sessions" className="btn-ghost">Open history</Link>
              <Link href="/inspect" className="btn-primary">Run an inspection</Link>
            </div>
          </div>
        )}

        {session && session !== "missing" && panel && (
          <section className="relative">
            <div className="max-w-[1200px] mx-auto px-6 md:px-10 pt-12 md:pt-16 pb-20 space-y-10">
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              >
                <Link
                  href={`/sessions/${session.id}`}
                  className="tick mb-3 inline-flex items-center gap-1.5 hover:text-[var(--fg)] transition-colors"
                >
                  <ArrowLeft size={11} /> Back to session
                </Link>
                <h1 className="h-display text-[44px] md:text-[72px] leading-[1.02] mt-2">
                  Has it gotten <em className="italic text-[var(--accent-2)]">worse</em>?
                </h1>
                <p className="body-md mt-3 max-w-[60ch]">
                  Drop a fresh photo of <span className="font-mono text-[12px]">{panel.panelId}</span>. We&apos;ll diff
                  condition, defects, and efficiency loss against the baseline saved on{" "}
                  {new Date(session.createdAt).toLocaleDateString()}.
                </p>
              </motion.div>

              <TimelineCompare
                before={panel}
                beforeImage={
                  panel.imageDataUrl ||
                  session.sourceThumbnails[panel.sourceFileName ?? panel.fileName]
                }
                baselineDate={session.createdAt}
              />
            </div>
          </section>
        )}
      </main>
      <Footer />
    </>
  );
}
