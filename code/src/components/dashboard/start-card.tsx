"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { DestinationPhoto } from "@/lib/destination-photos";

/**
 * One of the two ways to start. Each says who it's for ("you know where
 * you're going" / "you're still deciding") so a first-time traveller can pick
 * without having to guess what the difference is.
 *
 * The photo is the card; the text sits on a dark fade at the bottom so it
 * reads on any picture. The photo is decorative (the words say everything), so
 * it has no alt text, and the whole tile is one link.
 */
export function StartCard({
  href,
  title,
  description,
  cta,
  photo,
}: {
  href: string;
  title: string;
  description: string;
  cta: string;
  photo: DestinationPhoto;
}) {
  return (
    <Link
      href={href}
      className="group relative isolate flex min-h-72 flex-col justify-end overflow-hidden rounded-3xl bg-zinc-900 p-6 text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-600 sm:min-h-80 sm:p-8"
    >
      <Image
        src={photo.src}
        alt=""
        fill
        // The first thing on the page, so it loads first (Next 16's replacement for `priority`).
        loading="eager"
        fetchPriority="high"
        sizes="(min-width: 1152px) 560px, (min-width: 640px) 50vw, 100vw"
        style={{ objectPosition: photo.position }}
        className="-z-20 object-cover transition-transform duration-700 ease-out motion-safe:group-hover:scale-[1.04]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-gradient-to-t from-black/80 via-black/35 to-black/0"
      />

      <h2 className="font-display text-3xl font-medium tracking-tight">{title}</h2>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-white/85">{description}</p>
      <span className="mt-5 inline-flex w-fit items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition-colors group-hover:bg-orange-50">
        {cta}
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      </span>
    </Link>
  );
}
