// How mastery is shown on screen. Presentation only: the server sends a band
// and a percentage already limited to 5-95 (backend/services/mastery_display.py).
// The band in words comes first; the percentage is an estimate.

export type MasteryBand = 'needs_practice' | 'developing' | 'strong';

export const DISPLAY_MIN_PCT = 5;
export const DISPLAY_MAX_PCT = 95;

/** "5% or less", "62%", "95% or more": the limits are worded as limits. */
export function formatMastery(pct: number): string {
  if (pct <= DISPLAY_MIN_PCT) return `${DISPLAY_MIN_PCT}% or less`;
  if (pct >= DISPLAY_MAX_PCT) return `${DISPLAY_MAX_PCT}% or more`;
  return `${pct}%`;
}

const BANDS: Record<MasteryBand, { label: string; bar: string; text: string }> = {
  needs_practice: { label: 'Needs practice', bar: 'bg-amber-500', text: 'text-amber-400' },
  developing: { label: 'Developing', bar: 'bg-blue-500', text: 'text-blue-300' },
  strong: { label: 'Strong', bar: 'bg-green-500', text: 'text-green-400' },
};

const NOT_STARTED = { label: 'Not started', bar: 'bg-transparent', text: 'text-gray-500' };

export function bandInfo(band: MasteryBand | null) {
  return band ? BANDS[band] : NOT_STARTED;
}
