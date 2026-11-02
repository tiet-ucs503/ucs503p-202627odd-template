"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

/**
 * One of the two ways to start. Each says who it's for ("you know where
 * you're going" / "you're still deciding") so a first-time traveller can pick
 * without having to guess what the difference is.
 */
export function StartCard({
  href,
  title,
  description,
  cta,
}: {
  href: string;
  title: string;
  description: string;
  cta: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition-colors hover:border-orange-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-orange-500"
    >
      <h2 className="font-display text-xl font-medium tracking-tight text-zinc-900 dark:text-zinc-50">{title}</h2>
      <p className="mt-1.5 flex-1 text-sm text-zinc-600 dark:text-zinc-400">{description}</p>
      <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-orange-700 dark:text-orange-400">
        {cta}
        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
