import { useState } from 'react';
import type { DailyPoint } from '@/lib/api';

// Two small charts of the last 14 days, each with its own scale:
// questions answered per day (bars) and accuracy on the days practised (line).
// One series each, so the title says what is plotted and no legend is needed.

const SERIES = '#3987e5'; // checked for contrast against the dark chart surface
const GRID = 'rgba(255,255,255,0.10)';
const AXIS_TEXT = '#9ca3af';

const W = 520;
const H = 190;
const PAD = { top: 14, right: 12, bottom: 28, left: 34 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

const parseDay = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const formatDay = (iso: string) =>
  parseDay(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });

/** A round number at or above the largest value, so the top gridline is easy to read. */
function niceMax(value: number): number {
  if (value <= 5) return 5;
  if (value <= 10) return 10;
  return Math.ceil(value / 10) * 10;
}

interface ChartFrameProps {
  title: string;
  description: string;
  days: DailyPoint[];
  yTicks: number[];
  yMax: number;
  yLabel: (tick: number) => string;
  tooltip: (day: DailyPoint) => string[];
  children: (x: (index: number) => number, y: (value: number) => number, active: number | null) => React.ReactNode;
}

function ChartFrame({ title, description, days, yTicks, yMax, yLabel, tooltip, children }: ChartFrameProps) {
  const [active, setActive] = useState<number | null>(null);
  const band = PLOT_W / days.length;
  const x = (index: number) => PAD.left + band * index + band / 2;
  const y = (value: number) => PAD.top + PLOT_H - (value / yMax) * PLOT_H;
  const hovered = active !== null ? days[active] : null;

  return (
    <figure className="bg-black/40 rounded-2xl border border-white/5 p-4 m-0">
      <figcaption className="mb-2">
        <div className="text-sm font-bold text-gray-100">{title}</div>
        <div className="text-xs text-gray-400">{description}</div>
      </figcaption>

      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={`${title}. ${description}`}>
          {yTicks.map((tick) => (
            <g key={tick}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(tick)} y2={y(tick)} stroke={GRID} strokeWidth={1} />
              <text x={PAD.left - 6} y={y(tick) + 4} textAnchor="end" fontSize={11} fill={AXIS_TEXT}>{yLabel(tick)}</text>
            </g>
          ))}
          {days.map((d, i) =>
            i % 3 === 1 ? (
              <text key={d.date} x={x(i)} y={H - 8} textAnchor="middle" fontSize={11} fill={AXIS_TEXT}>{formatDay(d.date)}</text>
            ) : null,
          )}

          {children(x, y, active)}

          {/* One wide, invisible column per day: easier to hover or focus than the mark itself. */}
          {days.map((d, i) => (
            <rect
              key={d.date}
              x={PAD.left + band * i}
              y={PAD.top}
              width={band}
              height={PLOT_H}
              fill="transparent"
              tabIndex={0}
              aria-label={tooltip(d).join(', ')}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              style={{ outline: 'none' }}
            />
          ))}
        </svg>

        {hovered && active !== null && (
          <div
            className="absolute z-10 pointer-events-none -translate-x-1/2 px-2.5 py-1.5 rounded-lg bg-ink-900 border border-white/20 text-xs text-gray-100 whitespace-nowrap shadow-lg"
            style={{ left: `${(x(active) / W) * 100}%`, top: 0 }}
          >
            {tooltip(hovered).map((line, i) => (
              <div key={line} className={i === 0 ? 'font-bold' : 'text-gray-300'}>{line}</div>
            ))}
          </div>
        )}
      </div>
    </figure>
  );
}

function QuestionsPerDay({ days }: { days: DailyPoint[] }) {
  const yMax = niceMax(Math.max(...days.map((d) => d.questions)));
  const barWidth = Math.min(24, (PLOT_W / days.length) * 0.6);
  return (
    <ChartFrame
      title="Questions answered per day"
      description="Last 14 days"
      days={days}
      yMax={yMax}
      yTicks={[0, yMax / 2, yMax]}
      yLabel={(t) => String(t)}
      tooltip={(d) => [
        formatDay(d.date),
        d.questions === 0 ? 'No practice' : `${d.questions} answered, ${d.correct} correct`,
        ...(d.questions ? [`${d.practice_minutes} min of practice`] : []),
      ]}
    >
      {(x, y, active) =>
        days.map((d, i) => {
          if (d.questions === 0) return null;
          const top = y(d.questions);
          const height = PAD.top + PLOT_H - top;
          const r = Math.min(4, height);
          const left = x(i) - barWidth / 2;
          // Rounded at the top (the data end), square where it meets the baseline.
          const path = `M${left},${top + height} V${top + r} Q${left},${top} ${left + r},${top} H${left + barWidth - r} Q${left + barWidth},${top} ${left + barWidth},${top + r} V${top + height} Z`;
          return <path key={d.date} d={path} fill={SERIES} opacity={active === null || active === i ? 1 : 0.55} />;
        })
      }
    </ChartFrame>
  );
}

function AccuracyPerDay({ days }: { days: DailyPoint[] }) {
  const practised = days.map((d, i) => ({ d, i })).filter(({ d }) => d.accuracy_pct !== null);
  return (
    <ChartFrame
      title="Accuracy on the days practised"
      description="Share of answers that were correct. Days without practice have no point."
      days={days}
      yMax={100}
      yTicks={[0, 50, 100]}
      yLabel={(t) => `${t}%`}
      tooltip={(d) => [
        formatDay(d.date),
        d.accuracy_pct === null ? 'No practice' : `${d.accuracy_pct}% correct (${d.correct} of ${d.questions})`,
      ]}
    >
      {(x, y, active) => (
        <>
          {practised.length > 1 && (
            <polyline
              points={practised.map(({ d, i }) => `${x(i)},${y(d.accuracy_pct as number)}`).join(' ')}
              fill="none"
              stroke={SERIES}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}
          {practised.map(({ d, i }) => (
            <circle
              key={d.date}
              cx={x(i)}
              cy={y(d.accuracy_pct as number)}
              r={active === i ? 6 : 4.5}
              fill={SERIES}
              stroke="#0b0b12"
              strokeWidth={2}
            />
          ))}
        </>
      )}
    </ChartFrame>
  );
}

export default function TrendCharts({ days }: { days: DailyPoint[] }) {
  const practisedDays = days.filter((d) => d.questions > 0);
  if (practisedDays.length === 0) {
    return <p className="text-sm text-gray-400">No practice in the last 14 days, so there is no trend to show yet.</p>;
  }

  return (
    <div>
      <div className="grid lg:grid-cols-2 gap-4">
        <QuestionsPerDay days={days} />
        <AccuracyPerDay days={days} />
      </div>

      <details className="mt-3 text-xs text-gray-400">
        <summary className="cursor-pointer hover:text-white w-fit">Show these numbers as a table</summary>
        <div className="overflow-x-auto mt-2">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 font-mono uppercase tracking-wider">
                <th className="py-2 pr-4">Day</th>
                <th className="py-2 pr-4">Questions</th>
                <th className="py-2 pr-4">Correct</th>
                <th className="py-2 pr-4">Accuracy</th>
                <th className="py-2 pr-4">Practice time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-gray-300">
              {practisedDays.map((d) => (
                <tr key={d.date}>
                  <td className="py-2 pr-4">{formatDay(d.date)}</td>
                  <td className="py-2 pr-4">{d.questions}</td>
                  <td className="py-2 pr-4">{d.correct}</td>
                  <td className="py-2 pr-4">{d.accuracy_pct}%</td>
                  <td className="py-2 pr-4">{d.practice_minutes} min</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
