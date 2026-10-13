"use client";

import { motion, useScroll, useTransform, useSpring } from "framer-motion";
import { useMemo, useRef, useState } from "react";
import { Download, Printer, ArrowUpRight, X as XIcon, Filter } from "lucide-react";
import type { FullAnalysis } from "@/lib/schema";
import { cn } from "@/lib/utils";
import { CountUp } from "./CountUp";

export function ReportDashboard({
  data,
  onDownload,
  onOpenPanel,
}: {
  data: FullAnalysis;
  onDownload: () => void;
  onOpenPanel?: (panelId: string) => void;
}) {
  const { report, panels, generatedAt, modelInfo } = data;
  const sevTotals = [
    { k: "critical", v: report.criticalCount },
    { k: "high", v: report.highCount },
    { k: "medium", v: report.mediumCount },
    { k: "low", v: report.lowCount },
  ] as const;
  const totalDefects = sevTotals.reduce((a, b) => a + b.v, 0);

  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start end", "end start"] });
  const smoothProgress = useSpring(scrollYProgress, { stiffness: 110, damping: 24, mass: 0.4 });
  const heroY = useTransform(smoothProgress, [0, 1], [40, -40]);

  const [matrixView, setMatrixView] = useState(false);
  const [filterType, setFilterType] = useState<string | null>(null);

  const defectTypeCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of panels) for (const d of p.defects) m.set(d.type.toLowerCase(), (m.get(d.type.toLowerCase()) ?? 0) + 1);
    return Array.from(m.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12);
  }, [panels]);

  const filteredPanels = useMemo(() => {
    if (!filterType) return panels;
    const f = filterType.toLowerCase();
    return panels.filter((p) => p.defects.some((d) => d.type.toLowerCase() === f));
  }, [panels, filterType]);

  // Anomaly detection: condition Z-score < -1.5 from mean
  const anomalies = useMemo(() => {
    if (panels.length < 4) return new Set<string>();
    const conds = panels.map((p) => p.conditionScore);
    const mean = conds.reduce((a, b) => a + b, 0) / conds.length;
    const variance = conds.reduce((a, b) => a + (b - mean) ** 2, 0) / conds.length;
    const sd = Math.sqrt(variance);
    if (sd < 4) return new Set<string>();
    const out = new Set<string>();
    for (const p of panels) {
      const z = (p.conditionScore - mean) / sd;
      if (z < -1.4) out.add(p.panelId);
    }
    return out;
  }, [panels]);

  return (
    <motion.section
      id="report"
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-12% 0px" }}
      transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-12 scroll-mt-24"
    >
      <div ref={heroRef} className="relative flex flex-wrap items-end justify-between gap-8">
        <motion.div style={{ y: heroY }}>
          <div className="tick mb-4">Executive Inspection Report</div>
          <h2 className="h-display text-[56px] md:text-[88px] lg:text-[104px]">Fleet diagnosis</h2>
          <p className="body-lg mt-5 max-w-[60ch]">{report.executiveSummary}</p>
        </motion.div>
        <div className="flex items-center gap-3 no-print">
          <button onClick={onDownload} className="btn-primary inline-flex items-center gap-2">
            <Download size={15} /> Download report
          </button>
          <button onClick={() => window.print()} className="btn-ghost inline-flex items-center gap-2">
            <Printer size={14} /> Print
          </button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-5">
        <RevealCard className="col-span-12 md:col-span-5 card-elev p-8 md:p-9 relative overflow-hidden scanline" delay={0}>
          <div className="absolute -right-12 -top-12 w-80 h-80 rounded-full opacity-40"
            style={{ background: "radial-gradient(circle, var(--accent-glow), transparent 60%)" }} />
          <div className="tick">Fleet health score</div>
          <div className="font-serif mt-3 leading-[0.9]" style={{ color: scoreColor(report.fleetHealthScore), fontSize: "clamp(96px, 14vw, 168px)", letterSpacing: "-0.04em" }}>
            <CountUp to={Math.round(report.fleetHealthScore)} />
          </div>
          <div className="bar bar-lg mt-6"><span style={{ width: `${report.fleetHealthScore}%` }} /></div>
          <div className="grid grid-cols-2 gap-5 mt-9">
            <Stat label="Panels analyzed" value={`${report.panelsAnalyzed}`} />
            <Stat label="Avg. eff. loss" value={`${report.fleetEfficiencyLossPct.toFixed(1)}%`} />
            <Stat label="Annual loss" value={`${Math.round(report.estimatedAnnualEnergyLossKwhPerKw)} kWh/kW`} />
            <Stat label="Next inspection" value={`${report.nextInspectionInDays}d`} />
          </div>
        </RevealCard>

        <RevealCard className="col-span-12 md:col-span-7 card-elev p-8 md:p-9" delay={0.08}>
          <div className="flex items-center justify-between mb-6">
            <div className="tick">Severity distribution</div>
            <div className="font-mono text-[13px] text-[var(--fg-dim)]">{totalDefects} findings</div>
          </div>

          <div className="space-y-5">
            {sevTotals.map((s, i) => {
              const pct = totalDefects ? (s.v / totalDefects) * 100 : 0;
              return (
                <motion.div
                  key={s.k}
                  initial={{ opacity: 0, x: -12 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-10% 0px" }}
                  transition={{ duration: 0.7, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={cn("severity-pill", s.k)}>{s.k}</span>
                    <span className="font-mono text-[13px] text-[var(--fg-dim)]">{s.v}</span>
                  </div>
                  <div className="bar bar-lg">
                    <span
                      style={{
                        width: `${pct}%`,
                        background: severityGradient(s.k),
                      }}
                    />
                  </div>
                </motion.div>
              );
            })}
          </div>

          <div className="divider my-7" />

          <div className="grid grid-cols-2 gap-6">
            <div>
              <div className="tick">Maintenance window</div>
              <div className="font-serif text-[26px] mt-2 leading-tight">{report.maintenanceWindow}</div>
            </div>
            <div>
              <div className="tick">Revenue at risk</div>
              <div className="font-serif text-[26px] mt-2 leading-tight">{report.estimatedRevenueAtRisk}</div>
            </div>
          </div>

          <div className="divider my-7" />

          <CarbonLedger annualLossKwhPerKw={report.estimatedAnnualEnergyLossKwhPerKw} />
        </RevealCard>

        <RevealCard className="col-span-12 lg:col-span-7 card-elev p-8 md:p-9" delay={0.05}>
          <div className="tick mb-6">Top risks</div>
          <ul className="space-y-5">
            {report.topRisks.slice(0, 6).map((r, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-10% 0px" }}
                transition={{ duration: 0.6, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
                className="flex gap-5 items-start border-t hairline pt-5 first:border-t-0 first:pt-0"
              >
                <span className={cn("severity-pill mt-1 shrink-0", r.severity)}>{r.severity}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-serif text-[24px] md:text-[26px] leading-[1.1]">{r.risk}</div>
                  <p className="body-md mt-1.5">{r.rationale}</p>
                  {r.affectedPanelIds.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {r.affectedPanelIds.slice(0, 8).map((id) => (
                        <button
                          key={id}
                          onClick={() => onOpenPanel?.(id)}
                          className="kbd hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors duration-200 cursor-pointer"
                        >
                          {id}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </motion.li>
            ))}
          </ul>
        </RevealCard>

        <RevealCard className="col-span-12 lg:col-span-5 card-elev p-8 md:p-9" delay={0.1}>
          <div className="tick mb-6">Prioritized actions</div>
          <ol className="space-y-5">
            {report.recommendations.slice(0, 6).map((rec, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-10% 0px" }}
                transition={{ duration: 0.6, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
                className="border-t hairline pt-5 first:border-t-0 first:pt-0"
              >
                <div className="flex items-center justify-between gap-3 mb-2">
                  <span className="font-mono text-[12px] tracking-[0.16em] text-[var(--fg-mute)]">
                    0{i + 1} · {rec.timeframe}
                  </span>
                  <span className={cn("severity-pill", rec.priority)}>{rec.priority}</span>
                </div>
                <div className="font-serif text-[22px] md:text-[24px] leading-[1.1]">{rec.title}</div>
                <p className="body-md mt-2">{rec.action}</p>
                <p className="text-[14px] text-[var(--accent-2)] mt-2 font-medium">→ {rec.expectedImpact}</p>
              </motion.li>
            ))}
          </ol>
        </RevealCard>

        <RevealCard className="col-span-12 card-elev p-8 md:p-9" delay={0.05}>
          <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
            <div className="tick">Per-panel ledger</div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMatrixView((v) => !v)}
                className={cn(
                  "font-mono text-[11px] tracking-[0.14em] uppercase px-3 py-1.5 rounded-full border transition-colors",
                  matrixView
                    ? "border-[var(--accent)] text-[var(--accent)]"
                    : "hairline-strong text-[var(--fg-dim)] hover:border-[var(--accent)] hover:text-[var(--fg)]"
                )}
              >
                {matrixView ? "Table view" : "Heatmap view"}
              </button>
              {anomalies.size > 0 && (
                <span className="font-mono text-[10.5px] tracking-[0.14em] uppercase px-2.5 py-1 rounded-full bg-[rgba(239,35,60,0.10)] text-[var(--sev-critical)] border border-[rgba(239,35,60,0.4)]">
                  {anomalies.size} outlier{anomalies.size === 1 ? "" : "s"}
                </span>
              )}
            </div>
          </div>

          {defectTypeCounts.length > 0 && (
            <div className="flex items-center flex-wrap gap-2 mb-5">
              <Filter size={12} className="text-[var(--fg-mute)] mr-1" />
              <button
                type="button"
                onClick={() => setFilterType(null)}
                className={cn(
                  "font-mono text-[11px] tracking-[0.12em] uppercase px-3 py-1 rounded-full border transition-colors",
                  filterType === null
                    ? "border-[var(--accent)] text-[var(--accent)]"
                    : "hairline-strong text-[var(--fg-dim)] hover:border-[var(--accent)]"
                )}
              >
                All · {panels.length}
              </button>
              {defectTypeCounts.map(([t, c]) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setFilterType(filterType === t ? null : t)}
                  className={cn(
                    "font-mono text-[11px] tracking-[0.12em] uppercase px-3 py-1 rounded-full border transition-colors lowercase normal-case",
                    filterType === t
                      ? "border-[var(--accent)] text-[var(--accent)] bg-[var(--surface-2)]"
                      : "hairline-strong text-[var(--fg-dim)] hover:border-[var(--accent)] hover:text-[var(--fg)]"
                  )}
                >
                  {t} · {c}
                </button>
              ))}
              {filterType && (
                <button
                  onClick={() => setFilterType(null)}
                  className="ml-1 text-[var(--fg-mute)] hover:text-[var(--accent)] transition-colors"
                  aria-label="Clear filter"
                >
                  <XIcon size={13} />
                </button>
              )}
            </div>
          )}

          {matrixView ? (
            <SeverityMatrix panels={filteredPanels} anomalies={anomalies} onOpenPanel={onOpenPanel} />
          ) : (
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left border-separate border-spacing-y-2">
              <thead>
                <tr className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--fg-mute)]">
                  <th className="px-4 py-2">ID</th>
                  <th className="px-4 py-2">Type</th>
                  <th className="px-4 py-2">Clean</th>
                  <th className="px-4 py-2">Condition</th>
                  <th className="px-4 py-2">Loss</th>
                  <th className="px-4 py-2">Defects</th>
                  <th className="px-4 py-2">Top finding</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {filteredPanels.map((p) => {
                  const top = [...p.defects].sort((a, b) => sevWeight(b.severity) - sevWeight(a.severity))[0];
                  const isAnomaly = anomalies.has(p.panelId);
                  return (
                    <tr
                      key={p.panelId}
                      onClick={() => onOpenPanel?.(p.panelId)}
                      className="text-[14px] cursor-pointer transition-colors duration-200 hover:[&>td]:bg-[var(--surface-3)]"
                      style={{ background: "var(--surface-2)" }}
                    >
                      <td className="px-4 py-4 rounded-l-lg font-mono text-[13px]">
                        {p.panelId}
                        {isAnomaly && (
                          <span className="ml-2 font-mono text-[9.5px] tracking-[0.16em] uppercase px-1.5 py-0.5 rounded text-[var(--sev-critical)] bg-[rgba(239,35,60,0.10)] border border-[rgba(239,35,60,0.4)]">
                            outlier
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4">{p.panelTypeGuess}</td>
                      <td className="px-4 py-4">{Math.round(p.cleanlinessScore)}</td>
                      <td className="px-4 py-4 font-serif text-[18px]" style={{ color: scoreColor(p.conditionScore) }}>
                        {Math.round(p.conditionScore)}
                      </td>
                      <td className="px-4 py-4">{p.estimatedTotalEfficiencyLoss.toFixed(1)}%</td>
                      <td className="px-4 py-4">{p.defects.length}</td>
                      <td className="px-4 py-4">
                        {top ? (
                          <span className="inline-flex items-center gap-2">
                            <span className={cn("severity-pill", top.severity)}>{top.severity}</span>
                            <span className="text-[var(--fg-dim)]">{top.type}</span>
                          </span>
                        ) : (
                          <span className="severity-pill low">clean</span>
                        )}
                      </td>
                      <td className="px-4 py-4 rounded-r-lg text-right">
                        <ArrowUpRight size={16} className="inline text-[var(--fg-mute)]" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          )}
        </RevealCard>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-[var(--fg-mute)] font-mono text-[12px]">
        <div>Generated {new Date(generatedAt).toLocaleString()}</div>
        <div>vision · {modelInfo.vision} &nbsp; / &nbsp; synthesis · {modelInfo.synthesis}</div>
      </div>
    </motion.section>
  );
}

function RevealCard({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-8% 0px" }}
      transition={{ duration: 0.9, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="tick">{label}</div>
      <div className="font-serif text-[26px] mt-1.5 leading-none">{value}</div>
    </div>
  );
}

function scoreColor(s: number) {
  if (s >= 80) return "var(--sev-low)";
  if (s >= 60) return "var(--sev-medium)";
  if (s >= 35) return "var(--sev-high)";
  return "var(--sev-critical)";
}

function severityGradient(k: "low" | "medium" | "high" | "critical") {
  return {
    low: "linear-gradient(90deg, var(--sev-low), #4dc78c)",
    medium: "linear-gradient(90deg, var(--sev-medium), #ffb800)",
    high: "linear-gradient(90deg, var(--accent), var(--accent-2))",
    critical: "linear-gradient(90deg, var(--sev-critical), var(--accent-3))",
  }[k];
}

function sevWeight(s: "low" | "medium" | "high" | "critical") {
  return { low: 1, medium: 2, high: 3, critical: 4 }[s];
}

function SeverityMatrix({
  panels,
  anomalies,
  onOpenPanel,
}: {
  panels: FullAnalysis["panels"];
  anomalies: Set<string>;
  onOpenPanel?: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-9 xl:grid-cols-12 gap-2">
      {panels.map((p) => {
        const c = p.conditionScore;
        const isAnomaly = anomalies.has(p.panelId);
        const color = scoreColor(c);
        const intensity = Math.max(0.2, Math.min(0.92, 1 - c / 100));
        return (
          <button
            key={p.panelId}
            type="button"
            onClick={() => onOpenPanel?.(p.panelId)}
            title={`${p.panelId} · cond ${Math.round(c)} · loss ${p.estimatedTotalEfficiencyLoss.toFixed(1)}%${isAnomaly ? " · OUTLIER" : ""}`}
            className="relative aspect-square rounded-md border hairline overflow-hidden hover:scale-[1.06] hover:z-10 transition-transform duration-200"
            style={{
              background: `linear-gradient(135deg, ${color}${Math.round(intensity * 255).toString(16).padStart(2, "0")}, transparent 110%), var(--surface-2)`,
            }}
          >
            <span className="absolute inset-0 flex items-center justify-center font-mono text-[11px] tracking-[0.08em] text-white/95">
              {Math.round(c)}
            </span>
            {isAnomaly && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[var(--sev-critical)] ring-2 ring-[var(--bg)]" />
            )}
            <span className="absolute bottom-0 inset-x-0 px-1 py-0.5 font-mono text-[8px] truncate text-white/65 bg-black/35">
              {p.panelId}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function CarbonLedger({ annualLossKwhPerKw }: { annualLossKwhPerKw: number }) {
  // Per-kW figures. 0.4 kg CO2 / kWh ≈ avg grid mix (IEA-ish).
  const kgCo2PerKwYear = annualLossKwhPerKw * 0.4;
  // 100km in a small EV ≈ 15 kWh ≈ 6 kg CO2 if grid-charged. Rough analogy:
  const equivKmEv = (kgCo2PerKwYear / 0.06).toFixed(0);
  return (
    <div>
      <div className="tick mb-3">Carbon ledger · per installed kW · annual</div>
      <div className="grid grid-cols-2 gap-5">
        <div>
          <div className="font-serif text-[34px] leading-none" style={{ color: "var(--accent-2)" }}>
            <CountUp to={Math.round(kgCo2PerKwYear)} /> kg
          </div>
          <div className="font-mono text-[11px] text-[var(--fg-mute)] mt-2 leading-snug">
            CO₂ avoidance lost to current defects (grid factor 0.40 kg/kWh)
          </div>
        </div>
        <div>
          <div className="font-serif text-[34px] leading-none">
            <CountUp to={Number(equivKmEv)} /> km
          </div>
          <div className="font-mono text-[11px] text-[var(--fg-mute)] mt-2 leading-snug">
            equivalent driving emissions a small EV could&apos;ve covered
          </div>
        </div>
      </div>
    </div>
  );
}
