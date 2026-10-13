"use client";

import { useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import type { FullAnalysis, SystemReport } from "@/lib/schema";
import { saveSession, type SessionRecord } from "@/lib/store";
import { cn } from "@/lib/utils";

const PERSONAS = [
  { id: "engineer", label: "Senior engineer" },
  { id: "junior", label: "Junior tech" },
  { id: "claims", label: "Claims adjuster" },
  { id: "investor", label: "Asset owner" },
] as const;

const LOCALES = [
  { id: "en", label: "English" },
  { id: "es", label: "Español" },
  { id: "pt", label: "Português" },
  { id: "hi", label: "हिन्दी" },
  { id: "fr", label: "Français" },
  { id: "de", label: "Deutsch" },
  { id: "zh", label: "中文" },
] as const;

export function ResynthControls({
  session,
  onUpdated,
}: {
  session: SessionRecord;
  onUpdated: (next: SessionRecord) => void;
}) {
  const [persona, setPersona] = useState<typeof PERSONAS[number]["id"]>("engineer");
  const [locale, setLocale] = useState<typeof LOCALES[number]["id"]>("en");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function regenerate() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ panels: session.data.panels, persona, locale }),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || `Request failed (${res.status})`);
      }
      const j = (await res.json()) as { report: SystemReport };
      const nextData: FullAnalysis = { ...session.data, report: j.report };
      const nextRecord: SessionRecord = {
        ...session,
        data: nextData,
        criticalCount: j.report.criticalCount,
        highCount: j.report.highCount,
        fleetHealthScore: j.report.fleetHealthScore,
        fleetEfficiencyLossPct: j.report.fleetEfficiencyLossPct,
      };
      await saveSession(nextRecord);
      onUpdated(nextRecord);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card-elev p-5 md:p-6">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div className="flex items-center gap-3">
          <RefreshCw size={14} className="text-[var(--accent)]" />
          <span className="tick">Regenerate report</span>
          <span className="font-mono text-[11.5px] text-[var(--fg-mute)]">
            same panels · different voice
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3 items-end">
        <Select label="Voice" value={persona} onChange={(v) => setPersona(v as typeof persona)} options={PERSONAS} />
        <Select label="Language" value={locale} onChange={(v) => setLocale(v as typeof locale)} options={LOCALES} />
        <button
          type="button"
          onClick={regenerate}
          disabled={busy}
          className="btn-primary inline-flex items-center gap-2 justify-center"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          {busy ? "Regenerating…" : "Run synthesis"}
        </button>
      </div>

      {error && (
        <div className="card p-3 mt-3 border-[rgba(239,35,60,0.4)]">
          <div className="severity-pill critical mb-1">Error</div>
          <p className="body-md text-[13px]">{error}</p>
        </div>
      )}
    </div>
  );
}

function Select<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: readonly { id: T; label: string }[];
}) {
  return (
    <label className="block">
      <div className="tick mb-1.5">{label}</div>
      <div className={cn("card", "px-3 py-2 flex items-center gap-2 cursor-pointer focus-within:border-[var(--accent)]")}>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value as T)}
          className="bg-transparent w-full outline-none font-sans text-[14.5px] text-[var(--fg)]"
          style={{ color: "var(--fg)" }}
        >
          {options.map((o) => (
            <option key={o.id} value={o.id} style={{ background: "var(--surface)", color: "var(--fg)" }}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    </label>
  );
}
