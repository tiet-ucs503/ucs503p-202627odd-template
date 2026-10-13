"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UploadZone, type StagedFile } from "./UploadZone";
import { AnalysisCard, type Pending } from "./AnalysisCard";
import { ReportDashboard } from "./ReportDashboard";
import { PanelReportSheet } from "./PanelReportSheet";
import { OverviewCard, type DetectedBox } from "./OverviewCard";
import { loadSamplesByIds } from "@/lib/samples";
import { newSessionId, saveSession } from "@/lib/store";
import { fileToDataUrl } from "@/lib/imageDataUrl";
import type { BBox, FullAnalysis, PanelAnalysis } from "@/lib/schema";

type Phase = "idle" | "running" | "synthesizing" | "complete" | "error";

type DetectedSource = {
  fileName: string;
  width: number;
  height: number;
  boxes: DetectedBox[];
};

export function SolpopApp() {
  const [files, setFiles] = useState<StagedFile[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [pending, setPending] = useState<Record<string, Pending>>({});
  const [panels, setPanels] = useState<PanelAnalysis[]>([]);
  const [detected, setDetected] = useState<Record<string, DetectedSource>>({});
  const [rejected, setRejected] = useState<
    Record<string, { reason: string; imageDescription: string; confidence: number }>
  >({});
  const [report, setReport] = useState<FullAnalysis | null>(null);
  const [topError, setTopError] = useState<string | null>(null);
  const [openPanelId, setOpenPanelId] = useState<string | null>(null);
  const [savedSessionId, setSavedSessionId] = useState<string | null>(null);
  const [savingSession, setSavingSession] = useState(false);

  const previewByName = useMemo(() => {
    const m: Record<string, string> = {};
    for (const f of files) m[f.file.name] = f.previewUrl;
    return m;
  }, [files]);

  useEffect(() => {
    return () => {
      for (const f of files) URL.revokeObjectURL(f.previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Sample-gallery deep-link: ?samples=01,02&auto=1 -----------------------
  const samplesAutoLoadedRef = useRef(false);
  const pendingAutoAnalyze = useRef(false);
  useEffect(() => {
    if (samplesAutoLoadedRef.current) return;
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const ids = (params.get("samples") || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (ids.length === 0) return;
    samplesAutoLoadedRef.current = true;
    pendingAutoAnalyze.current = params.get("auto") !== "0";

    (async () => {
      try {
        const fetched = await loadSamplesByIds(ids);
        if (fetched.length === 0) return;
        const staged: StagedFile[] = fetched.map((file) => ({
          id: `${file.name}-${file.size}-${crypto.randomUUID().slice(0, 8)}`,
          file,
          previewUrl: URL.createObjectURL(file),
        }));
        setFiles(staged);
        // strip query params after consumption (keep hash)
        const hash = window.location.hash;
        window.history.replaceState({}, "", window.location.pathname + hash);
        // scroll to workspace
        requestAnimationFrame(() => {
          document.getElementById("analyze")?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      } catch (e) {
        setTopError(e instanceof Error ? e.message : "Failed to load samples");
      }
    })();
  }, []);

  const reset = useCallback(() => {
    setPhase("idle");
    setPending({});
    setPanels([]);
    setDetected({});
    setRejected({});
    setReport(null);
    setTopError(null);
    setSavedSessionId(null);
  }, []);

  const onAnalyze = useCallback(async () => {
    if (files.length === 0) return;
    setPhase("running");
    setReport(null);
    setPanels([]);
    setDetected({});
    setRejected({});
    setTopError(null);
    setSavedSessionId(null);
    const initial: Record<string, Pending> = {};
    for (const f of files) initial[f.file.name] = { fileName: f.file.name, status: "queued" };
    setPending(initial);

    const fd = new FormData();
    for (const f of files) fd.append("images", f.file, f.file.name);

    let res: Response;
    try {
      res = await fetch("/api/analyze", { method: "POST", body: fd });
    } catch (e) {
      setTopError(e instanceof Error ? e.message : "Network error");
      setPhase("error");
      return;
    }

    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => "");
      setTopError(text || `Request failed (${res.status})`);
      setPhase("error");
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";

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
          handleEvent(evt);
        } catch {
          /* ignore malformed lines */
        }
      }
    }
    if (buf.trim()) {
      try { handleEvent(JSON.parse(buf)); } catch { /* noop */ }
    }

    function handleEvent(evt: { type: string; [k: string]: unknown }) {
      switch (evt.type) {
        case "detected": {
          const fileName = String(evt.fileName);
          const list = (evt.panels as Array<{ index: number; bbox: BBox; confidence: number }>) ?? [];
          setDetected((prev) => ({
            ...prev,
            [fileName]: {
              fileName,
              width: Number(evt.width ?? 0),
              height: Number(evt.height ?? 0),
              boxes: list.map((p) => ({ index: p.index, bbox: p.bbox })),
            },
          }));
          break;
        }
        case "progress": {
          const fileName = String(evt.fileName);
          setPending((p) => ({ ...p, [fileName]: { fileName, status: "analyzing" } }));
          break;
        }
        case "panel": {
          const panel = evt.data as PanelAnalysis;
          setPanels((arr) => [...arr, panel]);
          setPending((p) => ({
            ...p,
            [panel.fileName]: { fileName: panel.fileName, status: "done" },
          }));
          break;
        }
        case "error": {
          const fileName = String(evt.fileName);
          setPending((p) => ({
            ...p,
            [fileName]: { fileName, status: "failed", error: String(evt.error ?? "Failed") },
          }));
          break;
        }
        case "rejected": {
          const fileName = String(evt.fileName);
          const reason = String(evt.reason ?? "Not a solar panel");
          const imageDescription = String(evt.imageDescription ?? "");
          const confidence = Number(evt.confidence ?? 0);
          setPending((p) => ({
            ...p,
            [fileName]: {
              fileName,
              status: "failed",
              error: `Not a solar panel: ${reason}`,
            },
          }));
          setRejected((r) => ({
            ...r,
            [fileName]: { reason, imageDescription, confidence },
          }));
          break;
        }
        case "synthesizing":
          setPhase("synthesizing");
          break;
        case "report":
          setReport(evt.data as FullAnalysis);
          setPhase("complete");
          break;
        case "synthesis_error":
          setTopError(String(evt.error ?? "Synthesis failed"));
          setPhase("error");
          break;
        case "fatal":
          setTopError(String(evt.error ?? "Analysis failed"));
          setPhase("error");
          break;
      }
    }
  }, [files]);

  // After samples auto-load, fire analysis once
  useEffect(() => {
    if (!pendingAutoAnalyze.current) return;
    if (files.length === 0) return;
    if (phase !== "idle") return;
    pendingAutoAnalyze.current = false;
    onAnalyze();
  }, [files, phase, onAnalyze]);

  // Persist completed session to IndexedDB so user can revisit later
  useEffect(() => {
    if (!report) return;
    if (savedSessionId) return;
    if (savingSession) return;
    setSavingSession(true);
    (async () => {
      try {
        const sourceThumbnails: Record<string, string> = {};
        for (const f of files) {
          try {
            sourceThumbnails[f.file.name] = await fileToDataUrl(f.file, { maxEdge: 720 });
          } catch (e) {
            console.warn("Thumbnail failed for", f.file.name, e);
          }
        }
        const heroThumb =
          report.panels.find((p) => p.imageDataUrl)?.imageDataUrl ||
          sourceThumbnails[Object.keys(sourceThumbnails)[0] ?? ""] ||
          "";
        const id = newSessionId();
        await saveSession({
          id,
          createdAt: Date.now(),
          label: `Inspection · ${new Date().toLocaleString()}`,
          panelCount: report.panels.length,
          criticalCount: report.report.criticalCount,
          highCount: report.report.highCount,
          fleetHealthScore: report.report.fleetHealthScore,
          fleetEfficiencyLossPct: report.report.fleetEfficiencyLossPct,
          thumbnail: heroThumb,
          data: report,
          sourceThumbnails,
        });
        setSavedSessionId(id);
      } catch (e) {
        console.error("saveSession failed", e);
      } finally {
        setSavingSession(false);
      }
    })();
  }, [report, savedSessionId, savingSession, files]);

  const downloadJson = useCallback(() => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `solpop-report-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [report]);

  const busy = phase === "running" || phase === "synthesizing";
  const hasResults =
    panels.length > 0 || Object.keys(detected).length > 0 || phase === "synthesizing" || phase === "complete";

  // Build an ordered render-list:
  //   for each uploaded source file, in original order:
  //     - if 2+ panels detected: emit overview card, then panel cards for that source
  //     - else: emit one panel card (or its pending placeholder)
  const renderItems = useMemo(() => {
    type Item =
      | { kind: "overview"; sourceName: string }
      | { kind: "panel"; sourceName: string; panel?: PanelAnalysis; pendingKey: string; cardIndex: number };
    const items: Item[] = [];

    for (const f of files) {
      const sourceName = f.file.name;
      const det = detected[sourceName];
      const panelsForSource = panels.filter((p) => p.sourceFileName === sourceName);
      const isMulti = (det?.boxes.length ?? 0) >= 2;

      if (isMulti) {
        items.push({ kind: "overview", sourceName });
        // One panel card per detected box (matched by sourceIndex)
        for (const b of det!.boxes) {
          const panel = panelsForSource.find((p) => p.sourceIndex === b.index);
          const key = `${sourceName}#${b.index + 1}`;
          items.push({ kind: "panel", sourceName, panel, pendingKey: key, cardIndex: b.index });
        }
      } else {
        // single-panel source. panel.fileName = sourceName (post-analysis). pending key matches sourceName.
        const panel = panelsForSource[0];
        items.push({
          kind: "panel",
          sourceName,
          panel,
          pendingKey: panel?.fileName ?? sourceName,
          cardIndex: 0,
        });
      }
    }
    return items;
  }, [files, detected, panels]);

  const openPanel = openPanelId ? panels.find((p) => p.panelId === openPanelId) ?? null : null;
  const openPanelPreviewUrl = (() => {
    if (!openPanel) return undefined;
    if (openPanel.imageDataUrl) return openPanel.imageDataUrl;
    return previewByName[openPanel.sourceFileName ?? openPanel.fileName];
  })();

  return (
    <section id="analyze" className="relative">
      <div className="max-w-[1400px] mx-auto px-6 md:px-10 py-20 md:py-28 space-y-12">
        <div className="flex items-end justify-between flex-wrap gap-6">
          <div>
            <div className="tick mb-3">Inspection workspace</div>
            <h2 className="h-display text-[44px] md:text-[72px]">Inspect a fleet.</h2>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {savedSessionId && (
              <a
                href={`/chat/${savedSessionId}`}
                className="btn-primary text-sm inline-flex items-center gap-2 !py-2.5 !px-4"
              >
                Chat with report
              </a>
            )}
            {savedSessionId && (
              <a
                href={`/simulator/${savedSessionId}`}
                className="btn-ghost text-sm inline-flex items-center gap-2"
              >
                What-if simulator
              </a>
            )}
            {savedSessionId && (
              <a
                href={`/sessions/${savedSessionId}`}
                className="btn-ghost text-sm inline-flex items-center gap-2"
              >
                Saved · open later
              </a>
            )}
            {(hasResults || files.length > 0) && (
              <button
                onClick={() => {
                  reset();
                  setFiles((curr) => {
                    for (const f of curr) URL.revokeObjectURL(f.previewUrl);
                    return [];
                  });
                }}
                className="btn-ghost text-sm"
              >
                Reset session
              </button>
            )}
          </div>
        </div>

        <UploadZone files={files} setFiles={setFiles} onAnalyze={onAnalyze} busy={busy} />

        <AnimatePresence>
          {topError && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="card p-5 border-[rgba(239,35,60,0.4)]"
            >
              <div className="severity-pill critical mb-2">Error</div>
              <p className="text-[var(--fg-dim)] text-[14px]">{topError}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {Object.keys(rejected).length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="card p-4 border-[rgba(255,176,32,0.4)]"
            >
              <p className="text-[var(--fg-dim)] text-[14px]">
                {Object.keys(rejected).length} file(s) skipped — not solar panels.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {hasResults && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="flex items-center gap-3">
                <span className={`inline-block w-2 h-2 rounded-full ${phase === "complete" ? "bg-[var(--sev-low)]" : "bg-[var(--accent)] animate-pulse"}`} />
                <span className="tick">
                  {phase === "running" && "Running multimodal inspection"}
                  {phase === "synthesizing" && "Synthesizing executive report"}
                  {phase === "complete" && "Inspection complete"}
                  {phase === "error" && "Inspection halted"}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {renderItems.map((item, idx) => {
                  if (item.kind === "overview") {
                    const det = detected[item.sourceName];
                    return (
                      <OverviewCard
                        key={`ov-${item.sourceName}`}
                        fileName={item.sourceName}
                        previewUrl={previewByName[item.sourceName]}
                        detected={det.boxes}
                        panels={panels}
                        onOpen={(id) => setOpenPanelId(id)}
                      />
                    );
                  }
                  const pend =
                    pending[item.pendingKey] ??
                    pending[item.sourceName] ?? {
                      fileName: item.pendingKey,
                      status: "queued" as const,
                    };
                  return (
                    <AnalysisCard
                      key={`p-${item.pendingKey}`}
                      pending={pend}
                      panel={item.panel}
                      previewUrl={
                        item.panel?.imageDataUrl || previewByName[item.sourceName]
                      }
                      index={idx}
                      onOpen={item.panel ? () => setOpenPanelId(item.panel!.panelId) : undefined}
                    />
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {report && (
            <ReportDashboard
              data={report}
              onDownload={downloadJson}
              onOpenPanel={(id) => setOpenPanelId(id)}
            />
          )}
        </AnimatePresence>
      </div>

      <PanelReportSheet
        panel={openPanel}
        previewUrl={openPanelPreviewUrl}
        index={Math.max(0, panels.findIndex((p) => p.panelId === openPanelId))}
        total={panels.length}
        sessionId={savedSessionId ?? undefined}
        onClose={() => setOpenPanelId(null)}
      />
    </section>
  );
}
