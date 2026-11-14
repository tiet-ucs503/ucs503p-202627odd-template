import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AnswerResponse, SessionState } from '@/lib/api';
import { AudioEngine, COOLDOWN_MS, MASTER_CAP, MAX_VOICES } from '@/lib/effects/audio/engine';
import { RECIPES, SAMPLES } from '@/lib/effects/audio/recipes';
import { recipeDuration } from '@/lib/effects/audio/synth';
import { EffectsDirector } from '@/lib/effects/director';
import { deriveEvents, EventState, GameEventType, initialEventState } from '@/lib/effects/events';
import { SHARED, SPIDERMAN, VILLAINS } from '@/lib/effects/profiles';
import { DEFAULT_SETTINGS, SettingsStore } from '@/lib/effects/settings';
import { VariationPicker } from '@/lib/effects/variation';
import { asAudioContext, FakeAudioContext } from '@/test/fakeAudio';

// ── Gameplay events: every effect starts from something the server said ──────
const session = (over: Partial<SessionState> = {}): SessionState => ({
  id: 1, boss_id: 'goblin', status: 'active', correct_count: 0, wrong_count: 0, streak: 0,
  questions_to_win: 7, max_wrong: 7, points_awarded: 0, ...over,
});
type Judged = Pick<AnswerResponse, 'correct' | 'session' | 'session_status'>;
const judged = (correct: boolean, over: Partial<SessionState> = {}, status: SessionState['status'] = 'active'): Judged =>
  ({ correct, session: session({ ...over, status }), session_status: status });
const types = (state: EventState, response: Judged, timedOut = false) =>
  deriveEvents(state, response, timedOut).events.map((e) => e.type);

describe('deriveEvents', () => {
  it('a correct answer is a strike by Spider-Man', () => {
    expect(types(initialEventState(), judged(true, { streak: 1, correct_count: 1 }))).toEqual(['player_strike']);
  });

  it('a wrong chosen answer is a villain attack', () => {
    expect(types(initialEventState(), judged(false, { wrong_count: 1 }))).toEqual(['villain_attack']);
  });

  it('running out of time is a taunt, not an attack', () => {
    expect(types(initialEventState(), judged(false, { wrong_count: 1 }), true)).toEqual(['time_out']);
  });

  it.each([3, 5, 7])('a streak of %i adds a combo special', (streak) => {
    const events = types({ wrongInARow: 0, staggered: true }, judged(true, { streak, correct_count: streak }));
    expect(events).toEqual(['player_strike', 'combo_special']);
  });

  it.each([1, 2, 4, 6])('a streak of %i does not', (streak) => {
    const events = types({ wrongInARow: 0, staggered: true }, judged(true, { streak, correct_count: streak }));
    expect(events).toEqual(['player_strike']);
  });

  it('the second wrong answer in a row adds the villain special, and only the second', () => {
    let state = initialEventState();
    const seen: GameEventType[][] = [];
    for (let i = 1; i <= 4; i++) {
      const result = deriveEvents(state, judged(false, { wrong_count: i }), false);
      state = result.state;
      seen.push(result.events.map((e) => e.type));
    }
    expect(seen).toEqual([['villain_attack'], ['villain_attack', 'villain_special'], ['villain_attack'], ['villain_attack']]);
  });

  it('a correct answer resets the wrong-in-a-row count', () => {
    let state = deriveEvents(initialEventState(), judged(false), false).state;
    state = deriveEvents(state, judged(true, { streak: 1, correct_count: 1 }), false).state;
    expect(types(state, judged(false))).toEqual(['villain_attack']);
  });

  it('the villain is staggered once, when half the hits have landed', () => {
    let state = initialEventState();
    const seen: GameEventType[][] = [];
    for (let hits = 1; hits <= 6; hits++) {
      const result = deriveEvents(state, judged(true, { streak: 1, correct_count: hits }), false);
      state = result.state;
      seen.push(result.events.map((e) => e.type));
    }
    expect(seen.map((s) => s.includes('villain_staggered'))).toEqual([false, false, false, true, false, false]);
  });

  it('victory and defeat are marked to wait for the end screen', () => {
    const win = deriveEvents(initialEventState(), judged(true, { streak: 1, correct_count: 7 }, 'victory'), false).events;
    expect(win.map((e) => [e.type, e.afterResult ?? false])).toEqual([['player_strike', false], ['victory', true]]);
    const loss = deriveEvents(initialEventState(), judged(false, { wrong_count: 7 }, 'defeat'), false).events;
    expect(loss.map((e) => e.type)).toEqual(['villain_attack', 'defeat']);
  });
});

