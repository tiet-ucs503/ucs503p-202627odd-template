// Sounds for the first three villains. Each villain is built from a different
// kind of sound, not from a different pitch of the same sound:
//
//   Green Goblin    buzzy and unstable: sawtooth waves with fast wobble and
//                   ring modulation. Signature: a three-chirp "cackle".
//   Doctor Octopus  a machine: hard square clicks and metallic FM clanks.
//                   Signature: an even, four-beat servo pulse.
//   Mysterio        airy and uncanny: pure tones slightly out of tune with each
//                   other, swelling in slowly and trailing a long echo. No beat.
//
// Sound positions: villains sit to the right; Mysterio is spread wide.

import type { Layer, Recipe } from '@/lib/effects/audio/synth';

// ── Green Goblin ─────────────────────────────────────────────────────────────
/** One "ha" of the cackle: a short, buzzy, rising chirp. */
const chirp = (at: number, from: number, to: number, gain = 0.3): Layer => ({
  source: 'sawtooth', at, dur: 0.09, freq: [from, to], gain, attack: 0.02,
  vibrato: { rate: 32, depth: 26 }, ring: 95, pan: 0.5, echo: 0.15,
});

const goblin: Recipe[] = [
  {
    id: 'goblin-glider-1', // entrance: the glider's whine swells in, then cuts
    layers: [
      { source: 'sawtooth', dur: 0.7, freq: [170, 430], gain: 0.28, attack: 0.3, vibrato: { rate: 14, depth: 16 }, ring: 55, pan: 0.5, echo: 0.15 },
      { source: 'noise', dur: 0.7, gain: 0.12, attack: 0.3, filter: { type: 'bandpass', freq: [500, 1900], q: 4 }, pan: 0.5 },
      { source: 'sawtooth', at: 0.62, dur: 0.1, freq: [430, 300], gain: 0.2, attack: 0.005, ring: 55, pan: 0.5 },
    ],
  },
  {
    id: 'goblin-glider-2',
    layers: [
      { source: 'sawtooth', dur: 0.6, freq: [230, 540], gain: 0.28, attack: 0.25, vibrato: { rate: 17, depth: 20 }, ring: 62, pan: 0.5, echo: 0.15 },
      { source: 'noise', dur: 0.6, gain: 0.12, attack: 0.25, filter: { type: 'bandpass', freq: [700, 2300], q: 4 }, pan: 0.5 },
      { source: 'sawtooth', at: 0.53, dur: 0.1, freq: [540, 360], gain: 0.2, attack: 0.005, ring: 62, pan: 0.5 },
    ],
  },
  {
    id: 'goblin-cackle-1', // rising three-chirp cackle with a falling tail
    layers: [chirp(0, 520, 700), chirp(0.11, 600, 820), chirp(0.22, 700, 980),
      { source: 'sawtooth', at: 0.33, dur: 0.22, freq: [980, 380], gain: 0.26, attack: 0.01, vibrato: { rate: 28, depth: 40 }, ring: 95, pan: 0.5, echo: 0.2 }],
  },
  {
    id: 'goblin-cackle-2', // falling cackle
    layers: [chirp(0, 860, 700), chirp(0.11, 740, 600), chirp(0.22, 640, 500),
      { source: 'sawtooth', at: 0.33, dur: 0.2, freq: [500, 300], gain: 0.26, attack: 0.01, vibrato: { rate: 24, depth: 34 }, ring: 80, pan: 0.5, echo: 0.2 }],
  },
  {
    id: 'goblin-pumpkin-1', // a pumpkin whistles across, then pops
    layers: [
      { source: 'sawtooth', dur: 0.22, freq: [920, 300], gain: 0.24, attack: 0.01, ring: 120, pan: 0.2 },
      { source: 'noise', at: 0.22, dur: 0.13, gain: 0.4, attack: 0.002, filter: { type: 'lowpass', freq: [1300, 280] }, pan: -0.4 },
      { source: 'square', at: 0.22, dur: 0.1, freq: [190, 85], gain: 0.2, attack: 0.002, pan: -0.4 },
    ],
  },
  {
    id: 'goblin-pumpkin-2',
    layers: [
      { source: 'sawtooth', dur: 0.2, freq: [780, 250], gain: 0.24, attack: 0.01, ring: 140, pan: 0.2 },
      { source: 'noise', at: 0.2, dur: 0.15, gain: 0.4, attack: 0.002, filter: { type: 'lowpass', freq: [1000, 240] }, pan: -0.4 },
      { source: 'square', at: 0.2, dur: 0.12, freq: [160, 70], gain: 0.2, attack: 0.002, pan: -0.4 },
    ],
  },
  {
    id: 'goblin-hit-1', // the glider wobbles and sputters
    layers: [
      { source: 'sawtooth', dur: 0.28, freq: [420, 140], gain: 0.28, attack: 0.005, vibrato: { rate: 38, depth: 60 }, ring: 70, pan: 0.5 },
      { source: 'noise', dur: 0.08, gain: 0.2, attack: 0.001, filter: { type: 'highpass', freq: [3000, 5000] }, pan: 0.5 },
    ],
  },
  {
    id: 'goblin-hit-2',
    layers: [
      { source: 'sawtooth', dur: 0.24, freq: [520, 180], gain: 0.28, attack: 0.005, vibrato: { rate: 46, depth: 70 }, ring: 84, pan: 0.5 },
      { source: 'noise', at: 0.04, dur: 0.1, gain: 0.2, attack: 0.001, filter: { type: 'highpass', freq: [2600, 4600] }, pan: 0.5 },
    ],
  },
  {
    id: 'goblin-taunt-1', // time-out: a slow, mocking two-chirp
    layers: [
      { ...chirp(0, 480, 620, 0.26), dur: 0.16 },
      { ...chirp(0.24, 420, 560, 0.26), dur: 0.2 },
    ],
  },
];

