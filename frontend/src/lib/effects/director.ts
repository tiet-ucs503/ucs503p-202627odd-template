// Turns a gameplay event into sound (and, from F3, visuals) for the current villain.
//
// The director is the only thing the mission screen talks to. It knows about
// game events and nothing else: it has no access to the camera, to anything
// measured about the player, or to the server.

import type { AudioEngine } from '@/lib/effects/audio/engine';
import { RECIPES } from '@/lib/effects/audio/recipes';
import { cueClass, CUES } from '@/lib/effects/cues';
import type { GameEvent, GameEventType } from '@/lib/effects/events';
import { CueStep, Profile, SHARED, SPIDERMAN, Variation, VILLAINS } from '@/lib/effects/profiles';
import type { SettingsStore } from '@/lib/effects/settings';
import { Rng, VariationPicker } from '@/lib/effects/variation';

/** What a special event uses when a character has nothing specific for it. */
const FALLBACK: Partial<Record<GameEventType, GameEventType>> = {
  combo_special: 'player_strike',
  villain_special: 'villain_attack',
};

export interface ActiveCue extends CueStep {
  /** Unique per occurrence, so the same cue can be shown twice. */
  key: string;
  variation: string;
  reducedMotion: boolean;
}

export interface DirectorOptions {
  villainId: string;
  engine: AudioEngine;
  settings: SettingsStore;
  rng?: Rng;
  /** Called when a visual cue should appear. The effects layer listens here. */
  onCue?: (cue: ActiveCue) => void;
}

export class EffectsDirector {
  private picker: VariationPicker;
  private timers = new Set<number>();
  private sequence = 0;
  private disposed = false;

  constructor(private options: DirectorOptions) {
    this.picker = new VariationPicker(options.rng);
  }

  /** Call from a click, so the browser allows sound. */
  unlock(): void {
    this.options.engine.unlock();
  }

  /**
   * Plays the effects for one event.
   * Returns the ids of the variations chosen (useful for tests and the soundboard).
   */
  play(event: GameEvent): string[] {
    if (this.disposed) return [];
    const { villainId } = this.options;
    const villainList = this.variationsFor(VILLAINS[villainId], event);
    const villainOwnsEvent = villainList.variations.length > 0;
    const sources: [string, ReturnType<EffectsDirector['variationsFor']>][] = [
      // A villain with its own effects for this event replaces the shared ones.
      ['shared', villainOwnsEvent ? { key: '', variations: [] } : this.variationsFor(SHARED, event)],
      ['spiderman', this.variationsFor(SPIDERMAN, event)],
      [villainId, villainList],
    ];

    // Everything one event triggers is one effect as far as cooldowns go.
    const group = `${event.type}:${++this.sequence}`;
    const chosen: string[] = [];
    for (const [owner, { key, variations }] of sources) {
      if (!variations.length) continue;
      const variation = this.picker.pick(`${owner}:${key}`, variations);
      if (!variation) continue;
      chosen.push(`${owner}:${variation.id}`);
      // The villain decides how it reacts to being hit; drop the generic reaction.
      const cues = owner === 'spiderman' && villainOwnsEvent
        ? variation.cues.filter((c) => !(c.target === 'villain' && CUES[c.cue]?.kind === 'reaction'))
        : variation.cues;
      this.run(group, { ...variation, cues });
    }
    return chosen;
  }

  /**
   * The variations a profile offers for an event. A special with nothing of its
   * own falls back to the ordinary move (so a villain still reacts to a combo,
   * and an unknown villain still counter-attacks). Variations tied to a streak
   * length are only offered at that length.
   */
  private variationsFor(profile: Profile | undefined, event: GameEvent): { key: string; variations: Variation[] } {
    for (const type of [event.type, FALLBACK[event.type]]) {
      const list = type && profile?.[type];
      if (!list?.length) continue;
      const variations = list.filter((v) => v.forStreak === undefined || v.forStreak === event.streak);
      if (variations.length) return { key: `${type}:${event.streak ?? ''}`, variations };
    }
    return { key: '', variations: [] };
  }

  private run(group: string, variation: Variation): void {
    const { engine, settings, onCue } = this.options;
    const pitch = this.picker.pitchJitter();
    const jitterMs = this.picker.timingJitterMs();

    // Sounds are scheduled on the audio clock, so they stay in step with each other.
    for (const step of variation.sounds) {
      const play = { category: step.category, delayMs: step.atMs + jitterMs, group };
      if (step.recipe) {
        const recipe = RECIPES[step.recipe];
        if (recipe) engine.playRecipe(recipe, { ...play, pitch });
      } else if (step.sample) {
        engine.playSample(step.sample, { ...play, maxSeconds: step.maxSeconds });
      }
    }

    // Visual cues use the same offsets.
    if (!onCue) return;
    const reducedMotion = settings.reducedMotion();
    for (const cue of variation.cues) {
      if (cueClass(cue.cue, reducedMotion) === null) continue; // unknown, or has no still form
      const key = `${group}:${variation.id}:${cue.cue}:${cue.atMs}`;
      const show = () => onCue({ ...cue, key, variation: variation.id, reducedMotion });
      if (cue.atMs + jitterMs <= 0) {
        show();
      } else {
        const timer = window.setTimeout(() => {
          this.timers.delete(timer);
          if (!this.disposed) show();
        }, cue.atMs + jitterMs);
        this.timers.add(timer);
      }
    }
  }

  /** Stops everything this director started. The audio engine is disposed by its owner. */
  dispose(): void {
    this.disposed = true;
    this.timers.forEach((t) => window.clearTimeout(t));
    this.timers.clear();
  }
}
