import { Flame, Award, Users2, Timer } from 'lucide-react';
import Reveal from '@/components/Reveal';
import { useGameState } from '@/hooks/useGameState';
import { useAuth } from '@/context/AuthContext';

const features = [
  {
    icon: Timer,
    title: 'Mission Briefings',
    text: 'Receive high-stakes transmissions from JJJ when a villain attacks. Swift action is required to save the city.',
  },
  {
    icon: Flame,
    title: 'Spider-Sense Streaks',
    text: 'Patrol daily to keep your Spider-Sense sharp. Your combo multipliers decay if you abandon the city.',
  },
  {
    icon: Award,
    title: 'Power Upgrades & Badges',
    text: "Earn Spider Points to unlock enhanced abilities. Earn exclusive Villain Defeated Badges for conquering tricky chapters.",
  },
  {
    icon: Users2,
    title: 'Gwen\'s Research Lab',
    text: 'When a villain\'s defense seems unbreakable, Gwen Stacy analyzes their patterns to provide you with the exact hints needed to win.',
  },
];

const bossDetails: Record<string, { title: string, desc: string, name: string }> = {
  'goblin': { name: 'Green Goblin', title: 'Oscorp Formula Crisis', desc: "Green Goblin has damaged Oscorp's research formulas. Restore the calculations before the experiment destroys the city!" },
  'doc-ock': { name: 'Doc Ock', title: 'The Web Network Failure', desc: "Doc Ock is building a mechanical lab. Use geometry to calculate the area and perimeter to shut down his grid!" },
  'mysterio': { name: 'Mysterio', title: 'The Illusion Maze', desc: "Mysterio's drones are spawning in sequences. Crack the pattern to break the illusion!" },
  'venom': { name: 'Venom', title: 'Final Symbiote Challenge', desc: "The symbiote is spreading rapidly! Calculate the percentages to contain the outbreak!" },
  'lizard': { name: 'Lizard', title: 'Sewer Mutation Threat', desc: "The Lizard is mixing a new serum. Use radicals and exponents to calculate the neutralizing dosage!" },
  'kingpin': { name: 'Kingpin', title: 'Underworld Takeover', desc: "Kingpin is transferring funds. Use proportions to intercept his underworld transactions!" }
};

