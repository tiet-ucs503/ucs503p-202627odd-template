import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function PatternTag({
  name,
  cumulativeMastery,
  solved,
  total,
  clickable = true,
  size = 'sm'
}) {
  const [showTooltip, setShowTooltip] = useState(false);
  const navigate = useNavigate();

  const getMasteryColor = (m) => {
    if (m >= 80) return '#10b981';
    if (m >= 60) return '#6366f1';
    if (m >= 40) return '#f59e0b';
    return '#f43f5e';
  };

  const getMasteryGradient = (m) => {
    if (m >= 80) return 'linear-gradient(90deg, #10b981, #06b6d4)';
    if (m >= 60) return 'linear-gradient(90deg, #6366f1, #8b5cf6)';
    if (m >= 40) return 'linear-gradient(90deg, #f59e0b, #f97316)';
    return 'linear-gradient(90deg, #f43f5e, #f97316)';
  };

  const handleClick = (e) => {
    if (clickable) {
      e.stopPropagation();
      navigate(`/problems?pattern=${encodeURIComponent(name)}`);
    }
  };

  const sizeClasses = size === 'xs'
    ? 'px-2 py-0.5 text-[10px] gap-1'
    : 'px-2.5 py-0.5 text-[11px] gap-1.5';

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={handleClick}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={`
          inline-flex items-center rounded-md font-medium
          transition-all duration-200 text-left
          ${clickable ? 'cursor-pointer' : 'cursor-default'}
          ${sizeClasses}
        `}
        style={{
          background: 'rgba(99, 102, 241, 0.08)',
          color: 'var(--brand-primary)',
          border: '1px solid rgba(99, 102, 241, 0.2)',
        }}
        onMouseOver={e => {
          if (clickable) {
            e.currentTarget.style.background = 'rgba(99, 102, 241, 0.15)';
            e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.4)';
            e.currentTarget.style.boxShadow = '0 0 10px rgba(99, 102, 241, 0.15)';
          }
        }}
        onMouseOut={e => {
          e.currentTarget.style.background = 'rgba(99, 102, 241, 0.08)';
          e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.2)';
          e.currentTarget.style.boxShadow = 'none';
        }}
      >
        <span
          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ background: 'var(--brand-primary)' }}
        />
        {name}
      </button>

      {showTooltip && cumulativeMastery !== undefined && (
        <div
          className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 whitespace-nowrap pointer-events-none animate-scale-in"
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-default)',
            borderRadius: 10,
            boxShadow: 'var(--shadow-dropdown)',
            padding: '10px 14px',
            minWidth: 140,
            textAlign: 'center',
          }}
        >
          <p className="label-caps mb-1">Pattern Mastery</p>
          <p
            className="font-bold"
            style={{
              fontSize: 18,
              fontFamily: "'JetBrains Mono', monospace",
              color: getMasteryColor(cumulativeMastery),
              lineHeight: 1,
            }}
          >
            {cumulativeMastery}%
          </p>
          {/* Mini progress bar */}
          <div
            className="mt-2 h-1 rounded-full overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.08)' }}
          >
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${cumulativeMastery}%`,
                background: getMasteryGradient(cumulativeMastery),
              }}
            />
          </div>
          {solved !== undefined && (
            <p className="text-[10px] mt-1.5" style={{ color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
              {solved} / {total} solved
            </p>
          )}
          {/* Arrow */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
            <div
              className="w-2 h-2 rotate-45"
              style={{
                background: 'var(--bg-elevated)',
                borderRight: '1px solid var(--border-default)',
                borderBottom: '1px solid var(--border-default)',
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
