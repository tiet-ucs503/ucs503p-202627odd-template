"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, ArrowRight, Plus, Minus, RefreshCw, Sparkles } from "lucide-react";
import type { Defect, PanelAnalysis, Severity } from "@/lib/schema";
import { diffPanels } from "@/lib/timeline";
import type { PickedPanel } from "./PanelPicker";
import { BBoxOverlay } from "./BBoxOverlay";
import { CountUp } from "./CountUp";
import { cn } from "@/lib/utils";

export function CompareView({ a, b }: { a: PickedPanel; b: PickedPanel }) {
  const diff = useMemo(() => diffPanels(a.panel, b.panel), [a, b]);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <PanelCard side="A" pick={a} />
        <PanelCard side="B" pick={b} />
      </div>

      <DeltaStrip a={a.panel} b={b.panel} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <DefectColumn
          title="Only in A"
          icon={Minus}
          accent="var(--sev-low)"
          items={diff.healedDefects}
          subtag={a.panel.panelId}
          empty="A has no unique defects."
        />
        <DefectColumn
          title="Only in B"
          icon={Plus}
          accent="var(--sev-critical)"
          items={diff.newDefects}
          subtag={b.panel.panelId}
          empty="B has no unique defects."
        />
        <DefectColumn
          title="In both"
          icon={RefreshCw}
          accent="var(--sev-medium)"
          items={diff.persistentDefects.map((m) => m.after)}
          extras={diff.persistentDefects.map((m) =>
            m.lossDeltaPct === 0
              ? "no change"
              : `${m.lossDeltaPct > 0 ? "+" : ""}${m.lossDeltaPct.toFixed(1)}% (A→B)${m.severityChanged ? ` · ${m.before.severity}→${m.after.severity}` : ""}`
          )}
          empty="No shared defects."
        />
      </div>
    </div>
  );
}

function PanelCard({ side, pick }: { side: "A" | "B"; pick: PickedPanel }) {
  const { panel, thumbnail } = pick;
  const condColor = scoreColor(panel.conditionScore);
  const grounded = panel.defects.some((d) => Array.isArray(d.bbox));
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="card-elev overflow-hidden"
    >
      <div className="relative aspect-[16/10] bg-black overflow-hidden">
        {thumbnail && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumbnail} alt={panel.panelId} className="w-full h-full object-cover" />
        )}
        {grounded && <BBoxOverlay defects={panel.defects} showLabels={false} />}
        <div className="absolute inset-0 cell-pattern opacity-15 pointer-events-none" />
        <div className="absolute top-3 left-3 flex items-center gap-2">
          <span className="font-mono text-[11px] tracking-[0.18em] uppercase text-white/90 px-2.5 py-1 rounded-full bg-[var(--accent)] text-[#0a0a0a] backdrop-blur font-bold">
            {side}
          </span>
          <span className="font-mono text-[10.5px] tracking-[0.18em] uppercase text-white/85 px-2.5 py-1 rounded-full bg-black/55 backdrop-blur">
            {panel.panelId}
          </span>
        </div>
        <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between">
          <div className="min-w-0">
            <div className="font-mono text-[10.5px] tracking-[0.16em] text-white/65 truncate">
              {new Date(pick.sessionDate).toLocaleDateString()} · {panel.fileName}
            </div>
            <div className="font-serif text-white text-[22px] leading-tight">{panel.panelTypeGuess}</div>
          </div>
          <div className="text-right shrink-0">
            <div className="tick text-white/55">Cond.</div>
            <div className="font-serif text-[34px] leading-none" style={{ color: condColor }}>
              {Math.round(panel.conditionScore)}
            </div>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <Mini label="Clean" value={`${Math.round(panel.cleanlinessScore)}`} />
          <Mini label="Loss" value={`${panel.estimatedTotalEfficiencyLoss.toFixed(1)}%`} />
          <Mini label="Defects" value={`${panel.defects.length}`} />
        </div>
        <p className="body-md text-[14px] line-clamp-3">{panel.observations}</p>
      </div>
    </motion.div>
  );
}

