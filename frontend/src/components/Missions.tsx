import { Target, Shield, Zap, Beaker } from 'lucide-react';
import Reveal from '@/components/Reveal';
import { useGameState } from '@/hooks/useGameState';
import { useAuth } from '@/context/AuthContext';

const missionsData = [
  {
    id: 'goblin',
    icon: Target,
    title: 'Oscorp Formula Crisis',
    chapter: 'Chapter 1: Green Goblin',
    topic: 'Basic Algebra',
    grade: 'Find missing values',
    sp: 200,
    color: 'from-green-500/20 to-green-400/5',
    accent: 'text-green-400',
  },
  {
    id: 'doc-ock',
    icon: Beaker,
    title: 'The Web Network Failure',
    chapter: 'Chapter 2: Doctor Octopus',
    topic: 'Geometry',
    grade: 'Shapes, Angles, Area',
    sp: 300,
    color: 'from-slate-500/20 to-slate-400/5',
    accent: 'text-slate-400',
  },
  {
    id: 'mysterio',
    icon: Shield,
    title: 'The Illusion Maze',
    chapter: 'Chapter 3: Mysterio',
    topic: 'Patterns & Logic',
    grade: 'Sequences, Probability',
    sp: 400,
    color: 'from-purple-500/20 to-purple-400/5',
    accent: 'text-purple-400',
  },
  {
    id: 'venom',
    icon: Zap,
    title: 'Final Symbiote Challenge',
    chapter: 'Chapter 4: Venom',
    topic: 'Fractions & Data',
    grade: 'Percentages, Ratios',
    sp: 500,
    color: 'from-slate-800/60 to-slate-700/20',
    accent: 'text-white',
  },
  {
    id: 'lizard',
    icon: Beaker,
    title: 'Sewer Mutation Threat',
    chapter: 'Chapter 5: The Lizard',
    topic: 'Exponents',
    grade: 'Powers, Radicals',
    sp: 600,
    color: 'from-lime-500/20 to-lime-400/5',
    accent: 'text-lime-400',
  },
  {
    id: 'kingpin',
    icon: Target,
    title: 'Underworld Takeover',
    chapter: 'Chapter 6: Kingpin',
    topic: 'Area & Percentages',
    grade: 'Surface Area, Proportions',
    sp: 700,
    color: 'from-red-600/20 to-red-500/5',
    accent: 'text-red-500',
  },
];

export default function Missions({ setView }: { setView: (v: string) => void }) {
  const { gameState } = useGameState();
  const { isAuthenticated, openAuthModal } = useAuth();

  const missions = missionsData.map(m => ({
    ...m,
    locked: !gameState.unlockedBosses.includes(m.id)
  }));

  const handleStartMission = (m: typeof missions[0]) => {
    if (!isAuthenticated) {
      openAuthModal();
      return;
    }
    if (!m.locked) {
      setView(`mission:${m.id}`);
    } else {
      alert('Defeat previous bosses to unlock!');
    }
  };

  return (
    <section id="missions" className="relative py-24 overflow-hidden">
      <div className="absolute inset-0 halftone-red opacity-50" />
      <div className="relative max-w-7xl mx-auto px-5 sm:px-8">
        <Reveal className="text-center max-w-2xl mx-auto mb-14">
          <span className="text-hero-500 font-comic text-xl tracking-wide">Core Gameplay Loop</span>
          <h2 className="mt-2 font-comic text-4xl sm:text-5xl text-white tracking-wide leading-tight">
            Protect the City
          </h2>
          <p className="mt-4 text-gray-400 max-w-lg mx-auto">
            Briefing → Math Challenge → Complete Objective → Earn Spider Points → Unlock Next Mission.
          </p>
        </Reveal>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {missions.map((m, i) => (
            <Reveal
              key={m.title}
              delay={i * 80}
              as="article"
              className={`group relative rounded-2xl border border-white/10 bg-gradient-to-b ${m.color} p-6 hover:border-hero-600/40 transition-all hover:-translate-y-2 hover:scale-[1.02] duration-300`}
            >
              <div className="flex items-center justify-between mb-5">
                <span className={`grid place-items-center w-12 h-12 rounded-xl bg-ink-900/60 ${m.accent}`}>
                  <m.icon className="w-6 h-6" />
                </span>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-ink-900/60 text-gray-300">
                  {m.grade}
                </span>
              </div>

              <h3 className="font-comic text-2xl text-white tracking-wide leading-tight mb-2">{m.title}</h3>
              <p className="text-xs text-gray-500 font-medium tracking-wide uppercase">{m.chapter}</p>
              <p className="text-sm text-gray-400 mt-2">{m.topic}</p>

              <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4">
                <span className="text-xs font-bold text-hero-400">+{m.sp} Spider Points</span>
              </div>

              <button 
                onClick={() => handleStartMission(m)}
                className="mt-5 w-full py-2.5 rounded-lg bg-ink-900/60 text-white text-sm font-semibold opacity-0 group-hover:opacity-100 transition-opacity border border-white/10 hover:border-hero-600/50 active:scale-95"
              >
                {!isAuthenticated ? 'Sign Up to Play' : (m.locked ? 'Locked' : 'Start Mission →')}
              </button>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
