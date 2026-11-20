import type { ReactNode } from 'react';
import type { Character } from '@/lib/characters';
import type { ActiveCue } from '@/lib/effects/director';
import { PortraitOverlays } from '@/components/effects/EffectsLayer';
import { reactionClasses, reactionStyle } from '@/lib/effects/cueStyle';
import { effectsSettings, useEffectsSettings } from '@/lib/effects/settings';

interface CharacterPortraitProps {
  character: Character;
  /** Which side of the battle the character stands on; reactions lean away from the other side. */
  side?: 'left' | 'right';
  /** Small label pinned below, for example the player's level. */
  badge?: ReactNode;
  /** Visual cues currently aimed at this character. */
  cues?: ActiveCue[];
  /** A lasting look: weakened (half health gone) or defeated (on the end screen). */
  state?: 'weakened' | 'defeated';
}

/**
 * A character's animated portrait. This is the main thing on screen for each
 * character. Reactions (a recoil, a dim) are applied to the portrait itself;
 * overlays are small accents at its edge that never hide it.
 */
export default function CharacterPortrait({ character, side = 'left', badge, cues = [], state }: CharacterPortraitProps) {
  useEffectsSettings(); // re-render when the motion setting changes
  // With reduced motion the look is a change of colour only, with no tilt.
  const stateClass = state ? `fx-state fx-${state}${effectsSettings.reducedMotion() ? '-still' : ''}` : '';
  return (
    <div className="relative shrink-0" data-portrait={character.id} data-state={state ?? 'normal'}>
      <div
        className={`w-24 h-20 sm:w-32 sm:h-28 rounded-2xl border-[3px] ${character.border} bg-ink-900 overflow-hidden ${stateClass} ${reactionClasses(cues)}`}
        style={{ boxShadow: `0 0 22px rgba(${character.glow},0.45)`, ...reactionStyle(cues, side) }}
        data-portrait-frame
      >
        <img
          src={character.image}
          alt={character.name}
          className="w-full h-full object-cover"
          style={{ objectPosition: character.focus }}
        />
      </div>
      <PortraitOverlays cues={cues} />
      {badge && (
        <div className={`absolute -bottom-2 left-1/2 -translate-x-1/2 bg-black border-2 ${character.border} ${character.text} font-comic text-xs px-2 py-0.5 rounded-lg whitespace-nowrap`}>
          {badge}
        </div>
      )}
    </div>
  );
}
