// The shape of an effect, and small helpers for writing profiles.

import type { GameEventType } from '@/lib/effects/events';
import type { SoundCategory } from '@/lib/effects/audio/engine';
import type { Pickable } from '@/lib/effects/variation';

export interface SoundStep {
  /** Milliseconds after the effect starts. */
  atMs: number;
  /** A synthesised sound from the recipes, or... */
  recipe?: string;
  /** ...one of the existing audio files. */
  sample?: string;
  category: SoundCategory;
  maxSeconds?: number;
}

export interface CueStep {
  atMs: number;
  /** Name of a visual cue drawn by the effects layer. */
  cue: string;
  /** player/villain = that character's portrait; strip = the lane between them;
   *  gwen = her avatar by the hint button; end = the icon on the end screen. */
  target: 'player' | 'villain' | 'strip' | 'gwen' | 'end';
  durMs: number;
}

export interface Variation extends Pickable {
  sounds: SoundStep[];
  cues: CueStep[];
  /** Only used when the correct streak is exactly this long (for combo specials). */
  forStreak?: number;
}

export type Profile = Partial<Record<GameEventType, Variation[]>>;

export const cue = (atMs: number, name: string, target: CueStep['target'], durMs: number): CueStep => ({
  atMs, cue: name, target, durMs,
});

/** A synthesised sound starting `atMs` after the effect begins. */
export const synth = (recipe: string, category: SoundCategory = 'impact', atMs = 0): SoundStep => ({ atMs, recipe, category });

/** One of the existing audio files. */
export const file = (url: string, category: SoundCategory = 'voice', atMs = 0, maxSeconds?: number): SoundStep => ({
  atMs, sample: url, category, maxSeconds,
});
