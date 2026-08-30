import React, { useEffect, useRef, useState } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

// Animated number counter
function AnimatedNumber({ value, duration = 800 }) {
  const [display, setDisplay] = useState(0);
  const prevRef = useRef(0);

  useEffect(() => {
    const raw = typeof value === 'string' ? value : String(value);
    const isPercent = raw.endsWith('%');
    const isSlash = raw.includes('/');
    
    if (isPercent) {
      const num = parseFloat(raw);
      if (isNaN(num)) { setDisplay(value); return; }
      const start = prevRef.current;
      const end = num;
      const startTime = performance.now();
      const animate = (now) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setDisplay(Math.round(start + (end - start) * eased) + '%');
        if (progress < 1) requestAnimationFrame(animate);
        else prevRef.current = end;
      };
      requestAnimationFrame(animate);
    } else if (isSlash) {
      setDisplay(value);
    } else {
      const num = parseFloat(raw);
      if (isNaN(num)) { setDisplay(value); return; }
      const start = prevRef.current;
      const end = num;
      const startTime = performance.now();
      const animate = (now) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setDisplay(Math.round(start + (end - start) * eased));
        if (progress < 1) requestAnimationFrame(animate);
        else prevRef.current = end;
      };
      requestAnimationFrame(animate);
    }
  }, [value, duration]);

  return <span>{display || value}</span>;
}

export default function MetricCard({ 
  icon: Icon, 
  label, 
  value, 
  subtitle, 
  trend, 
  badge,
  badgeType = 'default',
  accentColor,
  index = 0
}) {
  const badgeStyles = {
    default: 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--border-subtle)]',
    danger:  'bg-[var(--status-danger-bg)] text-[var(--status-danger)] border-[var(--status-danger-border)]',
    success: 'bg-[var(--status-success-bg)] text-[var(--status-success)] border-[var(--status-success-border)]',
    info:    'bg-[var(--status-info-bg)] text-[var(--status-info)] border-[var(--status-info-border)]',
    warning: 'bg-[var(--status-warning-bg)] text-[var(--status-warning)] border-[var(--status-warning-border)]',
  };

  const accentColors = {
    primary:  { bg: 'rgba(99,102,241,0.12)', text: 'var(--brand-primary)',  glow: 'rgba(99,102,241,0.25)' },
    success:  { bg: 'rgba(16,185,129,0.12)', text: 'var(--status-success)', glow: 'rgba(16,185,129,0.25)' },
    warning:  { bg: 'rgba(245,158,11,0.12)', text: 'var(--status-warning)', glow: 'rgba(245,158,11,0.25)' },
    danger:   { bg: 'rgba(244,63,94,0.12)',  text: 'var(--status-danger)',  glow: 'rgba(244,63,94,0.25)'  },
    cyan:     { bg: 'rgba(6,182,212,0.12)',  text: 'var(--brand-secondary)', glow: 'rgba(6,182,212,0.25)' },
  };

  const accent = accentColors[accentColor] || accentColors.primary;
  const delay = `${index * 0.07}s`;

  return (
    <div
      className="panel-card p-5 flex flex-col justify-between group relative overflow-hidden cursor-default animate-fade-up"
      style={{ animationDelay: delay }}
    >
      {/* Subtle background glow on hover */}
      <div
        className="absolute inset-0 rounded-[14px] opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{ background: `radial-gradient(ellipse at 20% 50%, ${accent.glow} 0%, transparent 70%)` }}
      />

      {/* Top row: label + icon */}
      <div className="flex items-center justify-between gap-3 mb-4 relative">
        <span className="label-caps">{label}</span>
        {Icon && (
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-300 group-hover:scale-110"
            style={{
              background: accent.bg,
              color: accent.text,
              boxShadow: `0 0 0 1px ${accent.glow}`,
            }}
          >
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>

      {/* Metric value */}
      <div className="relative">
        <div className="flex items-baseline gap-2 mb-1">
          <span
            className="metric-lg text-[var(--text-primary)] transition-colors duration-300"
            style={{ color: accentColor ? accent.text : undefined }}
          >
            <AnimatedNumber value={value} />
          </span>
          {trend !== undefined && (
            <span className={`inline-flex items-center text-[11px] font-semibold ${
              trend > 0 ? 'text-[var(--status-success)]' : trend < 0 ? 'text-[var(--status-danger)]' : 'text-[var(--text-muted)]'
            }`}>
              {trend > 0 ? <TrendingUp className="w-3 h-3 mr-0.5" /> : trend < 0 ? <TrendingDown className="w-3 h-3 mr-0.5" /> : <Minus className="w-3 h-3 mr-0.5" />}
              {trend > 0 ? '+' : ''}{trend}%
            </span>
          )}
        </div>

        {subtitle && (
          <p className="text-[11px] text-[var(--text-muted)] leading-snug line-clamp-1">
            {subtitle}
          </p>
        )}

        {badge && (
          <div className="mt-2.5">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide border ${badgeStyles[badgeType]}`}>
              {badge}
            </span>
          </div>
        )}
      </div>

      {/* Bottom accent line */}
      <div
        className="absolute bottom-0 left-4 right-4 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ background: `linear-gradient(90deg, transparent, ${accent.text}, transparent)` }}
      />
    </div>
  );
}