function DeltaStrip({ a, b }: { a: PanelAnalysis; b: PanelAnalysis }) {
  const stats = [
    {
      label: "Condition",
      from: a.conditionScore,
      to: b.conditionScore,
      decimals: 0,
      reverseGood: false,
    },
    {
      label: "Eff. loss",
      from: a.estimatedTotalEfficiencyLoss,
      to: b.estimatedTotalEfficiencyLoss,
      decimals: 1,
      suffix: "%",
      reverseGood: true,
    },
    {
      label: "Cleanliness",
      from: a.cleanlinessScore,
      to: b.cleanlinessScore,
      decimals: 0,
      reverseGood: false,
    },
    {
      label: "Defects",
      from: a.defects.length,
      to: b.defects.length,
      decimals: 0,
      reverseGood: true,
    },
  ];
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="grid grid-cols-2 lg:grid-cols-4 gap-3"
    >
      {stats.map((s) => (
        <DeltaStat key={s.label} {...s} />
      ))}
    </motion.div>
  );
}

function DeltaStat({
  label,
  from,
  to,
  decimals,
  suffix = "",
  reverseGood = false,
}: {
  label: string;
  from: number;
  to: number;
  decimals: number;
  suffix?: string;
  reverseGood?: boolean;
}) {
  const delta = to - from;
  const isImprovement = reverseGood ? delta < 0 : delta > 0;
  const isWorse = reverseGood ? delta > 0 : delta < 0;
  const color = isImprovement ? "var(--sev-low)" : isWorse ? "var(--sev-critical)" : "var(--fg)";
  const Arrow = reverseGood ? (delta < 0 ? ArrowDownRight : ArrowUpRight) : delta > 0 ? ArrowUpRight : ArrowDownRight;
  const showDelta = Math.abs(delta) >= (decimals === 0 ? 1 : 0.05);
  return (
    <div className="card p-4">
      <div className="tick">{label}</div>
      <div className="flex items-baseline justify-between mt-1.5 gap-2">
        <div className="font-mono text-[15px] text-[var(--fg-mute)]">
          A {from.toFixed(decimals)}{suffix}
        </div>
        <ArrowRight size={12} className="text-[var(--fg-mute)]" />
        <div className="font-serif text-[26px] md:text-[30px] leading-none">
          <CountUp to={to} decimals={decimals} />
          <span className="text-[var(--fg-mute)] text-[12px] ml-0.5">{suffix}</span>
        </div>
      </div>
      {showDelta && (
        <div className="font-mono text-[11px] flex items-center gap-1 mt-1.5" style={{ color }}>
          <Arrow size={11} />
          {Math.abs(delta).toFixed(decimals)}
          {suffix.trim() ? suffix : ""}
        </div>
      )}
    </div>
  );
}

function DefectColumn({
  title,
  icon: Icon,
  accent,
  items,
  extras,
  subtag,
  empty,
}: {
  title: string;
  icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;
  accent: string;
  items: Defect[];
  extras?: string[];
  subtag?: string;
  empty: string;
}) {
  return (
    <div className="card-elev p-5 md:p-6">
      <div className="flex items-center gap-2 mb-4">
        <Icon size={14} style={{ color: accent }} />
        <span className="tick" style={{ color: accent }}>{title}</span>
        {subtag && (
          <span className="font-mono text-[10.5px] tracking-[0.14em] text-[var(--fg-mute)]">
            {subtag}
          </span>
        )}
        <span className="font-mono text-[11px] text-[var(--fg-mute)] ml-auto">{items.length}</span>
      </div>
      {items.length === 0 && (
        <p className="body-md text-[13.5px] text-[var(--fg-mute)]">{empty}</p>
      )}
      {items.map((d, i) => (
        <div
          key={i}
          className="flex items-start gap-3 py-3 border-t hairline first:border-t-0 first:pt-0"
        >
          <span className={cn("severity-pill mt-0.5 shrink-0", d.severity)}>{d.severity}</span>
          <div className="min-w-0 flex-1">
            <div className="font-serif text-[18px] leading-tight">{d.type}</div>
            <div className="font-mono text-[11.5px] text-[var(--fg-mute)] mt-0.5">
              {extras && extras[i]
                ? extras[i]
                : `${d.estimatedEfficiencyLoss.toFixed(1)}% · ${d.location}`}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="card py-2.5 px-3 text-center">
      <div className="tick">{label}</div>
      <div className="font-serif text-[20px] mt-1 leading-none">{value}</div>
    </div>
  );
}

function scoreColor(s: number) {
  if (s >= 80) return "var(--sev-low)";
  if (s >= 60) return "var(--sev-medium)";
  if (s >= 35) return "var(--sev-high)";
  return "var(--sev-critical)";
}

// Suppress unused import warning
const _ = Sparkles;
export const _Sparkles = _;
export type _Severity = Severity;
