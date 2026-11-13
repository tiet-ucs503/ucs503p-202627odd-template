// Turns a gameplay event into sound (and, from F3, visuals) for the current villain.
//
// The director is the only thing the mission screen talks to. It knows about
// game events and nothing else: it has no access to the camera, to anything
// measured about the player, or to the server.

import type { AudioEngine } from '@/lib/effects/audio/engine';
import { RECIPES } from '@/lib/effects/audio/recipes';
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
    const sources: [string, Profile | undefined][] = [
      ['shared', SHARED],
      ['spiderman', SPIDERMAN],
      [villainId, VILLAINS[villainId]],
    ];

    const chosen: string[] = [];
    for (const [owner, profile] of sources) {
      const variations = profile?.[event.type];
      if (!variations?.length) continue;
      const variation = this.picker.pick(`${owner}:${event.type}`, variations);
      if (!variation) continue;
      chosen.push(`${owner}:${variation.id}`);
      this.run(owner, variation);
    }
    return chosen;
  }

  private run(owner: string, variation: Variation): void {
    const { engine, settings, onCue } = this.options;
    const group = `${owner}:${variation.id}:${++this.sequence}`;
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
      const show = () => onCue({ ...cue, key: `${group}:${cue.cue}:${cue.atMs}`, variation: variation.id, reducedMotion });
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
