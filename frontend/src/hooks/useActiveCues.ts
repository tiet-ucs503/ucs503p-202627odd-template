import { useCallback, useEffect, useRef, useState } from 'react';
import type { ActiveCue } from '@/lib/effects/director';

/** The most visual cues that can be on screen at once. */
export const MAX_ACTIVE_CUES = 24;

/**
 * Holds the visual cues that are currently showing. Each cue removes itself
 * when its time is up, and everything is cleared when the screen closes.
 */
export function useActiveCues() {
  const [cues, setCues] = useState<ActiveCue[]>([]);
  const timers = useRef(new Set<number>());

  const onCue = useCallback((cue: ActiveCue) => {
    setCues((current) => [...current.slice(-(MAX_ACTIVE_CUES - 1)), cue]);
    const timer = window.setTimeout(() => {
      timers.current.delete(timer);
      setCues((current) => current.filter((c) => c.key !== cue.key));
    }, cue.durMs + 60);
    timers.current.add(timer);
  }, []);

  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((t) => window.clearTimeout(t));
      pending.clear();
    };
  }, []);

  return { cues, onCue };
}
