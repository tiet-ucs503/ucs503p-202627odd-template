"use client";

import { useCallback, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowDownRight,
  ArrowUpRight,
  ImagePlus,
  Loader2,
  Minus,
  Plus,
  RefreshCw,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import type { PanelAnalysis, Severity } from "@/lib/schema";
import type { SessionRecord } from "@/lib/store";
import { diffPanels, daysBetween, type TimelineDiff } from "@/lib/timeline";
import { CountUp } from "./CountUp";
import { BBoxOverlay } from "./BBoxOverlay";
import { cn } from "@/lib/utils";

type Phase = "idle" | "running" | "done" | "error";

export function TimelineCompare({
  before,
  beforeImage,
  baselineDate,
}: {
  before: PanelAnalysis;
  beforeImage: string | undefined;
  baselineDate: number;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [after, setAfter] = useState<PanelAnalysis | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback((accepted: File[]) => {
    const f = accepted[0];
    if (!f) return;
    if (filePreview) URL.revokeObjectURL(filePreview);
    setFile(f);
    setFilePreview(URL.createObjectURL(f));
    setAfter(null);
    setError(null);
    setPhase("idle");
  }, [filePreview]);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: {
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "image/webp": [".webp"],
      "image/heic": [".heic"],
      "image/heif": [".heif"],
    },
    maxSize: 12 * 1024 * 1024,
    multiple: false,
    noClick: true,
  });

  const runAfter = useCallback(async () => {
    if (!file) return;
    setPhase("running");
    setProgress("uploading");
    setAfter(null);
    setError(null);

    const fd = new FormData();
    fd.append("images", file, file.name);

    let res: Response;
    try {
      res = await fetch("/api/analyze", { method: "POST", body: fd });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
      setPhase("error");
      return;
    }
    if (!res.ok || !res.body) {
      setError(`Request failed (${res.status})`);
      setPhase("error");
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let firstPanel: PanelAnalysis | null = null;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, idx).trim();
        buf = buf.slice(idx + 1);
        if (!line) continue;
        try {
          const evt = JSON.parse(line);
          if (evt.type === "progress") setProgress(String(evt.status ?? "analyzing"));
          if (evt.type === "panel" && !firstPanel) firstPanel = evt.data as PanelAnalysis;
          if (evt.type === "synthesizing") setProgress("synthesizing");
          if (evt.type === "fatal" || evt.type === "error") {
            // analyze errors during streaming — record but keep waiting in case panel landed earlier
            if (!firstPanel) setError(String(evt.error ?? "Analysis failed"));
          }
        } catch {
          /* noop */
        }
      }
    }

    if (firstPanel) {
      setAfter(firstPanel);
      setPhase("done");
    } else if (!error) {
      setError("No panel result returned");
      setPhase("error");
    }
  }, [file, error]);

  const diff: TimelineDiff | null = useMemo(() => (after ? diffPanels(before, after) : null), [before, after]);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SidePanel
          tag="BEFORE"
          subtag={new Date(baselineDate).toLocaleDateString()}
          panel={before}
          previewUrl={beforeImage}
        />
        <AfterColumn
          tag="AFTER"
          phase={phase}
          progress={progress}
          file={file}
          filePreview={filePreview}
          after={after}
          dropzone={{ getRootProps, getInputProps, isDragActive, open }}
          onRun={runAfter}
          onReset={() => {
            setFile(null);
            if (filePreview) URL.revokeObjectURL(filePreview);
            setFilePreview(null);
            setAfter(null);
            setPhase("idle");
            setError(null);
          }}
          error={error}
        />
      </div>

      {diff && after && (
        <DiffPanel before={before} after={after} diff={diff} baselineDate={baselineDate} />
      )}
    </div>
  );
}

