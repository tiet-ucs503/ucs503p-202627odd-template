// Venom, The Lizard and Kingpin.
//
// As with the first three villains, a villain's own effects replace the shared
// ones, and every attack carries the moment Spider-Man's portrait flinches,
// timed to when that attack actually arrives.

import { cue, Profile, synth, Variation } from '@/lib/effects/profileTypes';

/** Spider-Man's web reaches the villain this long after a correct answer. */
const WEB_ARRIVES_MS = 180;

// ── Venom: tendrils that creep, lash and snap ────────────────────────────────
const lash = (id: string, recipe: string, tendrils: string[], snapMs: number): Variation => ({
  id,
  sounds: [synth(recipe)],
  cues: [
    cue(0, 'react-lean', 'villain', 300),
    ...tendrils.map((name, i) => cue(i * 90, name, 'strip', snapMs + 120)),
    cue(snapMs, 'venom-slash', 'player', 280), // lands on the snap in the sound
    cue(snapMs, 'react-hit', 'player', 250),
  ],
});
const creep = (id: string, recipe: string, order: string[]): Variation => ({
  id,
  sounds: [synth(recipe, 'ambient')],
  cues: [cue(0, 'react-enter', 'villain', 600), ...order.map((name, i) => cue(i * 160, name, 'strip', 560))],
});

export const VENOM: Profile = {
  mission_start: [
    creep('creep-1', 'venom-emerge-1', ['venom-tendril-1', 'venom-tendril-2', 'venom-tendril-3']),
    creep('creep-2', 'venom-emerge-2', ['venom-tendril-3', 'venom-tendril-1', 'venom-tendril-2']),
  ],
  villain_attack: [
    lash('lash-1', 'venom-lash-1', ['venom-tendril-1'], 300),
    lash('lash-2', 'venom-lash-2', ['venom-tendril-2'], 240),
    lash('lash-twin', 'venom-lash-3', ['venom-tendril-3', 'venom-tendril-1'], 200),
  ],
  player_strike: [
    { id: 'hit-1', sounds: [synth('venom-hit-1', 'impact', WEB_ARRIVES_MS)], cues: [cue(WEB_ARRIVES_MS, 'react-shrink', 'villain', 320), cue(WEB_ARRIVES_MS, 'venom-retract-1', 'strip', 320)] },
    { id: 'hit-2', sounds: [synth('venom-hit-2', 'impact', WEB_ARRIVES_MS)], cues: [cue(WEB_ARRIVES_MS, 'react-shrink', 'villain', 320), cue(WEB_ARRIVES_MS, 'venom-retract-2', 'strip', 320)] },
  ],
  time_out: [
    { id: 'taunt-1', sounds: [synth('venom-taunt-1', 'voice')], cues: [cue(0, 'venom-tendril-2', 'strip', 700), cue(0, 'react-dim', 'player', 400)] },
    { id: 'taunt-2', sounds: [synth('venom-taunt-2', 'voice')], cues: [cue(0, 'venom-tendril-3', 'strip', 700), cue(0, 'react-dim', 'player', 400)] },
  ],
};

// ── The Lizard: a sweeping tail and claw marks ───────────────────────────────
const claw = (id: string, recipe: string, tail: string, marks: string, crackMs: number): Variation => ({
  id,
  sounds: [synth(recipe)],
  cues: [
    cue(0, 'react-lean', 'villain', 300),
    cue(Math.max(0, crackMs - 160), tail, 'strip', 260), // the tail arrives as the sound cracks
    cue(crackMs, marks, 'player', 280),
    cue(crackMs, 'react-hit', 'player', 250),
  ],
});

