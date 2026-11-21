import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

export function Button({
  variant = 'primary',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'gold' | 'outline-light';
}) {
  const styles = {
    primary:
      'bg-leaf text-paper shadow-[0_2px_8px_rgba(61,122,74,0.25)] hover:bg-forest hover:shadow-[0_4px_12px_rgba(31,61,43,0.30)] active:scale-[0.98] disabled:opacity-50 disabled:shadow-none',
    secondary:
      'bg-paper text-forest border border-forest/20 shadow-xs hover:border-forest/50 hover:bg-forest/5 active:scale-[0.98]',
    ghost: 'bg-transparent text-forest hover:bg-forest/10 active:scale-[0.98]',
    danger:
      'bg-clay text-paper shadow-[0_2px_8px_rgba(155,44,44,0.25)] hover:bg-clay/90 hover:shadow-[0_4px_12px_rgba(155,44,44,0.30)] active:scale-[0.98]',
    // Forest on harvest gold — do not pair harvest with text-soil (fails contrast).
    gold:
      'bg-harvest text-forest shadow-[0_2px_8px_rgba(212,160,23,0.25)] hover:bg-[#c49212] hover:shadow-[0_4px_12px_rgba(212,160,23,0.30)] active:scale-[0.98] disabled:opacity-50',
    'outline-light':
      'border border-paper/60 bg-transparent text-paper hover:border-paper hover:bg-paper/15 active:scale-[0.98]',
  }[variant];

  return (
    <button
      className={cx(
        'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 text-base font-semibold cursor-pointer transition-all duration-150 disabled:cursor-not-allowed disabled:pointer-events-none',
        styles,
        className,
      )}
      {...props}
    />
  );
}

export function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-semibold text-forest">{label}</span>
      {children}
      {error ? <span className="text-sm text-clay">{error}</span> : null}
    </label>
  );
}

const inputClass =
  'min-h-12 w-full rounded-xl border border-forest/15 bg-paper px-4 text-base text-ink outline-none transition-all duration-150 placeholder:text-ink/40 focus:border-leaf focus:ring-4 focus:ring-leaf/15';

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx(inputClass, props.className)} {...props} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cx(inputClass, props.className)} {...props} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cx(inputClass, 'min-h-28 py-3', props.className)}
      {...props}
    />
  );
}

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        'rounded-2xl border border-forest/12 bg-paper p-5 sm:p-6 shadow-card transition-all duration-200',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-forest/10 pb-5">
      <div className="min-w-0 space-y-1.5">
        {eyebrow ? (
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-harvest">{eyebrow}</p>
        ) : null}
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-forest sm:text-4xl">
          {title}
        </h1>
        {subtitle ? <p className="max-w-2xl text-sm text-ink/70 sm:text-base">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2.5">{actions}</div> : null}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = 'forest',
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: 'forest' | 'leaf' | 'harvest';
}) {
  const iconBg =
    tone === 'harvest' ? 'bg-harvest/15 text-harvest' : tone === 'leaf' ? 'bg-leaf/12 text-leaf' : 'bg-forest/10 text-forest';
  return (
    <Card className="flex flex-col justify-between p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider text-soil">{label}</p>
          <p className="font-display mt-2 text-3xl font-extrabold text-forest sm:text-4xl">{value}</p>
        </div>
        <span className={cx('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', iconBg)} aria-hidden>
          <span className="h-2.5 w-2.5 rounded-full bg-current" />
        </span>
      </div>
      {hint ? (
        <p className="mt-4 border-t border-forest/8 pt-3 text-xs font-medium text-ink/70">{hint}</p>
      ) : null}
    </Card>
  );
}

export function Badge({
  children,
  tone = 'neutral',
  onImage = false,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'good' | 'warn' | 'bad' | 'gold';
  /** High-contrast styling for badges overlaid on listing photos. */
  onImage?: boolean;
}) {
  const toneClasses = onImage
    ? {
        neutral: 'bg-white/95 text-forest shadow-sm ring-1 ring-black/10 backdrop-blur-xs',
        good: 'bg-leaf text-white shadow-sm ring-1 ring-leaf/30 backdrop-blur-xs',
        warn: 'bg-harvest text-forest shadow-sm ring-1 ring-black/10 backdrop-blur-xs',
        bad: 'bg-clay text-white shadow-sm ring-1 ring-clay/30 backdrop-blur-xs',
        gold: 'bg-harvest text-forest shadow-sm ring-1 ring-black/10 backdrop-blur-xs',
      }
    : {
        neutral: 'bg-forest/8 text-forest border border-forest/10',
        good: 'bg-leaf/15 text-forest border border-leaf/20',
        warn: 'bg-harvest/20 text-soil border border-harvest/30',
        bad: 'bg-clay/15 text-clay border border-clay/20',
        gold: 'bg-harvest/25 text-soil border border-harvest/35',
      };
  const tones = toneClasses[tone];
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide',
        tones,
      )}
    >
      <span
        className={cx(
          'h-1.5 w-1.5 rounded-full',
          tone === 'good' ? 'bg-leaf' : tone === 'bad' ? 'bg-clay' : tone === 'warn' || tone === 'gold' ? 'bg-harvest' : 'bg-forest/40',
        )}
        aria-hidden
      />
      {children}
    </span>
  );
}

export function Alert({
  children,
  tone = 'bad',
}: {
  children: ReactNode;
  tone?: 'bad' | 'warn' | 'good' | 'neutral';
}) {
  const toneClasses = {
    bad: 'border-clay/25 border-s-clay bg-clay/8 text-clay',
    warn: 'border-harvest/35 border-s-harvest bg-harvest/15 text-soil',
    good: 'border-leaf/25 border-s-leaf bg-leaf/10 text-forest',
    neutral: 'border-forest/20 border-s-forest bg-forest/8 text-forest',
  }[tone];

  const iconClasses = {
    bad: 'text-clay',
    warn: 'text-soil',
    good: 'text-forest',
    neutral: 'text-forest',
  }[tone];

  return (
    <div
      className={cx(
        'flex items-start gap-3 rounded-xl border border-s-4 px-4 py-3 text-sm shadow-xs',
        toneClasses,
      )}
    >
      <svg
        viewBox="0 0 20 20"
        className={cx('mt-0.5 h-4 w-4 shrink-0', iconClasses)}
        fill="currentColor"
        aria-hidden
      >
        <path
          fillRule="evenodd"
          d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 6a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 6Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
          clipRule="evenodd"
        />
      </svg>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <Card className="text-center py-10 px-6 sm:px-12">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-forest/8 text-forest">
        <svg
          viewBox="0 0 24 24"
          className="h-7 w-7"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 14.93V18a1 1 0 0 1-2 0v-1.07A7.002 7.002 0 0 1 5.07 11H4a1 1 0 0 1 0-2h1.07A7.002 7.002 0 0 1 11 3.07V2a1 1 0 0 1 2 0v1.07A7.002 7.002 0 0 1 18.93 9H20a1 1 0 0 1 0 2h-1.07A7.002 7.002 0 0 1 13 16.93z" />
        </svg>
      </div>
      <h2 className="font-display text-2xl text-forest">{title}</h2>
      <p className="mt-2 text-ink/70 max-w-md mx-auto">{body}</p>
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
    </Card>
  );
}

export function Spinner() {
  return (
    <div className="flex min-h-40 items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-forest/15 border-t-leaf" />
    </div>
  );
}
