"use client";

export function Footer() {
  return (
    <footer className="no-print mt-32 border-t hairline">
      <div className="max-w-[1400px] mx-auto px-6 md:px-10 py-12 flex flex-wrap items-center justify-between gap-6">
        <div className="font-serif text-[22px]">SOLPOP</div>
        <div className="font-mono text-[11px] tracking-[0.18em] uppercase text-[var(--fg-mute)]">
          v1.0 · multimodal photovoltaic intelligence
        </div>
        <div className="font-mono text-[11px] text-[var(--fg-mute)]">
          © {new Date().getFullYear()} · For inspection assistance, not a substitute for licensed engineering review.
        </div>
      </div>
    </footer>
  );
}
