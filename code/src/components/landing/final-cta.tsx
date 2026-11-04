"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { countryByCode } from "@/lib/countries";
import { photoForCountry } from "@/lib/destination-photos";

const PHOTO = photoForCountry(countryByCode("PE")?.code ?? "PE");

export function FinalCta() {
  return (
    <section className="mx-auto max-w-6xl px-6 pb-24">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.6 }}
        className="relative isolate overflow-hidden rounded-[2rem] px-8 py-24 text-center text-white sm:py-32"
      >
        <Image
          src={PHOTO.src}
          alt={PHOTO.alt}
          fill
          sizes="(min-width: 1152px) 1104px, 100vw"
          style={{ objectPosition: PHOTO.position }}
          className="-z-20 object-cover"
        />
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-black/45" />
        <h2 className="font-display mx-auto max-w-2xl text-4xl font-medium tracking-tight sm:text-5xl">
          Pick your first country.
        </h2>
        <p className="mx-auto mt-4 max-w-md text-white/85">
          It takes a minute to set up, and the plan it builds is yours to edit.
        </p>
        <Link
          href="/sign-up"
          className="mt-8 inline-flex h-12 items-center justify-center rounded-full bg-white px-7 text-base font-medium text-zinc-900 transition-colors hover:bg-orange-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          Start planning
        </Link>
      </motion.div>
    </section>
  );
}
