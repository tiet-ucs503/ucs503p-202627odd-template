"use client";

import { motion } from "framer-motion";
import { Camera, Eye, FileText } from "lucide-react";

const STEPS = [
  {
    icon: Camera,
    label: "01 · Capture",
    title: "Upload single or batch panel imagery",
    body: "JPEG, PNG, WebP, or HEIC. Drag &amp; drop a single shot or up to 24 panels per inspection, drone, ground, or thermal RGB composites accepted.",
  },
  {
    icon: Eye,
    label: "02 · See",
    title: "Frontier vision model inspects each panel",
    body: "Gemini multimodal grades each panel against a 21-defect taxonomy: cracks, hotspots, soiling, delamination, PID, busbar discoloration, frame and junction-box damage.",
  },
  {
    icon: FileText,
    label: "03 · Synthesize",
    title: "O&amp;M-grade report with prioritized actions",
    body: "Llama 3.3 aggregates findings into a fleet health score, severity heatmap, ranked risks, quantified energy loss, and a 7/30/90-day action ladder.",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="relative scroll-mt-24">
      <div className="max-w-[1400px] mx-auto px-6 md:px-10 py-28 md:py-36">
        <div className="flex items-end justify-between flex-wrap gap-8 mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-15% 0px" }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="tick mb-4">How it works</div>
            <h2 className="h-display text-[56px] md:text-[88px] lg:text-[104px]">
              Three steps.<br/>One verdict.
            </h2>
          </motion.div>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-15% 0px" }}
            transition={{ duration: 0.9, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="max-w-md body-lg"
          >
            SOLPOP pairs a vision model that sees what an inspector sees with a reasoning
            model that writes what an asset manager needs.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            return (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-12% 0px" }}
                transition={{ duration: 0.9, delay: i * 0.12, ease: [0.16, 1, 0.3, 1] }}
                whileHover={{ y: -4 }}
                className="card-elev p-8 md:p-9 relative overflow-hidden scanline transition-shadow duration-500 hover:shadow-[0_30px_70px_-30px_rgba(0,0,0,0.7)]"
              >
                <div className="absolute -right-12 -bottom-12 w-52 h-52 rounded-full opacity-25"
                  style={{ background: "radial-gradient(circle, var(--accent-glow), transparent 60%)" }} />
                <div className="w-12 h-12 rounded-2xl grid place-items-center mb-8"
                  style={{ background: "var(--surface-2)", border: "1px solid var(--line-strong)" }}>
                  <Icon size={20} className="text-[var(--accent)]" />
                </div>
                <div className="tick mb-4">{s.label}</div>
                <h3 className="font-serif text-[30px] md:text-[34px] leading-[1.05] mb-4 tracking-[-0.02em]" dangerouslySetInnerHTML={{ __html: s.title }} />
                <p className="body-md leading-relaxed" dangerouslySetInnerHTML={{ __html: s.body }} />
              </motion.div>
            );
          })}
        </div>
      </div>
      <div className="divider" />
    </section>
  );
}
