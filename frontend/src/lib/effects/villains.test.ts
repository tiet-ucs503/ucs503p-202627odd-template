// Each villain must be recognisably its own: different sounds, built in a
// different way, with its own visuals, and enough variation not to repeat.
import { describe, expect, it } from 'vitest';
import { AudioEngine } from '@/lib/effects/audio/engine';
import { RECIPES } from '@/lib/effects/audio/recipes';
import type { Layer, Recipe } from '@/lib/effects/audio/synth';
import { CUES } from '@/lib/effects/cues';
import { ActiveCue, EffectsDirector } from '@/lib/effects/director';
import type { GameEventType } from '@/lib/effects/events';
import { IDENTITY, IDENTITY_FIELDS } from '@/lib/effects/identity';
import { Profile, SHARED, SPIDERMAN, VILLAINS } from '@/lib/effects/profiles';
import { SettingsStore } from '@/lib/effects/settings';
import { asAudioContext, FakeAudioContext } from '@/test/fakeAudio';

/** Villains whose own effects have been built so far. */
const BUILT = Object.keys(VILLAINS).filter((id) => Object.keys(VILLAINS[id]).length > 0);
const REPEATABLE: GameEventType[] = ['mission_start', 'villain_attack', 'player_strike', 'time_out'];

const recipesOf = (profile: Profile) =>
  [...new Set(Object.values(profile).flat().flatMap((v) => v.sounds.map((s) => s.recipe)).filter(Boolean))] as string[];
const cuesOf = (profile: Profile) =>
  [...new Set(Object.values(profile).flat().flatMap((v) => v.cues.map((c) => c.cue)))];
const layersOf = (prefix: string): [Recipe, Layer[]][] =>
  Object.values(RECIPES).filter((r) => r.id.startsWith(prefix)).map((r) => [r, r.layers]);

describe('built villains', () => {
  it('all six villains have their own effects', () => {
    expect(BUILT).toEqual(['goblin', 'doc-ock', 'mysterio', 'venom', 'lizard', 'kingpin']);
  });

  it.each(BUILT)('%s has at least two variations of every repeatable effect', (id) => {
    for (const event of REPEATABLE) {
      expect(VILLAINS[id][event]?.length ?? 0, `${id} ${event}`).toBeGreaterThanOrEqual(2);
    }
  });

  it.each(BUILT)('%s always has something to play: not every variation is rationed', (id) => {
    for (const variations of Object.values(VILLAINS[id])) {
      expect(variations.filter((v) => !v.minGap).length).toBeGreaterThanOrEqual(2);
    }
  });

  it.each(BUILT)('%s: every attack makes Spider-Man\'s portrait react, when the attack lands', (id) => {
    for (const attack of VILLAINS[id].villain_attack!) {
      const hit = attack.cues.find((c) => c.cue === 'react-hit' && c.target === 'player');
      expect(hit, `${id} ${attack.id}`).toBeDefined();
      const travelling = attack.cues.filter((c) => c.target === 'strip');
      if (travelling.length) expect(hit!.atMs).toBeGreaterThan(0); // not before the attack has crossed the lane
    }
  });

  it.each(BUILT)('%s reacts in its own way to being hit', (id) => {
    for (const hit of VILLAINS[id].player_strike!) {
      const reaction = hit.cues.find((c) => c.target === 'villain' && CUES[c.cue]?.kind === 'reaction');
      expect(reaction, `${id} ${hit.id}`).toBeDefined();
      expect(reaction!.cue).not.toBe('react-recoil'); // not the generic one
      expect(reaction!.atMs).toBe(180); // when Spider-Man's web arrives
    }
  });
});

