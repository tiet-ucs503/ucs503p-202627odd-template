// Sounds for Venom, The Lizard and Kingpin. As with the first three villains,
// each is built from a different kind of sound:
//
//   Venom       dark and wet: a sub-bass tone under low-passed noise whose
//               filter slides, so it growls. Signature: one long growl that
//               ends in a sudden snap.
//   The Lizard  thin and sharp: high-passed noise (a hiss) and an instant
//               broadband crack (a tail whip). Signature: hiss, pause, crack.
//   Kingpin     heavy and slow: a thud whose pitch drops, with a small wooden
//               click (his cane). Signature: one or two deliberate beats in a
//               big, echoing room.
//
// Very low tones are faint on laptop speakers, so each low sound also carries
// some energy higher up (the growl's noise, the thud's start, the click).

import type { Layer, Recipe } from '@/lib/effects/audio/synth';

// ── Venom ────────────────────────────────────────────────────────────────────
/** A growl: a sub-bass tone with dark, "wet" noise whose filter opens as it swells. */
const growl = (at: number, dur: number, from: number, to: number, gain = 0.5): Layer[] => [
  { source: 'sine', at, dur, freq: [from, to], gain, attack: dur * 0.5, pan: 0.5 },
  { source: 'noise', at, dur, gain: gain * 0.7, attack: dur * 0.5, filter: { type: 'lowpass', freq: [180, 720], q: 7 }, pan: 0.5 },
];
/** The snap at the end of a lash: a short dark burst with a falling thump. */
const snap = (at: number, gain = 0.45): Layer[] => [
  { source: 'noise', at, dur: 0.07, gain, attack: 0.001, filter: { type: 'lowpass', freq: [950, 200], q: 3 }, pan: 0.2 },
  { source: 'sine', at, dur: 0.13, freq: [88, 46], gain: gain * 0.9, attack: 0.002, pan: 0.2 },
];

const venom: Recipe[] = [
  { id: 'venom-emerge-1', layers: growl(0, 0.9, 48, 76) },
  { id: 'venom-emerge-2', layers: growl(0, 0.8, 70, 44) },
  { id: 'venom-lash-1', layers: [...growl(0, 0.3, 60, 84), ...snap(0.3)] },
  { id: 'venom-lash-2', layers: [...growl(0, 0.24, 72, 56), ...snap(0.24)] },
  { id: 'venom-lash-3', layers: [...growl(0, 0.2, 58, 78, 0.4), ...snap(0.2, 0.4), ...snap(0.34, 0.45)] },
  {
    id: 'venom-hit-1', // a wet recoil
    layers: [
      { source: 'sine', dur: 0.3, freq: [86, 40], gain: 0.5, attack: 0.004, pan: 0.5 },
      { source: 'noise', dur: 0.3, gain: 0.36, attack: 0.004, filter: { type: 'lowpass', freq: [760, 150], q: 6 }, pan: 0.5 },
    ],
  },
  {
    id: 'venom-hit-2',
    layers: [
      { source: 'sine', dur: 0.26, freq: [74, 38], gain: 0.5, attack: 0.004, pan: 0.5 },
      { source: 'noise', dur: 0.26, gain: 0.36, attack: 0.004, filter: { type: 'lowpass', freq: [620, 130], q: 8 }, pan: 0.5 },
    ],
  },
  {
    id: 'venom-taunt-1', // time-out: a long, low, rumbling growl
    layers: [
      { source: 'sine', dur: 0.85, freq: [52, 46], gain: 0.5, attack: 0.3, vibrato: { rate: 6, depth: 5 }, pan: 0.5 },
      { source: 'noise', dur: 0.85, gain: 0.32, attack: 0.3, filter: { type: 'lowpass', freq: [240, 480], q: 7 }, pan: 0.5 },
    ],
  },
  { id: 'venom-taunt-2', layers: growl(0, 0.7, 64, 50, 0.48) },
];

// ── The Lizard ───────────────────────────────────────────────────────────────
/** A hiss: thin, high noise that builds. */
const hiss = (at: number, dur: number, gain = 0.3): Layer => ({
  source: 'noise', at, dur, gain, attack: dur * 0.7, filter: { type: 'highpass', freq: [2600, 6200] }, pan: 0.45,
});
/** A whip crack: an instant burst across the whole range. */
const crack = (at: number, gain = 0.5): Layer => ({
  source: 'noise', at, dur: 0.045, gain, attack: 0.001, filter: { type: 'highpass', freq: [1300, 1300] }, pan: 0.2,
});
/** One claw scratch: a very short, bright scrape. */
const scratch = (at: number): Layer => ({
  source: 'noise', at, dur: 0.04, gain: 0.34, attack: 0.002, filter: { type: 'highpass', freq: [3400, 5200] }, pan: 0.2,
});

