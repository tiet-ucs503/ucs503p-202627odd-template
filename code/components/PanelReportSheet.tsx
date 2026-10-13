"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Download, AlertTriangle, CheckCircle2, Compass, Sparkles, Layers, Ruler, Activity, Crosshair, ImageDown, Loader2, History, MapPin, Clock, Camera, ExternalLink } from "lucide-react";
import type { PanelAnalysis } from "@/lib/schema";
import { cn } from "@/lib/utils";
import { CountUp } from "./CountUp";
import { lenisStop, lenisStart } from "./SmoothScroll";
import { BBoxOverlay } from "./BBoxOverlay";
import { DefectExplainModal } from "./DefectExplainModal";
import { annotatePanelToBlob, safeFileStub } from "@/lib/annotateImage";
import { HelpCircle } from "lucide-react";

export function PanelReportSheet({
  panel,
  previewUrl,
  onClose,
  index,
  total,
  sessionId,
}: {
  panel: PanelAnalysis | null;
  previewUrl?: string;
  onClose: () => void;
  index: number;
  total: number;
  sessionId?: string;
}) {
  useEffect(() => {
    if (panel) {
      lenisStop();
      return () => lenisStart();
    }
  }, [panel]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (panel) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [panel, onClose]);

  function downloadPanel() {
    if (!panel) return;
    const blob = new Blob([JSON.stringify(panel, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${panel.panelId}-${panel.fileName.replace(/\.[^.]+$/, "")}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <AnimatePresence>
      {panel && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-50 frosted no-print"
            onClick={onClose}
          />
          <motion.aside
            key="sheet"
            data-lenis-prevent
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 220, damping: 32, mass: 0.9 }}
            className="fixed top-0 right-0 bottom-0 z-50 w-full md:w-[680px] lg:w-[760px] bg-[var(--bg)] border-l hairline-strong overflow-y-auto no-print"
          >
            <SheetBody
              panel={panel}
              previewUrl={previewUrl}
              onClose={onClose}
              onDownload={downloadPanel}
              index={index}
              total={total}
              sessionId={sessionId}
            />
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function SheetBody({
  panel,
  previewUrl,
  onClose,
  onDownload,
  index,
  total,
  sessionId,
}: {
  panel: PanelAnalysis;
  previewUrl?: string;
  onClose: () => void;
  onDownload: () => void;
  index: number;
  total: number;
  sessionId?: string;
}) {
  const condColor = scoreColor(panel.conditionScore);
  const [hoveredDefectIdx, setHoveredDefectIdx] = useState<number | null>(null);
  const [overlayOn, setOverlayOn] = useState(true);
  const [annotating, setAnnotating] = useState(false);
  const [explain, setExplain] = useState<{ type: string; severity: PanelAnalysis["defects"][number]["severity"] } | null>(null);
  const heroSrc = panel.imageDataUrl || previewUrl;
  const groundedDefects = panel.defects.filter((d) => Array.isArray(d.bbox)).length;

  async function downloadAnnotatedPng() {
    if (!heroSrc) return;
    setAnnotating(true);
    try {
      const blob = await annotatePanelToBlob(panel, heroSrc, { format: "image/png" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${safeFileStub(panel)}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("annotatePanelToBlob failed", e);
    } finally {
      setAnnotating(false);
    }
  }

  return (
    <div className="relative">
      <div className="sticky top-0 z-10 frosted border-b hairline px-7 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-mono text-[11px] tracking-[0.18em] text-[var(--fg-mute)]">
            PANEL {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
          </span>
          <span className="text-[var(--fg-mute)]">·</span>
          <span className="font-mono text-[11px] tracking-[0.16em] text-[var(--fg-dim)] truncate">{panel.panelId}</span>
        </div>
        <div className="flex items-center gap-2">
          {groundedDefects > 0 && (
            <button
              onClick={() => setOverlayOn((v) => !v)}
              className={cn(
                "btn-ghost text-[12px] inline-flex items-center gap-1.5 !py-2 !px-3",
                overlayOn && "!border-[var(--accent)] !text-[var(--accent)]"
              )}
              title={overlayOn ? "Hide defect overlay" : "Show defect overlay"}
            >
              <Crosshair size={13} />
              <span className="font-mono tracking-[0.1em]">{groundedDefects}</span>
            </button>
          )}
          {sessionId && (
            <a
              href={`/timeline?session=${encodeURIComponent(sessionId)}&panel=${encodeURIComponent(panel.panelId)}`}
              title="Re-inspect this panel and diff against baseline"
              className="btn-ghost text-[13px] inline-flex items-center gap-2 !py-2 !px-3"
            >
              <History size={14} />
              <span className="hidden md:inline">Re-inspect</span>
            </a>
          )}
          {heroSrc && (
            <button
              onClick={downloadAnnotatedPng}
              disabled={annotating}
              title="Download image with defects annotated"
              className="btn-ghost text-[13px] inline-flex items-center gap-2 !py-2 !px-3"
            >
              {annotating ? <Loader2 size={14} className="animate-spin" /> : <ImageDown size={14} />}
              <span className="hidden md:inline">PNG</span>
            </button>
          )}
          <button onClick={onDownload} className="btn-ghost text-[13px] inline-flex items-center gap-2 !py-2 !px-3">
            <Download size={14} />
            <span className="hidden md:inline">JSON</span>
          </button>
          <button onClick={onClose} className="w-10 h-10 rounded-full grid place-items-center border hairline-strong hover:border-[var(--accent)] hover:bg-[var(--surface-2)] transition-all" aria-label="Close">
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="relative aspect-[16/9] overflow-hidden bg-black select-none">
        {heroSrc && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={heroSrc} alt={panel.fileName} className="w-full h-full object-cover" />
        )}
        {overlayOn && groundedDefects > 0 && (
          <BBoxOverlay
            defects={panel.defects}
            hoveredIndex={hoveredDefectIdx}
            onHover={setHoveredDefectIdx}
          />
        )}
        <div className="absolute inset-0 cell-pattern opacity-15 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent pointer-events-none" />
        <div className="absolute bottom-6 left-7 right-7 flex items-end justify-between gap-6 pointer-events-none">
          <div className="min-w-0">
            <div className="font-mono text-[11px] tracking-[0.18em] text-white/65 mb-2">{panel.fileName}</div>
            <h2 className="h-display text-white text-[40px] md:text-[56px] leading-[0.95]">
              {panel.panelTypeGuess}
            </h2>
            <div className="font-mono text-[12px] text-white/70 mt-2">
              {panel.estimatedCellCount > 0 ? `${panel.estimatedCellCount} cells · ` : ""}{panel.orientation}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="tick text-white/55">Condition</div>
            <div className="stat-num text-white" style={{ color: condColor, fontSize: "clamp(56px, 8vw, 96px)" }}>
              <CountUp to={Math.round(panel.conditionScore)} />
            </div>
          </div>
        </div>
      </div>

      <div className="px-7 py-10 space-y-12">
        <Section title="Verdict" tick="Inspector narrative">
          <p className="body-lg max-w-[60ch] leading-[1.55]">{panel.observations}</p>
        </Section>

        <Section title="Diagnostics" tick="Calibrated metrics">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Metric icon={Activity} label="Condition" value={Math.round(panel.conditionScore)} suffix="/100" color={condColor} />
            <Metric icon={Sparkles} label="Cleanliness" value={Math.round(panel.cleanlinessScore)} suffix="/100" />
            <Metric icon={Layers} label="Eff. loss" value={panel.estimatedTotalEfficiencyLoss} suffix="%" decimals={1} />
            <Metric icon={CheckCircle2} label="Confidence" value={panel.confidence * 100} suffix="%" decimals={0} />
          </div>

          <div className="mt-7 grid grid-cols-1 md:grid-cols-2 gap-4">
            <BarRow label="Output retained" value={100 - panel.estimatedTotalEfficiencyLoss} suffix="%" />
            <BarRow label="Cleanliness index" value={panel.cleanlinessScore} suffix="/100" />
          </div>
        </Section>

        <Section title="Defect ledger" tick={`${panel.defects.length} finding${panel.defects.length === 1 ? "" : "s"}`}>
          {panel.defects.length === 0 ? (
            <div className="card p-7 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full grid place-items-center" style={{ background: "rgba(128,237,153,0.12)" }}>
                <CheckCircle2 size={20} className="text-[var(--sev-low)]" />
              </div>
              <div>
                <div className="font-serif text-[22px] leading-tight">No defects detected</div>
                <div className="body-md mt-1">Panel passes baseline visual inspection. Continue regular cadence.</div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {panel.defects.map((d, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
                  onMouseEnter={() => d.bbox && setHoveredDefectIdx(i)}
                  onMouseLeave={() => setHoveredDefectIdx(null)}
                  className={cn(
                    "card-elev p-5 md:p-6 ring-defect transition-all duration-300",
                    d.severity === "critical" && "border-[rgba(239,35,60,0.35)]",
                    hoveredDefectIdx === i && "scale-[1.005] !border-[var(--accent)]",
                    d.bbox && "cursor-crosshair"
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-[11px] tracking-[0.16em] text-[var(--fg-mute)]">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className={cn("severity-pill", d.severity)}>{d.severity}</span>
                      <span className="font-serif text-[22px] md:text-[26px] leading-tight">{d.type}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExplain({ type: d.type, severity: d.severity });
                        }}
                        className="text-[var(--fg-mute)] hover:text-[var(--accent)] transition-colors"
                        aria-label="What is this defect?"
                        title="Explain this defect"
                      >
                        <HelpCircle size={15} />
                      </button>
                      {d.bbox && (
                        <span className="font-mono text-[10px] tracking-[0.14em] uppercase text-[var(--accent)] flex items-center gap-1">
                          <Crosshair size={10} /> located
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-right">
                      <div>
                        <div className="tick">Loss</div>
                        <div className="font-serif text-[22px] leading-none mt-1" style={{ color: severityColorVar(d.severity) }}>
                          {d.estimatedEfficiencyLoss.toFixed(1)}%
                        </div>
                      </div>
                      <div>
                        <div className="tick">Conf.</div>
                        <div className="font-serif text-[22px] leading-none mt-1">{Math.round(d.confidence * 100)}%</div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-[160px_1fr] gap-2 md:gap-4 mt-4">
                    <div className="tick flex items-center gap-1.5"><Compass size={11} /> Location</div>
                    <div className="body-md text-[var(--fg)]">{d.location}</div>
                  </div>
                  {d.notes && (
                    <div className="grid grid-cols-1 md:grid-cols-[160px_1fr] gap-2 md:gap-4 mt-3">
                      <div className="tick flex items-center gap-1.5"><Ruler size={11} /> Notes</div>
                      <p className="body-md">{d.notes}</p>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </Section>

        <Section title="Immediate actions" tick="O&M directives">
          {panel.immediateActions.length === 0 ? (
            <p className="body-md">None required.</p>
          ) : (
            <ol className="space-y-3">
              {panel.immediateActions.map((a, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
                  className="card p-5 flex items-start gap-4"
                >
                  <div className="font-mono text-[12px] tracking-[0.16em] text-[var(--accent)] pt-0.5">
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <p className="body-md text-[var(--fg)] leading-relaxed">{a}</p>
                </motion.li>
              ))}
            </ol>
          )}
        </Section>

        <Section title="Image quality" tick="Capture grade">
          <div className="card p-5 flex items-center gap-4">
            {panel.imageQuality === "poor" ? (
              <AlertTriangle size={20} className="text-[var(--sev-high)]" />
            ) : (
              <CheckCircle2 size={20} className="text-[var(--sev-low)]" />
            )}
            <div>
              <div className="font-serif text-[22px] capitalize leading-tight">{panel.imageQuality}</div>
              <div className="body-md mt-1">
                {panel.imageQuality === "excellent" && "Capture exceeds inspection standards."}
                {panel.imageQuality === "good" && "Capture sufficient for confident analysis."}
                {panel.imageQuality === "fair" && "Acceptable, recommend reshoot at next visit."}
                {panel.imageQuality === "poor" && "Re-capture advised, analysis confidence reduced."}
              </div>
            </div>
          </div>
        </Section>

        <CaptureMetadataSection panel={panel} />
      </div>

      <DefectExplainModal
        open={explain !== null}
        defectType={explain?.type ?? null}
        severity={explain?.severity}
        onClose={() => setExplain(null)}
      />
    </div>
  );
}

function Section({ title, tick, children }: { title: string; tick: string; children: React.ReactNode }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="flex items-baseline justify-between mb-5">
        <h3 className="h-display text-[28px] md:text-[36px]">{title}</h3>
        <span className="tick">{tick}</span>
      </div>
      {children}
    </motion.section>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  suffix,
  decimals = 0,
  color,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: number;
  suffix?: string;
  decimals?: number;
  color?: string;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <Icon size={14} className="text-[var(--fg-mute)]" />
        <span className="tick">{label}</span>
      </div>
      <div className="font-serif text-[40px] md:text-[44px] leading-none" style={{ color: color ?? "var(--fg)" }}>
        <CountUp to={value} decimals={decimals} />
        {suffix && <span className="text-[var(--fg-mute)] text-[24px] ml-0.5">{suffix}</span>}
      </div>
    </div>
  );
}

function BarRow({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="tick">{label}</span>
        <span className="font-mono text-[13px] text-[var(--fg-dim)]">
          {value.toFixed(1)}{suffix}
        </span>
      </div>
      <div className="bar bar-lg"><span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>
    </div>
  );
}

function CaptureMetadataSection({ panel }: { panel: PanelAnalysis }) {
  const exif = panel.exif;
  if (!exif) return null;
  const hasGps = exif.lat != null && exif.lon != null;
  if (!hasGps) return null;

  const lat = exif.lat as number;
  const lon = exif.lon as number;
  const mapsUrl = `https://www.google.com/maps?q=${lat},${lon}`;

  const hasDevice = !!(exif.make || exif.model);
  const deviceLabel = [exif.make, exif.model].filter(Boolean).join(" ").trim();

  const hasTime = exif.takenAt != null;
  const timeLabel = hasTime ? formatTakenAt(exif.takenAt as number) : null;

  return (
    <Section title="Capture metadata" tick="EXIF">
      <div className="card p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-[140px_1fr] gap-2 md:gap-4 items-baseline">
          <div className="tick flex items-center gap-1.5">
            <MapPin size={11} /> GPS
          </div>
          <div className="body-md text-[var(--fg)] flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-mono text-[13px]">{formatLatLon(lat, lon)}</span>
            {exif.altitudeM != null && (
              <span className="text-[var(--fg-mute)]">· alt {Math.round(exif.altitudeM)} m</span>
            )}
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[var(--accent)] hover:underline"
            >
              open in Google Maps <ExternalLink size={11} />
            </a>
          </div>
        </div>

        {hasTime && timeLabel && (
          <div className="grid grid-cols-1 md:grid-cols-[140px_1fr] gap-2 md:gap-4 items-baseline">
            <div className="tick flex items-center gap-1.5">
              <Clock size={11} /> Captured
            </div>
            <div className="body-md text-[var(--fg)] font-mono text-[13px]">{timeLabel}</div>
          </div>
        )}

        {hasDevice && deviceLabel && (
          <div className="grid grid-cols-1 md:grid-cols-[140px_1fr] gap-2 md:gap-4 items-baseline">
            <div className="tick flex items-center gap-1.5">
              <Camera size={11} /> Device
            </div>
            <div className="body-md text-[var(--fg)]">{deviceLabel}</div>
          </div>
        )}
      </div>
    </Section>
  );
}

function formatLatLon(lat: number, lon: number): string {
  const ns = lat >= 0 ? "N" : "S";
  const ew = lon >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(4)}°${ns}, ${Math.abs(lon).toFixed(4)}°${ew}`;
}

function formatTakenAt(ms: number): string {
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function scoreColor(s: number) {
  if (s >= 80) return "var(--sev-low)";
  if (s >= 60) return "var(--sev-medium)";
  if (s >= 35) return "var(--sev-high)";
  return "var(--sev-critical)";
}
function severityColorVar(s: "low" | "medium" | "high" | "critical") {
  return {
    low: "var(--sev-low)",
    medium: "var(--sev-medium)",
    high: "var(--sev-high)",
    critical: "var(--sev-critical)",
  }[s];
}
