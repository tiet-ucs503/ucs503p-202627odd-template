import React, { useRef } from 'react';

// Unique ID generator for SVG gradients (avoids conflicts when multiple rings render)
let ringCounter = 0;

export default function MasteryRing({ value = 0, size = 80, strokeWidth = 6, className = '' }) {
  const id = useRef(`mr-${++ringCounter}`).current;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const safeValue = Math.min(Math.max(value, 0), 100);
  const offset = circumference - (safeValue / 100) * circumference;

  // Color tiers
  const getTier = (v) => {
    if (v >= 80) return { id: `${id}-high`, stops: ['#10b981', '#06b6d4'], text: '#10b981', label: 'Mastered' };
    if (v >= 60) return { id: `${id}-good`, stops: ['#6366f1', '#8b5cf6'], text: '#818cf8', label: 'Strong' };
    if (v >= 40) return { id: `${id}-mid`,  stops: ['#f59e0b', '#f97316'], text: '#f59e0b', label: 'Moderate' };
    return          { id: `${id}-low`,  stops: ['#f43f5e', '#f97316'], text: '#f43f5e', label: 'Focus' };
  };

  const tier = getTier(safeValue);
  const textSize = size <= 44 ? 10 : size <= 56 ? 11 : size <= 72 ? 13 : 15;

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`}>
      <svg width={size} height={size} className="-rotate-90" style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id={tier.id} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={tier.stops[0]} />
            <stop offset="100%" stopColor={tier.stops[1]} />
          </linearGradient>
          {/* Glow filter */}
          <filter id={`${id}-glow`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Background track */}
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none"
          stroke="var(--border-subtle)"
          strokeWidth={strokeWidth}
        />

        {/* Subtle glow ring under progress */}
        {safeValue > 0 && (
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none"
            stroke={`url(#${tier.id})`}
            strokeWidth={strokeWidth + 4}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            opacity={0.12}
            filter={`url(#${id}-glow)`}
          />
        )}

        {/* Progress arc */}
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none"
          stroke={safeValue > 0 ? `url(#${tier.id})` : 'var(--border-subtle)'}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
        />
      </svg>

      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="font-bold leading-none"
          style={{ fontSize: textSize, color: safeValue > 0 ? tier.text : 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}
        >
          {safeValue}
        </span>
        {size >= 72 && (
          <span className="text-[8px] mt-0.5" style={{ color: 'var(--text-muted)', letterSpacing: '0.04em' }}>%</span>
        )}
      </div>
    </div>
  );
}