// ── Doctor Octopus ───────────────────────────────────────────────────────────
/** One tick of a servo motor: a hard, short, filtered square click. */
const click = (at: number, hz = 140, gain = 0.3): Layer => ({
  source: 'square', at, dur: 0.035, freq: [hz, hz], gain, attack: 0.001,
  filter: { type: 'bandpass', freq: [900, 900], q: 2 }, pan: 0.45,
});
/** Metal on metal: an inharmonic FM tone with a ringing tail. */
const clank = (at: number, hz: number, ratio: number, dur = 0.38, gain = 0.34): Layer => ({
  source: 'sine', at, dur, freq: [hz, hz * 0.97], gain, attack: 0.002, fm: { ratio, index: 3.5 }, pan: 0.45,
});

const docOck: Recipe[] = [
  { id: 'ock-servo-1', layers: [click(0), click(0.12), click(0.24), click(0.36), clank(0.36, 220, 1.41, 0.5, 0.26)] },
  { id: 'ock-servo-2', layers: [click(0, 120), click(0.12, 140), click(0.24, 160), click(0.36, 180), clank(0.36, 260, 1.41, 0.45, 0.26)] },
  {
    id: 'ock-clank-1', // an arm whirrs out and strikes
    layers: [
      { source: 'sine', dur: 0.18, freq: [90, 190], gain: 0.22, attack: 0.01, fm: { ratio: 2.76, index: 3 }, pan: 0.3 },
      click(0.18, 180, 0.34), clank(0.18, 310, 1.41),
    ],
  },
  {
    id: 'ock-clank-2',
    layers: [
      { source: 'sine', dur: 0.18, freq: [110, 230], gain: 0.22, attack: 0.01, fm: { ratio: 2.76, index: 3 }, pan: 0.3 },
      click(0.18, 200, 0.34), clank(0.18, 260, 3.5),
    ],
  },
  {
    id: 'ock-clank-3', // two arms, one after the other
    layers: [
      { source: 'sine', dur: 0.16, freq: [100, 210], gain: 0.2, attack: 0.01, fm: { ratio: 2.76, index: 3 }, pan: 0.3 },
      click(0.16, 170, 0.3), clank(0.16, 340, 1.41, 0.22, 0.3),
      click(0.3, 190, 0.3), clank(0.3, 250, 2.2, 0.36, 0.3),
    ],
  },
  {
    id: 'ock-clank-4',
    layers: [
      { source: 'sine', dur: 0.2, freq: [80, 170], gain: 0.22, attack: 0.01, fm: { ratio: 3.1, index: 3 }, pan: 0.3 },
      click(0.2, 160, 0.34), clank(0.2, 290, 2.2, 0.42),
    ],
  },
  {
    id: 'ock-hit-1', // metal scrapes and an arm recoils
    layers: [
      { source: 'sine', dur: 0.24, freq: [520, 200], gain: 0.3, attack: 0.002, fm: { ratio: 2.2, index: 6 }, pan: 0.45 },
      click(0, 220, 0.3), click(0.1, 150, 0.22),
    ],
  },
  {
    id: 'ock-hit-2',
    layers: [
      { source: 'sine', dur: 0.2, freq: [640, 240], gain: 0.3, attack: 0.002, fm: { ratio: 3.5, index: 5 }, pan: 0.45 },
      click(0, 240, 0.3), click(0.08, 170, 0.22),
    ],
  },
  {
    id: 'ock-taunt-1', // time-out: two slow servo ticks over a low mechanical hum
    layers: [
      click(0, 110, 0.28), click(0.3, 110, 0.28),
      { source: 'sine', dur: 0.6, freq: [70, 70], gain: 0.2, attack: 0.05, fm: { ratio: 1.41, index: 1.5 }, pan: 0.45 },
    ],
  },
];

