// Combo specials, villain signature moves, and how villains go down.
import { describe, expect, it } from 'vitest';
import { MAX_ACTIVE_CUES } from '@/hooks/useActiveCues';
import { AudioEngine, MAX_VOICES } from '@/lib/effects/audio/engine';
import { RECIPES } from '@/lib/effects/audio/recipes';
import { CUES } from '@/lib/effects/cues';
import { ActiveCue, EffectsDirector } from '@/lib/effects/director';
import { IDENTITY } from '@/lib/effects/identity';
import { Profile, SHARED, SPIDERMAN, VILLAINS } from '@/lib/effects/profiles';
import type { Variation } from '@/lib/effects/profileTypes';
import { SettingsStore } from '@/lib/effects/settings';
import { asAudioContext, FakeAudioContext } from '@/test/fakeAudio';

const VILLAIN_IDS = Object.keys(VILLAINS);
const ALL_PROFILES: [string, Profile][] = [['shared', SHARED], ['spiderman', SPIDERMAN], ...VILLAIN_IDS.map((id) => [id, VILLAINS[id]] as [string, Profile])];
const allVariations = (): [string, Variation][] =>
  ALL_PROFILES.flatMap(([owner, profile]) => Object.values(profile).flat().map((v) => [owner, v] as [string, Variation]));

const setup = (villainId: string) => {
  const ctx = new FakeAudioContext();
  let clock = 0;
  const settings = new SettingsStore();
  const engine = new AudioEngine(settings, {
    createContext: () => asAudioContext(ctx), now: () => (clock += 5000),
    loadBuffer: async () => ({ duration: 1 }) as AudioBuffer,
  });
  const cues: ActiveCue[] = [];
  const director = new EffectsDirector({ villainId, engine, settings, rng: () => 0, onCue: (c) => cues.push(c) });
  return { director, cues, engine, ctx };
};

describe("Spider-Man's combo", () => {
  const shotsIn = (v: Variation) => v.cues.filter((c) => c.cue.startsWith('web-line')).length;

  it.each([3, 5, 7])('a streak of %i plays a barrage made for that streak', (streak) => {
    const { director } = setup('nobody');
    const chosen = director.play({ type: 'combo_special', streak });
    expect(chosen).toHaveLength(1);
    expect(chosen[0]).toMatch(new RegExp(`^spiderman:barrage-${streak}`));
  });

  it('longer streaks fire more web shots, and only the full combo closes the net', () => {
    const byStreak = (n: number) => SPIDERMAN.combo_special!.filter((v) => v.forStreak === n);
    expect(byStreak(3).map(shotsIn)).toEqual([3, 3]);
    expect(byStreak(5).map(shotsIn)).toEqual([4, 4]);
    expect(byStreak(7).map(shotsIn)).toEqual([5]);
    const hasNet = (v: Variation) => v.cues.some((c) => c.cue === 'web-net');
    expect(SPIDERMAN.combo_special!.filter(hasNet).map((v) => v.forStreak)).toEqual([7]);
  });

  it('the shots on screen are in step with the shots in the sound', () => {
    for (const variation of SPIDERMAN.combo_special!) {
      const lines = variation.cues.filter((c) => c.cue.startsWith('web-line')).map((c) => c.atMs);
      const shots = RECIPES[variation.sounds[0].recipe!].layers
        .filter((l) => l.source === 'noise' && l.filter?.type === 'bandpass')
        .map((l) => Math.round((l.at ?? 0) * 1000));
      expect(lines, variation.id).toEqual(shots);
    }
  });

  it('a web lands on the portrait once per combo, however many shots there are', () => {
    for (const variation of SPIDERMAN.combo_special!) {
      expect(variation.cues.filter((c) => c.cue.startsWith('web-splat')), variation.id).toHaveLength(1);
    }
  });

  it.each(VILLAIN_IDS)('%s still takes the hit in its own way during a combo', (id) => {
    const { director } = setup(id);
    const chosen = director.play({ type: 'combo_special', streak: 3 });
    expect(chosen.map((c) => c.split(':')[0])).toEqual(['spiderman', id]);
    expect(chosen[1]).toMatch(/:hit-|:drotto-losing/);
  });

  it('a streak that is not a milestone has no barrage', () => {
    expect(setup('nobody').director.play({ type: 'combo_special', streak: 4 })).toEqual(['spiderman:thwip-1']);
  });
});