const lizard: Recipe[] = [
  { id: 'lizard-prowl-1', layers: [hiss(0, 0.6), hiss(0.38, 0.42, 0.26)] },
  { id: 'lizard-prowl-2', layers: [hiss(0, 0.45, 0.26), hiss(0.3, 0.55)] },
  { id: 'lizard-claw-1', layers: [hiss(0, 0.18), crack(0.26)] }, // hiss, pause, crack
  {
    id: 'lizard-claw-2', // the tail swishes round, then cracks
    layers: [
      { source: 'noise', dur: 0.16, gain: 0.3, attack: 0.08, filter: { type: 'highpass', freq: [1500, 4800] }, pan: 0.45 },
      crack(0.17),
    ],
  },
  { id: 'lizard-claw-3', layers: [scratch(0), scratch(0.07), scratch(0.14), crack(0.24, 0.45)] },
  {
    id: 'lizard-hit-1', // a sharp, angry hiss
    layers: [crack(0, 0.4), { source: 'noise', dur: 0.26, gain: 0.3, attack: 0.005, filter: { type: 'highpass', freq: [5200, 2200] }, pan: 0.45 }],
  },
  {
    id: 'lizard-hit-2',
    layers: [crack(0, 0.4), { source: 'noise', dur: 0.22, gain: 0.3, attack: 0.005, filter: { type: 'highpass', freq: [6000, 2800] }, pan: 0.45 }],
  },
  { id: 'lizard-taunt-1', layers: [hiss(0, 0.75, 0.28), scratch(0.55)] },
  { id: 'lizard-taunt-2', layers: [hiss(0, 0.3, 0.24), hiss(0.34, 0.4, 0.28)] },
];

// ── Kingpin ──────────────────────────────────────────────────────────────────
/** A heavy thud in a big room: the pitch drops as it lands. */
const thud = (at: number, gain = 0.6, from = 150): Layer[] => [
  { source: 'sine', at, dur: 0.42, freq: [from, 42], gain, attack: 0.003, pan: 0.25, echo: 0.4 },
  { source: 'noise', at, dur: 0.1, gain: gain * 0.4, attack: 0.001, filter: { type: 'lowpass', freq: [420, 120] }, pan: 0.25, echo: 0.3 },
];
/** The tap of his cane: a small, dry, wooden click. */
const tap = (at: number, gain = 0.3): Layer => ({
  source: 'triangle', at, dur: 0.03, freq: [1000, 880], gain, attack: 0.001, pan: 0.25, echo: 0.35,
});

const kingpin: Recipe[] = [
  { id: 'kingpin-step-1', layers: [...thud(0), tap(0.5)] },
  { id: 'kingpin-step-2', layers: [tap(0), ...thud(0.28)] },
  { id: 'kingpin-cane-1', layers: [tap(0), ...thud(0.16)] },
  { id: 'kingpin-cane-2', layers: [...thud(0, 0.62, 170), tap(0.02, 0.2)] },
  { id: 'kingpin-cane-3', layers: [tap(0), tap(0.2), ...thud(0.4)] }, // slow and deliberate
  {
    id: 'kingpin-hit-1', // he barely moves: a muffled thump
    layers: [
      { source: 'sine', dur: 0.26, freq: [112, 48], gain: 0.42, attack: 0.004, pan: 0.25, echo: 0.3 },
      tap(0.01, 0.16),
    ],
  },
  {
    id: 'kingpin-hit-2',
    layers: [
      { source: 'sine', dur: 0.22, freq: [128, 54], gain: 0.42, attack: 0.004, pan: 0.25, echo: 0.3 },
      tap(0.04, 0.16),
    ],
  },
  {
    id: 'kingpin-taunt-1', // time-out: two slow cane taps over a low hum
    layers: [tap(0), tap(0.45), { source: 'sine', dur: 0.75, freq: [110, 52], gain: 0.3, attack: 0.1, pan: 0.25, echo: 0.3 }],
  },
  { id: 'kingpin-taunt-2', layers: [tap(0, 0.26), ...thud(0.3, 0.4, 120)] },
];

export const VILLAIN_RECIPES_2: Recipe[] = [...venom, ...lizard, ...kingpin];
