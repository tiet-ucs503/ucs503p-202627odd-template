// The visual cues the effects layer knows how to draw.
//
// Three kinds:
//   reaction - applied to a character's own portrait (it recoils, dims, slides in);
//   overlay  - a small accent at the edge of a portrait or avatar;
//   strip    - something that travels across the lane between the two portraits.
//
// Every cue has a "still" form for reduced motion: a gentle fade with no
// movement. A cue whose still form is null is simply left out.

export type CueKind = 'reaction' | 'overlay' | 'strip';

/** Overlays may touch a portrait's edge but must leave it clearly visible. */
export const MAX_OVERLAY_COVER_PCT = 20;
export const MAX_OVERLAY_MS = 300;
/** No more than this many small moving dots in one effect. */
export const MAX_PARTICLES = 8;

export interface CueDef {
  kind: CueKind;
  /** Classes used with full motion. */
  className: string;
  /** Classes used with reduced motion, or null to leave the cue out. */
  reducedClassName: string | null;
  /** For overlays: how much of the portrait's area the cue can cover, in percent. */
  coverPct?: number;
  /** For strip cues made of small dots: how many. */
  particles?: number;
  /** Colour of the cue as a CSS colour, where it has one. */
  color?: string;
}

export const CUES: Record<string, CueDef> = {
  // Reactions
  'react-recoil': { kind: 'reaction', className: 'fx-react-recoil', reducedClassName: 'fx-react-dim' },
  'react-hit': { kind: 'reaction', className: 'fx-react-hit', reducedClassName: 'fx-react-dim' },
  'react-dim': { kind: 'reaction', className: 'fx-react-dim', reducedClassName: 'fx-react-dim' },
  'react-enter': { kind: 'reaction', className: 'fx-react-enter', reducedClassName: 'fx-react-fade-in' },
  'victory-pop': { kind: 'reaction', className: 'fx-victory-pop', reducedClassName: 'fx-react-fade-in' },
  'defeat-sink': { kind: 'reaction', className: 'fx-defeat-sink', reducedClassName: 'fx-react-fade-in' },

  // Spider-Man's web: a line across the lane, then a small splat at the villain's edge
  'web-line-1': { kind: 'strip', className: 'fx-web-line fx-web-line-moving fx-web-line-straight', reducedClassName: 'fx-web-line fx-web-line-still' },
  'web-line-2': { kind: 'strip', className: 'fx-web-line fx-web-line-moving fx-web-line-high', reducedClassName: 'fx-web-line fx-web-line-still' },
  'web-line-3': { kind: 'strip', className: 'fx-web-line fx-web-line-moving fx-web-line-low', reducedClassName: 'fx-web-line fx-web-line-still' },
  'web-splat-1': { kind: 'overlay', className: 'fx-web-splat fx-web-splat-moving fx-splat-tl', reducedClassName: 'fx-web-splat fx-web-splat-still fx-splat-tl', coverPct: 16 },
  'web-splat-2': { kind: 'overlay', className: 'fx-web-splat fx-web-splat-moving fx-splat-bl', reducedClassName: 'fx-web-splat fx-web-splat-still fx-splat-bl', coverPct: 16 },
  'web-splat-3': { kind: 'overlay', className: 'fx-web-splat fx-web-splat-moving fx-splat-tr', reducedClassName: 'fx-web-splat fx-web-splat-still fx-splat-tr', coverPct: 16 },
  'spark-burst': { kind: 'strip', className: 'fx-spark fx-spark-moving', reducedClassName: null, particles: 6, color: '#ffffff' },

  // Gwen's comm link
  'gwen-ripple': { kind: 'overlay', className: 'fx-ring fx-ring-moving', reducedClassName: 'fx-ring fx-ring-still', coverPct: 0 },
};

/** The classes to use for a cue, or null if it should not be shown. */
export function cueClass(cue: string, reducedMotion: boolean): string | null {
  const def = CUES[cue];
  if (!def) return null;
  return reducedMotion ? def.reducedClassName : def.className;
}