// ── Mysterio ─────────────────────────────────────────────────────────────────
/** A pair of pure tones a few Hz apart, left and right: they shimmer against each other. */
const pair = (at: number, from: number, to: number, dur: number, attack: number, gain = 0.2): Layer[] => [
  { source: 'sine', at, dur, freq: [from, to], gain, attack, pan: -0.7, echo: 0.65 },
  { source: 'sine', at, dur, freq: [from * 1.012, to * 1.012], gain, attack, pan: 0.7, echo: 0.65 },
];

const mysterio: Recipe[] = [
  { id: 'mysterio-mist-1', layers: [...pair(0, 330, 330, 1.1, 0.6), { source: 'sine', at: 0.2, dur: 0.9, freq: [495, 495], gain: 0.14, attack: 0.5, echo: 0.7 }] },
  { id: 'mysterio-mist-2', layers: [...pair(0, 294, 294, 1.1, 0.6), { source: 'sine', at: 0.2, dur: 0.9, freq: [441, 441], gain: 0.14, attack: 0.5, echo: 0.7 }] },
  {
    id: 'mysterio-illusion-1', // a rising swell that ends suddenly, then a high shimmer
    layers: [...pair(0, 440, 660, 0.5, 0.45), { source: 'triangle', at: 0.45, dur: 0.32, freq: [1320, 1980], gain: 0.1, attack: 0.01, echo: 0.8 }],
  },
  {
    id: 'mysterio-illusion-2', // the same gesture, falling
    layers: [...pair(0, 660, 440, 0.5, 0.45), { source: 'triangle', at: 0.45, dur: 0.32, freq: [1760, 1100], gain: 0.1, attack: 0.01, echo: 0.8 }],
  },
  {
    id: 'mysterio-illusion-3', // an uneasy interval
    layers: [...pair(0, 440, 466, 0.5, 0.45), { source: 'sine', dur: 0.5, freq: [622, 659], gain: 0.16, attack: 0.45, echo: 0.7 },
      { source: 'triangle', at: 0.45, dur: 0.32, freq: [1480, 1480], gain: 0.1, attack: 0.01, echo: 0.8 }],
  },
  {
    id: 'mysterio-hit-1', // the illusion cracks like glass
    layers: [...pair(0, 1760, 880, 0.32, 0.005, 0.18), { source: 'noise', dur: 0.05, gain: 0.16, attack: 0.001, filter: { type: 'highpass', freq: [4000, 6000] }, echo: 0.6 }],
  },
  {
    id: 'mysterio-hit-2',
    layers: [...pair(0, 2093, 1046, 0.28, 0.005, 0.18), { source: 'noise', at: 0.03, dur: 0.05, gain: 0.16, attack: 0.001, filter: { type: 'highpass', freq: [3500, 5500] }, echo: 0.6 }],
  },
  {
    id: 'mysterio-taunt-1', // time-out: a slow, wavering low tone
    layers: [
      { source: 'sine', dur: 0.9, freq: [220, 208], gain: 0.22, attack: 0.4, vibrato: { rate: 3, depth: 14 }, pan: -0.6, echo: 0.65 },
      { source: 'sine', dur: 0.9, freq: [223, 211], gain: 0.22, attack: 0.4, vibrato: { rate: 3.4, depth: 14 }, pan: 0.6, echo: 0.65 },
    ],
  },
];

