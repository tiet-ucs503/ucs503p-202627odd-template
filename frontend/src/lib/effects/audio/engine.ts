// The one place sound leaves the game.
//
// Child-friendly limits enforced here, whatever the rest of the code asks for:
//   - a hard cap on loudness, plus a limiter on the output;
//   - at most four sounds at once;
//   - a short cooldown per kind of sound, so nothing machine-guns;
//   - mute and volume come from the shared settings store and apply at once.

import type { SettingsStore } from '@/lib/effects/settings';
import { playRecipe, Recipe } from '@/lib/effects/audio/synth';

export type SoundCategory = 'impact' | 'voice' | 'ui' | 'music' | 'ambient';

/** The loudest the game can ever be, as a fraction of full scale. */
export const MASTER_CAP = 0.5;
export const MAX_VOICES = 4;
export const COOLDOWN_MS: Record<SoundCategory, number> = {
  impact: 250,
  voice: 1500,
  ui: 120,
  music: 0,
  ambient: 2000,
};

export interface PlayOptions {
  category: SoundCategory;
  /** Multiplies pitch (synth) or playback speed (samples). */
  pitch?: number;
  delayMs?: number;
  /** Cuts a long sample short, with a fade. */
  maxSeconds?: number;
  /**
   * Sounds that belong to one effect (for example a web shot and its impact)
   * share a group, so the cooldown applies to the effect as a whole and not
   * between its own parts.
   */
  group?: string;
}

interface Voice {
  category: SoundCategory;
  startedAt: number;
  end: number; // audio-clock time
  stop: () => void;
}

export interface EngineDeps {
  /** Returns null where audio is unavailable (for example in tests). */
  createContext?: () => AudioContext | null;
  now?: () => number;
  loadBuffer?: (ctx: AudioContext, url: string) => Promise<AudioBuffer>;
}

function defaultCreateContext(): AudioContext | null {
  try {
    return typeof AudioContext === 'function' ? new AudioContext() : null;
  } catch {
    return null;
  }
}

