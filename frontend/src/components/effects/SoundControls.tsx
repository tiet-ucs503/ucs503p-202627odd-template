import { Volume2, VolumeX } from 'lucide-react';
import { effectsSettings, useEffectsSettings } from '@/lib/effects/settings';

/**
 * Mute, volume and reduced-motion controls.
 * These are the only things in the app that change the effects settings, and
 * the settings are remembered on this device.
 */
export default function SoundControls() {
  const settings = useEffectsSettings();
  const reduced = settings.motion === 'reduced' || (settings.motion === 'system' && effectsSettings.reducedMotion());

  return (
    <div className="flex items-center gap-2" role="group" aria-label="Sound and motion settings">
      <button
        type="button"
        onClick={() => effectsSettings.update({ muted: !settings.muted })}
        aria-pressed={settings.muted}
        aria-label={settings.muted ? 'Sound is off. Turn sound on' : 'Sound is on. Turn sound off'}
        title={settings.muted ? 'Sound off' : 'Sound on'}
        className={`flex items-center justify-center w-7 h-7 rounded-lg border transition-colors ${
          settings.muted ? 'bg-white/5 border-white/20 text-slate-400' : 'bg-white/10 border-white/30 text-white'
        }`}
      >
        {settings.muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
      </button>

      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={settings.volume}
        disabled={settings.muted}
        onChange={(e) => effectsSettings.update({ volume: Number(e.target.value) })}
        aria-label="Volume"
        className="w-20 accent-hero-500 disabled:opacity-40"
      />

      <label className="flex items-center gap-1.5 cursor-pointer select-none" title="Replaces movement with gentle fades">
        <input
          type="checkbox"
          checked={reduced}
          onChange={(e) => effectsSettings.update({ motion: e.target.checked ? 'reduced' : 'full' })}
          className="accent-hero-500"
        />
        Less motion
      </label>
    </div>
  );
}
