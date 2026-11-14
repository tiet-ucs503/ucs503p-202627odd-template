// Green Goblin, Doctor Octopus and Mysterio.
//
// When a villain has its own effects for an event, they replace the shared
// ones, so each villain's attack, entrance and taunt are entirely its own.
// Spider-Man's web strike still plays on a correct answer; the villain adds
// its own way of taking the hit.
//
// Every attack carries the moment Spider-Man's portrait flinches, timed to
// when that villain's attack actually arrives.

import { SAMPLES } from '@/lib/effects/audio/recipes';
import { cue, file, Profile, synth, Variation } from '@/lib/effects/profileTypes';

/** Spider-Man's web reaches the villain this long after a correct answer. */
const WEB_ARRIVES_MS = 180;

// ── Green Goblin: lobbed pumpkins, cackles, a wobbling glider ────────────────
const PUMPKIN_FLIGHT_MS = 220;
const pumpkin = (id: string, recipe: string, lob: string): Variation => ({
  id,
  sounds: [synth(recipe)],
  cues: [
    cue(0, 'react-lean', 'villain', 300),
    cue(0, lob, 'strip', PUMPKIN_FLIGHT_MS),
    cue(PUMPKIN_FLIGHT_MS, 'goblin-puff', 'player', 280),
    cue(PUMPKIN_FLIGHT_MS, 'react-hit', 'player', 250),
  ],
});
const cackle = (id: string, sound: Variation['sounds'][number], minGap?: number): Variation => ({
  id, minGap,
  sounds: [sound],
  cues: [cue(0, 'react-lean', 'villain', 300), cue(120, 'react-hit', 'player', 250)],
});

export const GOBLIN: Profile = {
  mission_start: [
    { id: 'glider-1', sounds: [synth('goblin-glider-1', 'ambient')], cues: [cue(0, 'react-enter', 'villain', 500), cue(0, 'goblin-streak-1', 'strip', 600)] },
    { id: 'glider-2', sounds: [synth('goblin-glider-2', 'ambient')], cues: [cue(0, 'react-enter', 'villain', 500), cue(0, 'goblin-streak-2', 'strip', 600)] },
  ],
  villain_attack: [
    pumpkin('pumpkin-1', 'goblin-pumpkin-1', 'goblin-pumpkin-1'),
    pumpkin('pumpkin-2', 'goblin-pumpkin-2', 'goblin-pumpkin-2'),
    cackle('cackle-1', synth('goblin-cackle-1', 'voice')),
    cackle('cackle-2', synth('goblin-cackle-2', 'voice')),
    // The recorded laugh is a rare treat: at most once in every four attacks.
    cackle('laugh', file(SAMPLES.goblinLaugh), 3),
  ],
  player_strike: [
    { id: 'hit-1', sounds: [synth('goblin-hit-1', 'impact', WEB_ARRIVES_MS)], cues: [cue(WEB_ARRIVES_MS, 'react-wobble', 'villain', 320)] },
    { id: 'hit-2', sounds: [synth('goblin-hit-2', 'impact', WEB_ARRIVES_MS)], cues: [cue(WEB_ARRIVES_MS, 'react-wobble', 'villain', 320)] },
  ],
  time_out: [
    { id: 'taunt-1', sounds: [synth('goblin-taunt-1', 'voice')], cues: [cue(0, 'react-lean', 'villain', 300), cue(0, 'react-dim', 'player', 400)] },
    { id: 'taunt-2', sounds: [synth('goblin-cackle-2', 'voice')], cues: [cue(0, 'react-lean', 'villain', 300), cue(0, 'react-dim', 'player', 400)] },
  ],
};

// ── Doctor Octopus: four mechanical arms ─────────────────────────────────────
const ARM_REACH_MS = 180;
const arm = (id: string, sound: Variation['sounds'][number], arms: string[], minGap?: number): Variation => ({
  id, minGap,
  sounds: [sound],
  cues: [
    cue(0, 'react-lean', 'villain', 300),
    ...arms.map((name, i) => cue(i * 140, name, 'strip', 300)),
    cue(ARM_REACH_MS, 'ock-impact', 'player', 280),
    cue(ARM_REACH_MS, 'react-hit', 'player', 250),
  ],
});
const unfold = (id: string, recipe: string, order: string[]): Variation => ({
  id,
  sounds: [synth(recipe, 'ambient')],
  // One arm per servo click: the clicks are 120 ms apart.
  cues: [cue(0, 'react-enter', 'villain', 500), ...order.map((name, i) => cue(i * 120, name, 'strip', 280))],
});

