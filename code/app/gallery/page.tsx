"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowUpRight, Crosshair, Sparkles, Loader2 } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SAMPLES } from "@/lib/samples";
import { cn } from "@/lib/utils";

export default function GalleryPage() {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);

  function go(ids: string[], auto = true) {
    const q = `samples=${ids.join(",")}${auto ? "&auto=1" : ""}`;
    router.push(`/inspect?${q}`);
  }

  return (
    <>
      <Header />
      <main className="flex-1">
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 grid-bg opacity-30 pointer-events-none" />
          <div className="absolute -top-32 right-[-10%] w-[520px] h-[520px] rounded-full blur-3xl opacity-50 pointer-events-none"
            style={{ background: "radial-gradient(circle, var(--accent-glow), transparent 60%)" }} />

          <div className="relative max-w-[1400px] mx-auto px-6 md:px-10 pt-20 md:pt-32 pb-12 md:pb-16">
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              className="flex items-center gap-3 mb-10"
            >
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-[var(--accent)] shadow-[0_0_22px_var(--accent-glow)]" />
              <span className="tick">Sample gallery · zero-friction demo</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
              className="h-display text-[56px] md:text-[112px] lg:text-[136px]"
            >
              No panels?<br />
              <span className="text-[var(--fg-dim)]">try </span>
              <em className="italic text-[var(--accent-2)]">these</em>
              <span className="text-[var(--fg-dim)]">.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.85, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
              className="mt-8 max-w-[60ch] body-lg"
            >
              Six real solar panel photos, bundled and ready to push through the live SOLPOP
              pipeline. Click any tile to run inspection on that single image, or hit
              &ldquo;Run the full demo&rdquo; below to feed all six in one shot.
            </motion.p>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.7, delay: 0.35 }}
              className="mt-10 flex flex-wrap items-center gap-4"
            >
              <button
                disabled={bulkLoading}
                onClick={() => {
                  setBulkLoading(true);
                  go(SAMPLES.map((s) => s.id));
                }}
                className="btn-primary inline-flex items-center gap-2"
              >
                {bulkLoading ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                Run the full demo
              </button>
              <button
                onClick={() => go(["04"])}
                className="btn-ghost inline-flex items-center gap-2"
              >
                <Crosshair size={14} className="text-[var(--accent)]" />
                Multi-panel split (one image, many modules)
              </button>
            </motion.div>
          </div>

          <div className="divider" />
        </section>

        <section className="relative">
          <div className="max-w-[1400px] mx-auto px-6 md:px-10 py-16 md:py-20">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {SAMPLES.map((s, idx) => {
                const loading = loadingId === s.id;
                return (
                  <motion.button
                    key={s.id}
                    type="button"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-10% 0px" }}
                    transition={{ duration: 0.7, delay: Math.min(idx * 0.06, 0.4), ease: [0.16, 1, 0.3, 1] }}
                    whileHover={{ y: -4 }}
                    onClick={() => {
                      setLoadingId(s.id);
                      go([s.id]);
                    }}
                    className={cn(
                      "card-elev card-interactive overflow-hidden flex flex-col text-left group p-0"
                    )}
                  >
                    <div className="relative aspect-[16/10] overflow-hidden bg-black">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={s.file}
                        alt={s.name}
                        className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent" />
                      <div className="absolute top-3 left-3 font-mono text-[10.5px] tracking-[0.18em] uppercase text-white/85 px-2.5 py-1 rounded-full bg-black/55 backdrop-blur">
                        {s.tag}
                      </div>
                      <div className="absolute top-3 right-3 w-9 h-9 rounded-full grid place-items-center bg-black/55 backdrop-blur opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        {loading ? <Loader2 size={14} className="animate-spin text-white" /> : <ArrowUpRight size={15} className="text-white" />}
                      </div>
                    </div>
                    <div className="p-6 space-y-2.5">
                      <div className="flex items-baseline justify-between gap-3">
                        <h3 className="font-serif text-[26px] md:text-[28px] leading-[1.05]">{s.name}</h3>
                        <span className="font-mono text-[11px] text-[var(--fg-mute)]">{s.id}</span>
                      </div>
                      <p className="body-md text-[15px] line-clamp-3">{s.hint}</p>
                      <div className="flex items-center justify-between pt-3 border-t hairline">
                        <span className="tick">Run inspection</span>
                        <ArrowUpRight size={16} className="text-[var(--fg-mute)] group-hover:text-[var(--accent)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-300" />
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
