"use client";

import { motion } from "framer-motion";

const STEPS = [
  {
    title: "Choose a country",
    body: "Search the list, then add your dates, a budget and who is coming.",
  },
  {
    title: "Get a day-by-day plan",
    body: "Cities to base yourself in, somewhere to stay in each, things to do every day, and what it adds up to.",
  },
  {
    title: "Change anything",
    body: "Drag days around, swap a hotel, add or drop a stop. The budget and the travel-time checks recalculate as you edit.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="mx-auto max-w-6xl scroll-mt-8 px-6 py-24">
      <motion.h2
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.5 }}
        className="font-display max-w-xl text-3xl font-medium tracking-tight text-zinc-900 sm:text-4xl dark:text-zinc-50"
      >
        From a country to a trip you can edit
      </motion.h2>

      <ol className="mt-14 grid gap-x-12 gap-y-10 border-t border-zinc-200 pt-10 md:grid-cols-3 dark:border-zinc-800">
        {STEPS.map((step, i) => (
          <motion.li
            key={step.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, delay: i * 0.1 }}
          >
            <span className="font-display text-5xl font-medium text-orange-600/80" aria-hidden="true">
              {i + 1}
            </span>
            <h3 className="mt-3 text-lg font-semibold text-zinc-900 dark:text-zinc-50">{step.title}</h3>
            <p className="mt-2 text-zinc-600 dark:text-zinc-400">{step.body}</p>
          </motion.li>
        ))}
      </ol>
    </section>
  );
}