// ── Variation: no immediate repeats, and gaps for rare sounds ───────────────
describe('VariationPicker', () => {
  const options = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

  it('never picks the same variation twice in a row when there is a choice', () => {
    const picker = new VariationPicker();
    let last = '';
    for (let i = 0; i < 200; i++) {
      const pick = picker.pick('strike', options)!.id;
      expect(pick).not.toBe(last);
      last = pick;
    }
  });

  it('uses every variation over time', () => {
    const picker = new VariationPicker();
    const seen = new Set(Array.from({ length: 60 }, () => picker.pick('strike', options)!.id));
    expect(seen).toEqual(new Set(['a', 'b', 'c']));
  });

  it('keeps separate histories for separate effects', () => {
    const picker = new VariationPicker(() => 0);
    expect(picker.pick('one', options)!.id).toBe('a');
    expect(picker.pick('two', options)!.id).toBe('a');
  });

  it('a single option simply repeats', () => {
    const picker = new VariationPicker();
    expect([1, 2, 3].map(() => picker.pick('only', [{ id: 'x' }])!.id)).toEqual(['x', 'x', 'x']);
  });

  it('respects a gap: a rare sound plays at most once in every three', () => {
    const picker = new VariationPicker();
    const picks = Array.from({ length: 9 }, () => picker.pick('taunt', [{ id: 'laugh', minGap: 2 }])?.id ?? null);
    expect(picks).toEqual(['laugh', null, null, 'laugh', null, null, 'laugh', null, null]);
  });

  it('keeps pitch and timing changes small', () => {
    const picker = new VariationPicker();
    for (let i = 0; i < 100; i++) {
      const pitch = picker.pitchJitter();
      expect(pitch).toBeGreaterThanOrEqual(0.94);
      expect(pitch).toBeLessThanOrEqual(1.06);
      const delay = picker.timingJitterMs();
      expect(delay).toBeGreaterThanOrEqual(0);
      expect(delay).toBeLessThanOrEqual(40);
    }
  });
});

