"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Circle, RefreshCcw, RotateCcw, X, Check, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Snap = { id: string; dataUrl: string; blob: Blob };

export function WebcamCapture({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (files: File[]) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [mirror, setMirror] = useState(true);
  const [snaps, setSnaps] = useState<Snap[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [flashOn, setFlashOn] = useState(false);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop();
      streamRef.current = null;
    }
    setReady(false);
  }, []);

  const startStream = useCallback(
    async (preferredId?: string) => {
      setError(null);
      try {
        if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
          throw new Error("Camera API unavailable in this browser");
        }
        stopStream();
        const constraints: MediaStreamConstraints = {
          audio: false,
          video: preferredId
            ? { deviceId: { exact: preferredId } }
            : { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
        setReady(true);

        // Populate device list once permission granted
        try {
          const list = await navigator.mediaDevices.enumerateDevices();
          const cams = list.filter((d) => d.kind === "videoinput");
          setDevices(cams);
          const active = stream.getVideoTracks()[0]?.getSettings().deviceId;
          if (active) setDeviceId(active);
        } catch {
          /* enumerateDevices may fail on some browsers — non-fatal */
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
      }
    },
    [stopStream]
  );

  useEffect(() => {
    if (!open) return;
    startStream();
    return () => {
      stopStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!open) return;
      if (e.key === "Escape") onClose();
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        capture();
      }
    }
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function capture() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !ready) return;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (w === 0 || h === 0) return;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (mirror) {
      ctx.save();
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, w, h);
      ctx.restore();
    } else {
      ctx.drawImage(video, 0, 0, w, h);
    }

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
        const id = `${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`;
        setSnaps((curr) => [...curr, { id, dataUrl, blob }]);
        // shutter flash
        setFlashOn(true);
        setTimeout(() => setFlashOn(false), 130);
      },
      "image/jpeg",
      0.92
    );
  }

  function removeSnap(id: string) {
    setSnaps((curr) => curr.filter((s) => s.id !== id));
  }

  function clearAll() {
    setSnaps([]);
  }

  function confirm() {
    if (snaps.length === 0) return;
    const files = snaps.map((s, i) => {
      const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      return new File([s.blob], `webcam-${ts}-${i + 1}.jpg`, { type: "image/jpeg" });
    });
    onConfirm(files);
    setSnaps([]);
    stopStream();
    onClose();
  }

  function switchDevice() {
    if (devices.length <= 1) return;
    const ids = devices.map((d) => d.deviceId);
    const idx = deviceId ? ids.indexOf(deviceId) : 0;
    const next = ids[(idx + 1) % ids.length];
    setDeviceId(next);
    startStream(next);
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md no-print"
            onClick={onClose}
          />
          <motion.div
            key="modal"
            initial={{ opacity: 0, y: 12, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.99 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[min(1100px,94vw)] max-h-[92vh] flex flex-col card-elev overflow-hidden no-print"
          >
            <div className="px-6 py-4 border-b hairline flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Camera size={16} className="text-[var(--accent)]" />
                <span className="tick">Webcam capture</span>
                {snaps.length > 0 && (
                  <span className="font-mono text-[12px] text-[var(--fg-mute)]">
                    {snaps.length} {snaps.length === 1 ? "shot" : "shots"} ready
                  </span>
                )}
              </div>
              <button
                onClick={onClose}
                className="w-9 h-9 rounded-full grid place-items-center border hairline-strong hover:border-[var(--accent)] transition-colors"
                aria-label="Close"
              >
                <X size={15} />
              </button>
            </div>

            <div className="relative flex-1 min-h-0 bg-black overflow-hidden">
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                className={cn(
                  "absolute inset-0 w-full h-full object-contain bg-black",
                  mirror && "scale-x-[-1]"
                )}
              />
              <canvas ref={canvasRef} className="hidden" />

              <AnimatePresence>
                {flashOn && (
                  <motion.div
                    key="flash"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.55 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="absolute inset-0 bg-white pointer-events-none"
                  />
                )}
              </AnimatePresence>

              {!ready && !error && (
                <div className="absolute inset-0 grid place-items-center text-white/70 font-mono text-[12px] tracking-[0.16em] uppercase">
                  Requesting camera…
                </div>
              )}

              {error && (
                <div className="absolute inset-0 grid place-items-center px-6 text-center">
                  <div>
                    <div className="severity-pill critical mb-3">camera unavailable</div>
                    <p className="body-md max-w-md mx-auto text-white/80">{error}</p>
                  </div>
                </div>
              )}

              {/* Bottom bar overlaid */}
              <div className="absolute bottom-0 inset-x-0 px-5 py-4 flex items-center justify-between gap-3 bg-gradient-to-t from-black/70 to-transparent pointer-events-none">
                <button
                  type="button"
                  onClick={() => setMirror((v) => !v)}
                  className="pointer-events-auto font-mono text-[11px] tracking-[0.14em] uppercase px-3 py-1.5 rounded-full border border-white/20 text-white/85 bg-black/40 backdrop-blur hover:border-white/60 transition-colors"
                  title="Toggle mirror"
                >
                  <RotateCcw size={12} className="inline -mt-0.5 mr-1" />
                  {mirror ? "Mirror ON" : "Mirror OFF"}
                </button>

                <button
                  type="button"
                  onClick={capture}
                  disabled={!ready}
                  aria-label="Take photo"
                  className="pointer-events-auto relative w-[68px] h-[68px] rounded-full grid place-items-center transition-transform hover:scale-105 active:scale-95 disabled:opacity-50"
                  style={{ background: "var(--accent)", boxShadow: "0 0 0 4px #0a0a0a, 0 0 0 6px var(--accent)" }}
                >
                  <Circle size={18} className="text-[#0a0a0a]" fill="#0a0a0a" />
                </button>

                <button
                  type="button"
                  onClick={switchDevice}
                  disabled={devices.length <= 1}
                  className="pointer-events-auto font-mono text-[11px] tracking-[0.14em] uppercase px-3 py-1.5 rounded-full border border-white/20 text-white/85 bg-black/40 backdrop-blur hover:border-white/60 transition-colors disabled:opacity-40"
                  title="Switch camera"
                >
                  <RefreshCcw size={12} className="inline -mt-0.5 mr-1" />
                  Camera
                </button>
              </div>
            </div>

            {snaps.length > 0 && (
              <div className="border-t hairline px-5 py-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="tick">Captured</span>
                  <button
                    type="button"
                    onClick={clearAll}
                    className="font-mono text-[11px] text-[var(--fg-mute)] hover:text-[var(--sev-critical)] transition-colors inline-flex items-center gap-1"
                  >
                    <Trash2 size={11} /> Clear all
                  </button>
                </div>
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                  {snaps.map((s) => (
                    <div key={s.id} className="relative shrink-0 w-[112px] h-[68px] rounded-md overflow-hidden border hairline group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={s.dataUrl} alt="snap" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeSnap(s.id)}
                        className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/65 grid place-items-center opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label="Remove"
                      >
                        <X size={11} className="text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="border-t hairline px-6 py-4 flex items-center justify-between">
              <div className="font-mono text-[11px] text-[var(--fg-mute)]">
                Space / Enter to shoot · Esc to close
              </div>
              <button
                type="button"
                onClick={confirm}
                disabled={snaps.length === 0}
                className="btn-primary inline-flex items-center gap-2"
              >
                <Check size={14} />
                Add {snaps.length} to queue
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
