'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Button, Snackbar } from '@mui/material';

/**
 * Registers the student service worker and surfaces update notifications.
 * Renders the install banner above the student app.
 */
export default function StudentPwaProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [updateReady, setUpdateReady] =
    useState<ServiceWorkerRegistration | null>(null);
  const applyingUpdate = useRef(false);

  useEffect(() => {
    if (
      process.env.NODE_ENV !== 'production' ||
      typeof navigator === 'undefined' ||
      !('serviceWorker' in navigator)
    ) {
      return undefined;
    }

    let cancelled = false;

    const handleControllerChange = () => {
      if (applyingUpdate.current) {
        window.location.reload();
      }
    };

    navigator.serviceWorker.addEventListener(
      'controllerchange',
      handleControllerChange
    );

    navigator.serviceWorker
      .register('/student/sw.js', { scope: '/student/' })
      .then((registration) => {
        if (cancelled) return;

        if (registration.waiting) {
          setUpdateReady(registration);
        }

        registration.addEventListener('updatefound', () => {
          const installing = registration.installing;
          if (!installing) return;

          installing.addEventListener('statechange', () => {
            if (
              installing.state === 'installed' &&
              navigator.serviceWorker.controller
            ) {
              setUpdateReady(registration);
            }
          });
        });
      })
      .catch((error) => {
        console.error('[ClassPulse PWA] Service worker registration failed:', error);
      });

    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener(
        'controllerchange',
        handleControllerChange
      );
    };
  }, []);

  const handleUpdate = () => {
    const waiting = updateReady?.waiting;
    if (!waiting) return;
    applyingUpdate.current = true;
    waiting.postMessage({ type: 'SKIP_WAITING' });
    setUpdateReady(null);
  };

  return (
    <>
      {children}
      <Snackbar
        open={!!updateReady}
        message="A new version of ClassPulse is ready."
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        action={
          <Button color="secondary" size="small" onClick={handleUpdate}>
            Refresh
          </Button>
        }
      />
    </>
  );
}
