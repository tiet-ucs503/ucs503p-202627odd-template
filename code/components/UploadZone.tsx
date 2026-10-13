"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { motion, AnimatePresence } from "framer-motion";
import { ImagePlus, X, FileImage, Camera, Film, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { WebcamCapture } from "./WebcamCapture";
import { extractFrames } from "@/lib/videoFrames";

export type StagedFile = {
  id: string;
  file: File;
  previewUrl: string;
};

export function UploadZone({
  files,
  setFiles,
  onAnalyze,
  busy,
}: {
  files: StagedFile[];
  setFiles: (next: StagedFile[]) => void;
  onAnalyze: () => void;
  busy: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [webcamOpen, setWebcamOpen] = useState(false);
  const [frameCount, setFrameCount] = useState(8);
  const [extracting, setExtracting] = useState<{ done: number; total: number } | null>(null);

  const stage = useCallback(
    (incoming: File[]) => {
      const next: StagedFile[] = incoming.slice(0, 24).map((file) => ({
        id: `${file.name}-${file.size}-${crypto.randomUUID().slice(0, 8)}`,
        file,
        previewUrl: URL.createObjectURL(file),
      }));
      const merged = [...files, ...next].slice(0, 24);
      setFiles(merged);
    },
    [files, setFiles]
  );

  const handleVideo = useCallback(
    async (video: File) => {
      setError(null);
      setExtracting({ done: 0, total: frameCount });
      try {
        const frames = await extractFrames(video, {
          frameCount,
          onProgress: (i, total) => setExtracting({ done: i, total }),
        });
        stage(frames);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Frame extraction failed");
      } finally {
        setExtracting(null);
      }
    },
    [frameCount, stage]
  );

  const onDrop = useCallback(
    (accepted: File[]) => {
      setError(null);
      const videos: File[] = [];
      const images: File[] = [];
      for (const f of accepted) {
        if (f.type.startsWith("video/")) videos.push(f);
        else images.push(f);
      }
      if (images.length) stage(images);
      // Take first video; ignore additional videos to keep flow predictable
      if (videos.length > 0) handleVideo(videos[0]);
    },
    [stage, handleVideo]
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: {
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "image/webp": [".webp"],
      "image/heic": [".heic"],
      "image/heif": [".heif"],
      "video/mp4": [".mp4", ".m4v"],
      "video/quicktime": [".mov"],
      "video/webm": [".webm"],
    },
    maxSize: 60 * 1024 * 1024,
    multiple: true,
    noClick: true,
    onDropRejected: (rej) => {
      const first = rej[0];
      setError(first?.errors[0]?.message ?? "Some files were rejected");
    },
  });

  function remove(id: string) {
    const f = files.find((x) => x.id === id);
    if (f) URL.revokeObjectURL(f.previewUrl);
    setFiles(files.filter((x) => x.id !== id));
  }

  return (
    <div className="space-y-6">
      <div
        {...getRootProps()}
        className={cn(
          "dropzone relative scanline px-6 py-16 md:py-20 text-center cursor-default",
          isDragActive && "active"
        )}
      >
        <input {...getInputProps()} />

        <div className="mx-auto w-14 h-14 rounded-full grid place-items-center mb-6"
          style={{ background: "var(--surface-2)", border: "1px solid var(--line-strong)" }}>
          <ImagePlus size={22} className="text-[var(--accent)]" />
        </div>

        <h3 className="font-serif text-[42px] md:text-[58px] leading-[1] tracking-[-0.03em]">
          Drop panel imagery here
        </h3>
        <p className="mt-4 body-md max-w-lg mx-auto">
          JPEG · PNG · WebP · HEIC up to 12&nbsp;MB. Single shot or full fleet, up to 24 panels per run.
        </p>

        <div className="mt-7 flex items-center justify-center gap-3 flex-wrap">
          <button type="button" onClick={open} className="btn-primary">
            Choose files
          </button>
          <button
            type="button"
            onClick={() => setWebcamOpen(true)}
            className="btn-ghost inline-flex items-center gap-2"
          >
            <Camera size={14} className="text-[var(--accent)]" />
            Webcam
          </button>
          <span className="text-[var(--fg-mute)] text-sm">
            or drag &amp; drop · <span className="kbd">⌘V</span> to paste
          </span>
        </div>

        <div className="mt-5 flex items-center justify-center gap-3 flex-wrap text-[12.5px] text-[var(--fg-mute)]">
          <span className="font-mono inline-flex items-center gap-2">
            <Film size={12} className="text-[var(--accent)]" />
            Or drop a flyover MP4 / MOV / WebM —
          </span>
          <label className="font-mono inline-flex items-center gap-2">
            sample
            <select
              value={frameCount}
              onChange={(e) => setFrameCount(Number(e.target.value))}
              className="bg-[var(--surface-2)] border hairline-strong rounded-md px-2 py-1 text-[var(--fg)] text-[12px]"
              style={{ color: "var(--fg)" }}
            >
              {[4, 6, 8, 12, 16].map((n) => (
                <option key={n} value={n} style={{ background: "var(--surface)", color: "var(--fg)" }}>
                  {n}
                </option>
              ))}
            </select>
            frames
          </label>
        </div>

        {extracting && (
          <div className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--surface-2)] border hairline-strong">
            <Loader2 size={13} className="animate-spin text-[var(--accent)]" />
            <span className="font-mono text-[12px] text-[var(--fg-dim)]">
              extracting frame {extracting.done}/{extracting.total}
            </span>
          </div>
        )}

        {error && (
          <div className="mt-6 inline-block severity-pill critical">{error}</div>
        )}
      </div>

      <AnimatePresence>
        {files.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-5"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileImage size={16} className="text-[var(--fg-dim)]" />
                <span className="tick">Queue · {files.length} {files.length === 1 ? "panel" : "panels"}</span>
              </div>
              <button
                type="button"
                onClick={onAnalyze}
                disabled={busy || files.length === 0}
                className="btn-primary"
              >
                {busy ? "Analyzing…" : `Analyze ${files.length} ${files.length === 1 ? "panel" : "panels"}`}
              </button>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
              {files.map((f) => (
                <motion.div
                  key={f.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="card relative aspect-square overflow-hidden group"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={f.previewUrl}
                    alt={f.file.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent" />
                  <div className="absolute bottom-2 left-2 right-2 font-mono text-[10px] truncate text-white/80">
                    {f.file.name}
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(f.id)}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 hover:bg-black/80 grid place-items-center transition-opacity opacity-0 group-hover:opacity-100"
                    aria-label="Remove"
                  >
                    <X size={14} />
                  </button>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <WebcamCapture
        open={webcamOpen}
        onClose={() => setWebcamOpen(false)}
        onConfirm={(captured) => stage(captured)}
      />
    </div>
  );
}
