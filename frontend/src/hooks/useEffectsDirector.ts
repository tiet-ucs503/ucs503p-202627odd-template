import { useEffect, useRef } from 'react';
import { AudioEngine } from '@/lib/effects/audio/engine';
import { ActiveCue, EffectsDirector } from '@/lib/effects/director';
import { effectsSettings } from '@/lib/effects/settings';

/**
 * One director (and one audio engine) for the villain on screen.
 * Both are created when the mission screen opens and fully shut down when it closes.
 * Settings are not owned here: they live in the app-wide store and outlast any mission.
 */
export function useEffectsDirector(villainId: string, onCue?: (cue: ActiveCue) => void) {
  const director = useRef<EffectsDirector | null>(null);
  const engineRef = useRef<AudioEngine | null>(null);
  const onCueRef = useRef(onCue);
  onCueRef.current = onCue;

  useEffect(() => {
    const engine = new AudioEngine(effectsSettings);
    const d = new EffectsDirector({
      villainId,
      engine,
      settings: effectsSettings,
      onCue: (cue) => onCueRef.current?.(cue),
    });
    director.current = d;
    engineRef.current = engine;
    return () => {
      d.dispose();
      engine.dispose();
      director.current = null;
      engineRef.current = null;
    };
  }, [villainId]);

  return { director, engine: engineRef };
}
