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
  /** player/villain = that character's portrait; strip = the lane between them;
   *  gwen = her avatar by the hint button; end = the icon on the end screen. */
  target: 'player' | 'villain' | 'strip' | 'gwen' | 'end';
  durMs: number;
}

export interface Variation extends Pickable {
  sounds: SoundStep[];
  cues: CueStep[];
}

export type Profile = Partial<Record<GameEventType, Variation[]>>;

const sound = (id: string, recipe: string, category: SoundCategory = 'impact', cues: CueStep[] = []): Variation => ({
  id, sounds: [{ atMs: 0, recipe, category }], cues,
});

const cue = (atMs: number, name: string, target: CueStep['target'], durMs: number): CueStep => ({
  atMs, cue: name, target, durMs,
});

// The web reaches the villain 180 ms after it is fired, in step with the sound's impact layer.
const WEB_TRAVEL_MS = 180;
const webStrike = (id: string, recipe: string, line: string, splat: string): Variation => ({
  id,
  sounds: [{ atMs: 0, recipe, category: 'impact' }],
  cues: [
    cue(0, line, 'strip', 260),
    cue(WEB_TRAVEL_MS, splat, 'villain', 300),
    cue(WEB_TRAVEL_MS, 'react-recoil', 'villain', 260),
    cue(WEB_TRAVEL_MS, 'spark-burst', 'strip', 320),
  ],
});

const sample = (id: string, url: string, category: SoundCategory, extra: Partial<Variation> & { maxSeconds?: number } = {}): Variation => ({
  id, minGap: extra.minGap, sounds: [{ atMs: 0, sample: url, category, maxSeconds: extra.maxSeconds }], cues: [],
});

/** Used whichever villain is on screen. */
export const SHARED: Profile = {
  // The villain steps into view. Each villain's own entrance arrives with its profile.
  mission_start: [{ id: 'enter', sounds: [], cues: [cue(0, 'react-enter', 'villain', 500)] }],
  // Spider-Man takes the hit: his portrait flinches. The shake is 4px for a quarter of a second.
  villain_attack: [
    sound('counter-1', 'counter-thud-1', 'impact', [cue(60, 'react-hit', 'player', 250)]),
    sound('counter-2', 'counter-thud-2', 'impact', [cue(60, 'react-hit', 'player', 250)]),
  ],
  time_out: [sound('time-out-1', 'time-out-1', 'ui', [cue(0, 'react-dim', 'player', 400)])],
  hint: [
    sound('gwen-1', 'gwen-chirp-1', 'ui', [cue(0, 'gwen-ripple', 'gwen', 600)]),
    sound('gwen-2', 'gwen-chirp-2', 'ui', [cue(0, 'gwen-ripple', 'gwen', 600)]),
  ],
  defeat: [sound('defeat-1', 'defeat-1', 'music', [cue(0, 'defeat-sink', 'end', 700)])],
  victory: [{
    ...sample('jingle', SAMPLES.victoryJingle, 'music', { maxSeconds: 6 }),
    cues: [cue(0, 'victory-pop', 'end', 700)],
  }],
};

export const SPIDERMAN: Profile = {
  player_strike: [
    webStrike('thwip-1', 'spidey-thwip-1', 'web-line-1', 'web-splat-1'),
    webStrike('thwip-2', 'spidey-thwip-2', 'web-line-2', 'web-splat-2'),
    webStrike('thwip-3', 'spidey-thwip-3', 'web-line-3', 'web-splat-3'),
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
