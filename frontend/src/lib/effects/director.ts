// Turns a gameplay event into sound (and, from F3, visuals) for the current villain.
//
// The director is the only thing the mission screen talks to. It knows about
// game events and nothing else: it has no access to the camera, to anything
// measured about the player, or to the server.

import type { AudioEngine } from '@/lib/effects/audio/engine';
import { RECIPES } from '@/lib/effects/audio/recipes';
import { cueClass, CUES } from '@/lib/effects/cues';
import type { GameEvent } from '@/lib/effects/events';
import { CueStep, Profile, SHARED, SPIDERMAN, Variation, VILLAINS } from '@/lib/effects/profiles';
import type { SettingsStore } from '@/lib/effects/settings';
import { Rng, VariationPicker } from '@/lib/effects/variation';

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
    const villainOwnsEvent = Boolean(VILLAINS[villainId]?.[event.type]?.length);
    const sources: [string, Profile | undefined][] = [
      // A villain with its own effects for this event replaces the shared ones.
      ['shared', villainOwnsEvent ? undefined : SHARED],
      ['spiderman', SPIDERMAN],
      [villainId, VILLAINS[villainId]],
    ];

    // Everything one event triggers is one effect as far as cooldowns go.
    const group = `${event.type}:${++this.sequence}`;
    const chosen: string[] = [];
    for (const [owner, profile] of sources) {
      const variations = profile?.[event.type];
      if (!variations?.length) continue;
      const variation = this.picker.pick(`${owner}:${event.type}`, variations);
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