function SidePanel({
  tag,
  subtag,
  panel,
  previewUrl,
}: {
  tag: string;
  subtag?: string;
  panel: PanelAnalysis;
  previewUrl?: string;
}) {
  const condColor = scoreColor(panel.conditionScore);
  const grounded = panel.defects.some((d) => Array.isArray(d.bbox));
  return (
    <div className="card-elev overflow-hidden">
      <div className="relative aspect-[16/10] bg-black overflow-hidden">
        {previewUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt={panel.fileName} className="w-full h-full object-cover" />
        )}
        {grounded && <BBoxOverlay defects={panel.defects} showLabels={false} />}
        <div className="absolute inset-0 cell-pattern opacity-15 pointer-events-none" />
        <div className="absolute top-3 left-3 flex items-center gap-2">
          <span className="font-mono text-[10.5px] tracking-[0.18em] uppercase text-white/85 px-2.5 py-1 rounded-full bg-black/55 backdrop-blur">
            {tag}
          </span>
          {subtag && (
            <span className="font-mono text-[10.5px] tracking-[0.18em] uppercase text-white/70 px-2.5 py-1 rounded-full bg-black/40 backdrop-blur">
              {subtag}
            </span>
          )}
        </div>
        <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between">
          <div>
            <div className="font-mono text-[10.5px] tracking-[0.16em] text-white/65">{panel.fileName}</div>
            <div className="font-serif text-white text-[22px] leading-tight">{panel.panelTypeGuess}</div>
          </div>
          <div className="text-right">
            <div className="tick text-white/55">Cond.</div>
            <div className="font-serif text-white text-[34px] leading-none" style={{ color: condColor }}>
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
        <div className="flex flex-wrap gap-1.5">
          {panel.defects.slice(0, 6).map((d, i) => (
            <span key={i} className={cn("severity-pill", d.severity)}>
              <span className="lowercase normal-case tracking-normal font-sans text-[11px]">{d.type}</span>
            </span>
          ))}
          {panel.defects.length === 0 && <span className="severity-pill low">no defects</span>}
        </div>
      </div>
    </div>
  );
}

