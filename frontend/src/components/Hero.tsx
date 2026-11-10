import { ArrowRight, Play, Sparkles } from 'lucide-react';
import { useGameState } from '@/hooks/useGameState';
import { useAuth } from '@/context/AuthContext';

const SPIDEY_GIF = '/spiderman-gif.gif';

export default function Hero({ setView }: { setView: (view: string) => void }) {
  const { gameState } = useGameState();
  const { user, isAuthenticated, openAuthModal } = useAuth();
  
  const currentPoints = user?.points !== undefined ? user.points : gameState.spiderPoints;
  const tiers = [1000, 2500, 4000, 5500, 7000, 8500];
  const nextTarget = tiers.find(t => t > currentPoints) || (currentPoints + 1000);
  const progressPercent = Math.min(100, Math.max(0, (currentPoints / nextTarget) * 100));

  const handleBeginMission = () => {
    if (!isAuthenticated) {
      openAuthModal();
      return;
    }
    const currentBossId = gameState.unlockedBosses[0] || 'goblin';
    setView(`mission:${currentBossId}`);
  };

  return (
    <section id="hero" className="relative min-h-screen flex items-center justify-center pt-24 pb-12 overflow-hidden">
      {/* Decorative web/grid background */}
      <div className="absolute inset-0 halftone opacity-60" />
      <div className="absolute inset-0 bg-gradient-to-br from-hero-600/20 via-transparent to-transparent" />

      {/* Floating comic burst shapes */}
      <div className="absolute top-32 left-10 w-24 h-24 rounded-full bg-hero-600/20 blur-2xl animate-float" />
      <div className="absolute bottom-40 right-20 w-40 h-40 rounded-full bg-hero-500/10 blur-3xl animate-float" style={{ animationDelay: '1.5s' }} />

      <div className="relative max-w-7xl mx-auto px-5 sm:px-8 grid lg:grid-cols-2 gap-10 items-center">
        {/* Left: copy */}
        <div className="animate-slide-up">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-hero-600/10 border border-hero-600/20 text-hero-400 text-sm font-medium mb-6">
            <span className="w-2 h-2 rounded-full bg-hero-500 animate-pulse" />
            INCOMING TRANSMISSION
          </div>
          <h1 className="text-5xl sm:text-7xl font-comic tracking-wider text-white mb-6 uppercase leading-[1.1] text-shadow-sm">
            Become the <br />
            <span className="block text-hero-500 text-stroke mt-2">
              Ultimate Web-Slinger.
            </span>
          </h1>
          <p className="text-lg sm:text-xl text-gray-300 max-w-xl mx-auto mb-10 leading-relaxed">
            The city is under attack. Use intelligence, strategy, and problem-solving abilities to defeat villains and protect New York. <strong className="text-white font-bold">You are Spider-Man.</strong>
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <button
              onClick={handleBeginMission}
              className="group inline-flex items-center gap-2 px-7 py-3.5 bg-hero-600 hover:bg-hero-500 text-white font-bold rounded-xl comic-shadow transition-all hover:scale-105 active:scale-95"
            >
              {isAuthenticated ? 'Begin Your Mission' : 'Sign Up to Begin Mission'}
              <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
            </button>
            <a
              href="#how"
              className="inline-flex items-center gap-2 px-6 py-3.5 text-white font-semibold rounded-xl border-2 border-white/20 hover:border-hero-500/60 hover:bg-white/5 transition-all"
            >
              <Play className="w-4 h-4 fill-white" /> Watch How It Works
            </a>
          </div>

          {/* Stats */}
          <div className="mt-12 flex gap-8">
            {[
              { n: '60+', l: 'Math Missions' },
              { n: '6', l: 'Epic Boss Battles' },
              { n: '100%', l: 'ADHD Friendly' },
            ].map((s) => (
              <div key={s.l}>
                <div className="font-comic text-3xl text-hero-500">{s.n}</div>
                <div className="text-xs text-gray-400 uppercase tracking-wide mt-0.5">{s.l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Spiderman GIF panel */}
        <div className="relative animate-slide-up" style={{ animationDelay: '0.15s' }}>
          <div className="relative mx-auto max-w-md">
            {/* Speech bubble */}
            <div className="absolute -top-4 -left-4 z-20 bg-white text-ink-900 font-comic text-xl px-5 py-2 rounded-2xl rotate-[-6deg] comic-shadow z-20">
              Time to swing into math!
              <span className="absolute -bottom-3 right-8 w-0 h-0 border-l-[14px] border-l-transparent border-t-[14px] border-t-white" />
            </div>

            <div className="relative rounded-3xl overflow-hidden border-4 border-ink-900 comic-shadow-red bg-ink-800">
              <img
                src={SPIDEY_GIF}
                alt="Spiderman swinging into action"
                className="w-full h-[440px] object-cover"
                loading="eager"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-ink-900/70 via-transparent to-transparent" />

              {/* XP bar overlay */}
              <div className="absolute bottom-4 inset-x-4 bg-ink-900/80 backdrop-blur-sm rounded-xl p-3 border border-hero-600/30">
                <div className="flex justify-between text-xs text-white font-medium mb-1.5">
                  <span>Power Upgrade · Web-Shooters</span>
                  <span className="text-hero-400">{currentPoints.toLocaleString()} / {nextTarget.toLocaleString()} SP</span>
                </div>
                <div className="h-2 rounded-full bg-ink-700 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-hero-600 to-hero-400 transition-all duration-1000 ease-out" style={{ width: `${progressPercent}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
