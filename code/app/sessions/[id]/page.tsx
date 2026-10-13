"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, FileDown, Loader2, MessageSquare, Share2, Trash2, Wand2 } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ReportDashboard } from "@/components/ReportDashboard";
import { PanelReportSheet } from "@/components/PanelReportSheet";
import { OverviewCard, type DetectedBox } from "@/components/OverviewCard";
import { AnalysisCard } from "@/components/AnalysisCard";
import { ResynthControls } from "@/components/ResynthControls";
import { getSession, deleteSession, type SessionRecord } from "@/lib/store";
import { useRouter } from "next/navigation";

export default function SessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [session, setSession] = useState<SessionRecord | null | "missing">(null);
  const [openPanelId, setOpenPanelId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const rec = await getSession(id);
        setSession(rec ?? "missing");
      } catch (e) {
        console.error("getSession failed", e);
        setSession("missing");
      }
    })();
  }, [id]);

  async function onDelete() {
    if (!session || session === "missing") return;
    if (!confirm("Delete this saved inspection? This cannot be undone.")) return;
    await deleteSession(session.id);
    router.push("/sessions");
  }

  return (
    <>
      <Header />
      <main className="flex-1">
        {session === null && (
          <div className="max-w-[1400px] mx-auto px-6 md:px-10 py-32 body-md">Loading…</div>
        )}

        {session === "missing" && (
          <div className="max-w-[1400px] mx-auto px-6 md:px-10 py-32 text-center">
            <h1 className="h-display text-[44px] md:text-[80px] mb-4">Session not found</h1>
            <p className="body-md max-w-md mx-auto mb-8">
              This inspection isn&apos;t in your local history. It may have been deleted, or saved on a
              different browser.
            </p>
            <div className="flex items-center justify-center gap-3">
              <Link href="/sessions" className="btn-ghost">Back to history</Link>
              <Link href="/inspect" className="btn-primary">Run a new one</Link>
            </div>
          </div>
        )}

        {session && session !== "missing" && (
          <SessionView
            session={session}
            openPanelId={openPanelId}
            setOpenPanelId={setOpenPanelId}
            onDelete={onDelete}
            onUpdated={(next) => setSession(next)}
          />
        )}
      </main>
      <Footer />
    </>
  );
}

