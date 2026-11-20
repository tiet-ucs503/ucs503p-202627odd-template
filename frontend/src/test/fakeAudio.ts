// A stand-in for the browser's audio system, so tests can check what the game
// asked it to do without making any sound.
import { vi } from 'vitest';

class FakeParam {
  value = 0;
  setValueAtTime = vi.fn((v: number) => { this.value = v; });
  linearRampToValueAtTime = vi.fn();
  exponentialRampToValueAtTime = vi.fn();
  setTargetAtTime = vi.fn((v: number) => { this.value = v; });
}

class FakeNode {
  connect = vi.fn((target: unknown) => target);
  disconnect = vi.fn();
}

class FakeSource extends FakeNode {
  frequency = new FakeParam();
  playbackRate = new FakeParam();
  type = 'sine';
  buffer: unknown = null;
  loop = false;
  started: number | null = null;
  stopped = false;
  start = vi.fn((when = 0) => { this.started = when; });
  scheduledStop: number | null = null;
  /** stop(when) schedules the end; stop() with no time is an immediate, manual stop. */
  stop = vi.fn((when?: number) => {
    if (when === undefined) this.stopped = true;
    else this.scheduledStop = when;
  });
}

class FakeGain extends FakeNode {
  gain = new FakeParam();
}

export class FakeAudioContext {
  currentTime = 0;
  sampleRate = 8000;
  state: 'running' | 'suspended' | 'closed' = 'running';
  destination = new FakeNode();
  sources: FakeSource[] = [];
  gains: FakeGain[] = [];

  createGain = () => { const g = new FakeGain(); this.gains.push(g); return g; };
  createOscillator = () => { const s = new FakeSource(); this.sources.push(s); return s; };
  createBufferSource = () => { const s = new FakeSource(); this.sources.push(s); return s; };
  createBiquadFilter = () => Object.assign(new FakeNode(), { type: 'lowpass', frequency: new FakeParam(), Q: new FakeParam() });
  createDynamicsCompressor = () => Object.assign(new FakeNode(), {
    threshold: new FakeParam(), ratio: new FakeParam(), attack: new FakeParam(), release: new FakeParam(),
  });
  createDelay = () => Object.assign(new FakeNode(), { delayTime: new FakeParam() });
  createStereoPanner = () => Object.assign(new FakeNode(), { pan: new FakeParam() });
  createBuffer = (_channels: number, length: number) => ({ getChannelData: () => new Float32Array(length), duration: length / this.sampleRate });
  resume = vi.fn(async () => { this.state = 'running'; });
  suspend = vi.fn(async () => { this.state = 'suspended'; });
  close = vi.fn(async () => { this.state = 'closed'; });

  /** The first gain node created is the master volume. */
  get master() { return this.gains[0]; }
  /** Sources that were started and not stopped by hand. */
  get playing() { return this.sources.filter((s) => s.started !== null && !s.stopped); }
}

export const asAudioContext = (fake: FakeAudioContext) => fake as unknown as AudioContext;
