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
    console.error("[inspect/error]", error);
  }, [error]);

  function resetSession() {
    try {
      if (typeof window !== "undefined") {
        const ls = window.localStorage;
        const keys: string[] = [];
        for (let i = 0; i < ls.length; i++) {
          const k = ls.key(i);
          if (k && k.startsWith("solpop")) keys.push(k);
        }
        for (const k of keys) ls.removeItem(k);
        window.sessionStorage.clear();
      }
    } catch (e) {
      console.error("[inspect/error] reset failed", e);
    }
    reset();
  }

  return (
    <main className="flex-1 flex items-center justify-center px-6 py-24">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="card-elev w-full max-w-xl p-10"
      >
        <div className="tick mb-5">error / inspect</div>
        <h1 className="h-display text-5xl md:text-6xl mb-5">
          The workspace had a moment.
        </h1>
        <p className="body-md mb-7">
          Something in the inspection workspace tripped. Retry the action, or fully
          reset the session if it keeps happening.
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
          <button onClick={resetSession} className="btn-ghost">
            Reset session
          </button>
          <Link href="/" className="btn-ghost">
            Go home
          </Link>
        </div>
      </motion.div>
    </main>
  );
}
