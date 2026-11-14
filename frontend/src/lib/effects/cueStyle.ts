// Turns the cues currently aimed at a character into classes and style values.

import type { CSSProperties } from 'react';
import { cueClass, CUES } from '@/lib/effects/cues';
import type { ActiveCue } from '@/lib/effects/director';

/** Sets the animation length for one cue. */
export const cueDuration = (cue: ActiveCue): CSSProperties => ({ ['--fx-dur' as string]: `${cue.durMs}ms` });

/** The reaction classes currently applying to a character's portrait. */
export function reactionClasses(cues: ActiveCue[]): string {
  return cues
    .filter((cue) => CUES[cue.cue]?.kind === 'reaction')
    .map((cue) => cueClass(cue.cue, cue.reducedMotion))
    .filter(Boolean)
    .join(' ');
}

/** Direction and length for the reactions now applying. Left-side characters lean left, right-side lean right. */
export function reactionStyle(cues: ActiveCue[], side: 'left' | 'right'): CSSProperties {
  const reactions = cues.filter((cue) => CUES[cue.cue]?.kind === 'reaction');
  return {
    ['--fx-dir' as string]: side === 'right' ? 1 : -1,
    ...(reactions.length ? { ['--fx-dur' as string]: `${Math.max(...reactions.map((c) => c.durMs))}ms` } : {}),
  };
}
