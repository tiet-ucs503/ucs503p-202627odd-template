"use client";

import { motion } from "framer-motion";
import { CheckCircle2, AlertTriangle, Loader2, ArrowUpRight, Crosshair } from "lucide-react";
import type { PanelAnalysis, Severity } from "@/lib/schema";
import { cn } from "@/lib/utils";
import { CountUp } from "./CountUp";
import { BBoxOverlay } from "./BBoxOverlay";

export type Pending = {
  fileName: string;
  status: "queued" | "analyzing" | "done" | "failed";
  error?: string;
};

export function AnalysisCard({
  pending,
  panel,
  previewUrl,
  index,
  onOpen,
}: {
  pending: Pending;
  panel?: PanelAnalysis;
  previewUrl?: string;
  index: number;
  onOpen?: () => void;
}) {
  const interactive = !!panel && pending.status === "done";
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay: Math.min(index * 0.05, 0.45), ease: [0.16, 1, 0.3, 1] }}
      whileHover={interactive ? { y: -4 } : undefined}
      className={cn(
        "card-elev overflow-hidden flex flex-col group",
        interactive && "card-interactive"
      )}
      onClick={interactive ? onOpen : undefined}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : -1}
      onKeyDown={(e) => {
        if (interactive && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onOpen?.();
        }
      }}
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-black">
        {(panel?.imageDataUrl || previewUrl) && (
          <motion.img
            src={panel?.imageDataUrl || previewUrl}
            alt={pending.fileName}
            className="w-full h-full object-cover opacity-95"
            initial={{ scale: 1.04 }}
            animate={{ scale: 1 }}
            whileHover={interactive ? { scale: 1.04 } : undefined}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          />
        )}
        {panel && panel.defects.some((d) => Array.isArray(d.bbox)) && (
          <BBoxOverlay defects={panel.defects} showLabels={false} />
        )}
        <div className="absolute inset-0 cell-pattern opacity-20 pointer-events-none" />
        <div className="absolute top-3 left-3 flex items-center gap-2 flex-wrap">
          <span className="font-mono text-[10.5px] tracking-[0.18em] uppercase text-white/85 px-2.5 py-1 rounded-full bg-black/55 backdrop-blur">
            {panel?.panelId ?? `PNL-${String(index + 1).padStart(3, "0")}`}
          </span>
          {pending.status === "analyzing" && (
            <span className="font-mono text-[10.5px] tracking-[0.18em] uppercase text-white/85 px-2.5 py-1 rounded-full bg-black/55 backdrop-blur flex items-center gap-1.5">
              <Loader2 size={11} className="animate-spin" /> Analyzing
            </span>
          )}
          {pending.status === "done" && (
            <span className="font-mono text-[10.5px] tracking-[0.18em] uppercase px-2.5 py-1 rounded-full text-[#d5ffdf] bg-[rgba(128,237,153,0.18)] backdrop-blur flex items-center gap-1.5">
              <CheckCircle2 size={11} /> Complete
            </span>
          )}
          {panel && panel.sourceBBox && typeof panel.sourceIndex === "number" && (
            <span className="font-mono text-[10.5px] tracking-[0.18em] uppercase px-2.5 py-1 rounded-full text-white/85 bg-black/55 backdrop-blur flex items-center gap-1.5">
              <Crosshair size={10} /> seg #{panel.sourceIndex + 1}
            </span>
          )}
          {pending.status === "failed" && (
            <span className="font-mono text-[10.5px] tracking-[0.18em] uppercase px-2.5 py-1 rounded-full text-[#ffb8c2] bg-[rgba(239,35,60,0.20)] backdrop-blur flex items-center gap-1.5">
              <AlertTriangle size={11} /> Failed
            </span>
          )}
        </div>

        {interactive && (
          <div className="absolute top-3 right-3 w-9 h-9 rounded-full grid place-items-center bg-black/55 backdrop-blur opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <ArrowUpRight size={15} className="text-white" />
          </div>
        )}

        {pending.status === "analyzing" && (
          <div className="absolute inset-x-0 bottom-0 h-1 shimmer" />
        )}
      </div>

      <div className="p-6 space-y-5 flex-1">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="font-mono text-[11.5px] text-[var(--fg-mute)] truncate">{pending.fileName}</div>
            {panel ? (
              <div className="font-serif text-[26px] md:text-[28px] mt-1.5 leading-[1.05]">
                {panel.panelTypeGuess}
                {panel.estimatedCellCount > 0 && (
                  <span className="text-[var(--fg-mute)]"> · {panel.estimatedCellCount} cells</span>
                )}
              </div>
            ) : (
              <div className="font-serif text-[26px] mt-1.5 leading-tight text-[var(--fg-mute)]">Awaiting model…</div>
            )}
          </div>
          {panel && (
            <div className="text-right shrink-0">
              <div className="tick">Condition</div>
              <div className="font-serif text-[48px] leading-none mt-1" style={{ color: scoreColor(panel.conditionScore) }}>
                <CountUp to={Math.round(panel.conditionScore)} />
              </div>
            </div>
          )}
        </div>

        {panel && (
          <>
            <div className="grid grid-cols-3 gap-2.5">
              <Mini label="Clean" value={`${Math.round(panel.cleanlinessScore)}`} />
              <Mini label="Eff. loss" value={`${panel.estimatedTotalEfficiencyLoss.toFixed(1)}%`} />
              <Mini label="Conf." value={`${Math.round(panel.confidence * 100)}%`} />
            </div>

            <div className="bar"><span style={{ width: `${100 - panel.estimatedTotalEfficiencyLoss}%` }} /></div>

            <p className="text-[15px] text-[var(--fg-dim)] leading-[1.55] line-clamp-3">
              {panel.observations}
            </p>

            {panel.defects.length > 0 ? (
              <div className="space-y-2.5">
                <div className="tick">Defects · {panel.defects.length}</div>
                <div className="flex flex-wrap gap-2">
                  {panel.defects.slice(0, 5).map((d, i) => (
                    <span key={i} className={cn("severity-pill", d.severity)}>
                      <span className="lowercase normal-case tracking-normal font-sans text-[11.5px]">{d.type}</span>
                      <span className="opacity-60">·</span>
                      <span>{d.estimatedEfficiencyLoss.toFixed(1)}%</span>
                    </span>
                  ))}
                  {panel.defects.length > 5 && (
                    <span className="severity-pill medium">+{panel.defects.length - 5}</span>
                  )}
                </div>
              </div>
            ) : (
              <div className="severity-pill low">No defects detected</div>
            )}

            <div className="flex items-center justify-between pt-3 border-t hairline">
              <span className="tick">Open full report</span>
              <ArrowUpRight size={16} className="text-[var(--fg-mute)] group-hover:text-[var(--accent)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-300" />
            </div>
          </>
        )}

        {pending.status === "failed" && (
          <p className="text-[14px] text-[#ffb8c2]">{pending.error ?? "Analysis failed."}</p>
        )}
      </div>
    </motion.div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="card py-3 px-3 text-center">
      <div className="tick">{label}</div>
      <div className="font-serif text-[24px] mt-1 leading-none">{value}</div>
    </div>
  );
}

function scoreColor(s: number) {
  if (s >= 80) return "var(--sev-low)";
  if (s >= 60) return "var(--sev-medium)";
  if (s >= 35) return "var(--sev-high)";
  return "var(--sev-critical)";
}

export function severityBg(s: Severity) {
  return {
    low: "rgba(128,237,153,0.12)",
    medium: "rgba(255,195,0,0.12)",
    high: "rgba(255,91,0,0.14)",
    critical: "rgba(239,35,60,0.14)",
  }[s];
}
