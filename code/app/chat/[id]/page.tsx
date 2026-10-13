"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, FileSearch } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ChatPanel } from "@/components/ChatPanel";
import { getSession, type SessionRecord } from "@/lib/store";

export default function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [session, setSession] = useState<SessionRecord | null | "missing">(null);

  useEffect(() => {
    (async () => {
      try {
        const rec = await getSession(id);
        setSession(rec ?? "missing");
      } catch {
        setSession("missing");
      }
    })();
  }, [id]);

  return (
    <>
      <Header />
      <main className="flex-1">
        {session === null && (
          <div className="max-w-[1100px] mx-auto px-6 md:px-10 py-32 body-md">Loading session…</div>
        )}

        {session === "missing" && (
          <div className="max-w-[900px] mx-auto px-6 md:px-10 py-32 text-center">
            <h1 className="h-display text-[44px] md:text-[80px] mb-4">Session not found</h1>
            <p className="body-md max-w-md mx-auto mb-8">
              This chat is scoped to a specific saved inspection. The session it&apos;s pointing at is
              not in your local history.
            </p>
            <div className="flex items-center justify-center gap-3">
              <Link href="/sessions" className="btn-ghost">Open history</Link>
              <Link href="/inspect" className="btn-primary">Run an inspection</Link>
            </div>
          </div>
        )}

        {session && session !== "missing" && (
          <section className="relative">
            <div className="max-w-[1100px] mx-auto px-6 md:px-10 pt-12 md:pt-16 pb-10 flex flex-col h-[calc(100vh-72px)]">
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                className="flex items-end justify-between flex-wrap gap-4 mb-2 shrink-0"
              >
                <div>
                  <Link
                    href={`/sessions/${session.id}`}
                    className="tick mb-3 inline-flex items-center gap-1.5 hover:text-[var(--fg)] transition-colors"
                  >
                    <ArrowLeft size={11} /> Back to session
                  </Link>
                  <h1 className="h-display text-[40px] md:text-[60px] leading-[1.02] mt-1">
                    Talk to your <em className="italic text-[var(--accent-2)]">fleet</em>.
                  </h1>
                  <p className="body-md mt-2 font-mono text-[12px] text-[var(--fg-mute)]">
                    {session.panelCount} {session.panelCount === 1 ? "panel" : "panels"} · health {Math.round(session.fleetHealthScore)} · saved {new Date(session.createdAt).toLocaleString()}
                  </p>
                </div>
                <Link
                  href={`/sessions/${session.id}`}
                  className="btn-ghost text-sm inline-flex items-center gap-2"
                >
                  <FileSearch size={14} />
                  Open report
                </Link>
              </motion.div>

              <ChatPanel session={session.data} />
            </div>
          </section>
        )}
      </main>
      <Footer />
    </>
  );
}
