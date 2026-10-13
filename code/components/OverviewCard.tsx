"use client";

import { motion } from "framer-motion";
import { Crosshair } from "lucide-react";
import type { BBox, PanelAnalysis } from "@/lib/schema";
import { PanelDetectOverlay } from "./BBoxOverlay";

export type DetectedBox = {
  index: number;
  bbox: BBox;
  panelId?: string;
  conditionScore?: number;
};

export function OverviewCard({
  fileName,
  previewUrl,
  detected,
  panels,
  onOpen,
}: {
  fileName: string;
  previewUrl?: string;
  detected: DetectedBox[];
  panels: PanelAnalysis[];
  onOpen: (panelId: string) => void;
}) {
  // Enrich detected boxes with conditionScore + panelId from panels (matched by sourceIndex)
  const boxes = detected.map((d) => {
    const match = panels.find(
      (p) => p.sourceFileName === fileName && p.sourceIndex === d.index
    );
    return {
      ...d,
      panelId: match?.panelId ?? d.panelId,
      conditionScore: match?.conditionScore ?? d.conditionScore,
    };
  });

  const completed = boxes.filter((b) => b.panelId).length;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className="card-elev overflow-hidden col-span-full"
    >
      <div className="flex items-center justify-between px-6 md:px-7 py-4 border-b hairline">
        <div className="flex items-center gap-3">
          <Crosshair size={14} className="text-[var(--accent)]" />
          <div className="tick">Multi-panel split</div>
          <span className="font-mono text-[11.5px] text-[var(--fg-dim)] truncate max-w-[40ch]">
            {fileName}
          </span>
        </div>
        <div className="font-mono text-[11.5px] text-[var(--fg-mute)] tracking-[0.12em]">
          {completed} / {boxes.length} ANALYZED
        </div>
      </div>

      <div className="relative w-full bg-black select-none" style={{ aspectRatio: "16 / 9" }}>
        {previewUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt={fileName} className="absolute inset-0 w-full h-full object-cover" />
        )}
        <div className="absolute inset-0 cell-pattern opacity-12 pointer-events-none" />
        <PanelDetectOverlay
          panels={boxes.map((b) => ({ bbox: b.bbox, condition: b.conditionScore }))}
          labels={boxes.map((b, i) =>
            b.panelId ? b.panelId : `PNL ${String(i + 1).padStart(2, "0")}`
          )}
          onClick={(i) => {
            const id = boxes[i]?.panelId;
            if (id) onOpen(id);
          }}
        />
        <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between gap-3 pointer-events-none">
          <div className="font-mono text-[11px] tracking-[0.18em] uppercase text-white/70 px-2.5 py-1 rounded-full bg-black/50 backdrop-blur">
            Click any box to open report
          </div>
          <div className="font-mono text-[11px] text-white/55">
            {boxes.length} panels detected
          </div>
        </div>
      </div>
    </motion.div>
  );
}
