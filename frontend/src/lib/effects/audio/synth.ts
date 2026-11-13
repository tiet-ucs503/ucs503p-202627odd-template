// Plays a sound "recipe": a few layers of tones and noise shaped over time.
// Every sound in the game that is not one of the five existing audio files is
// made here, in the browser, so nothing is downloaded.
//
// A character's identity comes from the kind of layers it uses (buzzy saw,
// metallic FM, hiss, sub-bass...), not from pitch alone.

export type Wave = 'sine' | 'triangle' | 'sawtooth' | 'square' | 'noise';

export interface Layer {
  source: Wave;
  /** Seconds after the start of the sound at which this layer begins. */
  at?: number;
  /** Length of the layer in seconds. */
  dur: number;
  /** Pitch in Hz, sliding from the first value to the second. Ignored for noise. */
  freq?: [number, number];
  /** Loudest point of the layer, 0 to 1. */
  gain: number;
  /** Fade-in time in seconds. Very short = a sharp click or snap. */
  attack?: number;
  /** Tone shaping: lowpass = dull/dark, highpass = thin/hissy, bandpass = focused. */
  filter?: { type: BiquadFilterType; freq: [number, number]; q?: number };
  /** Wobble in pitch: rate in Hz, depth in Hz. */
  vibrato?: { rate: number; depth: number };
  /** Metallic, bell-like tone: a second oscillator bends the first one's pitch. */
  fm?: { ratio: number; index: number };
  /** Buzzy, robotic tone: the layer is multiplied by a tone of this many Hz. */
  ring?: number;
  /** Left (-1) to right (1). */
  pan?: number;
  /** How much of the layer is sent to the shared echo, 0 to 1. */
  echo?: number;
}

export interface Recipe {
  id: string;
  layers: Layer[];
}

export function recipeDuration(recipe: Recipe): number {
  return Math.max(...recipe.layers.map((l) => (l.at ?? 0) + l.dur));
}

const noiseBuffers = new WeakMap<BaseAudioContext, AudioBuffer>();

function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  let buffer = noiseBuffers.get(ctx);
  if (!buffer) {
    buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 2), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    noiseBuffers.set(ctx, buffer);
  }
  return buffer;
}

const SILENT = 0.0001; // exponential fades cannot reach exactly zero

/**
 * Schedules a recipe to start at `when` (audio-clock seconds).
 * `pitch` multiplies every frequency; 1 leaves the sound as written.
 */
export function playRecipe(
  ctx: BaseAudioContext,
  recipe: Recipe,
  out: AudioNode,
  echoIn: AudioNode | null,
  when: number,
  pitch = 1,
): { end: number; stop: () => void } {
  const sources: AudioScheduledSourceNode[] = [];
  let end = when;

  for (const layer of recipe.layers) {
    const start = when + (layer.at ?? 0);
    const stop = start + layer.dur;
    end = Math.max(end, stop);

    // 1. The raw sound: an oscillator or noise.
    let node: AudioNode;
    if (layer.source === 'noise') {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer(ctx);
      src.loop = true;
      src.start(start);
      src.stop(stop);
      sources.push(src);
      node = src;
    } else {
      const osc = ctx.createOscillator();
      osc.type = layer.source;
      const [f0, f1] = layer.freq ?? [440, 440];
      osc.frequency.setValueAtTime(Math.max(1, f0 * pitch), start);
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1 * pitch), stop);

      if (layer.vibrato) {
        const lfo = ctx.createOscillator();
        const depth = ctx.createGain();
        lfo.frequency.value = layer.vibrato.rate;
        depth.gain.value = layer.vibrato.depth;
        lfo.connect(depth).connect(osc.frequency);
        lfo.start(start);
        lfo.stop(stop);
        sources.push(lfo);
      }
      if (layer.fm) {
        const mod = ctx.createOscillator();
        const index = ctx.createGain();
        mod.frequency.value = f0 * pitch * layer.fm.ratio;
        index.gain.value = f0 * pitch * layer.fm.index;
        mod.connect(index).connect(osc.frequency);
        mod.start(start);
        mod.stop(stop);
        sources.push(mod);
      }
      osc.start(start);
      osc.stop(stop);
      sources.push(osc);
      node = osc;
    }

    // 2. Optional ring modulation (multiplies the sound by another tone).
    if (layer.ring) {
      const ringGain = ctx.createGain();
      ringGain.gain.value = 0;
      const ringOsc = ctx.createOscillator();
      ringOsc.frequency.value = layer.ring * pitch;
      ringOsc.connect(ringGain.gain);
      ringOsc.start(start);
      ringOsc.stop(stop);
      sources.push(ringOsc);
      node.connect(ringGain);
      node = ringGain;
    }

    // 3. Optional filter sweep.
    if (layer.filter) {
      const filter = ctx.createBiquadFilter();
      filter.type = layer.filter.type;
      filter.Q.value = layer.filter.q ?? 1;
      filter.frequency.setValueAtTime(Math.max(10, layer.filter.freq[0]), start);
      filter.frequency.exponentialRampToValueAtTime(Math.max(10, layer.filter.freq[1]), stop);
      node.connect(filter);
      node = filter;
    }

    // 4. Volume shape: fade in, then fade out smoothly so nothing clicks.
    const env = ctx.createGain();
    const attack = Math.min(layer.attack ?? 0.005, layer.dur / 2);
    env.gain.setValueAtTime(SILENT, start);
    env.gain.linearRampToValueAtTime(Math.max(SILENT, layer.gain), start + attack);
    env.gain.exponentialRampToValueAtTime(SILENT, stop);
    node.connect(env);
    node = env;

    // 5. Position between the speakers.
    if (layer.pan !== undefined && typeof ctx.createStereoPanner === 'function') {
      const panner = ctx.createStereoPanner();
      panner.pan.value = layer.pan;
      node.connect(panner);
      node = panner;
    }

    node.connect(out);
    if (layer.echo && echoIn) {
      const send = ctx.createGain();
      send.gain.value = layer.echo;
      node.connect(send).connect(echoIn);
    }
  }

  return {
    end,
    stop: () => {
      for (const s of sources) {
        try {
          s.stop();
        } catch {
          /* already stopped */
        }
      }
    },
  };
}
