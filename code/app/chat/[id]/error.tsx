"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const pathname = usePathname();

  useEffect(() => {
    console.error("[chat/[id]/error]", error);
  }, [error]);

  const reportHref = useMemo(() => {
    if (!pathname) return "/sessions";
    const match = pathname.match(/\/chat\/([^/?#]+)/);
    const id = match?.[1];
    return id ? `/sessions/${id}` : "/sessions";
  }, [pathname]);

  return (
    <main className="flex-1 flex items-center justify-center px-6 py-24">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="card-elev w-full max-w-xl p-10"
      >
        <div className="tick mb-5">error / chat</div>
        <h1 className="h-display text-5xl md:text-6xl mb-5">
          Chat is having a moment.
        </h1>
        <p className="body-md mb-7">
          The conversation surface hit an error. Retry to keep going, or jump back to
          the underlying report.
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
          <Link href={reportHref} className="btn-ghost">
            Open report
          </Link>
        </div>
      </motion.div>
    </main>
  );
}
