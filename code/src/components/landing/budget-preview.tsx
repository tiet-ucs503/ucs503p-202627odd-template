"use client";

import { motion } from "framer-motion";

// An illustration of how a budget is laid out, not a quote. The total is added
// up from the parts so the two can never disagree.
const CATEGORIES = [
  { label: "Flights", amount: 35_000, color: "bg-orange-500" },
  { label: "Hotels", amount: 45_000, color: "bg-orange-500" },
  { label: "Food", amount: 20_000, color: "bg-orange-500" },
  { label: "Activities", amount: 22_000, color: "bg-orange-500" },
  { label: "Transport", amount: 10_000, color: "bg-orange-500" },
  { label: "Buffer", amount: 18_000, color: "bg-zinc-400" },
];

const TOTAL = CATEGORIES.reduce((sum, category) => sum + category.amount, 0);
const MAX = Math.max(...CATEGORIES.map((c) => c.amount));

export function BudgetPreview() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="font-display text-3xl font-medium tracking-tight text-zinc-900 sm:text-4xl dark:text-zinc-50">
            A budget you can actually understand
          </h2>
          <p className="mt-3 max-w-md text-zinc-600 dark:text-zinc-400">
            Every hotel, meal and activity rolls up into a live budget. Change
            anything in your itinerary and the numbers update immediately —
            no spreadsheet required.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6 }}
          className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-xl shadow-zinc-900/5 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-zinc-500">Example: total budget</span>
            <span className="font-display text-2xl font-medium text-zinc-900 dark:text-zinc-50">
              ₹{TOTAL.toLocaleString("en-IN")}
            </span>
          </div>

          <div className="mt-6 flex flex-col gap-4">
            {CATEGORIES.map((c, i) => (
              <div key={c.label}>
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className="text-zinc-600 dark:text-zinc-400">{c.label}</span>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    ₹{c.amount.toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                  <motion.div
                    initial={{ width: 0 }}
                    whileInView={{ width: `${(c.amount / MAX) * 100}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                    className={`h-full rounded-full ${c.color}`}
                  />
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
