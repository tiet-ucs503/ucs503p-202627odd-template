'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/auth-context';
import { useLocale } from '@/features/i18n/locale-context';
import { declineCall, subscribeToCalls, type IncomingCall } from '@/lib/call-signaling';
import { ringtoneManager } from '@/lib/ringtone';
import { Button } from '@/components/ui';

export function GlobalIncomingCall() {
  const { user } = useAuth();
  const { t } = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const [incoming, setIncoming] = useState<IncomingCall | null>(null);

  useEffect(() => {
    if (!user) return;

    const unsubscribe = subscribeToCalls({
      onIncoming: (call) => {
        setIncoming(call);
        // OrderCallPanel handles its own ringing when on the order page
        if (pathname !== `/orders/${call.orderId}`) {
          ringtoneManager.start();
        }
      },
      onEnded: (payload) => {
        ringtoneManager.stop();
        setIncoming((current) => (current?.orderId === payload.orderId ? null : current));
      },
      onDeclined: (payload) => {
        ringtoneManager.stop();
        setIncoming((current) => (current?.orderId === payload.orderId ? null : current));
      },
      onAccepted: () => {
        ringtoneManager.stop();
        setIncoming(null);
      },
    });

    return () => {
      unsubscribe();
      ringtoneManager.stop();
    };
  }, [pathname, user]);

  const handleDecline = () => {
    if (incoming) {
      declineCall(incoming.orderId, incoming.callId);
    }
    ringtoneManager.stop();
    setIncoming(null);
  };

  const handleAccept = () => {
    if (!incoming) return;
    const targetCall = incoming;
    ringtoneManager.stop();
    try {
      sessionStorage.setItem('agriconnect_pending_call_accept', JSON.stringify(targetCall));
    } catch {
      // Ignore sessionStorage storage quota or security errors
    }
    setIncoming(null);
    router.push(`/orders/${targetCall.orderId}`);
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
