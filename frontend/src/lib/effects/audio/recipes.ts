// Sound recipes. Each one is two or three layers: a sharp start, a body, a tail.
//
// F2 holds the shared sounds and Spider-Man's basic strike. Each villain's own
// sound family is added in its own phase and reviewed by ear before it ships.

import type { Recipe } from '@/lib/effects/audio/synth';
import { VILLAIN_RECIPES_1 } from '@/lib/effects/audio/recipes.villains1';

const list: Recipe[] = [
  // ── Spider-Man: web "thwip" (noise swept upward) with a plucked tone ──
  {
    id: 'spidey-thwip-1',
    layers: [
      { source: 'noise', dur: 0.16, gain: 0.5, attack: 0.002, filter: { type: 'bandpass', freq: [900, 5200], q: 3 }, pan: -0.5 },
      { source: 'triangle', dur: 0.2, freq: [880, 240], gain: 0.28, attack: 0.002, pan: -0.4 },
      { source: 'noise', at: 0.17, dur: 0.07, gain: 0.3, attack: 0.001, filter: { type: 'lowpass', freq: [1800, 400] }, pan: 0.4 },
    ],
  },
  {
    id: 'spidey-thwip-2',
    layers: [
      { source: 'noise', dur: 0.13, gain: 0.5, attack: 0.002, filter: { type: 'bandpass', freq: [1300, 6200], q: 4 }, pan: -0.5 },
      { source: 'triangle', dur: 0.17, freq: [1040, 300], gain: 0.26, attack: 0.002, pan: -0.4 },
      { source: 'noise', at: 0.14, dur: 0.08, gain: 0.32, attack: 0.001, filter: { type: 'lowpass', freq: [2200, 500] }, pan: 0.4 },
    ],
  },
  {
    id: 'spidey-thwip-3',
    layers: [
      { source: 'noise', dur: 0.2, gain: 0.45, attack: 0.004, filter: { type: 'bandpass', freq: [700, 4200], q: 2.5 }, pan: -0.5 },
      { source: 'triangle', dur: 0.24, freq: [740, 200], gain: 0.28, attack: 0.002, pan: -0.4 },
      { source: 'noise', at: 0.21, dur: 0.06, gain: 0.3, attack: 0.001, filter: { type: 'lowpass', freq: [1500, 350] }, pan: 0.4 },
    ],
  },

  // ── Shared: a villain's counter-attack before that villain has its own sounds ──
  {
    id: 'counter-thud-1',
    layers: [
      { source: 'sine', dur: 0.28, freq: [170, 55], gain: 0.6, attack: 0.003, pan: 0.4 },
      { source: 'noise', dur: 0.09, gain: 0.3, attack: 0.001, filter: { type: 'lowpass', freq: [1400, 300] }, pan: 0.4 },
    ],
  },
  {
    id: 'counter-thud-2',
    layers: [
      { source: 'sine', dur: 0.34, freq: [140, 48], gain: 0.6, attack: 0.003, pan: 0.4 },
      { source: 'square', dur: 0.07, freq: [300, 120], gain: 0.14, attack: 0.001, filter: { type: 'lowpass', freq: [900, 300] }, pan: 0.4 },
      { source: 'noise', dur: 0.12, gain: 0.26, attack: 0.001, filter: { type: 'lowpass', freq: [1000, 250] }, pan: 0.4 },
    ],
  },

  // ── Shared: ran out of time (two soft falling notes) ──
  {
    id: 'time-out-1',
    layers: [
      { source: 'sine', dur: 0.22, freq: [520, 500], gain: 0.3, attack: 0.01, echo: 0.2 },
      { source: 'sine', at: 0.2, dur: 0.34, freq: [390, 370], gain: 0.3, attack: 0.01, echo: 0.2 },
    ],
  },

  // ── Shared: mission lost (slow, low, falling; not harsh) ──
  {
    id: 'defeat-1',
    layers: [
      { source: 'triangle', dur: 0.9, freq: [330, 110], gain: 0.34, attack: 0.02, echo: 0.3 },
      { source: 'sine', at: 0.1, dur: 1.0, freq: [165, 55], gain: 0.3, attack: 0.05 },
    ],
  },

  // ── Gwen: two-note comm chirp ──
  {
    id: 'gwen-chirp-1',
    layers: [
      { source: 'sine', dur: 0.09, freq: [1320, 1320], gain: 0.26, attack: 0.004, pan: -0.3, echo: 0.25 },
      { source: 'sine', at: 0.09, dur: 0.16, freq: [1760, 1760], gain: 0.26, attack: 0.004, pan: -0.3, echo: 0.25 },
    ],
  },
  {
    id: 'gwen-chirp-2',
    layers: [
      { source: 'sine', dur: 0.08, freq: [1175, 1175], gain: 0.26, attack: 0.004, pan: -0.3, echo: 0.25 },
      { source: 'sine', at: 0.08, dur: 0.08, freq: [1480, 1480], gain: 0.24, attack: 0.004, pan: -0.3, echo: 0.25 },
      { source: 'sine', at: 0.16, dur: 0.16, freq: [1760, 1760], gain: 0.24, attack: 0.004, pan: -0.3, echo: 0.25 },
    ],
  },
];

export const RECIPES: Record<string, Recipe> = Object.fromEntries(
  [...list, ...VILLAIN_RECIPES_1].map((r) => [r.id, r]),
);

/** The audio files that already existed in the project. */
export const SAMPLES = {
  goblinLaugh: '/green_goblin_laugh.mp3',
  drotto: '/drotto.wav',
  drottoLosing: '/drottoloosing.wav',
  victoryJingle: '/spiderman-meme-song.mp3',
  unreviewedLaugh: '/laugh.mp3', // in the repo but never used; listed on the soundboard for review only
} as const;
