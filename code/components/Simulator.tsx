"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, Wand2, Sparkles, RotateCcw, Crosshair, ChevronDown } from "lucide-react";
import type { FullAnalysis, Severity } from "@/lib/schema";
import {
  defectKey,
  presetFixAll,
  presetFixSeverity,
  presetFixTopByLoss,
  presetFixType,
  simulate,
  type DefectKey,
} from "@/lib/simulator";
import { CountUp } from "./CountUp";
import { cn } from "@/lib/utils";

export function Simulator({ session }: { session: FullAnalysis }) {
  const [fixed, setFixed] = useState<Set<DefectKey>>(() => new Set());
  const [openPanels, setOpenPanels] = useState<Set<string>>(() => new Set());

  const result = useMemo(() => simulate(session, fixed), [session, fixed]);
  const panels = session.panels;

  function toggle(key: DefectKey) {
    setFixed((curr) => {
      const next = new Set(curr);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function togglePanelOpen(id: string) {
    setOpenPanels((curr) => {
      const next = new Set(curr);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function fixAllOnPanel(panelId: string) {
    const p = panels.find((x) => x.panelId === panelId);
    if (!p) return;
    setFixed((curr) => {
      const next = new Set(curr);
      for (let i = 0; i < p.defects.length; i++) next.add(defectKey(panelId, i));
      return next;
    });
  }

  function clearPanel(panelId: string) {
    const p = panels.find((x) => x.panelId === panelId);
    if (!p) return;
    setFixed((curr) => {
      const next = new Set(curr);
      for (let i = 0; i < p.defects.length; i++) next.delete(defectKey(panelId, i));
      return next;
    });
  }

  const totalDefects = panels.reduce((a, p) => a + p.defects.length, 0);
  const fixedCount = result.delta.fixedDefectCount;

  return (
    <div className="space-y-8">
      <StatBanner result={result} />

      <div className="card-elev p-6 md:p-7">
        <div className="flex items-center justify-between flex-wrap gap-4 mb-5">
          <div className="flex items-center gap-3">
            <Wand2 size={15} className="text-[var(--accent)]" />
            <span className="tick">Quick scenarios</span>
          </div>
          <div className="font-mono text-[12px] text-[var(--fg-mute)]">
            {fixedCount}/{totalDefects} defects fixed
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <PresetButton
            label="Fix all critical + high"
            onClick={() => setFixed(presetFixSeverity(panels, ["critical", "high"]))}
          />
          <PresetButton
            label="Clean all soiling"
            onClick={() => setFixed(presetFixType(panels, "soil"))}
          />
          <PresetButton
            label="Top 5 by loss"
            onClick={() => setFixed(presetFixTopByLoss(panels, 5))}
          />
          <PresetButton
            label="Fix everything"
            onClick={() => setFixed(presetFixAll(panels))}
          />
          <PresetButton
            icon={RotateCcw}
            label="Reset"
            onClick={() => setFixed(new Set())}
            variant="ghost"
          />
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <div className="tick mb-2">Per-panel ledger</div>
            <h3 className="h-display text-[28px] md:text-[36px]">
              Toggle defects to recompute the fleet.
            </h3>
          </div>
          <div className="font-mono text-[12px] text-[var(--fg-mute)]">
            click any panel to expand
          </div>
        </div>

        <div className="space-y-3">
          {result.panels.map((sp) => {
            const isOpen = openPanels.has(sp.panel.panelId);
            const condDelta = sp.simulatedConditionScore - sp.baselineConditionScore;
            return (
              <motion.div
                key={sp.panel.panelId}
                layout
                className={cn(
                  "card-elev overflow-hidden",
                  sp.fixedCount > 0 && "border-[rgba(255,91,0,0.35)]"
                )}
              >
                <button
                  type="button"
                  onClick={() => togglePanelOpen(sp.panel.panelId)}
                  className="w-full flex items-center gap-4 px-5 md:px-6 py-4 text-left hover:bg-[var(--surface-2)] transition-colors duration-200"
                >
                  <div className="font-mono text-[12px] tracking-[0.16em] text-[var(--fg-mute)] shrink-0 w-[112px]">
                    {sp.panel.panelId}
                  </div>
                  <div className="font-serif text-[18px] md:text-[20px] leading-tight truncate flex-1 min-w-0">
                    {sp.panel.panelTypeGuess}
                    <span className="text-[var(--fg-mute)] text-[14px] ml-2">
                      · {sp.panel.defects.length} {sp.panel.defects.length === 1 ? "defect" : "defects"}
                    </span>
                  </div>

                  <div className="hidden md:flex items-center gap-6 shrink-0">
                    <CompactMetric
                      label="Condition"
                      from={sp.baselineConditionScore}
                      to={sp.simulatedConditionScore}
                    />
                    <CompactMetric
                      label="Loss %"
                      from={sp.baselineEffLossPct}
                      to={sp.simulatedEffLossPct}
                      decimals={1}
                      suffix="%"
                      reverseGood
                    />
                    <div className="text-right w-[78px]">
                      <div className="tick">Fixed</div>
                      <div className="font-serif text-[20px] mt-0.5 leading-none">
                        <span style={{ color: sp.fixedCount > 0 ? "var(--accent)" : "var(--fg-mute)" }}>
                          {sp.fixedCount}
                        </span>
                        <span className="text-[var(--fg-mute)] text-[13px]"> / {sp.panel.defects.length}</span>
                      </div>
                    </div>
                  </div>

                  <ChevronDown
                    size={18}
                    className={cn(
                      "text-[var(--fg-mute)] shrink-0 transition-transform duration-300",
                      isOpen && "rotate-180"
                    )}
                  />
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="px-5 md:px-6 pb-5 pt-1 border-t hairline">
                        <div className="md:hidden flex items-center gap-5 mb-4">
                          <CompactMetric
                            label="Condition"
                            from={sp.baselineConditionScore}
                            to={sp.simulatedConditionScore}
                          />
                          <CompactMetric
                            label="Loss %"
                            from={sp.baselineEffLossPct}
                            to={sp.simulatedEffLossPct}
                            decimals={1}
                            suffix="%"
                            reverseGood
                          />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 mb-4 items-start">
                          <p className="body-md text-[14.5px] max-w-[68ch]">{sp.panel.observations}</p>
                          <div className="flex gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                fixAllOnPanel(sp.panel.panelId);
                              }}
                              className="font-mono text-[11px] tracking-[0.12em] uppercase px-3 py-1.5 rounded-full border hairline-strong hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
                            >
                              Fix all
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                clearPanel(sp.panel.panelId);
                              }}
                              className="font-mono text-[11px] tracking-[0.12em] uppercase px-3 py-1.5 rounded-full border hairline-strong hover:border-[var(--fg)] transition-colors"
                            >
                              Clear
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                          {sp.panel.defects.length === 0 && (
                            <div className="severity-pill low">No defects</div>
                          )}
                          {sp.panel.defects.map((d, i) => {
                            const k = defectKey(sp.panel.panelId, i);
                            const isFixed = fixed.has(k);
                            return (
                              <button
                                key={i}
                                type="button"
                                onClick={() => toggle(k)}
                                className={cn(
                                  "card text-left p-3.5 flex items-start gap-3 transition-all duration-200",
                                  "hover:border-[var(--accent)] hover:bg-[var(--surface-2)]",
                                  isFixed && "!border-[var(--accent)] bg-[var(--surface-2)]"
                                )}
                              >
                                <div
                                  className={cn(
                                    "shrink-0 w-5 h-5 rounded-md grid place-items-center mt-0.5 border transition-all",
                                    isFixed
                                      ? "bg-[var(--accent)] border-[var(--accent)]"
                                      : "border-[var(--line-strong)] bg-[var(--surface-2)]"
                                  )}
                                >
                                  {isFixed && (
                                    <svg viewBox="0 0 16 16" width="11" height="11" aria-hidden>
                                      <path
                                        d="M3 8.5L6.5 12L13 5"
                                        fill="none"
                                        stroke="#0a0a0a"
                                        strokeWidth="2.4"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      />
                                    </svg>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className={cn("severity-pill", d.severity)}>{d.severity}</span>
                                    <span
                                      className={cn(
                                        "font-serif text-[18px] leading-tight",
                                        isFixed && "line-through text-[var(--fg-mute)]"
                                      )}
                                    >
                                      {d.type}
                                    </span>
                                    {d.bbox && (
                                      <Crosshair size={11} className="text-[var(--accent)]" />
                                    )}
                                  </div>
                                  <div className="font-mono text-[11.5px] text-[var(--fg-mute)] mt-1">
                                    -{d.estimatedEfficiencyLoss.toFixed(1)}% · {d.location}
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </div>

      <div className="card-elev p-6 md:p-8 relative overflow-hidden">
        <div
          className="absolute -right-20 -top-20 w-[420px] h-[420px] rounded-full opacity-30 blur-3xl pointer-events-none"
          style={{ background: "radial-gradient(circle, var(--accent-glow), transparent 60%)" }}
        />
        <div className="tick mb-3">If you act now</div>
        <h3 className="h-display text-[32px] md:text-[44px] leading-[1.05] mb-4">
          {fixedCount === 0 ? (
            <>Pick something to fix.</>
          ) : (
            <>
              Recover{" "}
              <em className="italic text-[var(--accent-2)]">
                <CountUp to={Math.max(0, result.delta.outputRetainedPctDelta)} decimals={1} suffix="%" />
              </em>{" "}
              of fleet output.
            </>
          )}
        </h3>
        <p className="body-md max-w-[58ch]">
          {fixedCount === 0
            ? "Toggle defects above or pick a quick scenario. Numbers in the banner update live."
            : `Fixing ${fixedCount} ${fixedCount === 1 ? "defect" : "defects"} across ${result.delta.fixedPanelCount} ${result.delta.fixedPanelCount === 1 ? "panel" : "panels"} cuts annual loss by approximately ${Math.abs(result.delta.annualLossDelta).toFixed(0)} kWh per installed kW.`}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href={`/chat/${session.generatedAt /* fallback */}`}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => setFixed(new Set())}
            className="btn-ghost text-sm inline-flex items-center gap-2"
          >
            <RotateCcw size={13} /> Reset scenario
          </button>
        </div>
      </div>
    </div>
  );
}

function StatBanner({ result }: { result: ReturnType<typeof simulate> }) {
  const { baseline, simulated, delta } = result;
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sticky top-[72px] z-30 frosted py-3 border-b hairline -mx-6 md:-mx-10 px-6 md:px-10">
      <Stat
        label="Fleet health"
        from={baseline.fleetHealthScore}
        to={simulated.fleetHealthScore}
        suffix=""
        decimals={0}
      />
      <Stat
        label="Eff. loss"
        from={baseline.fleetEffLossPct}
        to={simulated.fleetEffLossPct}
        suffix="%"
        decimals={1}
        reverseGood
      />
      <Stat
        label="Annual loss"
        from={baseline.annualLossKwhPerKw}
        to={simulated.annualLossKwhPerKw}
        suffix=" kWh/kW"
        decimals={0}
        reverseGood
      />
      <Stat
        label="Output regained"
        from={0}
        to={delta.outputRetainedPctDelta}
        suffix="%"
        decimals={1}
      />
    </div>
  );
}

function Stat({
  label,
  from,
  to,
  suffix = "",
  decimals = 0,
  reverseGood = false,
}: {
  label: string;
  from: number;
  to: number;
  suffix?: string;
  decimals?: number;
  reverseGood?: boolean;
}) {
  const diff = to - from;
  const isImprovement = reverseGood ? diff < 0 : diff > 0;
  const isWorse = reverseGood ? diff > 0 : diff < 0;
  const goodColor = "var(--sev-low)";
  const badColor = "var(--sev-critical)";
  const color = isImprovement ? goodColor : isWorse ? badColor : "var(--fg)";
  const Arrow = reverseGood ? (diff < 0 ? ArrowDownRight : ArrowUpRight) : diff > 0 ? ArrowUpRight : ArrowDownRight;
  const showDelta = Math.abs(diff) >= (decimals === 0 ? 1 : 0.05);
  return (
    <div className="card p-3 md:p-4">
      <div className="tick">{label}</div>
      <div className="flex items-baseline justify-between mt-1.5 gap-2">
        <div className="font-serif text-[28px] md:text-[36px] leading-none">
          <CountUp to={to} decimals={decimals} />
          <span className="text-[var(--fg-mute)] text-[14px] ml-0.5">{suffix}</span>
        </div>
        {showDelta && (
          <div
            className="font-mono text-[12px] flex items-center gap-1"
            style={{ color }}
          >
            <Arrow size={12} />
            {Math.abs(diff).toFixed(decimals)}
            {suffix.trim() ? suffix : ""}
          </div>
        )}
      </div>
    </div>
  );
}

function CompactMetric({
  label,
  from,
  to,
  suffix = "",
  decimals = 0,
  reverseGood = false,
}: {
  label: string;
  from: number;
  to: number;
  suffix?: string;
  decimals?: number;
  reverseGood?: boolean;
}) {
  const diff = to - from;
  const isImprovement = reverseGood ? diff < 0 : diff > 0;
  const isWorse = reverseGood ? diff > 0 : diff < 0;
  const color = isImprovement ? "var(--sev-low)" : isWorse ? "var(--sev-critical)" : "var(--fg)";
  return (
    <div className="text-right">
      <div className="tick">{label}</div>
      <div className="font-mono text-[13px] mt-0.5 leading-none">
        <span className="text-[var(--fg-mute)]">{from.toFixed(decimals)}{suffix}</span>
        <span className="mx-1.5 text-[var(--fg-mute)]">→</span>
        <span style={{ color }}>{to.toFixed(decimals)}{suffix}</span>
      </div>
    </div>
  );
}

function PresetButton({
  label,
  onClick,
  icon: Icon = Sparkles,
  variant = "primary",
}: {
  label: string;
  onClick: () => void;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  variant?: "primary" | "ghost";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "font-sans text-[13.5px] px-3.5 py-2 rounded-full border hairline-strong",
        "inline-flex items-center gap-2 transition-all duration-200",
        variant === "primary"
          ? "text-[var(--fg)] hover:border-[var(--accent)] hover:bg-[var(--surface-2)]"
          : "text-[var(--fg-mute)] hover:text-[var(--fg)]"
      )}
    >
      <Icon size={12} className={variant === "primary" ? "text-[var(--accent)]" : ""} />
      {label}
    </button>
  );
}

// Suppress unused import warning if Severity type ever needed elsewhere
export type _Severity = Severity;