describe('distinct identities', () => {
  const characters = ['spiderman', ...BUILT];

  it('every character has a stated identity', () => {
    for (const id of characters) expect(IDENTITY[id], id).toBeDefined();
  });

  it('any two characters differ in at least three of the five identity traits', () => {
    for (let i = 0; i < characters.length; i++) {
      for (let j = i + 1; j < characters.length; j++) {
        const [a, b] = [IDENTITY[characters[i]], IDENTITY[characters[j]]];
        const differing = IDENTITY_FIELDS.filter((f) => a[f] !== b[f]);
        expect(differing.length, `${characters[i]} vs ${characters[j]}`).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('no two characters share a sound', () => {
    const owners = new Map<string, string>();
    const profiles: [string, Profile][] = [['spiderman', SPIDERMAN], ...BUILT.map((id) => [id, VILLAINS[id]] as [string, Profile])];
    for (const [owner, profile] of profiles) {
      for (const recipe of recipesOf(profile)) {
        expect(owners.get(recipe) ?? owner, `${recipe} is used by two characters`).toBe(owner);
        owners.set(recipe, owner);
        expect(recipe.startsWith(IDENTITY[owner].recipePrefix), `${owner} uses ${recipe}`).toBe(true);
      }
    }
    // ...and the shared sounds are not borrowed from any character.
    for (const recipe of recipesOf(SHARED)) expect(owners.has(recipe), recipe).toBe(false);
  });

  it('no two villains share a visual of their own', () => {
    const generic = new Set(['react-hit', 'react-dim', 'react-enter', 'react-lean']);
    const seen = new Map<string, string>();
    for (const id of BUILT) {
      const own = cuesOf(VILLAINS[id]).filter((c) => !generic.has(c));
      expect(own.length, `${id} has no visuals of its own`).toBeGreaterThanOrEqual(3);
      for (const name of own) {
        expect(seen.get(name) ?? id, `${name} is used by two villains`).toBe(id);
        seen.set(name, id);
      }
    }
  });

  // The recipes really are built the way the identity says.
  it('Spider-Man is filtered noise with a plucked tone: no buzz, no metal', () => {
    const recipes = layersOf('spidey-');
    expect(recipes.length).toBeGreaterThanOrEqual(3);
    for (const [recipe, layers] of recipes) {
      expect(layers.some((l) => l.source === 'noise' && l.filter?.type === 'bandpass'), recipe.id).toBe(true);
      expect(layers.some((l) => l.source === 'triangle'), recipe.id).toBe(true);
      expect(layers.some((l) => l.fm || l.ring || l.source === 'sawtooth'), recipe.id).toBe(false);
    }
  });

  it('Green Goblin is buzzy sawtooth with wobble or ring modulation: no metal, no pure tones', () => {
    const recipes = layersOf('goblin-');
    expect(recipes.length).toBeGreaterThanOrEqual(8);
    for (const [recipe, layers] of recipes) {
      expect(layers.some((l) => l.source === 'sawtooth' && (l.ring || l.vibrato)), recipe.id).toBe(true);
      expect(layers.some((l) => l.fm || l.source === 'sine'), recipe.id).toBe(false);
    }
  });

  it('Doctor Octopus is clicks and metallic FM: dry, steady, no wobble', () => {
    const recipes = layersOf('ock-');
    expect(recipes.length).toBeGreaterThanOrEqual(8);
    for (const [recipe, layers] of recipes) {
      expect(layers.some((l) => l.fm), recipe.id).toBe(true);
      expect(layers.some((l) => l.source === 'square' && l.dur <= 0.05), recipe.id).toBe(true);
      expect(layers.some((l) => l.vibrato || l.echo || l.source === 'sawtooth'), recipe.id).toBe(false);
    }
  });

  it('Mysterio is paired, slightly detuned pure tones, wide apart with heavy echo', () => {
    const recipes = layersOf('mysterio-');
    expect(recipes.length).toBeGreaterThanOrEqual(7);
    for (const [recipe, layers] of recipes) {
      const sines = layers.filter((l) => l.source === 'sine');
      expect(sines.length, recipe.id).toBeGreaterThanOrEqual(2);
      expect(sines.some((l) => (l.pan ?? 0) < 0) && sines.some((l) => (l.pan ?? 0) > 0), recipe.id).toBe(true);
      expect(sines.every((l) => (l.echo ?? 0) >= 0.5), recipe.id).toBe(true);
      expect(layers.some((l) => l.fm || l.ring || l.source === 'sawtooth' || l.source === 'square'), recipe.id).toBe(false);
    }
  });

  it('Venom is sub-bass under dark, low-passed noise: nothing bright, no echo', () => {
    const recipes = layersOf('venom-');
    expect(recipes.length).toBeGreaterThanOrEqual(8);
    for (const [recipe, layers] of recipes) {
      expect(layers.some((l) => l.source === 'sine' && Math.min(...l.freq!) <= 60), recipe.id).toBe(true);
      expect(layers.some((l) => l.source === 'noise' && l.filter?.type === 'lowpass'), recipe.id).toBe(true);
      expect(layers.some((l) => l.filter?.type === 'highpass' || l.echo || l.fm || l.ring), recipe.id).toBe(false);
      expect(layers.some((l) => ['sawtooth', 'square', 'triangle'].includes(l.source)), recipe.id).toBe(false);
    }
  });

  it('The Lizard is high-passed noise only: hisses and cracks, no tones at all', () => {
    const recipes = layersOf('lizard-');
    expect(recipes.length).toBeGreaterThanOrEqual(8);
    for (const [recipe, layers] of recipes) {
      expect(layers.every((l) => l.source === 'noise' && l.filter?.type === 'highpass'), recipe.id).toBe(true);
      expect(layers.some((l) => l.echo), recipe.id).toBe(false);
    }
    // every attack ends in an instant crack
    for (const id of ['lizard-claw-1', 'lizard-claw-2', 'lizard-claw-3']) {
      expect(RECIPES[id].layers.some((l) => l.dur <= 0.05 && (l.attack ?? 1) <= 0.001), id).toBe(true);
    }
  });

  it('Kingpin is a pitch-dropping thud with a wooden click, in an echoing room', () => {
    const recipes = layersOf('kingpin-');
    expect(recipes.length).toBeGreaterThanOrEqual(8);
    for (const [recipe, layers] of recipes) {
      const thud = layers.find((l) => l.source === 'sine');
      expect(thud, recipe.id).toBeDefined();
      expect(thud!.freq![0] / thud!.freq![1], recipe.id).toBeGreaterThanOrEqual(2); // the pitch falls by an octave or more
      expect(thud!.freq![1], recipe.id).toBeLessThanOrEqual(60);
      expect((thud!.echo ?? 0), recipe.id).toBeGreaterThanOrEqual(0.3);
      expect(layers.some((l) => l.source === 'triangle' && l.dur <= 0.04), recipe.id).toBe(true); // the cane tap
      expect(layers.some((l) => l.filter?.type === 'highpass' || l.fm || l.ring || l.source === 'sawtooth'), recipe.id).toBe(false);
    }
  });

  it('the two lowest villains are still different kinds of sound', () => {
    // Venom and Kingpin both sit very low; what separates them is how the sound is made and shaped.
    const venomAttack = RECIPES['venom-lash-1'].layers;
    const kingpinAttack = RECIPES['kingpin-cane-1'].layers;
    expect(venomAttack[0].attack).toBeGreaterThan(0.1); // Venom swells in slowly
    expect(kingpinAttack.find((l) => l.source === 'sine')!.attack).toBeLessThan(0.01); // Kingpin lands at once
    expect(venomAttack.some((l) => l.echo)).toBe(false);
    expect(kingpinAttack.every((l) => (l.echo ?? 0) > 0)).toBe(true);
  });

  it('the signature rhythms are there: three chirps, four clicks', () => {
    const cackle = RECIPES['goblin-cackle-1'].layers.filter((l) => l.dur < 0.1);
    expect(cackle).toHaveLength(3);
    const servo = RECIPES['ock-servo-1'].layers.filter((l) => l.source === 'square');
    expect(servo.map((l) => l.at ?? 0)).toEqual([0, 0.12, 0.24, 0.36]); // evenly spaced
  });
});

describe('the director with a built villain', () => {
  const setup = (villainId: string, rng?: () => number) => {
    const ctx = new FakeAudioContext();
    let clock = 0;
    const settings = new SettingsStore();
    const engine = new AudioEngine(settings, {
      createContext: () => asAudioContext(ctx), now: () => (clock += 5000),
      loadBuffer: async () => ({ duration: 1 }) as AudioBuffer,
    });
    const cues: ActiveCue[] = [];
    const director = new EffectsDirector({ villainId, engine, settings, rng, onCue: (c) => cues.push(c) });
    return { director, cues, ctx };
  };

  it.each(BUILT)('%s: its own attack replaces the shared one', (id) => {
    const { director } = setup(id);
    for (let i = 0; i < 12; i++) {
      const chosen = director.play({ type: 'villain_attack' });
      expect(chosen).toHaveLength(1);
      expect(chosen[0].startsWith(`${id}:`)).toBe(true);
    }
  });

  it.each(BUILT)('%s: attacks vary and never repeat back to back', (id) => {
    const { director } = setup(id);
    const picks = Array.from({ length: 30 }, () => director.play({ type: 'villain_attack' })[0]);
    expect(new Set(picks).size).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < picks.length; i++) expect(picks[i]).not.toBe(picks[i - 1]);
  });

  it.each(BUILT)('%s: a strike plays Spider-Man\'s web and the villain\'s own reaction, not the generic recoil', (id) => {
    const { director, cues } = setup(id, () => 0); // no random start delay, so the first cue shows at once
    const chosen = director.play({ type: 'player_strike' });
    expect(chosen.map((c) => c.split(':')[0])).toEqual(['spiderman', id]);
    expect(cues.some((c) => c.cue.startsWith('web-line'))).toBe(true); // immediate cue
    expect(cues.some((c) => c.cue === 'react-recoil')).toBe(false);
  });

  it('the shared effects remain as the fallback for an unknown villain', () => {
    const { director } = setup('nobody');
    expect(director.play({ type: 'villain_attack' })[0]).toMatch(/^shared:counter-/);
    expect(director.play({ type: 'mission_start' })).toEqual(['shared:enter']);
  });

  it('the recorded clips are rationed: at most once in every four', () => {
    for (const [id, clip] of [['goblin', 'goblin:laugh'], ['doc-ock', 'doc-ock:drotto']] as const) {
      const { director } = setup(id);
      const picks = Array.from({ length: 60 }, () => director.play({ type: 'villain_attack' })[0]);
      const at = picks.map((p, i) => (p === clip ? i : -1)).filter((i) => i >= 0);
      expect(at.length).toBeGreaterThan(0); // it is used...
      for (let i = 1; i < at.length; i++) expect(at[i] - at[i - 1]).toBeGreaterThanOrEqual(4); // ...but rarely
    }
  });

  it('only the Goblin uses the Goblin laugh, and only Doc Ock the "drotto" clips', () => {
    for (const id of Object.keys(VILLAINS)) {
      const samples = Object.values(VILLAINS[id]).flat().flatMap((v) => v.sounds.map((s) => s.sample)).filter(Boolean);
      if (id !== 'goblin') expect(samples).not.toContain('/green_goblin_laugh.mp3');
      if (id !== 'doc-ock') expect(samples.some((s) => s!.includes('drotto'))).toBe(false);
    }
  });
});
