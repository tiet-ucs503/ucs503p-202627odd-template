"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, Plane, Sparkles } from "lucide-react";
import { Alert, Badge, Button, Card } from "@/components/ui";
import { fromInr } from "@/lib/fx";
import { formatMoney } from "@/lib/utils";
import type { FlightQuote } from "@/types/flights";
import { BUDGET_CATEGORY_LABELS, BUDGET_CATEGORY_ORDER } from "@/types/budget";
import type { BudgetBreakdown, SavingsSuggestion } from "@/types/budget";

const CHART_COLOR = "#ea580c";

export function BudgetPanel({
  budget,
  flights = null,
  suggestions,
  onAskTravis,
}: {
  budget: BudgetBreakdown;
  /** How the flight cost was worked out; null when there is nothing to explain. */
  flights?: FlightQuote | null;
  suggestions: SavingsSuggestion[];
  /** Open Travis with this already asked. */
  onAskTravis: (text: string) => void;
}) {
  const overBy = budget.estimatedTotal - budget.total;
  const remaining = budget.total - budget.estimatedTotal;
  const percent = budget.total > 0 ? Math.round((budget.estimatedTotal / budget.total) * 100) : 0;

  const chartData = BUDGET_CATEGORY_ORDER.map((cat) => ({
    name: BUDGET_CATEGORY_LABELS[cat],
    amount: budget.categories[cat] ?? 0,
  })).filter((d) => d.amount > 0);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Trip budget</p>
            <p className="font-display text-3xl font-medium text-zinc-900 dark:text-zinc-50">
              {formatMoney(budget.total, budget.currency)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Estimated</p>
            <p className={`text-lg font-semibold ${overBy > 0 ? "text-red-600" : "text-emerald-600"}`}>
              {formatMoney(budget.estimatedTotal, budget.currency)}
            </p>
          </div>
        </div>

        <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
          <div
            className={`h-full rounded-full transition-all duration-700 ${percent > 100 ? "bg-red-500" : "bg-orange-600"}`}
            style={{ width: `${Math.min(100, percent)}%` }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-zinc-500">
          <span>{percent}% of budget</span>
          <span>
            {remaining >= 0
              ? `${formatMoney(remaining, budget.currency)} remaining`
              : `${formatMoney(-remaining, budget.currency)} over`}
          </span>
        </div>
      </Card>

      {overBy > 0 ? (
        <Alert tone="warning">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              You&apos;re {formatMoney(overBy, budget.currency)} over budget. See ways to save below.
            </span>
          </div>
        </Alert>
      ) : (
        <Alert tone="success">Your trip fits comfortably within budget.</Alert>
      )}

      <Card>
        <h3 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Spending by category</h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid horizontal={false} stroke="currentColor" className="text-zinc-100 dark:text-zinc-800" />
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="name"
                width={90}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12, fill: "currentColor" }}
                className="text-zinc-600 dark:text-zinc-400"
              />
              <Tooltip
                cursor={{ fill: "rgba(234,88,12,0.06)" }}
                formatter={(value) => formatMoney(Number(value), budget.currency)}
                contentStyle={{ borderRadius: 12, border: "1px solid #e4e4e7", fontSize: 13 }}
              />
              <Bar dataKey="amount" fill={CHART_COLOR} radius={[0, 6, 6, 0]} maxBarSize={22} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <ul className="mt-2 flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800">
          {BUDGET_CATEGORY_ORDER.map((cat) => (
            <li key={cat} className="flex items-center justify-between py-2 text-sm">
              <span className="text-zinc-600 dark:text-zinc-400">{BUDGET_CATEGORY_LABELS[cat]}</span>
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                {formatMoney(budget.categories[cat] ?? 0, budget.currency)}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      {flights ? <FlightQuoteCard quote={flights} currency={budget.currency} /> : null}

      {suggestions.length > 0 ? (
        <Card>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            <Sparkles className="h-4 w-4 text-orange-600" />
            Ways to save
          </h3>
          <ul className="flex flex-col gap-3">
            {suggestions.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between gap-4 rounded-xl border border-zinc-200 p-3.5 dark:border-zinc-800"
              >
                <div>
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{s.title}</p>
                  <p className="text-xs text-zinc-500">{s.description}</p>
                  <Badge tone="green" className="mt-1.5">
                    Est. saving {formatMoney(s.estimatedSavings, budget.currency)}
                  </Badge>
                </div>
                <Button size="sm" variant="outline" onClick={() => onAskTravis(s.askTravis)}>
                  Ask Travis
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}

/** Where the flight figure came from, so it reads as an estimate with its reasons, not a fare. */
function FlightQuoteCard({ quote, currency }: { quote: FlightQuote; currency: string }) {
  const money = (inr: number) => formatMoney(fromInr(inr, currency), currency);
  const { low, typical, high } = quote.perTravelerInr;
  return (
    <Card>
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        <Plane className="h-4 w-4 text-orange-600" />
        Flights
      </h3>
      {quote.arrival ? (
        <>
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {quote.origin.city} ({quote.origin.code}) → {quote.arrival.city} ({quote.arrival.code}), return
          </p>
          <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300" data-testid="flight-range">
            {money(low)} – {money(high)} per person, typically {money(typical)}
            {quote.travelers > 1 ? ` · ${money(quote.totalInr)} for ${quote.travelers}` : ""}
          </p>
        </>
      ) : null}
      <p className="mt-2 text-xs text-zinc-500">{quote.basis}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Badge tone={quote.confidence === "route" ? "green" : "amber"}>
          {quote.confidence === "route" ? "Based on a year of fares on this route" : "Modelled estimate"}
        </Badge>
        <Badge tone="neutral">Estimated on {quote.quotedOn}, not a live fare</Badge>
      </div>
    </Card>
  );
}
