// Sound and motion settings for the whole app.
//
// There is exactly one store, created when the app loads. It is remembered on
// this device, so the values survive a new question, a restarted mission, the
// next villain, a visit to the dashboard, and a page reload.
//
// Only the player's own action on the controls calls `update`. Nothing in the
// game (showing a question, starting or finishing a mission) writes here.

import { useSyncExternalStore } from 'react';

export type MotionChoice = 'system' | 'full' | 'reduced';

export interface EffectsSettings {
  muted: boolean;
  /** 0 to 100. The audio engine also applies its own hard cap on top of this. */
  volume: number;
  /** 'system' follows the device's reduced-motion setting until the player chooses. */
  motion: MotionChoice;
}

export const DEFAULT_SETTINGS: EffectsSettings = { muted: false, volume: 60, motion: 'system' };
const STORAGE_KEY = 'mathverse_effects_settings';

function clampVolume(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(100, Math.max(0, Math.round(n))) : DEFAULT_SETTINGS.volume;
}

function load(): EffectsSettings {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (!saved || typeof saved !== 'object') return { ...DEFAULT_SETTINGS };
    return {
      muted: saved.muted === true,
      volume: clampVolume(saved.volume),
      motion: saved.motion === 'full' || saved.motion === 'reduced' ? saved.motion : 'system',
    };
  } catch {
    return { ...DEFAULT_SETTINGS }; // storage unavailable or unreadable: use defaults
  }
}

export class SettingsStore {
  private value: EffectsSettings = load();
  private listeners = new Set<() => void>();

  get = (): EffectsSettings => this.value;

  /** Called only from the sound and motion controls. */
  update(change: Partial<EffectsSettings>): void {
    this.value = {
      ...this.value,
      ...change,
      volume: clampVolume(change.volume ?? this.value.volume),
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.value));
    } catch {
      /* storage unavailable: the setting still holds until the page is closed */
    }
    this.listeners.forEach((listener) => listener());
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** True when movement should be replaced by gentle fades. */
  reducedMotion(): boolean {
    if (this.value.motion === 'reduced') return true;
    if (this.value.motion === 'full') return false;
    return typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /** For tests: read the saved values again, as a fresh page load would. */
  reload(): void {
    this.value = load();
    this.listeners.forEach((listener) => listener());
  }
}

/** The one store for the app. */
export const effectsSettings = new SettingsStore();

export function useEffectsSettings(): EffectsSettings {
  return useSyncExternalStore(effectsSettings.subscribe, effectsSettings.get);
}
