"use client";

import { useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global-error]", error);
  }, [error]);

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <main className="flex-1 flex items-center justify-center px-6 py-24">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="card-elev w-full max-w-xl p-10"
          >
            <div className="tick mb-5">error / fatal</div>
            <h1 className="h-display text-5xl md:text-6xl mb-5">Something broke.</h1>
            <p className="body-md mb-7">
              The app hit an unexpected fault. Try again, or head home and start fresh —
              your last upload should still be in place.
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
              <Link href="/" className="btn-ghost">
                Go home
              </Link>
            </div>
          </motion.div>
        </main>
      </body>
    </html>
  );
}
