// Owns the webcam while the student has the camera switched on.
//
// Camera frames go: webcam -> an off-screen <video> element -> the in-browser
// face model -> a FaceSample (four numbers). Nothing is recorded, drawn to a
// canvas, or uploaded. Only the per-question summary of those numbers is sent
// to the server, alongside the answer.

import type { AttentionSummary } from '@/lib/api';
import { createFaceDetector, FaceDetector } from '@/lib/attention/detector';
import { AttentionAccumulator, FaceSample, HeadBaseline, isFacingScreen } from '@/lib/attention/summary';

const SAMPLE_INTERVAL_MS = 100; // about 10 readings a second

export type CameraProblem = 'denied' | 'no-camera' | 'busy' | 'unsupported' | 'failed';

export class CameraError extends Error {
  problem: CameraProblem;
  constructor(problem: CameraProblem) {
    super(problem);
    this.problem = problem;
  }
}

function problemFrom(err: unknown): CameraProblem {
  const name = err instanceof Error ? err.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'denied';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'no-camera';
  if (name === 'NotReadableError' || name === 'AbortError') return 'busy';
  return 'failed';
}

/** What the test readout shows. Numbers only; there is no image data in here. */
export interface AttentionDebugSnapshot {
  reading: FaceSample | null;
  baseline: HeadBaseline | null;
  calibrationMsLeft: number;
  /** Whether the latest reading counts as facing the screen; null while there is nothing to judge. */
  facing: boolean | null;
  /** The summary for the current question so far. Looking at it does not reset it. */
  question: AttentionSummary | null;
  readingsPerSecond: number;
}

export class AttentionTracker {
  private stream: MediaStream | null = null;
  private video: HTMLVideoElement | null = null;
  private detector: FaceDetector | null = null;
  private timer: number | undefined;
  private accumulator = new AttentionAccumulator();
  private generation = 0; // lets a stop() during start() cancel the start
  private lastReading: FaceSample | null = null;
  private readingTimes: number[] = [];

  /** Called if the camera stops by itself (unplugged, or permission taken away). */
  onEnded: (() => void) | null = null;

  get running(): boolean {
    return this.stream !== null;
  }

  /** Asks for the camera and starts measuring. Throws CameraError if that is not possible. */
  async start(): Promise<void> {
    if (this.running) return;
    const generation = ++this.generation;

    if (!navigator.mediaDevices?.getUserMedia) throw new CameraError('unsupported');

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: 'user' },
        audio: false,
      });
    } catch (err) {
      throw new CameraError(problemFrom(err));
    }

    try {
      const video = document.createElement('video'); // never added to the page
      video.muted = true;
      video.playsInline = true;
      video.srcObject = stream;
      await video.play();
      const detector = await createFaceDetector();

      if (generation !== this.generation) {
        // Switched off while it was still starting.
        detector.close();
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      this.stream = stream;
      this.video = video;
      this.detector = detector;
      stream.getTracks().forEach((t) =>
        t.addEventListener('ended', () => {
          if (this.stream !== stream) return;
          this.stop();
          this.onEnded?.();
        }),
      );
      this.timer = window.setInterval(() => this.sample(), SAMPLE_INTERVAL_MS);
    } catch (err) {
      stream.getTracks().forEach((t) => t.stop());
      throw err instanceof CameraError ? err : new CameraError('failed');
    }
  }

  private sample(): void {
    if (!this.video || !this.detector) return;
    try {
      const now = performance.now();
      const reading = this.detector.detect(this.video, now);
      if (reading) {
        this.accumulator.add(reading, now);
        this.lastReading = reading;
        this.readingTimes = [...this.readingTimes.filter((t) => now - t < 2000), now];
      }
    } catch {
      /* one bad frame is not worth interrupting the game for */
    }
  }

  /** Turns the camera off immediately and forgets anything not yet sent. */
  stop(): void {
    this.generation += 1;
    window.clearInterval(this.timer);
    this.timer = undefined;
    this.stream?.getTracks().forEach((t) => t.stop());
    if (this.video) this.video.srcObject = null;
    this.detector?.close();
    this.stream = null;
    this.video = null;
    this.detector = null;
    this.accumulator = new AttentionAccumulator();
    this.lastReading = null;
    this.readingTimes = [];
  }

  /**
   * A read-only look at what is being measured, for testing on real hardware
   * (see docs/WEBCAM_TEST_PLAN.md). It changes nothing and is never sent anywhere.
   */
  debugSnapshot(): AttentionDebugSnapshot | null {
    if (!this.running) return null;
    const now = performance.now();
    const { baseline, msLeft } = this.accumulator.calibration(now);
    const reading = this.lastReading;
    const recent = this.readingTimes.filter((t) => now - t < 2000);
    return {
      reading,
      baseline,
      calibrationMsLeft: msLeft,
      facing: reading && reading.facePresent ? (baseline ? isFacingScreen(reading, baseline) : true) : reading ? false : null,
      question: this.accumulator.summary(),
      readingsPerSecond: recent.length / 2,
    };
  }

  /** Starts counting afresh for a new question. */
  beginQuestion(): void {
    this.accumulator.resetQuestion();
  }

  /** The numbers for the question just answered, or null if nothing was measured. */
  takeSummary(): AttentionSummary | null {
    if (!this.running) return null;
    const summary = this.accumulator.summary();
    this.accumulator.resetQuestion();
    return summary;
  }
}
