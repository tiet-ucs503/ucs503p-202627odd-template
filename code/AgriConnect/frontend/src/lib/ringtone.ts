'use client';

/**
 * Singleton RingtoneManager for Web Audio telephone ringing cadences.
 *
 * Guarantees:
 * - Single active AudioContext across all calling components.
 * - Idempotent start and immediate, synchronous sound cutoff on stop.
 * - Eliminates lingering ringing when calls are accepted, declined, or cancelled.
 */
class RingtoneManager {
  private ctx: AudioContext | null = null;
  private intervalId: number | null = null;
  private isRinging = false;

  start(): void {
    if (typeof window === 'undefined') return;
    if (this.isRinging) return;
    this.isRinging = true;

    try {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;

      const ctx = new AudioContextClass();
      this.ctx = ctx;

      const playTone = () => {
        if (!this.isRinging || !this.ctx || this.ctx.state === 'closed') return;
        if (this.ctx.state === 'suspended') {
          void this.ctx.resume().catch(() => undefined);
        }

        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        // Standard Indian/UK dual-frequency ringing tones (440Hz + 480Hz)
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

      playTone();
      this.intervalId = window.setInterval(playTone, 3200);
    } catch {
      this.isRinging = false;
    }
  }

  stop(): void {
    if (!this.isRinging && !this.ctx && this.intervalId === null) return;
    this.isRinging = false;

    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }

    if (this.ctx) {
      try {
        // Suspend immediately so already scheduled oscillator frames are silenced instantly
        void this.ctx.suspend().catch(() => undefined);
        void this.ctx.close().catch(() => undefined);
      } catch {
        // Ignore AudioContext close errors
      }
      this.ctx = null;
    }
  }
}

export const ringtoneManager = new RingtoneManager();