function AfterColumn({
  tag,
  phase,
  progress,
  file,
  filePreview,
  after,
  dropzone,
  onRun,
  onReset,
  error,
}: {
  tag: string;
  phase: Phase;
  progress: string;
  file: File | null;
  filePreview: string | null;
  after: PanelAnalysis | null;
  dropzone: {
    getRootProps: ReturnType<typeof useDropzone>["getRootProps"];
    getInputProps: ReturnType<typeof useDropzone>["getInputProps"];
    isDragActive: boolean;
    open: () => void;
  };
  onRun: () => void;
  onReset: () => void;
  error: string | null;
}) {
  const { getRootProps, getInputProps, isDragActive, open } = dropzone;

  if (after && filePreview) {
    return <SidePanel tag={tag} subtag={new Date().toLocaleDateString()} panel={after} previewUrl={filePreview} />;
  }

  return (
    <div className="card-elev overflow-hidden flex flex-col">
      <div
        {...getRootProps()}
        className={cn(
          "dropzone relative scanline aspect-[16/10] flex flex-col items-center justify-center text-center cursor-default",
          isDragActive && "active"
        )}
      >
        <input {...getInputProps()} />
        <span className="absolute top-3 left-3 font-mono text-[10.5px] tracking-[0.18em] uppercase text-[var(--fg-mute)] px-2.5 py-1 rounded-full bg-[var(--surface-2)] border hairline">
          {tag}
        </span>

        {!filePreview && (
          <>
            <div
              className="w-12 h-12 rounded-full grid place-items-center mb-4"
              style={{ background: "var(--surface-2)", border: "1px solid var(--line-strong)" }}
            >
              <ImagePlus size={20} className="text-[var(--accent)]" />
            </div>
            <h3 className="font-serif text-[26px] md:text-[30px] leading-tight">
              Drop today&apos;s shot of this panel.
            </h3>
            <p className="body-md mt-2 max-w-xs px-3">
              We&apos;ll diff condition, defects, and efficiency loss against the baseline.
            </p>
            <button onClick={open} type="button" className="btn-primary mt-5">
              Choose file
            </button>
          </>
        )}

        {filePreview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={filePreview} alt="after" className="absolute inset-0 w-full h-full object-cover opacity-90" />
        )}

        {phase === "running" && filePreview && (
          <div className="absolute inset-0 grid place-items-center bg-black/55 backdrop-blur-sm">
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-black/55 border hairline-strong">
              <Loader2 size={14} className="animate-spin text-[var(--accent)]" />
              <span className="font-mono text-[12px] tracking-[0.16em] text-white/85 uppercase">
                {progress || "running"}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="p-5 flex items-center justify-between gap-3 flex-wrap">
        <div className="font-mono text-[12px] text-[var(--fg-mute)] truncate max-w-[60%]">
          {file ? file.name : "no file selected"}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {filePreview && phase !== "running" && !after && (
            <button onClick={onRun} className="btn-primary inline-flex items-center gap-2">
              <Sparkles size={14} />
              Run analysis
            </button>
          )}
          {filePreview && (
            <button onClick={onReset} className="btn-ghost text-sm inline-flex items-center gap-2">
              <RefreshCw size={13} /> Replace
            </button>
          )}
        </div>
      </div>
      {error && (
        <div className="px-5 pb-5">
          <div className="card p-3 border-[rgba(239,35,60,0.4)]">
            <div className="severity-pill critical mb-1">Error</div>
            <p className="body-md text-[13px]">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function DiffPanel({
  before,
  after,
  diff,
  baselineDate,
}: {
  before: PanelAnalysis;
  after: PanelAnalysis;
  diff: TimelineDiff;
  baselineDate: number;
}) {
  const days = daysBetween(baselineDate, Date.now());
  const verdictCopy =
    diff.verdict === "improved"
      ? { word: "Improved", color: "var(--sev-low)", icon: TrendingUp }
      : diff.verdict === "worsened"
        ? { word: "Worsening", color: "var(--sev-critical)", icon: TrendingDown }
        : { word: "Stable", color: "var(--accent-2)", icon: Sparkles };
  const Icon = verdictCopy.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-6"
    >
      <div className="card-elev p-7 md:p-8 relative overflow-hidden">
        <div
          className="absolute -right-24 -top-24 w-[440px] h-[440px] rounded-full opacity-25 blur-3xl pointer-events-none"
          style={{ background: `radial-gradient(circle, ${verdictCopy.color}, transparent 60%)` }}
        />
        <div className="flex items-center gap-3 mb-4">
          <Icon size={16} style={{ color: verdictCopy.color }} />
          <span className="tick">{days} {days === 1 ? "day" : "days"} apart</span>
        </div>
        <h3 className="h-display text-[36px] md:text-[52px] leading-[1.02]">
          <span style={{ color: verdictCopy.color }}>{verdictCopy.word}.</span>{" "}
          <span className="text-[var(--fg-dim)]">
            {diff.improvedDefectCount} better,{" "}
            {diff.worseDefectCount} worse.
          </span>
        </h3>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
          <DeltaStat label="Condition" before={before.conditionScore} after={after.conditionScore} decimals={0} />
          <DeltaStat label="Eff. loss" before={before.estimatedTotalEfficiencyLoss} after={after.estimatedTotalEfficiencyLoss} decimals={1} suffix="%" reverseGood />
          <DeltaStat label="Cleanliness" before={before.cleanlinessScore} after={after.cleanlinessScore} decimals={0} />
          <DeltaStat label="Defect count" before={before.defects.length} after={after.defects.length} decimals={0} reverseGood />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <DiffList
          title="New"
          icon={Plus}
          accent="var(--sev-critical)"
          items={diff.newDefects.map((d) => ({
            severity: d.severity,
            type: d.type,
            note: `${d.estimatedEfficiencyLoss.toFixed(1)}% · ${d.location}`,
          }))}
          empty="No new defects."
        />
        <DiffList
          title="Healed"
          icon={Minus}
          accent="var(--sev-low)"
          items={diff.healedDefects.map((d) => ({
            severity: d.severity,
            type: d.type,
            note: `was ${d.estimatedEfficiencyLoss.toFixed(1)}% · ${d.location}`,
          }))}
          empty="Nothing was repaired."
        />
        <DiffList
          title="Persistent"
          icon={RefreshCw}
          accent="var(--sev-medium)"
          items={diff.persistentDefects.map((m) => ({
            severity: m.after.severity,
            type: m.after.type,
            note: m.lossDeltaPct === 0
              ? "no change"
              : `${m.lossDeltaPct > 0 ? "+" : ""}${m.lossDeltaPct.toFixed(1)}% vs baseline${m.severityChanged ? ` · ${m.before.severity}→${m.after.severity}` : ""}`,
          }))}
          empty="No defects matched across both inspections."
        />
      </div>
    </motion.div>
  );
}

function DeltaStat({
  label,
  before,
  after,
  decimals,
  suffix = "",
  reverseGood = false,
}: {
  label: string;
  before: number;
  after: number;
  decimals: number;
  suffix?: string;
  reverseGood?: boolean;
}) {
  const delta = after - before;
  const isImprovement = reverseGood ? delta < 0 : delta > 0;
  const isWorse = reverseGood ? delta > 0 : delta < 0;
  const color = isImprovement ? "var(--sev-low)" : isWorse ? "var(--sev-critical)" : "var(--fg)";
  const Arrow = reverseGood ? (delta < 0 ? ArrowDownRight : ArrowUpRight) : delta > 0 ? ArrowUpRight : ArrowDownRight;
  const showDelta = Math.abs(delta) >= (decimals === 0 ? 1 : 0.05);
  return (
    <div className="card p-4">
      <div className="tick">{label}</div>
      <div className="flex items-baseline justify-between mt-1.5 gap-2">
        <div className="font-serif text-[28px] md:text-[34px] leading-none">
          <CountUp to={after} decimals={decimals} />
          <span className="text-[var(--fg-mute)] text-[14px] ml-0.5">{suffix}</span>
        </div>
        {showDelta && (
          <div className="font-mono text-[12px] flex items-center gap-1" style={{ color }}>
            <Arrow size={12} />
            {Math.abs(delta).toFixed(decimals)}
            {suffix.trim() ? suffix : ""}
          </div>
        )}
      </div>
      <div className="font-mono text-[11px] text-[var(--fg-mute)] mt-1">
        was {before.toFixed(decimals)}{suffix}
      </div>
    </div>
  );
}

function DiffList({
  title,
  icon: Icon,
  accent,
  items,
  empty,
}: {
  title: string;
  icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;
  accent: string;
  items: { severity: Severity; type: string; note: string }[];
  empty: string;
}) {
  return (
    <div className="card-elev p-5 md:p-6">
      <div className="flex items-center gap-2 mb-4">
        <Icon size={14} style={{ color: accent }} />
        <span className="tick" style={{ color: accent }}>{title}</span>
        <span className="font-mono text-[11px] text-[var(--fg-mute)] ml-auto">{items.length}</span>
      </div>
      {items.length === 0 && (
        <p className="body-md text-[13.5px] text-[var(--fg-mute)]">{empty}</p>
      )}
      <AnimatePresence>
        {items.map((d, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.04, ease: [0.16, 1, 0.3, 1] }}
            className="flex items-start gap-3 py-3 border-t hairline first:border-t-0 first:pt-0"
          >
            <span className={cn("severity-pill mt-0.5 shrink-0", d.severity)}>{d.severity}</span>
            <div className="min-w-0">
              <div className="font-serif text-[18px] leading-tight">{d.type}</div>
              <div className="font-mono text-[11.5px] text-[var(--fg-mute)] mt-0.5 truncate">{d.note}</div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
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

// Suppress unused export
export type _SessionRecord = SessionRecord;
