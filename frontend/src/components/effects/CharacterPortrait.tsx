import type { ReactNode } from 'react';
import type { Character } from '@/lib/characters';

interface CharacterPortraitProps {
  character: Character;
  /** Small label pinned to a corner, for example the player's level. */
  badge?: ReactNode;
  /** Extra classes for reactions (recoil, glow...) applied to the image itself. */
  reaction?: string;
}

/**
 * A character's animated portrait. This is the main thing on screen for each
 * character: effects are accents around it and reactions are applied to it.
 */
export default function CharacterPortrait({ character, badge, reaction = '' }: CharacterPortraitProps) {
  return (
    <div className="relative shrink-0" data-portrait={character.id}>
      <div
        className={`w-24 h-20 sm:w-32 sm:h-28 rounded-2xl border-[3px] ${character.border} bg-ink-900 overflow-hidden`}
        style={{ boxShadow: `0 0 22px rgba(${character.glow},0.45)` }}
      >
        <img
          src={character.image}
          alt={character.name}
          className={`w-full h-full object-cover ${reaction}`}
          style={{ objectPosition: character.focus }}
        />
      </div>
      {badge && (
        <div className={`absolute -bottom-2 left-1/2 -translate-x-1/2 bg-black border-2 ${character.border} ${character.text} font-comic text-xs px-2 py-0.5 rounded-lg whitespace-nowrap`}>
          {badge}
        </div>
      )}
    </div>
  );
}