function SessionView({
  session,
  openPanelId,
  setOpenPanelId,
  onDelete,
  onUpdated,
}: {
  session: SessionRecord;
  openPanelId: string | null;
  setOpenPanelId: (id: string | null) => void;
  onDelete: () => void;
  onUpdated: (next: SessionRecord) => void;
}) {
  const { data, sourceThumbnails } = session;
  const panels = data.panels;
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  async function makeShare() {
    setShareError(null);
    setShareLoading(true);
    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: session.data,
          sourceThumbnails: session.sourceThumbnails,
          label: session.label,
        }),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(t || `Request failed (${res.status})`);
      }
      const j = (await res.json()) as { id: string; url: string };
      const full = `${window.location.origin}${j.url}`;
      setShareUrl(full);
      try {
        await navigator.clipboard?.writeText(full);
      } catch {
        /* noop */
      }
    } catch (e) {
      setShareError(e instanceof Error ? e.message : String(e));
    } finally {
      setShareLoading(false);
    }
  }

  async function downloadPdf() {
    setPdfError(null);
    setPdfLoading(true);
    try {
      const res = await fetch("/api/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: session.data,
          sessionId: session.id,
          sourceThumbnails: session.sourceThumbnails,
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `PDF request failed (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `solpop-${session.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setPdfError(e instanceof Error ? e.message : "PDF download failed");
    } finally {
      setPdfLoading(false);
    }
  }

  // Group panels by sourceFileName so multi-panel sources can render an overview card
  type Item =
    | { kind: "overview"; sourceName: string; boxes: DetectedBox[] }
    | { kind: "panel"; sourceName: string; panel: typeof panels[number]; cardIndex: number };

  const items: Item[] = [];
  const seen = new Set<string>();
  for (const p of panels) {
    const sourceName = p.sourceFileName ?? p.fileName;
    if (seen.has(sourceName)) continue;
    seen.add(sourceName);
    const group = panels.filter((q) => (q.sourceFileName ?? q.fileName) === sourceName);
    const isMulti = group.some((q) => q.sourceBBox);
    if (isMulti) {
      const boxes: DetectedBox[] = group
        .filter((q) => q.sourceBBox)
        .map((q) => ({
          index: q.sourceIndex ?? 0,
          bbox: q.sourceBBox!,
          panelId: q.panelId,
          conditionScore: q.conditionScore,
        }))
        .sort((a, b) => a.index - b.index);
      items.push({ kind: "overview", sourceName, boxes });
      for (const q of group) {
        items.push({ kind: "panel", sourceName, panel: q, cardIndex: q.sourceIndex ?? 0 });
      }
    } else {
      for (const q of group) {
        items.push({ kind: "panel", sourceName, panel: q, cardIndex: 0 });
      }
    }
  }

  function downloadJson() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `solpop-session-${session.id}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const openPanel = openPanelId ? panels.find((p) => p.panelId === openPanelId) ?? null : null;
  const openPanelPreviewUrl = openPanel
    ? openPanel.imageDataUrl || sourceThumbnails[openPanel.sourceFileName ?? openPanel.fileName]
    : undefined;

  return (
    <section className="relative">
      <div className="max-w-[1400px] mx-auto px-6 md:px-10 py-20 md:py-24 space-y-12">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <Link
              href="/sessions"
              className="tick mb-3 inline-flex items-center gap-1.5 hover:text-[var(--fg)] transition-colors"
            >
              <ArrowLeft size={11} /> All sessions
            </Link>
            <h1 className="h-display text-[44px] md:text-[72px] mt-2">Saved inspection.</h1>
            <p className="body-md mt-3 font-mono text-[12px] text-[var(--fg-mute)]">
              {new Date(session.createdAt).toLocaleString()} · {session.panelCount}{" "}
              {session.panelCount === 1 ? "panel" : "panels"}
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <Link
              href={`/chat/${session.id}`}
              className="btn-primary inline-flex items-center gap-2"
            >
              <MessageSquare size={14} />
              Chat with report
            </Link>
            <Link
              href={`/simulator/${session.id}`}
              className="btn-ghost inline-flex items-center gap-2 text-sm"
            >
              <Wand2 size={14} className="text-[var(--accent)]" />
              What-if simulator
            </Link>
            <button
              onClick={downloadPdf}
              disabled={pdfLoading}
              className="btn-ghost inline-flex items-center gap-2 text-sm"
            >
              {pdfLoading ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
              {pdfLoading ? "Building PDF…" : "Download PDF"}
            </button>
            <button
              onClick={makeShare}
              disabled={shareLoading}
              className="btn-ghost inline-flex items-center gap-2 text-sm"
            >
              {shareLoading ? <Loader2 size={14} className="animate-spin" /> : <Share2 size={14} />}
              {shareUrl ? "Link copied" : "Share link"}
            </button>
            <button
              onClick={onDelete}
              className="btn-ghost text-sm inline-flex items-center gap-2 hover:!border-[var(--sev-critical)] hover:!text-[var(--sev-critical)]"
            >
              <Trash2 size={14} />
              Delete
            </button>
          </div>
        </div>

        {pdfError && (
          <div className="card p-4 border-[rgba(239,35,60,0.4)]">
            <div className="severity-pill critical mb-2">PDF error</div>
            <p className="body-md text-[14px]">{pdfError}</p>
          </div>
        )}

        {shareUrl && (
          <div className="card-elev p-4 flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="tick mb-1">Public read-only link · 30-day TTL</div>
              <a
                href={shareUrl}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-[13px] text-[var(--accent)] underline underline-offset-2 break-all"
              >
                {shareUrl}
              </a>
            </div>
            <span className="font-mono text-[11px] text-[var(--fg-mute)]">
              copied to clipboard
            </span>
          </div>
        )}

        {shareError && (
          <div className="card p-4 border-[rgba(239,35,60,0.4)]">
            <div className="severity-pill critical mb-2">Share error</div>
            <p className="body-md text-[14px]">{shareError}</p>
          </div>
        )}

        {items.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
          >
            {items.map((item, idx) => {
              if (item.kind === "overview") {
                return (
                  <OverviewCard
                    key={`ov-${item.sourceName}`}
                    fileName={item.sourceName}
                    previewUrl={sourceThumbnails[item.sourceName]}
                    detected={item.boxes}
                    panels={panels}
                    onOpen={(id) => setOpenPanelId(id)}
                  />
                );
              }
              return (
                <AnalysisCard
                  key={`p-${item.panel.panelId}`}
                  pending={{ fileName: item.panel.fileName, status: "done" }}
                  panel={item.panel}
                  previewUrl={
                    item.panel.imageDataUrl ||
                    sourceThumbnails[item.panel.sourceFileName ?? item.panel.fileName]
                  }
                  index={idx}
                  onOpen={() => setOpenPanelId(item.panel.panelId)}
                />
              );
            })}
          </motion.div>
        )}

        <ResynthControls session={session} onUpdated={onUpdated} />

        <ReportDashboard
          data={data}
          onDownload={downloadJson}
          onOpenPanel={(id) => setOpenPanelId(id)}
        />
      </div>

      <PanelReportSheet
        panel={openPanel}
        previewUrl={openPanelPreviewUrl}
        index={Math.max(0, panels.findIndex((p) => p.panelId === openPanelId))}
        total={panels.length}
        sessionId={session.id}
        onClose={() => setOpenPanelId(null)}
      />
    </section>
  );
}
