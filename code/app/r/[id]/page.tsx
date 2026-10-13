"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ReportDashboard } from "@/components/ReportDashboard";
import { PanelReportSheet } from "@/components/PanelReportSheet";
import { OverviewCard, type DetectedBox } from "@/components/OverviewCard";
import { AnalysisCard } from "@/components/AnalysisCard";
import type { FullAnalysis } from "@/lib/schema";

type Loaded = {
  id: string;
  createdAt: number;
  data: FullAnalysis;
  sourceThumbnails: Record<string, string>;
  label?: string;
};

export default function PublicShareReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [share, setShare] = useState<Loaded | null | "missing">(null);
  const [openPanelId, setOpenPanelId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/share/${id}`, { cache: "no-store" });
        if (!res.ok) {
          setShare("missing");
          return;
        }
        const payload = (await res.json()) as Loaded;
        setShare(payload);
      } catch {
        setShare("missing");
      }
    })();
  }, [id]);

  return (
    <>
      <Header />
      <main className="flex-1">
        {share === null && (
          <div className="max-w-[1400px] mx-auto px-6 md:px-10 py-32 body-md">Loading shared report…</div>
        )}

        {share === "missing" && (
          <div className="max-w-[900px] mx-auto px-6 md:px-10 py-32 text-center">
            <h1 className="h-display text-[44px] md:text-[80px] mb-4">Link expired or invalid</h1>
            <p className="body-md max-w-md mx-auto mb-8">
              This shared report is no longer available. Public links are valid for 30 days.
            </p>
            <div className="flex items-center justify-center gap-3">
              <Link href="/inspect" className="btn-primary">Run your own inspection</Link>
            </div>
          </div>
        )}

        {share && share !== "missing" && (
          <PublicView share={share} openPanelId={openPanelId} setOpenPanelId={setOpenPanelId} />
        )}
      </main>
      <Footer />
    </>
  );
}

function PublicView({
  share,
  openPanelId,
  setOpenPanelId,
}: {
  share: Loaded;
  openPanelId: string | null;
  setOpenPanelId: (id: string | null) => void;
}) {
  const panels = share.data.panels;

  function downloadJson() {
    const blob = new Blob([JSON.stringify(share.data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `solpop-shared-${share.id}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

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
      for (const q of group) items.push({ kind: "panel", sourceName, panel: q, cardIndex: q.sourceIndex ?? 0 });
    } else {
      for (const q of group) items.push({ kind: "panel", sourceName, panel: q, cardIndex: 0 });
    }
  }

  const openPanel = openPanelId ? panels.find((p) => p.panelId === openPanelId) ?? null : null;
  const openPanelPreviewUrl = openPanel
    ? openPanel.imageDataUrl || share.sourceThumbnails[openPanel.sourceFileName ?? openPanel.fileName]
    : undefined;

  return (
    <section className="relative">
      <div className="max-w-[1400px] mx-auto px-6 md:px-10 py-20 md:py-24 space-y-12">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="tick mb-3 inline-flex items-center gap-2">
            shared inspection · read-only
          </div>
          <h1 className="h-display text-[44px] md:text-[72px] leading-[1.02] mt-2">
            Inspection report.
          </h1>
          <p className="body-md mt-3 font-mono text-[12px] text-[var(--fg-mute)]">
            Generated {new Date(share.data.generatedAt).toLocaleString()} · {panels.length}{" "}
            {panels.length === 1 ? "panel" : "panels"}
          </p>
        </motion.div>

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
                    previewUrl={share.sourceThumbnails[item.sourceName]}
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
                    share.sourceThumbnails[item.panel.sourceFileName ?? item.panel.fileName]
                  }
                  index={idx}
                  onOpen={() => setOpenPanelId(item.panel.panelId)}
                />
              );
            })}
          </motion.div>
        )}

        <ReportDashboard
          data={share.data}
          onDownload={downloadJson}
          onOpenPanel={(id) => setOpenPanelId(id)}
        />
      </div>

      <PanelReportSheet
        panel={openPanel}
        previewUrl={openPanelPreviewUrl}
        index={Math.max(0, panels.findIndex((p) => p.panelId === openPanelId))}
        total={panels.length}
        onClose={() => setOpenPanelId(null)}
      />
    </section>
  );
}