async function defaultLoadBuffer(ctx: AudioContext, url: string): Promise<AudioBuffer> {
  const response = await fetch(url);
  return ctx.decodeAudioData(await response.arrayBuffer());
}

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private echoIn: AudioNode | null = null;
  private voices: Voice[] = [];
  private lastPlayed = new Map<SoundCategory, number>();
  private lastGroup = new Map<SoundCategory, string>();
  private buffers = new Map<string, Promise<AudioBuffer>>();
  private disposed = false;
  private unsubscribe: () => void;
  private createContext: () => AudioContext | null;
  private now: () => number;
  private loadBuffer: (ctx: AudioContext, url: string) => Promise<AudioBuffer>;

  constructor(private settings: SettingsStore, deps: EngineDeps = {}) {
    this.createContext = deps.createContext ?? defaultCreateContext;
    this.now = deps.now ?? (() => performance.now());
    this.loadBuffer = deps.loadBuffer ?? defaultLoadBuffer;
    this.unsubscribe = settings.subscribe(() => this.applyVolume());
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  private onVisibility = () => {
    if (!this.ctx) return;
    if (document.hidden) void this.ctx.suspend();
    else void this.ctx.resume();
  };

  /** Builds the output chain the first time a sound is needed. */
  private ensure(): AudioContext | null {
    if (this.disposed) return null;
    if (this.ctx) return this.ctx;
    const ctx = this.createContext();
    if (!ctx) return null;

    // sounds -> master volume (capped) -> limiter -> speakers
    const master = ctx.createGain();
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -12;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.15;
    master.connect(limiter).connect(ctx.destination);

    // One shared, quiet echo so every sound sits in the same room.
    const delay = ctx.createDelay(0.5);
    delay.delayTime.value = 0.17;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.28;
    const damp = ctx.createBiquadFilter();
    damp.type = 'lowpass';
    damp.frequency.value = 2400;
    delay.connect(damp).connect(feedback).connect(delay);
    damp.connect(master);

    this.ctx = ctx;
    this.master = master;
    this.echoIn = delay;
    this.applyVolume();
    return ctx;
  }

  /** Master gain for the current settings. Never above MASTER_CAP. */
  masterGain(): number {
    const { muted, volume } = this.settings.get();
    return muted ? 0 : MASTER_CAP * (Math.min(100, Math.max(0, volume)) / 100);
  }

  private applyVolume(): void {
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.masterGain(), this.ctx.currentTime, 0.02);
    }
  }

  /** Browsers only allow sound after the player has clicked; call this from a click. */
  unlock(): void {
    const ctx = this.ensure();
    if (ctx && ctx.state === 'suspended') void ctx.resume();
  }

  get activeVoices(): number {
    this.prune();
    return this.voices.length;
  }

  private prune(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.voices = this.voices.filter((v) => v.end > t);
  }

  /** Decides whether a sound may start now, and makes room for it if needed. */
  private admit(category: SoundCategory, group?: string): AudioContext | null {
    if (this.settings.get().muted) return null;
    const ctx = this.ensure();
    if (!ctx) return null;

    const now = this.now();
    const sameEffect = group !== undefined && this.lastGroup.get(category) === group;
    if (!sameEffect) {
      const last = this.lastPlayed.get(category);
      if (last !== undefined && now - last < COOLDOWN_MS[category]) return null;
      this.lastPlayed.set(category, now);
      if (group !== undefined) this.lastGroup.set(category, group);
      else this.lastGroup.delete(category);
    }

    this.prune();
    while (this.voices.length >= MAX_VOICES) {
      // Drop the oldest sound of the same kind, or the oldest of all.
      const sameKind = this.voices.filter((v) => v.category === category);
      const victim = (sameKind.length ? sameKind : this.voices).reduce((a, b) => (a.startedAt <= b.startedAt ? a : b));
      victim.stop();
      this.voices = this.voices.filter((v) => v !== victim);
    }
    return ctx;
  }

  /** Plays a synthesised sound. Returns false if it was skipped (muted, cooling down, no audio). */
  playRecipe(recipe: Recipe, options: PlayOptions): boolean {
    const ctx = this.admit(options.category, options.group);
    if (!ctx || !this.master) return false;
    const when = ctx.currentTime + (options.delayMs ?? 0) / 1000;
    const handle = playRecipe(ctx, recipe, this.master, this.echoIn, when, options.pitch ?? 1);
    this.voices.push({ category: options.category, startedAt: this.now(), end: handle.end, stop: handle.stop });
    return true;
  }

  /** Plays one of the existing audio files. Returns false if it was skipped. */
  playSample(url: string, options: PlayOptions): boolean {
    const ctx = this.admit(options.category, options.group);
    if (!ctx || !this.master) return false;
    const master = this.master;

    let cancelled = false;
    let source: AudioBufferSourceNode | null = null;
    const voice: Voice = {
      category: options.category,
      startedAt: this.now(),
      end: ctx.currentTime + 30, // corrected once the file's length is known
      stop: () => {
        cancelled = true;
        try {
          source?.stop();
        } catch {
          /* already stopped */
        }
      },
    };
    this.voices.push(voice);

    let pending = this.buffers.get(url);
    if (!pending) {
      pending = this.loadBuffer(ctx, url);
      this.buffers.set(url, pending);
    }
    pending
      .then((buffer) => {
        if (cancelled || this.disposed || this.settings.get().muted) {
          voice.end = 0;
          return;
        }
        const when = ctx.currentTime + (options.delayMs ?? 0) / 1000;
        const length = Math.min(buffer.duration, options.maxSeconds ?? buffer.duration);
        source = ctx.createBufferSource();
        source.buffer = buffer;
        source.playbackRate.value = options.pitch ?? 1;
        const fade = ctx.createGain();
        fade.gain.setValueAtTime(0.9, when);
        fade.gain.setValueAtTime(0.9, when + Math.max(0, length - 0.4));
        fade.gain.linearRampToValueAtTime(0.0001, when + length);
        source.connect(fade).connect(master);
        source.start(when);
        source.stop(when + length);
        voice.end = when + length;
      })
      .catch(() => {
        voice.end = 0; // the file could not be loaded: stay silent
        this.buffers.delete(url);
      });
    return true;
  }

  /** Stops everything and releases the audio device. */
  dispose(): void {
    this.disposed = true;
    this.unsubscribe();
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.voices.forEach((v) => v.stop());
    this.voices = [];
    if (this.ctx && this.ctx.state !== 'closed') void this.ctx.close();
    this.ctx = null;
    this.master = null;
    this.echoIn = null;
  }
}