// ── Settings: remembered, and only changed by the controls ───────────────────
describe('SettingsStore', () => {
  it('starts from sensible defaults', () => {
    expect(new SettingsStore().get()).toEqual(DEFAULT_SETTINGS);
  });

  it('remembers changes for the next page load', () => {
    new SettingsStore().update({ muted: true, volume: 35, motion: 'reduced' });
    expect(new SettingsStore().get()).toEqual({ muted: true, volume: 35, motion: 'reduced' });
  });

  it('keeps volume between 0 and 100 and ignores rubbish in storage', () => {
    const store = new SettingsStore();
    store.update({ volume: 250 });
    expect(store.get().volume).toBe(100);
    store.update({ volume: -5 });
    expect(store.get().volume).toBe(0);
    localStorage.setItem('mathverse_effects_settings', '{"volume":"loud","motion":"sideways","muted":"yes"}');
    expect(new SettingsStore().get()).toEqual(DEFAULT_SETTINGS);
    localStorage.setItem('mathverse_effects_settings', 'not json');
    expect(new SettingsStore().get()).toEqual(DEFAULT_SETTINGS);
  });

  it('follows the device for reduced motion until the player chooses', () => {
    const prefersReduced = { matches: true };
    vi.stubGlobal('matchMedia', () => prefersReduced);
    const store = new SettingsStore();
    expect(store.reducedMotion()).toBe(true);
    store.update({ motion: 'full' });
    expect(store.reducedMotion()).toBe(false); // the player's choice wins
    prefersReduced.matches = false;
    store.update({ motion: 'reduced' });
    expect(store.reducedMotion()).toBe(true);
    vi.unstubAllGlobals();
  });

  it('tells listeners about every change', () => {
    const store = new SettingsStore();
    const listener = vi.fn();
    const stop = store.subscribe(listener);
    store.update({ muted: true });
    stop();
    store.update({ muted: false });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

// ── Audio engine: loudness cap, voice limit, cooldowns, mute, cleanup ───────
describe('AudioEngine', () => {
  let ctx: FakeAudioContext;
  let clock: number;
  let settings: SettingsStore;
  let engine: AudioEngine;
  const thud = RECIPES['counter-thud-1'];

  beforeEach(() => {
    ctx = new FakeAudioContext();
    clock = 0;
    settings = new SettingsStore();
    engine = new AudioEngine(settings, { createContext: () => asAudioContext(ctx), now: () => clock });
  });

  it('never exceeds the loudness cap, even at full volume', () => {
    settings.update({ volume: 100 });
    expect(engine.masterGain()).toBe(MASTER_CAP);
    expect(MASTER_CAP).toBeLessThanOrEqual(0.5);
    settings.update({ volume: 60 });
    expect(engine.masterGain()).toBeCloseTo(0.3);
  });

  it('applies volume changes to sound that is already set up', () => {
    engine.playRecipe(thud, { category: 'impact' });
    settings.update({ volume: 20 });
    expect(ctx.master.gain.value).toBeCloseTo(MASTER_CAP * 0.2);
  });

  it('plays nothing while muted, and resumes when unmuted', () => {
    settings.update({ muted: true });
    expect(engine.playRecipe(thud, { category: 'impact' })).toBe(false);
    expect(ctx.sources).toHaveLength(0);
    settings.update({ muted: false });
    expect(engine.playRecipe(thud, { category: 'impact' })).toBe(true);
  });

  it('silences the output at once when muted mid-sound', () => {
    engine.playRecipe(thud, { category: 'impact' });
    settings.update({ muted: true });
    expect(ctx.master.gain.value).toBe(0);
  });

  it('refuses the same kind of sound again inside its cooldown', () => {
    expect(engine.playRecipe(thud, { category: 'impact' })).toBe(true);
    clock += COOLDOWN_MS.impact - 1;
    expect(engine.playRecipe(thud, { category: 'impact' })).toBe(false);
    clock += 2;
    expect(engine.playRecipe(thud, { category: 'impact' })).toBe(true);
  });

  it('lets the parts of one effect through together', () => {
    expect(engine.playRecipe(thud, { category: 'impact', group: 'strike-1' })).toBe(true);
    expect(engine.playRecipe(thud, { category: 'impact', group: 'strike-1', delayMs: 180 })).toBe(true);
    expect(engine.playRecipe(thud, { category: 'impact', group: 'strike-2' })).toBe(false); // a new effect must wait
  });

  it('different kinds of sound do not block each other', () => {
    expect(engine.playRecipe(thud, { category: 'impact' })).toBe(true);
    expect(engine.playRecipe(RECIPES['gwen-chirp-1'], { category: 'ui' })).toBe(true);
  });

  it(`never has more than ${MAX_VOICES} sounds at once`, () => {
    for (let i = 0; i < 10; i++) {
      clock += 1000; // past every cooldown, but the audio clock has not moved: all still sounding
      engine.playRecipe(thud, { category: 'impact' });
      expect(engine.activeVoices).toBeLessThanOrEqual(MAX_VOICES);
    }
    expect(engine.activeVoices).toBe(MAX_VOICES);
  });

  it('forgets sounds that have finished', () => {
    engine.playRecipe(thud, { category: 'impact' });
    ctx.currentTime = recipeDuration(thud) + 0.1;
    expect(engine.activeVoices).toBe(0);
  });

  it('plays an existing audio file, cut to the requested length', async () => {
    const loadBuffer = vi.fn(async () => ({ duration: 12 }) as AudioBuffer);
    engine = new AudioEngine(settings, { createContext: () => asAudioContext(ctx), now: () => clock, loadBuffer });
    expect(engine.playSample(SAMPLES.victoryJingle, { category: 'music', maxSeconds: 6 })).toBe(true);
    await vi.waitFor(() => expect(ctx.playing).toHaveLength(1));
    expect(ctx.playing[0].scheduledStop).toBe(6);
    engine.playSample(SAMPLES.victoryJingle, { category: 'music', maxSeconds: 6 });
    expect(loadBuffer).toHaveBeenCalledTimes(1); // the file is fetched once
  });

  it('stays silent if an audio file cannot be loaded', async () => {
    engine = new AudioEngine(settings, {
      createContext: () => asAudioContext(ctx), now: () => clock,
      loadBuffer: async () => { throw new Error('missing'); },
    });
    engine.playSample('/nope.mp3', { category: 'voice' });
    await vi.waitFor(() => expect(engine.activeVoices).toBe(0));
  });

  it('stops everything and releases audio when disposed', () => {
    engine.playRecipe(thud, { category: 'impact' });
    const started = ctx.sources.filter((s) => s.started !== null);
    engine.dispose();
    expect(started.every((s) => s.stopped)).toBe(true);
    expect(ctx.close).toHaveBeenCalled();
    expect(engine.playRecipe(thud, { category: 'music' })).toBe(false);
    settings.update({ volume: 10 }); // no longer listening: must not throw
  });

  it('does nothing, without errors, where audio is unavailable', () => {
    const silent = new AudioEngine(settings, { createContext: () => null });
    expect(silent.playRecipe(thud, { category: 'impact' })).toBe(false);
    expect(silent.playSample('/x.mp3', { category: 'voice' })).toBe(false);
    silent.unlock();
    silent.dispose();
  });
});

// ── Director and profiles ────────────────────────────────────────────────────
describe('EffectsDirector', () => {
  const makeDirector = (villainId: string, rng?: () => number) => {
    const ctx = new FakeAudioContext();
    let clock = 0;
    const settings = new SettingsStore();
    const engine = new AudioEngine(settings, {
      createContext: () => asAudioContext(ctx), now: () => (clock += 5000),
      loadBuffer: async () => ({ duration: 1 }) as AudioBuffer,
    });
    return { director: new EffectsDirector({ villainId, engine, settings, rng }), engine, ctx, settings };
  };

  it('plays Spider-Man\'s strike for a correct answer, varying it', () => {
    const { director } = makeDirector('venom');
    const picks = Array.from({ length: 12 }, () => director.play({ type: 'player_strike' })[0]);
    expect(new Set(picks).size).toBe(3);
    for (let i = 1; i < picks.length; i++) expect(picks[i]).not.toBe(picks[i - 1]);
  });

  it('every villain has a counter-attack sound', () => {
    for (const villainId of Object.keys(VILLAINS)) {
      expect(makeDirector(villainId).director.play({ type: 'villain_attack' }).length).toBeGreaterThan(0);
    }
  });

  it('ignores events that have no effects yet, and unknown villains', () => {
    expect(makeDirector('goblin').director.play({ type: 'combo_special' })).toEqual([]);
    const picked = makeDirector('nobody').director.play({ type: 'player_strike' });
    expect(picked).toHaveLength(1); // Spider-Man's own sound still plays
    expect(picked[0]).toMatch(/^spiderman:/);
  });

  it('does nothing after it is disposed', () => {
    const { director } = makeDirector('goblin');
    director.dispose();
    expect(director.play({ type: 'player_strike' })).toEqual([]);
  });

  it('stays quiet when muted but still works', () => {
    const { director, settings, ctx } = makeDirector('venom');
    settings.update({ muted: true });
    expect(director.play({ type: 'player_strike' })).toHaveLength(1);
    expect(ctx.sources).toHaveLength(0);
  });
});

describe('profiles', () => {
  const allVariations = [SHARED, SPIDERMAN, ...Object.values(VILLAINS)]
    .flatMap((profile) => Object.values(profile).flat());

  it('every sound a profile refers to exists', () => {
    const files = new Set<string>(Object.values(SAMPLES));
    for (const variation of allVariations) {
      for (const step of variation.sounds) {
        if (step.recipe) expect(RECIPES[step.recipe], step.recipe).toBeDefined();
        if (step.sample) expect(files.has(step.sample), step.sample).toBe(true);
        expect(Boolean(step.recipe) !== Boolean(step.sample)).toBe(true);
      }
    }
  });

  it('every synthesised sound is short and layered', () => {
    for (const recipe of Object.values(RECIPES)) {
      expect(recipeDuration(recipe), recipe.id).toBeLessThanOrEqual(1.5);
      expect(recipe.layers.length, recipe.id).toBeGreaterThanOrEqual(2);
      for (const layer of recipe.layers) expect(layer.gain, recipe.id).toBeLessThanOrEqual(0.7);
    }
  });

  it('the unreviewed laugh file is not used by any character', () => {
    const used = allVariations.flatMap((v) => v.sounds.map((s) => s.sample));
    expect(used).not.toContain(SAMPLES.unreviewedLaugh);
  });
});

// ── Separation: effects know about game events and nothing about the player ──
describe('effects code', () => {
  it('has no access to the camera, attention data or the server', () => {
    const sources = import.meta.glob(['./**/*.ts', '../../hooks/useEffectsDirector.ts', '!./**/*.test.ts'], {
      query: '?raw', import: 'default', eager: true,
    }) as Record<string, string>;
    expect(Object.keys(sources).length).toBeGreaterThanOrEqual(8);
    for (const [file, code] of Object.entries(sources)) {
      const withoutComments = code.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
      for (const banned of ['attention', 'tracker', 'getUserMedia', 'on_screen', 'face_present', "from '@/lib/api'"]) {
        if (banned === "from '@/lib/api'" && /import type/.test(withoutComments)) continue; // type-only imports carry no data
        expect(withoutComments.includes(banned), `${file} mentions ${banned}`).toBe(false);
      }
      expect(/\bfetch\(/.test(withoutComments) && !file.endsWith('engine.ts'), `${file} calls fetch`).toBe(false);
    }
  });
});