describe('villain signature moves', () => {
  it.each(VILLAIN_IDS)('%s has a signature move of its own, in two variations', (id) => {
    const specials = VILLAINS[id].villain_special!;
    expect(specials.length).toBeGreaterThanOrEqual(2);
    for (const special of specials) {
      const recipe = special.sounds[0].recipe!;
      expect(recipe.startsWith(IDENTITY[id].recipePrefix), `${id} ${recipe}`).toBe(true);
      expect(recipe).toContain('special');
      // It is bigger than an ordinary attack: more happens on screen.
      const ordinary = Math.max(...VILLAINS[id].villain_attack!.map((v) => v.cues.length));
      expect(special.cues.length, `${id} ${special.id}`).toBeGreaterThan(ordinary);
      expect(special.cues.some((c) => c.cue === 'react-hit' && c.target === 'player')).toBe(true);
    }
  });

  it.each(VILLAIN_IDS)('%s: the signature move replaces the ordinary attack and the shared sound', (id) => {
    const chosen = setup(id).director.play({ type: 'villain_special' });
    expect(chosen).toHaveLength(1);
    expect(chosen[0].startsWith(`${id}:`)).toBe(true);
  });

  it('a villain with no signature move falls back to an ordinary attack', () => {
    expect(setup('nobody').director.play({ type: 'villain_special' })[0]).toMatch(/^shared:counter-/);
  });
});

describe('how villains go down', () => {
  it.each(VILLAIN_IDS)('%s has its own defeat sound and collapses', (id) => {
    const [defeat] = VILLAINS[id].villain_defeated!;
    expect(defeat.sounds[0].recipe).toBe(`${IDENTITY[id].recipePrefix}defeat-1`);
    expect(RECIPES[defeat.sounds[0].recipe!]).toBeDefined();
    expect(defeat.cues.map((c) => c.cue)).toEqual(['react-collapse']);
  });

  it('the villain reels once when half its health is gone, silently', () => {
    const [stagger] = SHARED.villain_staggered!;
    expect(stagger.sounds).toEqual([]);
    expect(stagger.cues.map((c) => [c.cue, c.target])).toEqual([['react-stagger', 'villain']]);
    // It comes after the strike that caused it has landed, not on top of it.
    expect(stagger.cues[0].atMs).toBeGreaterThan(180 + 260);
  });

  it('losing is gentle: no villain gloats at the player', () => {
    for (const id of VILLAIN_IDS) expect(VILLAINS[id].defeat).toBeUndefined();
    expect(SHARED.defeat).toHaveLength(1);
  });
});

describe('keeping effects readable and light', () => {
  it('marks at the edge of a portrait never pile up within one effect', () => {
    for (const [owner, variation] of allVariations()) {
      for (const target of ['player', 'villain'] as const) {
        const marks = variation.cues
          .filter((c) => c.target === target && CUES[c.cue]?.kind === 'overlay' && (CUES[c.cue].coverPct ?? 0) > 5)
          .sort((a, b) => a.atMs - b.atMs);
        for (let i = 1; i < marks.length; i++) {
          expect(marks[i].atMs, `${owner} ${variation.id}: ${marks[i - 1].cue} then ${marks[i].cue}`)
            .toBeGreaterThanOrEqual(marks[i - 1].atMs + marks[i - 1].durMs);
        }
      }
    }
  });

  it('Spider-Man is never shaken more than twice in one effect, or faster than 3 times a second', () => {
    for (const [owner, variation] of allVariations()) {
      const hits = variation.cues.filter((c) => c.cue === 'react-hit').map((c) => c.atMs).sort((a, b) => a - b);
      expect(hits.length, `${owner} ${variation.id}`).toBeLessThanOrEqual(2);
      for (let i = 1; i < hits.length; i++) expect(hits[i] - hits[i - 1]).toBeGreaterThanOrEqual(280);
    }
  });

  it('no single effect is crowded', () => {
    for (const [owner, variation] of allVariations()) {
      expect(variation.cues.length, `${owner} ${variation.id}`).toBeLessThanOrEqual(12);
      expect(variation.sounds.length, `${owner} ${variation.id}`).toBeLessThanOrEqual(2);
    }
  });

  it('even the busiest moment stays inside the limits', () => {
    // The full combo against each villain, immediately followed by the stagger and the defeat.
    for (const id of VILLAIN_IDS) {
      const { director, cues, engine } = setup(id);
      director.play({ type: 'combo_special', streak: 7 });
      director.play({ type: 'villain_staggered' });
      director.play({ type: 'villain_defeated' });
      director.play({ type: 'victory' });
      expect(engine.activeVoices, id).toBeLessThanOrEqual(MAX_VOICES);
      expect(cues.length, id).toBeLessThanOrEqual(MAX_ACTIVE_CUES); // only the cues due at once are shown
      director.dispose();
    }
  });
});