export const DOC_OCK: Profile = {
  mission_start: [
    unfold('unfold-1', 'ock-servo-1', ['ock-arm-1', 'ock-arm-2', 'ock-arm-3', 'ock-arm-4']),
    unfold('unfold-2', 'ock-servo-2', ['ock-arm-4', 'ock-arm-3', 'ock-arm-2', 'ock-arm-1']),
  ],
  villain_attack: [
    arm('arm-1', synth('ock-clank-1'), ['ock-arm-1']),
    arm('arm-2', synth('ock-clank-2'), ['ock-arm-2']),
    arm('arm-pair', synth('ock-clank-3'), ['ock-arm-3', 'ock-arm-2']),
    arm('arm-4', synth('ock-clank-4'), ['ock-arm-4']),
    arm('drotto', file(SAMPLES.drotto), ['ock-arm-1'], 3),
  ],
  player_strike: [
    { id: 'hit-1', sounds: [synth('ock-hit-1', 'impact', WEB_ARRIVES_MS)], cues: [cue(WEB_ARRIVES_MS, 'react-flinch', 'villain', 260)] },
    { id: 'hit-2', sounds: [synth('ock-hit-2', 'impact', WEB_ARRIVES_MS)], cues: [cue(WEB_ARRIVES_MS, 'react-flinch', 'villain', 260)] },
    { id: 'drotto-losing', minGap: 3, sounds: [file(SAMPLES.drottoLosing, 'voice', WEB_ARRIVES_MS)], cues: [cue(WEB_ARRIVES_MS, 'react-flinch', 'villain', 260)] },
  ],
  time_out: [
    { id: 'taunt-1', sounds: [synth('ock-taunt-1', 'voice')], cues: [cue(0, 'react-dim', 'player', 400)] },
    { id: 'taunt-2', sounds: [synth('ock-servo-2', 'voice')], cues: [cue(0, 'ock-arm-2', 'strip', 300), cue(0, 'react-dim', 'player', 400)] },
  ],
};

// ── Mysterio: mist and ghost copies of himself ───────────────────────────────
/** The swell in Mysterio's sound peaks, and stops, at this point. */
const ILLUSION_LANDS_MS = 420;
const illusion = (id: string, recipe: string, ghost: string, mist: string): Variation => ({
  id,
  sounds: [synth(recipe)],
  cues: [
    cue(0, ghost, 'strip', 480),
    cue(100, mist, 'strip', 500),
    cue(ILLUSION_LANDS_MS, 'mysterio-veil', 'player', 280),
    cue(ILLUSION_LANDS_MS, 'react-hit', 'player', 250),
  ],
});
const appear = (id: string, recipe: string, mist: string): Variation => ({
  id,
  sounds: [synth(recipe, 'ambient')],
  cues: [
    cue(0, 'react-materialise', 'villain', 700),
    cue(0, mist, 'strip', 700),
    cue(150, 'mysterio-ghost-1', 'strip', 500),
    cue(350, 'mysterio-ghost-2', 'strip', 500),
  ],
});

export const MYSTERIO: Profile = {
  mission_start: [appear('appear-1', 'mysterio-mist-1', 'mysterio-mist-1'), appear('appear-2', 'mysterio-mist-2', 'mysterio-mist-2')],
  villain_attack: [
    illusion('illusion-1', 'mysterio-illusion-1', 'mysterio-ghost-1', 'mysterio-mist-1'),
    illusion('illusion-2', 'mysterio-illusion-2', 'mysterio-ghost-2', 'mysterio-mist-2'),
    illusion('illusion-3', 'mysterio-illusion-3', 'mysterio-ghost-1', 'mysterio-mist-2'),
  ],
  player_strike: [
    { id: 'hit-1', sounds: [synth('mysterio-hit-1', 'impact', WEB_ARRIVES_MS)], cues: [cue(WEB_ARRIVES_MS, 'react-ripple', 'villain', 320), cue(WEB_ARRIVES_MS, 'mysterio-mist-2', 'strip', 400)] },
    { id: 'hit-2', sounds: [synth('mysterio-hit-2', 'impact', WEB_ARRIVES_MS)], cues: [cue(WEB_ARRIVES_MS, 'react-ripple', 'villain', 320), cue(WEB_ARRIVES_MS, 'mysterio-mist-1', 'strip', 400)] },
  ],
  time_out: [
    { id: 'taunt-1', sounds: [synth('mysterio-taunt-1', 'voice')], cues: [cue(0, 'mysterio-mist-1', 'strip', 700), cue(0, 'react-dim', 'player', 400)] },
    { id: 'taunt-2', sounds: [synth('mysterio-mist-2', 'voice')], cues: [cue(0, 'mysterio-mist-2', 'strip', 700), cue(0, 'react-dim', 'player', 400)] },
  ],
};