// ── Signature moves (second wrong answer in a row) and defeats ──
goblin.push(
  {
    id: 'goblin-special-1', // two pumpkins, then a cackle
    layers: [
      { source: 'sawtooth', dur: 0.2, freq: [920, 300], gain: 0.24, attack: 0.01, ring: 120, pan: 0.2 },
      { source: 'noise', at: 0.22, dur: 0.12, gain: 0.38, attack: 0.002, filter: { type: 'lowpass', freq: [1300, 280] }, pan: -0.4 },
      { source: 'sawtooth', at: 0.3, dur: 0.2, freq: [800, 260], gain: 0.24, attack: 0.01, ring: 140, pan: 0.2 },
      { source: 'noise', at: 0.52, dur: 0.13, gain: 0.4, attack: 0.002, filter: { type: 'lowpass', freq: [1100, 240] }, pan: -0.4 },
      chirp(0.68, 600, 820), chirp(0.79, 700, 980), chirp(0.9, 820, 1100),
    ],
  },
  {
    id: 'goblin-defeat-1', // the glider sputters and drops
    layers: [
      { source: 'sawtooth', dur: 0.9, freq: [420, 90], gain: 0.28, attack: 0.01, vibrato: { rate: 22, depth: 70 }, ring: 60, pan: 0.5, echo: 0.15 },
      { source: 'noise', dur: 0.5, gain: 0.12, attack: 0.2, filter: { type: 'bandpass', freq: [1500, 400], q: 4 }, pan: 0.5 },
    ],
  },
);

docOck.push(
  {
    id: 'ock-special-1', // all four arms, one after another
    layers: [
      click(0), clank(0, 310, 1.41, 0.2, 0.3),
      click(0.14, 170), clank(0.14, 260, 3.5, 0.2, 0.3),
      click(0.28, 190), clank(0.28, 340, 2.2, 0.2, 0.3),
      click(0.42, 210), clank(0.42, 290, 1.41, 0.42, 0.34),
    ],
  },
  {
    id: 'ock-defeat-1', // the servos wind down, each click later than the last
    layers: [
      click(0), click(0.14), click(0.32), click(0.56), click(0.86),
      { source: 'sine', dur: 1.0, freq: [180, 60], gain: 0.24, attack: 0.02, fm: { ratio: 1.41, index: 2.5 }, pan: 0.45 },
    ],
  },
);

mysterio.push(
  {
    id: 'mysterio-special-1', // two swells at once: the illusion doubles
    layers: [...pair(0, 440, 660, 0.5, 0.45), ...pair(0, 330, 495, 0.5, 0.45, 0.16),
      { source: 'triangle', at: 0.45, dur: 0.4, freq: [1320, 2640], gain: 0.1, attack: 0.01, echo: 0.8 }],
  },
  {
    id: 'mysterio-defeat-1', // the illusion collapses: a long fall and a crack in the dome
    layers: [...pair(0, 660, 220, 1.0, 0.02, 0.2),
      { source: 'noise', at: 0.1, dur: 0.06, gain: 0.16, attack: 0.001, filter: { type: 'highpass', freq: [4000, 6000] }, echo: 0.6 }],
  },
);

export const VILLAIN_RECIPES_1: Recipe[] = [...goblin, ...docOck, ...mysterio];
