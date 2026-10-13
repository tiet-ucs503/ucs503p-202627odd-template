"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform, useSpring } from "framer-motion";
import { ArrowDown } from "lucide-react";
import { CountUp } from "./CountUp";

export function Hero() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const smoothProgress = useSpring(scrollYProgress, { stiffness: 110, damping: 24, mass: 0.4 });
  const headlineY = useTransform(smoothProgress, [0, 1], [0, -120]);
  const headlineOpacity = useTransform(smoothProgress, [0, 0.7], [1, 0]);
  const orbY = useTransform(smoothProgress, [0, 1], [0, 220]);
  const orbScale = useTransform(smoothProgress, [0, 1], [1, 1.4]);
  const videoOpacity = useTransform(smoothProgress, [0, 0.6, 1], [0.3, 0.18, 0.04]);
  const videoScale = useTransform(smoothProgress, [0, 1], [1, 1.08]);

  return (
    <section ref={ref} className="relative overflow-hidden isolate">
      <motion.div
        style={{ opacity: videoOpacity, scale: videoScale }}
        className="absolute inset-0 -z-10 pointer-events-none parallax-soft will-change-transform"
        aria-hidden
      >
        <video
          src="/bloom.mp4"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          className="w-full h-full object-cover"
          style={{ filter: "saturate(1.05) contrast(1.05)", mixBlendMode: "screen" }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[var(--bg)]/40 via-transparent to-[var(--bg)] pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--bg)]/70 via-transparent to-[var(--bg)]/30 pointer-events-none" />
      </motion.div>

      <div className="absolute inset-0 grid-bg opacity-40 pointer-events-none" />
      <motion.div
        style={{ y: orbY, scale: orbScale }}
        className="absolute -top-40 right-[-10%] w-[640px] h-[640px] rounded-full blur-3xl opacity-55 pointer-events-none parallax-soft"
      >
        <div className="w-full h-full rounded-full" style={{ background: "radial-gradient(circle, rgba(255,91,0,0.55), transparent 60%)" }} />
      </motion.div>
      <motion.div
        style={{ y: orbY, scale: orbScale }}
        className="absolute top-[20%] left-[-12%] w-[460px] h-[460px] rounded-full blur-3xl opacity-40 pointer-events-none parallax-soft"
      >
        <div className="w-full h-full rounded-full" style={{ background: "radial-gradient(circle, rgba(255,61,138,0.45), transparent 60%)" }} />
      </motion.div>

      <div className="relative max-w-[1400px] mx-auto px-6 md:px-10 pt-10 md:pt-16 pb-20 md:pb-28">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="flex items-center gap-3 mb-5 md:mb-7"
        >
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-[var(--accent)] shadow-[0_0_22px_var(--accent-glow)]" />
          <span className="tick">Live · Multimodal Inspection Engine</span>
        </motion.div>

        <motion.h1
          style={{ y: headlineY, opacity: headlineOpacity }}
          className="h-display text-[64px] md:text-[120px] lg:text-[152px] parallax-soft"
        >
          {["See every", "crack,", "hotspot, and", "kilowatt", "left on the table."].map((line, i) => (
            <motion.span
              key={i}
              initial={{ opacity: 0, y: 36 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.95, delay: 0.08 + i * 0.08, ease: [0.16, 1, 0.3, 1] }}
              className="block"
              style={{
                color: i === 1 ? "var(--accent-2)" : i === 2 || i === 4 ? "var(--fg-dim)" : undefined,
                fontStyle: i === 1 ? "italic" : undefined,
              }}
            >
              {line}
            </motion.span>
          ))}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="mt-8 md:mt-10 max-w-[720px] body-lg text-[1.18rem] md:text-[1.32rem] leading-[1.5]"
        >
          SOLPOP ingests a single panel photo or an entire fleet upload, runs frontier vision
          models against a 21-defect taxonomy, and synthesizes an executive O&amp;M report with
          quantified efficiency loss and prioritized actions, in under a minute.
        </motion.p>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.85 }}
          className="mt-10 md:mt-12 flex flex-wrap items-center gap-4"
        >
          <a href="/inspect" className="btn-primary inline-flex items-center gap-2">
            Begin inspection
            <ArrowDown size={16} className="-rotate-90" />
          </a>
          <a href="/gallery" className="btn-ghost">Try a sample</a>

          <div className="flex items-center gap-3 ml-2">
            <span className="tick">Powered by</span>
            <span className="font-mono text-[13px] text-[var(--fg-dim)]">Gemini Vision</span>
            <span className="text-[var(--fg-mute)]">·</span>
            <span className="font-mono text-[13px] text-[var(--fg-dim)]">Llama 3.3 70B</span>
          </div>
        </motion.div>

        <div className="mt-20 md:mt-24 grid grid-cols-2 md:grid-cols-4 gap-7 md:gap-10" id="capabilities">
          {[
            { num: 21, suf: "", l: "Defect classes detected" },
            { num: 60, suf: "s", prefix: "<", l: "Per-fleet inspection" },
            { num: 100, suf: "", l: "Calibrated condition scoring" },
            { num: 0, suf: "", lit: "kWh/kW", l: "Quantified energy loss" },
          ].map((s, i) => (
            <motion.div
              key={s.l}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-12% 0px" }}
              transition={{ duration: 0.85, delay: i * 0.07, ease: [0.16, 1, 0.3, 1] }}
              className="border-t hairline-strong pt-6"
            >
              <div className="stat-num">
                {s.lit ?? (
                  <>
                    {s.prefix && <span className="text-[var(--fg-mute)]">{s.prefix}</span>}
                    <CountUp to={s.num} suffix={s.suf} />
                  </>
                )}
              </div>
              <div className="tick mt-4">{s.l}</div>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="divider" />
    </section>
  );
}
