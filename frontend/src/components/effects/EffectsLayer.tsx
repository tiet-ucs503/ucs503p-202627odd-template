import '@/styles/effects.css';
import type { Character } from '@/lib/characters';
import { cueClass, CUES } from '@/lib/effects/cues';
import { cueDuration as dur } from '@/lib/effects/cueStyle';
import type { ActiveCue } from '@/lib/effects/director';

/** A small web: a few spokes and two rings. Drawn at the edge of a portrait. */
function WebSplat() {
  const spokes = [0, 45, 90, 135, 180, 225, 270, 315];
  return (
    <svg viewBox="-12 -12 24 24" width="100%" height="100%" fill="none" stroke="#ffffff" strokeWidth="1" strokeLinecap="round">
      {spokes.map((a) => (
        <line key={a} x1="0" y1="0" x2={11 * Math.cos((a * Math.PI) / 180)} y2={11 * Math.sin((a * Math.PI) / 180)} />
      ))}
      <circle r="4" />
      <circle r="8" />
    </svg>
  );
}

/** A single diagonal cut. */
function Slash() {
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" strokeLinecap="round">
      <line x1="3" y1="20" x2="21" y2="4" strokeWidth="2.5" />
      <line x1="6" y1="21" x2="22" y2="7" strokeWidth="1" opacity="0.6" />
    </svg>
  );
}

/** Three parallel scratch marks at the given angle. */
function Claws({ angle = -35 }: { angle?: number }) {
  return (
    <svg viewBox="-12 -12 24 24" width="100%" height="100%" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <g transform={`rotate(${angle})`}>
        <line x1="-9" y1="-5" x2="9" y2="-5" />
        <line x1="-10" y1="0" x2="10" y2="0" />
        <line x1="-9" y1="5" x2="9" y2="5" />
      </g>
    </svg>
  );
}

/** A four-point glint, like light catching a diamond. */
function Glint() {
  return (
    <svg viewBox="-12 -12 24 24" width="100%" height="100%" fill="currentColor">
      <path d="M0,-11 L2,-2 L11,0 L2,2 L0,11 L-2,2 L-11,0 L-2,-2 Z" />
    </svg>
  );
}

/**
 * Small accents drawn at the edge of one character's portrait or avatar.
 * Rendered inside that portrait's own box.
 */
export function PortraitOverlays({ cues }: { cues: ActiveCue[] }) {
  return (
    <>
      {cues.map((cue) => {
        const def = CUES[cue.cue];
        const className = cueClass(cue.cue, cue.reducedMotion);
        if (!className || def?.kind !== 'overlay') return null;
        return (
          <span key={cue.key} className={className} style={{ ...dur(cue), color: def.color }} data-cue={cue.cue} aria-hidden="true">
            {def.mark === 'web' && <WebSplat />}
            {def.mark === 'slash' && <Slash />}
            {def.mark === 'claws' && <Claws angle={def.angle} />}
            {def.mark === 'glint' && <Glint />}
          </span>
        );
      })}
    </>
  );
}

const SPARK_OFFSETS = [
  [-26, -18], [-30, 2], [-22, 20], [-10, -24], [-12, 22], [-34, -8], [-18, 10], [-6, -12],
];

/** Draws one cue that travels across the lane. */
function StripCue({ cue, villain }: { cue: ActiveCue; villain?: Character }) {
  const def = CUES[cue.cue];
  const className = cueClass(cue.cue, cue.reducedMotion);
  if (!className || !def) return null;
  const style = { ...dur(cue), color: def.color };

  switch (def.shape) {
    case 'sparks': // a few small dots flying away from the point of impact, beside the villain
      return (
        <>
          {SPARK_OFFSETS.slice(0, def.particles ?? 0).map(([x, y], i) => (
            <span
              key={i}
              className={className}
              data-cue={cue.cue}
              style={{ ...style, background: def.color, ['--fx-x' as string]: `${x}px`, ['--fx-y' as string]: `${y}px` }}
            />
          ))}
        </>
      );
    case 'arc': // a curved arm reaching from the villain to the player
      return (
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" data-cue={cue.cue}>
          <path d={def.path} pathLength={100} className={className} style={style} stroke={def.color} vectorEffect="non-scaling-stroke" />
        </svg>
      );
    case 'ghost': // a faint copy of the villain's own image drifting across
      return villain ? (
        <img src={villain.image} alt="" className={className} style={{ ...style, objectPosition: villain.focus }} data-cue={cue.cue} />
      ) : null;
    default: // line, dot, blob, ring: a single shaped element
      return <span className={className} style={style} data-cue={cue.cue} />;
  }
}

/**
 * Effects that travel across the lane between the two portraits.
 * The layer fills the battle header only, is invisible to the mouse and to
 * screen readers, and is never placed over the question or the controls.
 */
export default function EffectsLayer({ cues, villain }: { cues: ActiveCue[]; villain?: Character }) {
  const strip = cues.filter((cue) => cue.target === 'strip' && CUES[cue.cue]?.kind === 'strip');
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true" data-effects-layer>
      {/* The lane: the space between the player's portrait and the villain's. */}
      <div className="absolute top-0 bottom-0 left-28 right-28 sm:left-36 sm:right-36" data-effects-lane>
        {strip.map((cue) => <StripCue key={cue.key} cue={cue} villain={villain} />)}
      </div>
    </div>
  );
}
