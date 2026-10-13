"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { Sparkles } from "lucide-react";

export function Header() {
  const { scrollY } = useScroll();
  const opacity = useTransform(scrollY, [0, 80], [0, 1]);
  const blur = useTransform(scrollY, [0, 80], [0, 22]);
  const bg = useTransform(opacity, (o) => `rgba(8, 8, 10, ${0.62 * o})`);
  const filter = useTransform(blur, (b) => `blur(${b}px) saturate(140%)`);

  return (
    <header className="no-print sticky top-0 z-40 border-b border-transparent">
      <motion.div
        style={{ background: bg, backdropFilter: filter, WebkitBackdropFilter: filter as unknown as string }}
        className="absolute inset-0 transition-colors duration-500"
      />
      <div className="relative max-w-[1400px] mx-auto px-6 md:px-10 h-[72px] flex items-center justify-between">
        <a href="/" className="flex items-center gap-3.5 group">
          <motion.div
            initial={{ rotate: 0 }}
            animate={{ rotate: 360 }}
            transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
            className="relative w-8 h-8 rounded-full"
            style={{
              background:
                "conic-gradient(from 0deg, var(--accent), var(--accent-2), var(--accent))",
              boxShadow: "0 0 28px var(--accent-glow)",
            }}
          >
            <span className="absolute inset-[3px] rounded-full bg-[var(--bg)]" />
          </motion.div>
          <div className="leading-tight">
            <div className="font-mono text-[11.5px] tracking-[0.22em] text-[var(--fg-mute)]">
              SOLPOP / V1.0
            </div>
            <div className="font-serif text-[19px] -mt-[2px] group-hover:text-[var(--accent-2)] transition-colors duration-300">
              panels, popping
            </div>
          </div>
        </a>

        <nav className="hidden md:flex items-center gap-9">
          <a className="tick hover:text-[var(--fg)] transition-colors duration-200" href="/gallery">Gallery</a>
          <a className="tick hover:text-[var(--fg)] transition-colors duration-200" href="/inspect">Inspect</a>
          <a className="tick hover:text-[var(--fg)] transition-colors duration-200" href="/sessions">History</a>
          <a className="tick hover:text-[var(--fg)] transition-colors duration-200" href="/compare">Compare</a>
        </nav>

        <a href="/inspect" className="btn-ghost text-sm flex items-center gap-2 !py-2.5 !px-5">
          <Sparkles size={14} className="text-[var(--accent)]" />
          <span>Run inspection</span>
        </a>
      </div>
    </header>
  );
}
