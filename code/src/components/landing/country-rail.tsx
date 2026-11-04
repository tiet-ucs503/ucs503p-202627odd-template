"use client";

import Image from "next/image";
import { useRef } from "react";
import { motion } from "framer-motion";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { COUNTRIES, bestMonthsLabel, countryByCode, type Country } from "@/lib/countries";
import { photoForCountry } from "@/lib/destination-photos";

/** The countries shown, picked to look different from one another side by side. */
const RAIL_CODES = ["JP", "IT", "TH", "IS", "MV", "CH", "PE", "NZ", "MA", "GR", "AE", "VN"];
const RAIL: Country[] = RAIL_CODES.map((code) => countryByCode(code)).filter((c): c is Country => c !== null);

/**
 * A row of places to start from, as photographs. Each one starts a trip to that
 * country. It scrolls by touch or trackpad, snaps card to card, and has
 * buttons for people who have neither.
 */
export function CountryRail({ onPick }: { onPick: (country: Country) => void }) {
  const scroller = useRef<HTMLUListElement>(null);

  function scrollBy(direction: 1 | -1) {
    const el = scroller.current;
    if (!el) return;
    el.scrollBy({ left: direction * Math.max(280, el.clientWidth * 0.8), behavior: "smooth" });
  }

  return (
    <section id="countries" className="mx-auto max-w-6xl scroll-mt-8 px-6 py-24">
      <div className="flex items-end justify-between gap-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
          className="max-w-xl"
        >
          <h2 className="font-display text-3xl font-medium tracking-tight text-zinc-900 sm:text-4xl dark:text-zinc-50">
            Pick from {COUNTRIES.length} countries
          </h2>
          <p className="mt-3 text-zinc-600 dark:text-zinc-400">
            Each comes with its real cities, the months it is usually at its best, and the same editable
            day-by-day plan. Choose one to begin.
          </p>
        </motion.div>
        <div className="hidden gap-2 sm:flex">
          <button
            type="button"
            onClick={() => scrollBy(-1)}
            aria-label="Scroll countries left"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-zinc-300 text-zinc-700 transition-colors hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => scrollBy(1)}
            aria-label="Scroll countries right"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-zinc-300 text-zinc-700 transition-colors hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <ul
        ref={scroller}
        className="-mx-6 mt-10 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-6 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {RAIL.map((country) => {
          const photo = photoForCountry(country.code);
          return (
            <li key={country.code} className="w-60 shrink-0 snap-start sm:w-64">
              <button
                type="button"
                onClick={() => onPick(country)}
                className="group relative block aspect-[3/4] w-full overflow-hidden rounded-3xl bg-zinc-200 text-left text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-600 dark:bg-zinc-800"
              >
                <Image
                  src={photo.src}
                  alt={photo.alt}
                  fill
                  sizes="256px"
                  style={{ objectPosition: photo.position }}
                  className="object-cover transition-transform duration-700 ease-out motion-safe:group-hover:scale-[1.06]"
                />
                <span
                  aria-hidden="true"
                  className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent"
                />
                <span className="absolute inset-x-0 bottom-0 flex flex-col gap-1 p-5">
                  <span className="font-display text-2xl font-medium leading-tight">{country.name}</span>
                  <span className="text-xs text-white/80">Usually best {bestMonthsLabel(country)}</span>
                  <span className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                    Plan a trip
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
