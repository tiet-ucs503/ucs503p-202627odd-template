import '@/styles/effects.css';
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

/**
 * Small accents drawn at the edge of one character's portrait or avatar.
 * Rendered inside that portrait's own box.
 */
export function PortraitOverlays({ cues }: { cues: ActiveCue[] }) {
  return (
    <>
      {cues.map((cue) => {
        const className = cueClass(cue.cue, cue.reducedMotion);
        if (!className || CUES[cue.cue]?.kind !== 'overlay') return null;
        return (
          <span key={cue.key} className={className} style={dur(cue)} data-cue={cue.cue} aria-hidden="true">
            {cue.cue.startsWith('web-splat') && <WebSplat />}
          </span>
        );
      })}
    </>
  );
}

const SPARK_OFFSETS = [
  [-26, -18], [-30, 2], [-22, 20], [-10, -24], [-12, 22], [-34, -8], [-18, 10], [-6, -12],
];

/**
 * Effects that travel across the lane between the two portraits.
 * It fills the battle header only, is invisible to the mouse and to screen
 * readers, and is never placed over the question or the controls.
 */
export default function EffectsLayer({ cues }: { cues: ActiveCue[] }) {
  const strip = cues.filter((cue) => cue.target === 'strip' && CUES[cue.cue]?.kind === 'strip');
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true" data-effects-layer>
      {strip.map((cue) => {
        const def = CUES[cue.cue];
        const className = cueClass(cue.cue, cue.reducedMotion);
        if (!className) return null;

        if (def.particles) {
          // A few small dots flying away from the point of impact, beside the villain.
          return SPARK_OFFSETS.slice(0, def.particles).map(([x, y], i) => (
            <span
              key={`${cue.key}:${i}`}
              className={`${className} right-28 sm:right-36`}
              data-cue={cue.cue}
              style={{ ...dur(cue), background: def.color, ['--fx-x' as string]: `${x}px`, ['--fx-y' as string]: `${y}px` }}
            />
          ));
        }
        // A line from the player's portrait to the villain's.
        return <span key={cue.key} className={`${className} left-28 right-28 sm:left-36 sm:right-36`} style={dur(cue)} data-cue={cue.cue} />;
      })}
    </div>
  );
}
