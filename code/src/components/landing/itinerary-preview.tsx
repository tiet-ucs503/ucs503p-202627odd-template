"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { cn } from "@/lib/utils";

const DEMO_DAYS = [
  { day: 1, city: "Bangkok", items: ["Grand Palace", "Street food at Chinatown", "Wat Pho"] },
  { day: 2, city: "Bangkok", items: ["Damnoen Saduak Floating Market", "Chinatown (Yaowarat)", "Riverside dinner"] },
  { day: 3, city: "Bangkok", items: ["Chatuchak Weekend Market", "Jim Thompson House", "Khao San Road"] },
  { day: 4, city: "Phuket", items: ["Travel to Phuket", "Patong Beach", "Bangla Road nightlife"] },
  { day: 5, city: "Phuket", items: ["Phi Phi Islands day trip", "Snorkelling", "Beachside seafood dinner"] },
  { day: 6, city: "Phuket", items: ["Big Buddha Phuket", "Phuket Old Town walk", "Old Town dinner"] },
  { day: 7, city: "Phuket", items: ["Phang Nga Bay kayaking", "Kata Beach sunset", "Bangla Road"] },
  { day: 8, city: "Phuket", items: ["Wat Chalong", "Souvenir shopping", "Farewell dinner"] },
];

export function ItineraryPreview() {
  const [active, setActive] = useState(0);
  const activeDay = DEMO_DAYS[active];

  return (
    <section className="mx-auto max-w-6xl px-6 py-24">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.5 }}
        className="max-w-xl"
      >
        <h2 className="font-display text-3xl font-medium tracking-tight text-zinc-900 sm:text-4xl dark:text-zinc-50">
          A sample itinerary
        </h2>
        <p className="mt-3 text-zinc-600 dark:text-zinc-400">
          Eight days across Bangkok and Phuket, built from demo data. Choose a day to see what is in it.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.6 }}
        className="mt-10 overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-xl shadow-zinc-900/5 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-5 dark:border-zinc-800">
          <div>
            <p className="text-sm font-semibold text-orange-600">Thailand</p>
            <p className="text-sm text-zinc-500">8 days · 2 cities</p>
          </div>
          <div className="hidden items-center gap-2 text-sm text-zinc-400 sm:flex">
            <span className="font-medium text-zinc-700 dark:text-zinc-300">Bangkok</span>
            <span className="h-px w-10 bg-zinc-300 dark:bg-zinc-700" />
            <span className="font-medium text-zinc-700 dark:text-zinc-300">Phuket</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 px-6 pt-5">
          {DEMO_DAYS.map((d, i) => (
            <button
              key={d.day}
              onClick={() => setActive(i)}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium transition-colors",
                active === i
                  ? "bg-orange-600 text-white shadow-sm shadow-orange-600/30"
                  : "bg-zinc-100 text-zinc-600 hover:bg-orange-100 hover:text-orange-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700",
              )}
              aria-label={`Day ${d.day}`}
              aria-pressed={active === i}
            >
              {d.day}
            </button>
          ))}
        </div>

        <div className="min-h-[180px] px-6 pb-6 pt-4">
          <motion.div
            key={activeDay.day}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.25 }}
          >
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Day {activeDay.day} · {activeDay.city}
            </p>
            <ul className="mt-3 flex flex-col gap-2.5">
              {activeDay.items.map((item) => (
                <li key={item} className="flex items-center gap-3 text-sm text-zinc-600 dark:text-zinc-400">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-orange-500" />
                  {item}
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}
