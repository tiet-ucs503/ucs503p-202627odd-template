import React from 'react';

export default function MasteryBar({ value = 0, label, weight, showLabel = true, height = 'h-1.5' }) {
  const safeValue = Math.min(Math.max(value, 0), 100);

  const getGradient = (v) => {
    if (v >= 80) return 'linear-gradient(90deg, #10b981, #06b6d4)';
    if (v >= 60) return 'linear-gradient(90deg, #6366f1, #8b5cf6)';
    if (v >= 40) return 'linear-gradient(90deg, #f59e0b, #f97316)';
    return 'linear-gradient(90deg, #f43f5e, #f97316)';
  };

  const getTextColor = (v) => {
    if (v >= 80) return 'text-[var(--status-success)]';
    if (v >= 60) return 'text-[var(--brand-primary)]';
    if (v >= 40) return 'text-[var(--status-warning)]';
    return 'text-[var(--status-danger)]';
  };

  const trackH = height === 'h-1.5' ? '6px' : height === 'h-2' ? '8px' : '4px';

  return (
    <div className="w-full">
      {showLabel && (label || weight !== undefined) && (
        <div className="flex items-center justify-between mb-2 text-xs">
          {label && (
            <span className="text-[var(--text-secondary)] font-medium text-[11px] leading-tight">
              {label}
            </span>
          )}
          <div className="flex items-center gap-1.5 ml-auto flex-shrink-0">
            {weight !== undefined && (
              <span className="label-caps opacity-60">wt {weight}%</span>
            )}
            <span className={`font-bold metric-sm ${getTextColor(safeValue)}`}>
              {safeValue}%
            </span>
          </div>
        </div>
      )}
      <div
        className="w-full rounded-full overflow-hidden relative"
        style={{
          height: trackH,
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <div
          className="mastery-bar-fill"
          style={{
            width: `${safeValue}%`,
            background: getGradient(safeValue),
            height: '100%',
          }}
        />
      </div>
    </div>
  );
}
