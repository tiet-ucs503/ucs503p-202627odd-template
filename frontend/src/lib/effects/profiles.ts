// Which effects each character has for each gameplay event.
//
// For one event, up to three lists are consulted and each contributes one
// variation: the shared list, Spider-Man's list, and the current villain's
// list. That is how a strike can be Spider-Man's web sound plus the villain's
// own reaction.
//
// Where the villain has its own effects for an event, they replace the shared
// ones, and replace the generic way a villain reacts to being hit.

import type { SoundCategory } from '@/lib/effects/audio/engine';
import { SAMPLES } from '@/lib/effects/audio/recipes';
import { cue, CueStep, Profile, Variation } from '@/lib/effects/profileTypes';
import { DOC_OCK, GOBLIN, MYSTERIO } from '@/lib/effects/profiles.villains1';
import { KINGPIN, LIZARD, VENOM } from '@/lib/effects/profiles.villains2';

export type { CueStep, Profile, SoundStep, Variation } from '@/lib/effects/profileTypes';

const sound = (id: string, recipe: string, category: SoundCategory = 'impact', cues: CueStep[] = []): Variation => ({
  id, sounds: [{ atMs: 0, recipe, category }], cues,
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
  // The villain reels once, when half its health is gone. It looks weakened from then on.
  villain_staggered: [{ id: 'stagger', sounds: [], cues: [cue(460, 'react-stagger', 'villain', 420)] }],
  // Fallback for a villain with no defeat of its own.
  villain_defeated: [{ id: 'collapse', sounds: [], cues: [cue(0, 'react-collapse', 'villain', 700)] }],
  victory: [{
    ...sample('jingle', SAMPLES.victoryJingle, 'music', { maxSeconds: 6 }),
    cues: [cue(0, 'victory-pop', 'end', 700)],
  }],
};

// A combo: web shots 110 ms apart, in step with the barrage sound. The longer
// the streak, the more shots; at seven a web net closes round the villain.
const SHOT_GAP_MS = 110;
const combo = (id: string, recipe: string, forStreak: number, shots: number, splat: string, net = false): Variation => {
  const lastShotLands = (shots - 1) * SHOT_GAP_MS + WEB_TRAVEL_MS;
  return {
    id,
    forStreak,
    sounds: [{ atMs: 0, recipe, category: 'impact' }],
    cues: [
      ...Array.from({ length: shots }, (_, i) => cue(i * SHOT_GAP_MS, `web-line-${(i % 3) + 1}`, 'strip', 260)),
      cue(WEB_TRAVEL_MS, 'react-recoil', 'villain', 260),
      cue(WEB_TRAVEL_MS, 'spark-burst', 'strip', 320),
      cue(lastShotLands, 'spark-burst', 'strip', 320),
      cue(lastShotLands, splat, 'villain', 300), // one web only, so the portrait stays clear
      ...(net ? [cue(lastShotLands, 'web-net', 'villain', 600)] : []),
    ],
  };
};

export const SPIDERMAN: Profile = {
  combo_special: [
    combo('barrage-3a', 'spidey-barrage-3a', 3, 3, 'web-splat-1'),
    combo('barrage-3b', 'spidey-barrage-3b', 3, 3, 'web-splat-2'),
    combo('barrage-5a', 'spidey-barrage-5a', 5, 4, 'web-splat-3'),
    combo('barrage-5b', 'spidey-barrage-5b', 5, 4, 'web-splat-1'),
    combo('barrage-7', 'spidey-barrage-7', 7, 5, 'web-splat-2', true),
  ],
  player_strike: [
    webStrike('thwip-1', 'spidey-thwip-1', 'web-line-1', 'web-splat-1'),
    webStrike('thwip-2', 'spidey-thwip-2', 'web-line-2', 'web-splat-2'),
    webStrike('thwip-3', 'spidey-thwip-3', 'web-line-3', 'web-splat-3'),
  ],
};

/**
 * Each villain's own effects. Where a villain has effects for an event they
 * replace the shared ones (see director.ts). The shared effects remain as the
 * fallback, and still supply hints, victory and defeat.
 */
export const VILLAINS: Record<string, Profile> = {
  goblin: GOBLIN,
  'doc-ock': DOC_OCK,
  mysterio: MYSTERIO,
  venom: VENOM,
  lizard: LIZARD,
  kingpin: KINGPIN,
};

export const CHARACTER_IDS = ['spiderman', ...Object.keys(VILLAINS)] as const;
