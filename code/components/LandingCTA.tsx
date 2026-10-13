"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight, Crosshair, Sparkles, ImagePlus } from "lucide-react";

export function LandingCTA() {
  return (
    <section className="relative">
      <div className="max-w-[1400px] mx-auto px-6 md:px-10 py-28 md:py-36">
        <motion.div
          initial={{ opacity: 0, y: 22 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-15% 0px" }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          className="card-elev relative overflow-hidden scanline p-8 md:p-14"
        >
          <div
            className="absolute -right-20 -top-24 w-[520px] h-[520px] rounded-full opacity-40 blur-3xl pointer-events-none"
            style={{ background: "radial-gradient(circle, var(--accent-glow), transparent 60%)" }}
          />
          <div
            className="absolute -left-20 -bottom-24 w-[420px] h-[420px] rounded-full opacity-30 blur-3xl pointer-events-none"
            style={{ background: "radial-gradient(circle, var(--accent-glow-2), transparent 60%)" }}
          />

          <div className="relative grid md:grid-cols-[1.2fr_1fr] gap-10 md:gap-16 items-end">
            <div>
              <div className="tick mb-4">Try it in 60 seconds</div>
              <h2 className="h-display text-[44px] md:text-[80px] lg:text-[96px]">
                Drop a photo.<br />
                <span className="text-[var(--fg-dim)]">Get a verdict.</span>
              </h2>
              <p className="body-lg mt-6 max-w-[60ch]">
                One image, one button, one minute. Or jump straight into the gallery and run a
                pre-curated demo against six real solar panels.
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-3">
                <Link href="/inspect" className="btn-primary inline-flex items-center gap-2">
                  <ImagePlus size={15} />
                  Inspect a panel
                </Link>
                <Link href="/gallery" className="btn-ghost inline-flex items-center gap-2">
                  <Sparkles size={14} className="text-[var(--accent)]" />
                  Open the gallery
                  <ArrowUpRight size={14} />
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: Crosshair, k: "Multi-panel", v: "auto-segments wide drone shots" },
                { icon: Sparkles, k: "Live stream", v: "panels light up as they finish" },
                { icon: ImagePlus, k: "Drag & drop", v: "JPEG · PNG · WebP · HEIC up to 12 MB" },
                { icon: ArrowUpRight, k: "Per-panel deep dive", v: "click any card for full report" },
              ].map((b, i) => {
                const Icon = b.icon;
                return (
                  <motion.div
                    key={b.k}
                    initial={{ opacity: 0, y: 14 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-10% 0px" }}
                    transition={{ duration: 0.7, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
                    className="card p-5"
                  >
                    <Icon size={16} className="text-[var(--accent)] mb-3" />
                    <div className="font-serif text-[20px] leading-tight">{b.k}</div>
                    <div className="body-md text-[13.5px] mt-1.5">{b.v}</div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
