import { Zap, Lock, Skull } from 'lucide-react';
import Reveal from '@/components/Reveal';
import { useGameState } from '@/hooks/useGameState';
import { useAuth } from '@/context/AuthContext';

const bossesData = [
  {
    id: 'goblin',
    name: 'Green Goblin',
    subject: 'Basic Algebra',
    gif: '/goblin-gif.gif',
    glow: 'bg-green-500/20',
    border: 'border-green-500/40',
    chip: 'bg-green-500/15 text-green-400 border-green-500/30',
    accent: 'text-green-400',
    level: 'Chapter 1',
    difficulty: '★★★☆☆',
    reward: 'Goblin Defeated Badge',
    imagePosition: 'object-center',
  },
  {
    id: 'doc-ock',
    name: 'Doctor Octopus',
    subject: 'Geometry',
    gif: '/doc-ock-spider-man.gif',
    glow: 'bg-slate-400/20',
    border: 'border-slate-500/40',
    chip: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
    accent: 'text-slate-300',
    level: 'Chapter 2',
    difficulty: '★★★★☆',
    reward: 'Web Repair Badge',
    imagePosition: 'object-[center_25%]',
  },
  {
    id: 'mysterio',
    name: 'Mysterio',
    subject: 'Patterns & Logic',
    gif: '/mysterio-im-here.gif',
    glow: 'bg-emerald-500/5',
    border: 'border-ink-600/40',
    chip: 'bg-ink-700/50 text-gray-400 border-ink-600/30',
    accent: 'text-gray-500',
    level: 'Chapter 3',
    difficulty: '?????',
    reward: 'Illusion Breaker Badge',
    imagePosition: 'object-[center_20%]',
  },
  {
    id: 'venom',
    name: 'Venom',
    subject: 'Fractions & Data',
    gif: '/venom-gif.gif',
    glow: 'bg-purple-500/5',
    border: 'border-ink-600/40',
    chip: 'bg-ink-700/50 text-gray-400 border-ink-600/30',
    accent: 'text-gray-500',
    level: 'Chapter 4',
    difficulty: '?????',
    reward: 'Ultimate Spider Badge',
  },
  {
    id: 'lizard',
    name: 'The Lizard',
    subject: 'Exponents & Radicals',
    gif: '/lizard-gif.webp',
    glow: 'bg-lime-500/10',
    border: 'border-ink-600/40',
    chip: 'bg-ink-700/50 text-gray-400 border-ink-600/30',
    accent: 'text-gray-500',
    level: 'Chapter 5',
    difficulty: '?????',
    reward: 'Reptilian Science Badge',
    imagePosition: 'object-top',
  },
  {
    id: 'kingpin',
    name: 'Kingpin',
    subject: 'Area & Percentages',
    gif: '/the-kingpin-wilson-fisk.gif',
    glow: 'bg-red-500/10',
    border: 'border-ink-600/40',
    chip: 'bg-ink-700/50 text-gray-400 border-ink-600/30',
    accent: 'text-gray-500',
    level: 'Chapter 6',
    difficulty: '?????',
    reward: 'City Savior Badge',
    imagePosition: 'object-top',
  },
];

export default function BossBattles({ setView }: { setView: (v: string) => void }) {
  const { gameState } = useGameState();
  const { isAuthenticated, openAuthModal } = useAuth();

  const bosses = bossesData.map(boss => ({
    ...boss,
    locked: !gameState.unlockedBosses.includes(boss.id),
  }));

  const handleBossClick = (boss: typeof bosses[0]) => {
    if (!isAuthenticated) {
      openAuthModal();
      return;
    }
    if (!boss.locked) {
      setView(`mission:${boss.id}`);
    } else {
      alert('Defeat previous bosses to unlock!');
    }
  };

  return (
    <section id="bosses" className="relative py-24 overflow-hidden">
      <div className="absolute inset-0 halftone opacity-30" />
      <div className="relative max-w-7xl mx-auto px-5 sm:px-8">
        <Reveal className="text-center max-w-2xl mx-auto mb-14">
          <span className="text-hero-500 font-comic text-xl tracking-wide">Epic Encounters</span>
          <h2 className="mt-2 font-comic text-4xl sm:text-5xl text-white tracking-wide leading-tight">
            The Sinister Syndicate
          </h2>
          <p className="mt-4 text-gray-400 max-w-lg mx-auto">
            Six villains have taken over New York. Defeat each boss by calculating weaknesses and solving problems.
          </p>
        </Reveal>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {bosses.map((boss, i) => (
            <Reveal key={boss.name} delay={i * 80} as="article"
              className={`group relative rounded-2xl border ${boss.border} bg-ink-900/70 overflow-hidden hover:-translate-y-2 hover:scale-[1.02] transition-all duration-300 ${!boss.locked ? 'cursor-pointer' : ''}`}
            >
              {/* Click Overlay */}
              <div 
                className="absolute inset-0 z-30" 
                onClick={() => handleBossClick(boss)} 
              />
              {/* Glow */}
              <div className={`absolute -inset-0.5 ${boss.glow} blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />

              {/* GIF or Locked state */}
              <div className="relative h-44 overflow-hidden bg-ink-950 flex flex-col items-center justify-center">
                {boss.gif && (
                  <img
                    src={boss.gif}
                    alt={`${boss.name} in action`}
                    className={`absolute inset-0 w-full h-full object-cover ${boss.imagePosition || 'object-center'} group-hover:scale-110 transition-transform duration-700 ${boss.locked ? 'opacity-30 grayscale' : ''}`}
                    loading="lazy"
                  />
                )}
                {boss.locked && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-ink-500 z-10 bg-ink-900/40 backdrop-blur-[2px]">
                    <Lock className="w-12 h-12 mb-2" />
                    <span className="font-comic text-sm font-bold tracking-widest text-white/50">LOCKED</span>
                  </div>
                )}
                
                {/* Shimmer sweep on hover */}
                <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/5 to-transparent z-10" />
                <div className="absolute inset-0 bg-gradient-to-t from-ink-900 via-ink-900/40 to-transparent z-10" />
                <div className={`absolute top-3 left-3 px-2.5 py-1 rounded-full text-xs font-bold border ${boss.chip} z-20`}>
                  {boss.level}
                </div>
              </div>

              {/* Info */}
              <div className="relative p-5">
                <div className="flex justify-between items-start mb-1">
                  <h3 className="font-comic text-xl text-white tracking-wide">{boss.name}</h3>
                  <div className="flex items-center space-x-1 mt-1">
                    <span className="text-xs text-hero-500 font-mono tracking-tighter">{boss.difficulty}</span>
                  </div>
                </div>
                
                <div className="text-xs text-gray-400 mt-1 mb-3">
                  <span className="text-gray-500">Weakness:</span> {boss.subject}
                </div>

                <div className="h-px w-full bg-white/5 my-3" />

                <div className={`flex flex-col gap-1.5 text-xs ${boss.accent}`}>
                  {boss.locked ? (
                    <div className="flex items-center gap-1.5 opacity-60">
                      <Lock className="w-3.5 h-3.5" /> Defeat previous bosses to unlock
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <Skull className="w-3.5 h-3.5 group-hover:animate-wiggle" fill="currentColor" /> 
                      <span className="font-medium text-gray-300">Reward:</span> {boss.reward}
                    </div>
                  )}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
