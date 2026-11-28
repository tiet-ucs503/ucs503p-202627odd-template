'use client';

import { useEffect, useRef } from 'react';
import { Alert, Badge, Button, Card } from '@/components/ui';
import { useLocale } from '@/features/i18n/locale-context';
import { useOrderCall } from './useOrderCall';

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * In-app voice call for an order. Buyers and farmers talk without ever seeing each
 * other's phone number, which is why sharing numbers in chat is blocked.
 */
export function OrderCallPanel({
  orderId,
  counterpartyName,
  disabled,
}: {
  orderId: string;
  counterpartyName: string;
  disabled?: boolean;
}) {
  const { t } = useLocale();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const call = useOrderCall({ orderId, disabled, audioElementRef: audioRef });

  useEffect(() => {
    if (call.status === 'ringing' && call.incoming) {
      let isPlaying = true;
      try {
        const AudioContextClass =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AudioContextClass) return;
        const ctx = new AudioContextClass();

        const ring = () => {
          if (!isPlaying || ctx.state === 'closed') return;
          if (ctx.state === 'suspended') void ctx.resume();
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
        const timer = window.setInterval(ring, 3200);
        return () => {
          isPlaying = false;
          window.clearInterval(timer);
          void ctx.close().catch(() => undefined);
        };
      } catch {
        return;
      }
    }
  }, [call.status, call.incoming]);

  return (
    <Card className="space-y-3">
      <audio ref={audioRef} autoPlay playsInline className="hidden" aria-hidden="true" />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl text-forest">{t('order.call.title')}</h2>
          <p className="text-sm text-ink/60">
            {t('order.call.subtitle', { name: counterpartyName })}
          </p>
        </div>
        {call.status === 'active' ? (
          <Badge tone="good">
            {t('order.call.onCall', { duration: formatDuration(call.seconds) })}
          </Badge>
        ) : call.status === 'calling' ? (
          <Badge tone="warn">{t('order.call.ringing')}</Badge>
        ) : call.status === 'connecting' ? (
          <Badge tone="warn">{t('order.call.connecting')}</Badge>
        ) : null}
      </div>

      {call.error ? <Alert>{call.error}</Alert> : null}

      {disabled ? (
        <p className="text-sm text-ink/60">{t('order.call.closed')}</p>
      ) : call.status === 'ringing' && call.incoming ? (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-forest">
            {t('order.call.incoming', { name: call.incoming.from.name })}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => void call.accept()}>
              {t('order.call.accept')}
            </Button>
            <Button type="button" variant="danger" onClick={call.decline}>
              {t('order.call.decline')}
            </Button>
          </div>
        </div>
      ) : call.status === 'idle' ? (
        <Button type="button" variant="secondary" onClick={() => void call.start()}>
          {t('order.call.start', { name: counterpartyName })}
        </Button>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={call.toggleMute}>
            {call.muted ? t('order.call.unmute') : t('order.call.mute')}
          </Button>
          <Button type="button" variant="danger" onClick={call.hangUp}>
            {call.status === 'calling' ? t('order.call.cancelCall') : t('order.call.endCall')}
          </Button>
        </div>
      )}
    </Card>
  );
}
