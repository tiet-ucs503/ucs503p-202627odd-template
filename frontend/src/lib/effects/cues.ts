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

/** How a strip cue is drawn. */
export type StripShape = 'line' | 'sparks' | 'dot' | 'arc' | 'blob' | 'ghost' | 'ring';

/** A small drawing placed at the edge of a portrait. */
export type OverlayMark = 'web' | 'slash' | 'claws' | 'glint';

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
  /** For strip cues: what to draw. */
  shape?: StripShape;
  /** For overlays: how much of the portrait's area the cue can cover, in percent. */
  coverPct?: number;
  /** For 'sparks': how many dots. */
  particles?: number;
  /** For 'arc': the curve, drawn in a 100 x 100 box from the villain (right) to the player (left). */
  path?: string;
  /** For overlays that are a small drawing rather than a plain shape. */
  mark?: OverlayMark;
  /** For 'claws': the angle of the scratch marks, in degrees. */
  angle?: number;
  /** Colour of the cue as a CSS colour, where it has one. */
  color?: string;
}

const reaction = (className: string, reducedClassName: string | null): CueDef => ({ kind: 'reaction', className, reducedClassName });
const strip = (shape: StripShape, moving: string, still: string | null, extra: Partial<CueDef> = {}): CueDef =>
  ({ kind: 'strip', shape, className: moving, reducedClassName: still, ...extra });
const overlay = (moving: string, still: string, coverPct: number, color?: string, extra: Partial<CueDef> = {}): CueDef =>
  ({ kind: 'overlay', className: moving, reducedClassName: still, coverPct, color, ...extra });
/** A small drawing that pops in at the inner edge of the player's portrait, where an attack lands. */
const mark = (kind: OverlayMark, color: string, extra: Partial<CueDef> = {}): CueDef =>
  overlay('fx-edge-mark fx-edge-inner fx-web-splat-moving', 'fx-edge-mark fx-edge-inner fx-web-splat-still', 19, color, { mark: kind, ...extra });

const STEEL = '#94a3b8';
const TENDRIL = '#64748b';

