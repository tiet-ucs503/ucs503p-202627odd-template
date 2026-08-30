import React from 'react';

export default function DifficultyBadge({ difficulty = 'Easy', size = 'sm' }) {
  const styles = {
    Easy: {
      bg: 'var(--diff-easy-bg)',
      text: 'var(--diff-easy)',
      border: 'var(--diff-easy-border)',
      glow: '0 0 10px rgba(16, 185, 129, 0.2)',
      dotBg: 'var(--diff-easy)',
    },
    Medium: {
      bg: 'var(--diff-medium-bg)',
      text: 'var(--diff-medium)',
      border: 'var(--diff-medium-border)',
      glow: '0 0 10px rgba(245, 158, 11, 0.2)',
      dotBg: 'var(--diff-medium)',
    },
    Hard: {
      bg: 'var(--diff-hard-bg)',
      text: 'var(--diff-hard)',
      border: 'var(--diff-hard-border)',
      glow: '0 0 10px rgba(244, 63, 94, 0.2)',
      dotBg: 'var(--diff-hard)',
    },
  };

  const current = styles[difficulty] || styles.Easy;
  const sizeClasses = size === 'xs' 
    ? 'px-2 py-0.5 text-[10px] gap-1' 
    : 'px-2.5 py-0.5 text-[11px] gap-1.5';

  return (
    <span
      className={`inline-flex items-center font-bold rounded-md whitespace-nowrap font-mono tracking-tight transition-all duration-200 ${sizeClasses}`}
      style={{
        background: current.bg,
        color: current.text,
        border: `1px solid ${current.border}`,
        boxShadow: current.glow,
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{
          background: current.dotBg,
          boxShadow: `0 0 4px ${current.dotBg}`,
        }}
      />
      {difficulty}
    </span>
  );
}
