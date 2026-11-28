'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/auth-context';
import { useLocale } from '@/features/i18n/locale-context';
import { declineCall, subscribeToCalls, type IncomingCall } from '@/lib/call-signaling';
import { Button } from '@/components/ui';

function playWebAudioRing(): () => void {
  if (typeof window === 'undefined') return () => {};
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return () => {};
    const ctx = new AudioContextClass();
    let isPlaying = true;

    const ring = () => {
      if (!isPlaying || ctx.state === 'closed') return;
      if (ctx.state === 'suspended') {
        void ctx.resume();
      }
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'sine';
      osc1.frequency.setValueAtTime(440, ctx.currentTime);
      osc2.frequency.setValueAtTime(480, ctx.currentTime);

      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.8);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(ctx.currentTime);
      osc2.start(ctx.currentTime);
      osc1.stop(ctx.currentTime + 1.8);
      osc2.stop(ctx.currentTime + 1.8);
    };

    ring();
    const interval = window.setInterval(ring, 3200);

    return () => {
      isPlaying = false;
      window.clearInterval(interval);
      void ctx.close().catch(() => undefined);
    };
  } catch {
    return () => {};
  }
}

export function GlobalIncomingCall() {
  const { user } = useAuth();
  const { t } = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const [incoming, setIncoming] = useState<IncomingCall | null>(null);
  const stopRingRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!user) return;

    const unsubscribe = subscribeToCalls({
      onIncoming: (call) => {
        setIncoming(call);
        stopRingRef.current?.();
        stopRingRef.current = playWebAudioRing();
      },
      onEnded: (payload) => {
        setIncoming((current) => {
          if (current?.orderId === payload.orderId) {
            stopRingRef.current?.();
            stopRingRef.current = null;
            return null;
          }
          return current;
        });
      },
      onDeclined: (payload) => {
        setIncoming((current) => {
          if (current?.orderId === payload.orderId) {
            stopRingRef.current?.();
            stopRingRef.current = null;
            return null;
          }
          return current;
        });
      },
      onAccepted: () => {
        stopRingRef.current?.();
        stopRingRef.current = null;
        setIncoming(null);
      },
    });

    return () => {
      unsubscribe();
      stopRingRef.current?.();
      stopRingRef.current = null;
    };
  }, [user]);

  const handleDecline = () => {
    if (incoming) {
      declineCall(incoming.orderId, incoming.callId);
    }
    stopRingRef.current?.();
    stopRingRef.current = null;
    setIncoming(null);
  };

  const handleAccept = () => {
    if (!incoming) return;
    const orderId = incoming.orderId;
    stopRingRef.current?.();
    stopRingRef.current = null;
    setIncoming(null);
    router.push(`/orders/${orderId}`);
  };

  // If user is already looking at that order's page, OrderCallPanel handles it in-place
  if (!incoming || pathname === `/orders/${incoming.orderId}`) {
    return null;
  }

  const orderShort = `#${incoming.orderId.slice(-6).toUpperCase()}`;

  return (
    <aside
      role="alert"
      aria-live="assertive"
      className="fixed inset-x-4 top-4 z-50 mx-auto max-w-md animate-bounce-short rounded-2xl border-2 border-forest/20 bg-paper/95 p-4 shadow-2xl backdrop-blur-md"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 animate-pulse items-center justify-center rounded-full bg-forest text-paper shadow-md">
          <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 00-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="font-display font-semibold text-forest">{t('order.call.title')}</p>
            <span className="rounded bg-harvest/15 px-1.5 py-0.5 text-xs font-bold text-forest">
              {orderShort}
            </span>
          </div>
          <p className="truncate text-sm text-ink/80">
            {t('order.call.incoming', { name: incoming.from.name })}
          </p>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <Button
          type="button"
          onClick={handleAccept}
          className="flex-1 bg-forest text-paper hover:bg-forest/90"
        >
          {t('order.call.accept')}
        </Button>
        <Button
          type="button"
          variant="danger"
          onClick={handleDecline}
          className="flex-1"
        >
          {t('order.call.decline')}
        </Button>
      </div>
    </aside>
  );
}