export const LIZARD: Profile = {
  mission_start: [
    { id: 'prowl-1', sounds: [synth('lizard-prowl-1', 'ambient')], cues: [cue(0, 'react-shimmer', 'villain', 700), cue(200, 'lizard-tail-1', 'strip', 400)] },
    { id: 'prowl-2', sounds: [synth('lizard-prowl-2', 'ambient')], cues: [cue(0, 'react-shimmer', 'villain', 700), cue(200, 'lizard-tail-2', 'strip', 400)] },
  ],
  villain_attack: [
    claw('claw-1', 'lizard-claw-1', 'lizard-tail-1', 'lizard-claws-1', 260),
    claw('claw-2', 'lizard-claw-2', 'lizard-tail-2', 'lizard-claws-2', 170),
    claw('claw-3', 'lizard-claw-3', 'lizard-tail-1', 'lizard-claws-3', 240),
  ],
  player_strike: [
    { id: 'hit-1', sounds: [synth('lizard-hit-1', 'impact', WEB_ARRIVES_MS)], cues: [cue(WEB_ARRIVES_MS, 'react-flick', 'villain', 280)] },
    { id: 'hit-2', sounds: [synth('lizard-hit-2', 'impact', WEB_ARRIVES_MS)], cues: [cue(WEB_ARRIVES_MS, 'react-flick', 'villain', 280), cue(WEB_ARRIVES_MS, 'lizard-tail-2', 'strip', 260)] },
  ],
  time_out: [
    { id: 'taunt-1', sounds: [synth('lizard-taunt-1', 'voice')], cues: [cue(0, 'react-shimmer', 'villain', 700), cue(0, 'react-dim', 'player', 400)] },
    { id: 'taunt-2', sounds: [synth('lizard-taunt-2', 'voice')], cues: [cue(0, 'lizard-tail-1', 'strip', 400), cue(0, 'react-dim', 'player', 400)] },
  ],
};

// ── Kingpin: slow, heavy, deliberate ─────────────────────────────────────────
const cane = (id: string, recipe: string, ring: string, thudMs: number): Variation => ({
  id,
  sounds: [synth(recipe)],
  cues: [
    cue(thudMs, ring, 'strip', 420), // the ring spreads from the thud
    cue(thudMs + 120, 'kingpin-impact', 'player', 280),
    cue(thudMs + 120, 'react-hit', 'player', 250),
  ],
});

export const KINGPIN: Profile = {
  mission_start: [
    { id: 'step-1', sounds: [synth('kingpin-step-1', 'ambient')], cues: [cue(0, 'react-step-in', 'villain', 700), cue(0, 'kingpin-ring-1', 'strip', 420)] },
    { id: 'step-2', sounds: [synth('kingpin-step-2', 'ambient')], cues: [cue(0, 'react-step-in', 'villain', 700), cue(280, 'kingpin-ring-1', 'strip', 420)] },
  ],
  villain_attack: [
    cane('cane-1', 'kingpin-cane-1', 'kingpin-ring-1', 160),
    cane('cane-2', 'kingpin-cane-2', 'kingpin-ring-2', 0),
    cane('cane-3', 'kingpin-cane-3', 'kingpin-ring-1', 400),
  ],
  player_strike: [
    { id: 'hit-1', sounds: [synth('kingpin-hit-1', 'impact', WEB_ARRIVES_MS)], cues: [cue(WEB_ARRIVES_MS, 'react-brace', 'villain', 300), cue(WEB_ARRIVES_MS, 'kingpin-glint', 'villain', 280)] },
    { id: 'hit-2', sounds: [synth('kingpin-hit-2', 'impact', WEB_ARRIVES_MS)], cues: [cue(WEB_ARRIVES_MS, 'react-brace', 'villain', 300), cue(WEB_ARRIVES_MS + 60, 'kingpin-glint', 'villain', 280)] },
  ],
  time_out: [
    { id: 'taunt-1', sounds: [synth('kingpin-taunt-1', 'voice')], cues: [cue(0, 'kingpin-glint', 'villain', 280), cue(0, 'react-dim', 'player', 400)] },
    { id: 'taunt-2', sounds: [synth('kingpin-taunt-2', 'voice')], cues: [cue(300, 'kingpin-ring-1', 'strip', 420), cue(0, 'react-dim', 'player', 400)] },
  ],
};
