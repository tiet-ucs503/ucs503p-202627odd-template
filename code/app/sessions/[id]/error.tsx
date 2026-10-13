"use client";

import { useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[sessions/[id]/error]", error);
  }, [error]);

  return (
    <main className="flex-1 flex items-center justify-center px-6 py-24">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="card-elev w-full max-w-xl p-10"
      >
        <div className="tick mb-5">error / session</div>
        <h1 className="h-display text-5xl md:text-6xl mb-5">
          This session won&rsquo;t open.
        </h1>
        <p className="body-md mb-7">
          The report tied to this id couldn&rsquo;t load. It may have been cleared, or a
          render hit a snag. Try again, or browse the history.
        </p>
        {error.message ? (
          <pre className="font-mono text-[12.5px] leading-relaxed whitespace-pre-wrap break-words rounded-xl border hairline bg-[var(--surface-2)] p-4 mb-7 text-[var(--fg-dim)]">
            {error.message}
            {error.digest ? `\n\ndigest: ${error.digest}` : ""}
          </pre>
        ) : null}
        <div className="flex flex-wrap gap-3">
          <button onClick={() => reset()} className="btn-primary">
            Try again
          </button>
          <Link href="/sessions" className="btn-ghost">
            Open history
          </Link>
        </div>
      </motion.div>
    </main>
  );
}
