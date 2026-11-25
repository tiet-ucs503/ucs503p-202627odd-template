'use client';

import { useEffect, useRef } from 'react';

/**
 * Visibility-aware polling with an in-flight guard.
 *
 * - does not poll while the document is hidden
 * - immediately runs once when it becomes visible again
 * - never runs two callbacks concurrently
 */
export function usePolling(
  callback: () => void | Promise<void>,
  intervalMs: number,
  enabled = true
): void {
  const callbackRef = useRef(callback);
  const inFlightRef = useRef(false);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) return undefined;

    let cancelled = false;

    const run = async () => {
      if (cancelled || inFlightRef.current) return;
      if (typeof document !== 'undefined' && document.hidden) return;
      inFlightRef.current = true;
      try {
        await callbackRef.current();
      } finally {
        inFlightRef.current = false;
      }
    };

    void run();
    const timer = window.setInterval(() => {
      void run();
    }, intervalMs);

    const onVisibilityChange = () => {
      if (!document.hidden) void run();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [enabled, intervalMs]);
}