export const CUES: Record<string, CueDef> = {
  // ── Reactions shared by everyone ──
  'react-recoil': reaction('fx-react-recoil', 'fx-react-dim'),
  'react-hit': reaction('fx-react-hit', 'fx-react-dim'),
  'react-dim': reaction('fx-react-dim', 'fx-react-dim'),
  'react-enter': reaction('fx-react-enter', 'fx-react-fade-in'),
  'react-lean': reaction('fx-react-lean', null), // a villain leaning into its attack
  'victory-pop': reaction('fx-victory-pop', 'fx-react-fade-in'),
  'defeat-sink': reaction('fx-defeat-sink', 'fx-react-fade-in'),

  // ── Spider-Man: a web line across the lane, then a small web at the villain's edge ──
  'web-line-1': strip('line', 'fx-web-line fx-web-line-moving fx-web-line-straight', 'fx-web-line fx-web-line-still'),
  'web-line-2': strip('line', 'fx-web-line fx-web-line-moving fx-web-line-high', 'fx-web-line fx-web-line-still'),
  'web-line-3': strip('line', 'fx-web-line fx-web-line-moving fx-web-line-low', 'fx-web-line fx-web-line-still'),
  'web-splat-1': overlay('fx-web-splat fx-web-splat-moving fx-splat-tl', 'fx-web-splat fx-web-splat-still fx-splat-tl', 16, undefined, { mark: 'web' }),
  'web-splat-2': overlay('fx-web-splat fx-web-splat-moving fx-splat-bl', 'fx-web-splat fx-web-splat-still fx-splat-bl', 16, undefined, { mark: 'web' }),
  'web-splat-3': overlay('fx-web-splat fx-web-splat-moving fx-splat-tr', 'fx-web-splat fx-web-splat-still fx-splat-tr', 16, undefined, { mark: 'web' }),
  'spark-burst': strip('sparks', 'fx-spark fx-spark-moving', null, { particles: 6, color: '#ffffff' }),

  // ── Gwen's comm link ──
  'gwen-ripple': overlay('fx-ring fx-ring-moving', 'fx-ring fx-ring-still', 0),

  // ── Green Goblin: glider streaks, lobbed pumpkins, an orange puff, a wobbling glider ──
  'goblin-streak-1': strip('line', 'fx-streak fx-streak-moving fx-streak-high', 'fx-streak fx-streak-still fx-streak-high'),
  'goblin-streak-2': strip('line', 'fx-streak fx-streak-moving fx-streak-low', 'fx-streak fx-streak-still fx-streak-low'),
  'goblin-pumpkin-1': strip('dot', 'fx-dot fx-lob-high', null, { color: '#fb923c' }),
  'goblin-pumpkin-2': strip('dot', 'fx-dot fx-lob-low', null, { color: '#fb923c' }),
  'goblin-puff': overlay('fx-puff fx-puff-moving', 'fx-puff fx-puff-still', 13, '#fb923c'),
  'react-wobble': reaction('fx-react-wobble', 'fx-react-dim'),

  // ── Doctor Octopus: four mechanical arms reaching across, an amber impact, a flinch ──
  'ock-arm-1': strip('arc', 'fx-arc fx-arc-moving', 'fx-arc fx-arc-still', { path: 'M100,30 C70,4 40,10 3,42', color: STEEL }),
  'ock-arm-2': strip('arc', 'fx-arc fx-arc-moving', 'fx-arc fx-arc-still', { path: 'M100,45 C76,28 44,34 3,50', color: STEEL }),
  'ock-arm-3': strip('arc', 'fx-arc fx-arc-moving', 'fx-arc fx-arc-still', { path: 'M100,58 C72,76 42,70 3,54', color: STEEL }),
  'ock-arm-4': strip('arc', 'fx-arc fx-arc-moving', 'fx-arc fx-arc-still', { path: 'M100,74 C70,98 36,94 3,60', color: STEEL }),
  'ock-impact': overlay('fx-puff fx-puff-moving', 'fx-puff fx-puff-still', 13, '#fbbf24'),
  'react-flinch': reaction('fx-react-flinch', 'fx-react-dim'),

  // ── Mysterio: drifting mist, ghost copies of himself, a teal veil, a rippling image ──
  'mysterio-mist-1': strip('blob', 'fx-mist fx-mist-moving fx-mist-a', 'fx-mist fx-mist-still fx-mist-a'),
  'mysterio-mist-2': strip('blob', 'fx-mist fx-mist-moving fx-mist-b', 'fx-mist fx-mist-still fx-mist-b'),
  'mysterio-ghost-1': strip('ghost', 'fx-ghost fx-ghost-moving fx-ghost-high', null),
  'mysterio-ghost-2': strip('ghost', 'fx-ghost fx-ghost-moving fx-ghost-low', null),
  'mysterio-veil': overlay('fx-puff fx-puff-moving', 'fx-puff fx-puff-still', 13, '#2dd4bf'),
  'react-ripple': reaction('fx-react-ripple', 'fx-react-dim'),
  'react-materialise': reaction('fx-react-materialise', 'fx-react-fade-in'),

  // ── Venom: thick grey tendrils that creep and lash, a white slash, a recoil ──
  'venom-tendril-1': strip('arc', 'fx-arc fx-arc-thick fx-arc-moving', 'fx-arc fx-arc-thick fx-arc-still', { path: 'M100,34 C82,60 62,8 42,36 C28,56 14,30 3,44', color: TENDRIL }),
  'venom-tendril-2': strip('arc', 'fx-arc fx-arc-thick fx-arc-moving', 'fx-arc fx-arc-thick fx-arc-still', { path: 'M100,52 C80,26 64,78 44,52 C30,34 16,62 3,50', color: TENDRIL }),
  'venom-tendril-3': strip('arc', 'fx-arc fx-arc-thick fx-arc-moving', 'fx-arc fx-arc-thick fx-arc-still', { path: 'M100,70 C84,92 60,46 42,68 C28,84 14,52 3,58', color: TENDRIL }),
  'venom-retract-1': strip('arc', 'fx-arc fx-arc-thick fx-arc-retract', 'fx-arc fx-arc-thick fx-arc-still', { path: 'M100,40 C84,62 66,20 50,42', color: TENDRIL }),
  'venom-retract-2': strip('arc', 'fx-arc fx-arc-thick fx-arc-retract', 'fx-arc fx-arc-thick fx-arc-still', { path: 'M100,62 C84,40 66,82 50,60', color: TENDRIL }),
  'venom-slash': mark('slash', '#f8fafc'),
  'react-shrink': reaction('fx-react-shrink', 'fx-react-dim'),

  // ── The Lizard: a sweeping green tail, claw marks, shimmering scales ──
  'lizard-tail-1': strip('arc', 'fx-arc fx-arc-thick fx-arc-moving', 'fx-arc fx-arc-thick fx-arc-still', { path: 'M100,22 C70,20 34,34 3,62', color: '#84cc16' }),
  'lizard-tail-2': strip('arc', 'fx-arc fx-arc-thick fx-arc-moving', 'fx-arc fx-arc-thick fx-arc-still', { path: 'M100,80 C68,82 32,68 3,40', color: '#84cc16' }),
  'lizard-claws-1': mark('claws', '#bef264', { angle: -35 }),
  'lizard-claws-2': mark('claws', '#bef264', { angle: 35 }),
  'lizard-claws-3': mark('claws', '#bef264', { angle: -70 }),
  'react-flick': reaction('fx-react-flick', 'fx-react-dim'),
  'react-shimmer': reaction('fx-react-shimmer', 'fx-react-fade-in'),

  // ── Kingpin: a red and gold shock ring, a gold glint, hardly moving ──
  'kingpin-ring-1': strip('ring', 'fx-shock fx-shock-moving', 'fx-shock fx-shock-still', { color: '#f59e0b' }),
  'kingpin-ring-2': strip('ring', 'fx-shock fx-shock-wide fx-shock-moving', 'fx-shock fx-shock-wide fx-shock-still', { color: '#dc2626' }),
  'kingpin-impact': overlay('fx-puff fx-puff-moving', 'fx-puff fx-puff-still', 13, '#f59e0b'),
  'kingpin-glint': overlay('fx-edge-mark fx-edge-corner fx-web-splat-moving', 'fx-edge-mark fx-edge-corner fx-web-splat-still', 7, '#fde68a', { mark: 'glint' }),
  'react-brace': reaction('fx-react-brace', 'fx-react-dim'),
  'react-step-in': reaction('fx-react-step-in', 'fx-react-fade-in'),
};

/** The classes to use for a cue, or null if it should not be shown. */
export function cueClass(cue: string, reducedMotion: boolean): string | null {
  const def = CUES[cue];
  if (!def) return null;
  return reducedMotion ? def.reducedClassName : def.className;
}
