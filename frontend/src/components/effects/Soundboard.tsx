import { useState } from 'react';
import { RECIPES, SAMPLES } from '@/lib/effects/audio/recipes';
import { recipeDuration } from '@/lib/effects/audio/synth';
import type { GameEventType } from '@/lib/effects/events';
import { SHARED, SPIDERMAN, VILLAINS } from '@/lib/effects/profiles';
import { useEffectsDirector } from '@/hooks/useEffectsDirector';
import SoundControls from '@/components/effects/SoundControls';
import CharacterPortrait from '@/components/effects/CharacterPortrait';
import { SPIDERMAN as SPIDERMAN_CHARACTER, VILLAIN_CHARACTERS } from '@/lib/characters';

// A review page for listening to every sound. It is not linked from the app:
// open it by adding ?soundboard=1 to the address. It needs no sign-in and
// talks to no server.

const EVENTS: GameEventType[] = [
  'mission_start', 'player_strike', 'villain_attack', 'time_out',
  'combo_special', 'villain_special', 'villain_staggered', 'hint', 'victory', 'defeat',
];

const button = 'px-3 py-1.5 rounded-lg bg-ink-800 border border-white/15 hover:border-hero-500 text-sm text-white text-left';

export default function Soundboard() {
  const [villainId, setVillainId] = useState('goblin');
  const [last, setLast] = useState('');
  const { director, engine } = useEffectsDirector(villainId);

  const available = (event: GameEventType) =>
    Boolean(SHARED[event]?.length || SPIDERMAN[event]?.length || VILLAINS[villainId]?.[event]?.length);

  return (
    <div className="min-h-screen bg-black text-white p-6 sm:p-10 font-sans">
      <div className="max-w-4xl mx-auto space-y-10">
        <header>
          <h1 className="font-comic text-4xl tracking-wide">Effects review</h1>
          <p className="text-sm text-gray-400 mt-2">
            For reviewing character portraits and sounds. Click a sound button to hear it. Sounds have short cooldowns, so wait a moment between clicks of the same kind.
          </p>
          <div className="mt-4 text-xs text-gray-300 font-mono"><SoundControls /></div>
        </header>

        <section>
          <h2 className="font-comic text-2xl mb-1">Character portraits</h2>
          <p className="text-xs text-gray-400 mb-4">
            Each character at the size and crop used in a battle. The animated image is the character; effects are drawn around it.
          </p>
          <div className="flex flex-wrap gap-6">
            {[SPIDERMAN_CHARACTER, ...Object.values(VILLAIN_CHARACTERS)].map((character) => (
              <figure key={character.id} className="m-0 text-center">
                <CharacterPortrait character={character} />
                <figcaption className={`mt-2 text-xs font-comic tracking-wider ${character.text}`}>{character.name}</figcaption>
              </figure>
            ))}
          </div>
        </section>

        <section>
          <h2 className="font-comic text-2xl mb-1">As played in a mission</h2>
          <p className="text-xs text-gray-400 mb-3">
            Plays what the game would play for each event, including variation and pitch changes. Click the same event several times to hear the variations.
          </p>
          <label className="text-sm text-gray-300">
            Villain{' '}
            <select
              value={villainId}
              onChange={(e) => setVillainId(e.target.value)}
              className="bg-ink-900 border border-white/15 rounded-lg px-2 py-1 ml-1 text-white"
            >
              {Object.keys(VILLAINS).map((id) => <option key={id} value={id}>{id}</option>)}
            </select>
          </label>
          <div className="grid sm:grid-cols-3 gap-2 mt-3">
            {EVENTS.map((event) => (
              <button
                key={event}
                className={`${button} disabled:opacity-30`}
                disabled={!available(event)}
                onClick={() => {
                  director.current?.unlock();
                  const chosen = director.current?.play({ type: event }) ?? [];
                  setLast(`${event}: ${chosen.join(', ') || 'nothing chosen (every variation is inside its gap)'}`);
                }}
              >
                {event}{!available(event) ? ' (not built yet)' : ''}
              </button>
            ))}
          </div>
          <p role="status" className="text-xs text-gray-400 font-mono mt-3 min-h-4">{last}</p>
        </section>

        <section>
          <h2 className="font-comic text-2xl mb-3">Every synthesised sound</h2>
          <div className="grid sm:grid-cols-3 gap-2">
            {Object.values(RECIPES).map((recipe) => (
              <button
                key={recipe.id}
                className={button}
                onClick={() => {
                  engine.current?.unlock();
                  engine.current?.playRecipe(recipe, { category: 'music' });
                }}
              >
                {recipe.id}
                <span className="block text-[11px] text-gray-400">
                  {recipe.layers.length} layers · {recipeDuration(recipe).toFixed(2)}s
                </span>
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2 className="font-comic text-2xl mb-3">Existing audio files</h2>
          <div className="grid sm:grid-cols-3 gap-2">
            {Object.entries(SAMPLES).map(([name, url]) => (
              <button
                key={name}
                className={button}
                onClick={() => {
                  engine.current?.unlock();
                  engine.current?.playSample(url, { category: 'music' });
                }}
              >
                {name}
                <span className="block text-[11px] text-gray-400">{url}</span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
