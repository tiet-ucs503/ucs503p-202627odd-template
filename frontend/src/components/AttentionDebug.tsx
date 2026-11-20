import { useEffect, useState } from 'react';
import type { AttentionDebugSnapshot } from '@/lib/attention/tracker';
import { PITCH_LIMIT_DEG, YAW_LIMIT_DEG } from '@/lib/attention/summary';

const one = (n: number) => n.toFixed(1);

/**
 * A developer-only readout for testing the camera on real hardware.
 *
 * It shows numbers as text and nothing else: no picture, no video. It reads
 * what the tracker already measured, sends nothing anywhere, and changes
 * nothing about the game or what is stored. It only appears when the address
 * contains ?attentionDebug=1.
 */
export default function AttentionDebug({ camera, read }: { camera: string; read: () => AttentionDebugSnapshot | null }) {
  const [snapshot, setSnapshot] = useState<AttentionDebugSnapshot | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setSnapshot(read()), 250);
    return () => window.clearInterval(timer);
  }, [read]);

  const s = snapshot;
  const reading = s?.reading;
  return (
    <div
      data-attention-debug
      aria-hidden="true"
      className="fixed top-2 left-1/2 -translate-x-1/2 z-[70] pointer-events-none bg-black/85 border border-yellow-400/60 rounded-lg px-3 py-2 text-[11px] leading-snug font-mono text-yellow-100 whitespace-pre"
    >
      <div className="text-yellow-400 font-bold">ATTENTION DEBUG (numbers only, nothing is sent)</div>
      <div>camera: {camera}</div>
      {!s || camera !== 'on' ? (
        <div>no readings (camera is not on)</div>
      ) : (
        <>
          <div>face present: {reading ? (reading.facePresent ? 'yes' : 'no') : 'waiting for first frame'}</div>
          <div>head turn (yaw): {reading?.facePresent ? `${one(reading.yawDeg)} deg` : '-'}</div>
          <div>head tilt (pitch): {reading?.facePresent ? `${one(reading.pitchDeg)} deg` : '-'}</div>
          <div>eyes closed: {reading?.facePresent ? (reading.eyesClosed ? 'yes' : 'no') : '-'}</div>
          <div>
            baseline: {s.baseline
              ? `yaw ${one(s.baseline.yaw)}, pitch ${one(s.baseline.pitch)} deg`
              : `calibrating, ${one(s.calibrationMsLeft / 1000)} s left`}
          </div>
          <div>facing screen now: {s.facing === null ? '-' : s.facing ? 'yes' : 'no'} (limits: turn {YAW_LIMIT_DEG}, tilt {PITCH_LIMIT_DEG} deg from baseline)</div>
          <div>
            this question so far: {s.question
              ? `face ${s.question.face_present_pct}%, on screen ${s.question.on_screen_pct}%, blinks/min ${s.question.blink_rate_per_min ?? '-'}, ${s.question.sample_seconds} s`
              : 'no samples yet'}
          </div>
          <div>readings per second: {one(s.readingsPerSecond)}</div>
        </>
      )}
    </div>
  );
}