export default function Gamification({ setView }: { setView?: (view: string) => void }) {
  const { gameState } = useGameState();
  const { user, isAuthenticated, openAuthModal } = useAuth();
  
  // Dynamic user points
  const currentPoints = user?.points !== undefined ? user.points : gameState.spiderPoints;
  const tiers = [1000, 2500, 4000, 5500, 7000, 8500];
  const nextTarget = tiers.find(t => t > currentPoints) || (currentPoints + 1000);
  const progressPercent = Math.min(100, Math.max(0, (currentPoints / nextTarget) * 100));

  // Dynamic active boss (first boss 'goblin' for a newly signed up user)
  const currentBossId = gameState.unlockedBosses[gameState.unlockedBosses.length - 1] || 'goblin';
  const currentBoss = bossDetails[currentBossId] || bossDetails['goblin'];

  const heroDisplayName = user?.name || 'Spider-Man';
  const heroRoleSubtitle = user ? `Level ${user.level || 1} • Cadet Web-Slinger` : 'Sign up to unlock Hero Abilities';

  const handleStartMission = () => {
    if (!isAuthenticated) {
      openAuthModal();
      return;
    }
    if (setView) setView(`mission:${currentBossId}`);
  };

  return (
    <section id="rewards" className="relative py-24 overflow-hidden">
      <div className="absolute inset-0 halftone opacity-40" />
      <div className="relative max-w-7xl mx-auto px-5 sm:px-8">
        <div className="grid lg:grid-cols-2 gap-14 items-center">
          {/* Left: feature list */}
          <Reveal>
            <span className="text-hero-500 font-comic text-xl tracking-wide">Train Like a Hero</span>
            <h2 className="mt-2 font-comic text-4xl sm:text-5xl text-white tracking-wide leading-tight">
              Level Up Your Spider-Sense
            </h2>
            <p className="mt-4 text-gray-400 max-w-lg">
              Forget boring textbooks. Every mission is designed to keep you in the action with instant rewards, epic suit upgrades, and dopamine-triggering villain battles!
            </p>

            <div className="mt-8 space-y-5">
              {features.map((f, i) => (
                <Reveal key={f.title} delay={i * 100} className="flex gap-4 group">
                  <span className="grid place-items-center w-11 h-11 rounded-xl bg-hero-600/15 border border-hero-600/30 text-hero-400 shrink-0 group-hover:bg-hero-600 group-hover:text-white group-hover:scale-110 transition-all">
                    <f.icon className="w-5 h-5 group-hover:animate-wiggle" />
                  </span>
                  <div>
                    <h3 className="font-semibold text-white">{f.title}</h3>
                    <p className="text-sm text-gray-400 mt-0.5 leading-relaxed">{f.text}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </Reveal>

          {/* Right: game UI card */}
          <Reveal delay={200} className="relative">
            <div className="absolute -inset-4 bg-hero-600/10 rounded-3xl blur-2xl animate-glow-pulse" />
            <div className="relative bg-ink-800 rounded-3xl border border-white/10 comic-shadow-red p-6">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <span className="grid place-items-center w-12 h-12 rounded-xl bg-hero-600 text-white text-2xl">🕷️</span>
                  <div>
                    <div className="font-comic text-xl text-white">{heroDisplayName}</div>
                    <div className="text-xs text-gray-400">{heroRoleSubtitle}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-hero-400 font-bold">
                  <Flame className="w-5 h-5" fill="currentColor" />
                  <span className="text-lg">{gameState.missionsCompleted > 0 ? (gameState.missionsCompleted * 2) : 0}</span>
                </div>
              </div>

              {/* XP progress */}
              <div className="mb-5">
                <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                  <span>Spider Points to Next Power</span>
                  <span className="text-hero-400">{currentPoints.toLocaleString()} / {nextTarget.toLocaleString()}</span>
                </div>
                <div className="h-3 rounded-full bg-ink-700 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-hero-600 to-hero-400 transition-all duration-1000 ease-out" style={{ width: `${progressPercent}%` }} />
                </div>
              </div>

              {/* Badges */}
              <div className="mb-5">
                <div className="text-xs text-gray-400 uppercase tracking-wide mb-2">Recent Spider Badges</div>
                <div className="flex gap-2">
                  {['🥇', '⚡', '🎯', '🏆', '🔥'].map((b, i) => (
                    <span key={i} className="grid place-items-center w-10 h-10 rounded-lg bg-ink-900 border border-white/10 text-xl hover:scale-110 hover:-rotate-12 hover:border-hero-600/40 transition-all cursor-default" style={{ animationDelay: `${i * 80}ms` }}>
                      {b}
                    </span>
                  ))}
                </div>
              </div>

              {/* Active mission - JJJ */}
              <div className="rounded-xl bg-red-950/40 border border-red-600/30 p-4 relative overflow-hidden mt-2">
                <div className="absolute -top-2 -right-4 p-2 opacity-5 pointer-events-none transform rotate-[-10deg]">
                  <span className="font-comic text-5xl">DAILY BUGLE</span>
                </div>
                <div className="flex items-start gap-3 relative z-10">
                  <img
                    src="/j-jonah-jameson.png"
                    alt="J. Jonah Jameson"
                    className="w-12 h-12 rounded-lg object-cover border border-red-500/50"
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider">Message from J.J.J.</span>
                      <span className="text-[10px] text-gray-400 font-mono">Missions: {gameState.missionsCompleted}</span>
                    </div>
                    <p className="text-white font-medium text-sm leading-snug">
                      &quot;{currentBoss.desc}&quot;
                    </p>
                    <div className="mt-3 flex items-center gap-2">
                      <button 
                        onClick={handleStartMission}
                        className="flex-1 py-2 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-500 active:scale-95 transition-all shadow-md"
                      >
                        {isAuthenticated ? 'Accept Mission →' : 'Sign Up to Accept Mission →'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Mentor Partner */}
              <div className="rounded-xl bg-ink-900/60 border border-hero-600/20 p-4 mt-2">
                <div className="flex items-center gap-3">
                  <img src="/gwen.jpeg" alt="Gwen Stacy" className="w-10 h-10 rounded-full object-cover border-2 border-pink-500" />
                  <div className="flex-1 flex justify-between items-center">
                    <div>
                      <div className="text-white font-medium text-sm">Gwen&apos;s Research Lab</div>
                      <span className="text-[10px] font-semibold text-pink-400 uppercase">ANALYZING {currentBoss.name.toUpperCase()}&apos;S WEAKNESSES</span>
                    </div>
                    <button 
                      onClick={handleStartMission}
                      className="px-3 py-1.5 rounded-lg bg-ink-700 hover:bg-pink-600 hover:text-white text-gray-300 text-xs font-semibold transition-all" 
                      title="Gwen's Research Lab has discovered a weakness. Solve these problems to understand the pattern."
                    >
                      Ask for Hint
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
