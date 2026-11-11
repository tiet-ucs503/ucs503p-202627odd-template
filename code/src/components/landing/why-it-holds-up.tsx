"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { countryByCode } from "@/lib/countries";
import { photoForCountry } from "@/lib/destination-photos";

const POINTS = [
  {
    title: "Travel time is checked.",
    body: "Every day is tested against the distance between stops and the hours in it. A day that cannot work is flagged, not quietly packed.",
  },
  {
    title: "No invented prices.",
    body: "Estimates are labelled as estimates. Hotels, sights and restaurants are real places from Google Maps, chosen by their ratings, and anything we cannot verify is marked as not verified.",
  },
  {
    title: "Everything stays editable.",
    body: "Reorder, swap, add or remove. The budget and the checks recompute as you go, so the plan never goes stale.",
  },
  {
    title: "Not sure where? Ask Travis.",
    body: "An assistant for where and when to go, with whether that time of year is usually cheaper or dearer. It never quotes a price it cannot know.",
  },
];

const PHOTO = photoForCountry(countryByCode("NZ")?.code ?? "NZ");

export function WhyItHoldsUp() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24">
      <div className="grid items-stretch gap-12 lg:grid-cols-2 lg:gap-16">
        <div>
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5 }}
            className="font-display text-3xl font-medium tracking-tight text-zinc-900 sm:text-4xl dark:text-zinc-50"
          >
            A plan you can trust enough to book from
          </motion.h2>
          <dl className="mt-10 flex flex-col gap-7">
            {POINTS.map((point, i) => (
              <motion.div
                key={point.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.45, delay: i * 0.07 }}
                className="border-l-2 border-orange-500/70 pl-5"
              >
                <dt className="font-semibold text-zinc-900 dark:text-zinc-50">{point.title}</dt>
                <dd className="mt-1 text-zinc-600 dark:text-zinc-400">{point.body}</dd>
              </motion.div>
            ))}
          </dl>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.7 }}
          className="relative min-h-80 overflow-hidden rounded-3xl bg-zinc-200 lg:min-h-0 dark:bg-zinc-800"
        >
          <Image
            src={PHOTO.src}
            alt={PHOTO.alt}
            fill
            sizes="(min-width: 1024px) 560px, 100vw"
            style={{ objectPosition: PHOTO.position }}
            className="object-cover"
          />
        </motion.div>
      </div>
    </section>
  );
}
