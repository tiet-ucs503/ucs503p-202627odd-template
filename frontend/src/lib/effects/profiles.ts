// Which effects each character has for each gameplay event.
//
// For one event, up to three lists are consulted and each contributes one
// variation: the shared list, Spider-Man's list, and the current villain's
// list. That is how a strike can be Spider-Man's web sound plus the villain's
// own reaction.
//
// F2 routes the sounds the game already had through this table. Visual cues
// and each villain's own sound family arrive in later phases.

import type { GameEventType } from '@/lib/effects/events';
import type { SoundCategory } from '@/lib/effects/audio/engine';
import type { Pickable } from '@/lib/effects/variation';
import { SAMPLES } from '@/lib/effects/audio/recipes';

export interface SoundStep {
  /** Milliseconds after the effect starts. */
  atMs: number;
  /** A synthesised sound from recipes.ts, or... */
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
  target: 'player' | 'villain' | 'strip';
  durMs: number;
}

export interface Variation extends Pickable {
  sounds: SoundStep[];
  cues: CueStep[];
}

export type Profile = Partial<Record<GameEventType, Variation[]>>;

const sound = (id: string, recipe: string, category: SoundCategory = 'impact'): Variation => ({
  id, sounds: [{ atMs: 0, recipe, category }], cues: [],
});

const sample = (id: string, url: string, category: SoundCategory, extra: Partial<Variation> & { maxSeconds?: number } = {}): Variation => ({
  id, minGap: extra.minGap, sounds: [{ atMs: 0, sample: url, category, maxSeconds: extra.maxSeconds }], cues: [],
});

/** Used whichever villain is on screen. */
export const SHARED: Profile = {
  villain_attack: [sound('counter-1', 'counter-thud-1'), sound('counter-2', 'counter-thud-2')],
  time_out: [sound('time-out-1', 'time-out-1', 'ui')],
  hint: [sound('gwen-1', 'gwen-chirp-1', 'ui'), sound('gwen-2', 'gwen-chirp-2', 'ui')],
  defeat: [sound('defeat-1', 'defeat-1', 'music')],
  victory: [sample('jingle', SAMPLES.victoryJingle, 'music', { maxSeconds: 6 })],
};

export const SPIDERMAN: Profile = {
  player_strike: [
    sound('thwip-1', 'spidey-thwip-1'),
    sound('thwip-2', 'spidey-thwip-2'),
    sound('thwip-3', 'spidey-thwip-3'),
  ],
};

export const VILLAINS: Record<string, Profile> = {
  goblin: {
    // The recorded laugh is a rare taunt: at most once in every three counter-attacks.
    villain_attack: [sample('laugh', SAMPLES.goblinLaugh, 'voice', { minGap: 2 })],
  },
  'doc-ock': {
    villain_attack: [sample('drotto', SAMPLES.drotto, 'voice', { minGap: 1 })],
    player_strike: [sample('drotto-losing', SAMPLES.drottoLosing, 'voice', { minGap: 2 })],
  },
  mysterio: {},
  venom: {},
  lizard: {},
  kingpin: {},
};

export const CHARACTER_IDS = ['spiderman', ...Object.keys(VILLAINS)] as const;
