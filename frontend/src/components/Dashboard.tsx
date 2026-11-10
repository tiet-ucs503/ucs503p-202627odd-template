import { useState, useEffect } from 'react';
import { Target, Trophy, Clock, Zap, AlertTriangle, TrendingUp, CheckCircle2, Lock } from 'lucide-react';
import Reveal from '@/components/Reveal';
import { useGameState } from '@/hooks/useGameState';
import { useAuth } from '@/context/AuthContext';

const bossDetails: Record<string, { title: string, desc: string, villainName: string }> = {
  'goblin': { villainName: 'Green Goblin', title: 'Oscorp Formula Crisis', desc: "Green Goblin has damaged Oscorp's research formulas. Restore the calculations before the experiment destroys the city." },
  'doc-ock': { villainName: 'Doc Ock', title: 'The Web Network Failure', desc: "Doc Ock is building a mechanical lab. Use geometry to calculate the area and perimeter to shut down his grid." },
  'mysterio': { villainName: 'Mysterio', title: 'The Illusion Maze', desc: "Mysterio's drones are spawning in sequences. Crack the pattern to break the illusion." },
  'venom': { villainName: 'Venom', title: 'Final Symbiote Challenge', desc: "The symbiote is spreading rapidly! Calculate the percentages to contain the outbreak." },
  'lizard': { villainName: 'Lizard', title: 'Sewer Mutation Threat', desc: "The Lizard is mixing a new serum. Use radicals and exponents to calculate the neutralizing dosage." },
  'kingpin': { villainName: 'Kingpin', title: 'Underworld Takeover', desc: "Kingpin is transferring funds. Use proportions to intercept his underworld transactions." }
};

const BOSS_KEYS = ['goblin', 'doc-ock', 'mysterio', 'venom', 'lizard', 'kingpin'];

export default function Dashboard({ setView }: { setView: (view: string) => void }) {
  const { gameState } = useGameState();
  const { user, token, isAuthenticated, openAuthModal } = useAuth();
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    fetch(`http://localhost:8001/reports/student/${user.userId}`, {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    })
      .then(res => res.json())
      .then(data => {
        setReport(data);
      })
      .catch(err => {
        console.error("Failed to load student dashboard reports:", err);
      })
      .finally(() => setLoading(false));
  }, [user?.userId, token, isAuthenticated]);

  if (!isAuthenticated || !user) {
    return (
      <section className="relative py-28 min-h-screen flex items-center justify-center">
        <div className="absolute inset-0 halftone opacity-30" />
        <div className="relative max-w-md mx-auto px-6 text-center">
          <div className="p-8 rounded-3xl bg-ink-800/90 border border-white/10 backdrop-blur-md shadow-2xl">
            <div className="w-16 h-16 rounded-2xl bg-hero-600/20 text-hero-500 border border-hero-600/30 mx-auto flex items-center justify-center mb-5">
              <Lock className="w-8 h-8" />
            </div>
            <h2 className="font-comic text-3xl text-white tracking-wide">Hero Portal Classified</h2>
            <p className="mt-3 text-sm text-gray-400 leading-relaxed">
              Authenticate your Spider-Identity to access your live mission telemetry, tactical mastery stats, and combat progress.
            </p>
            <button
              onClick={openAuthModal}
              className="mt-6 w-full py-3 bg-hero-600 hover:bg-hero-500 text-white font-bold rounded-xl comic-shadow transition-all"
            >
              Sign In / Sign Up
            </button>
          </div>
        </div>
      </section>
    );
  }

  const userLevel = user.level || 1;
  const currentBossIndex = Math.min(BOSS_KEYS.length - 1, userLevel - 1);
  const currentBossId = BOSS_KEYS[currentBossIndex] || 'goblin';
  const currentBoss = bossDetails[currentBossId] || bossDetails['goblin'];

  const attempts = report?.recent_attempts || [];
  const totalMissions = attempts.length;
  const uniqueVillains = new Set(attempts.filter((a: any) => a.score > 0).map((a: any) => a.villain)).size;
  const totalTimeMinutes = report?.total_time_minutes || 0;
  const userPoints = user.points !== undefined ? user.points : (report?.student?.points || gameState.spiderPoints);

  const stats = [
    { label: 'Missions Completed', value: totalMissions.toString(), icon: Target, trend: totalMissions > 0 ? 'Active in combat' : 'Ready for duty', color: 'text-hero-400' },
    { label: 'Villains Defeated', value: uniqueVillains.toString(), icon: Trophy, trend: uniqueVillains > 0 ? `Latest: ${attempts[0]?.villain || 'None'}` : 'Engage Goblin', color: 'text-yellow-400' },
    { label: 'Focus Time', value: `${totalTimeMinutes}m`, icon: Clock, trend: 'Cognitive telemetry', color: 'text-blue-400' },
    { label: 'Spider Points', value: userPoints.toString(), icon: Zap, trend: 'Combat rewards', color: 'text-pink-400' },
  ];

  const recentMissions = attempts.slice(0, 5).map((a: any) => ({
    title: a.villain || 'Villain Battle',
    subject: `State: ${a.cognitiveState || 'Focused'}`,
    score: `+${a.score} SP`,
    time: `${a.timeTaken}s duration`,
    date: a.timestamp ? new Date(a.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Logged'
  }));

  const masteryItems = report?.topic_mastery || [
    { topic: 'Algebra (Linear Equations)', mastery_percent: 0, status: 'Not Started' },
    { topic: 'Geometry (Area & Perimeter)', mastery_percent: 0, status: 'Not Started' },
    { topic: 'Number Patterns & Sequences', mastery_percent: 0, status: 'Not Started' },
    { topic: 'Fractions & Percentages', mastery_percent: 0, status: 'Not Started' },
  ];

  return (
    <section className="relative py-24 min-h-screen">
      <div className="absolute inset-0 halftone opacity-30" />
      <div className="relative max-w-7xl mx-auto px-5 sm:px-8">
        
        {/* Header */}
        <Reveal>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
            <div>
              <span className="text-hero-500 font-comic text-xl tracking-wide">Hero Command Center</span>
              <h2 className="mt-2 font-comic text-4xl sm:text-5xl text-white tracking-wide leading-tight">
                {user.name}&apos;s Spider Profile
              </h2>
              <p className="mt-3 text-gray-400">Live operational stats, active threats, and mastery tracking.</p>
            </div>
            
            <div className="flex items-center gap-4 bg-ink-800/80 p-3 rounded-2xl border border-white/10 backdrop-blur-md">
              <img src="/spiderman-gif.gif" alt="Spider-Man" className="w-12 h-12 rounded-xl object-cover border-2 border-hero-500" />
              <div className="pr-4">
                <div className="text-white font-bold">{user.name}</div>
                <div className="text-xs text-hero-400 font-medium">Level {userLevel} of 6 Web-Slinger</div>
              </div>
            </div>
          </div>
        </Reveal>

        {/* Stats Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          {stats.map((stat, i) => (
            <Reveal key={stat.label} delay={i * 100}>
              <div className="bg-ink-800/80 rounded-2xl p-5 border border-white/10 backdrop-blur-sm relative overflow-hidden group hover:border-hero-500/50 transition-colors">
                <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/5 rounded-full blur-xl group-hover:bg-hero-500/10 transition-colors" />
                <div className="flex justify-between items-start mb-4">
                  <div className={`p-2.5 rounded-xl bg-ink-900 border border-white/5 ${stat.color}`}>
                    <stat.icon className="w-5 h-5" />
                  </div>
                </div>
                <div className="text-3xl font-comic text-white mb-1 tracking-wide">{stat.value}</div>
                <div className="text-sm font-medium text-gray-300">{stat.label}</div>
                <div className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" /> {stat.trend}
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          
          {/* Main Column */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Recent Missions */}
            <Reveal delay={400}>
              <div className="bg-ink-800/80 rounded-2xl border border-white/10 backdrop-blur-sm overflow-hidden">
                <div className="p-5 border-b border-white/5 flex justify-between items-center bg-ink-900/50">
                  <h3 className="font-comic text-xl text-white tracking-wide">Recent Boss Battles</h3>
                  <span className="text-xs text-gray-400 font-mono">Live Database Feed</span>
                </div>
                <div className="divide-y divide-white/5">
                  {recentMissions.length > 0 ? recentMissions.map((mission: any, i: number) => (
                    <div key={i} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 mt-1">
                          <CheckCircle2 className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="font-semibold text-white">{mission.title}</div>
                          <div className="text-sm text-gray-400 mt-0.5">{mission.subject}</div>
                        </div>
                      </div>
                      <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 sm:gap-1">
                        <div className="text-lg font-bold text-hero-400">{mission.score}</div>
                        <div className="text-xs text-gray-500 flex gap-2">
                          <span>{mission.time}</span> • <span>{mission.date}</span>
                        </div>
                      </div>
                    </div>
                  )) : (
                    <div className="p-8 text-center text-gray-500 font-medium">
                      No missions completed yet. Engage Green Goblin to log your first battle!
                    </div>
                  )}
                </div>
              </div>
            </Reveal>

          </div>

          {/* Sidebar */}
          <div className="space-y-8">
            
            {/* Active Threat */}
            <Reveal delay={500}>
              <div className="bg-red-950/40 rounded-2xl border border-red-500/30 backdrop-blur-sm p-5 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                  <AlertTriangle className="w-24 h-24 text-red-500" />
                </div>
                <div className="flex items-center gap-2 mb-4 relative z-10">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                  <h3 className="font-comic text-xl text-white tracking-wide">Active Threat (Level {userLevel})</h3>
                </div>
                <div className="relative z-10 bg-red-900/40 rounded-xl p-4 border border-red-500/20">
                  <div className="font-bold text-red-100 text-sm mb-1">{currentBoss.title}</div>
                  <p className="text-xs text-red-200/80 leading-relaxed mb-3">
                    {currentBoss.desc}
                  </p>
                  <button 
                    onClick={() => setView(`mission:${currentBossId}`)}
                    className="w-full py-2 bg-hero-600 hover:bg-hero-500 text-white text-xs font-bold rounded-lg border border-red-500/50 transition-colors shadow-md">
                    Engage Target ({currentBoss.villainName})
                  </button>
                </div>
              </div>
            </Reveal>

            {/* Skill Mastery */}
            <Reveal delay={600}>
              <div className="bg-ink-800/80 rounded-2xl border border-white/10 backdrop-blur-sm p-5">
                <h3 className="font-comic text-xl text-white tracking-wide mb-5">Web-Slinging Skills</h3>
                <div className="space-y-4">
                  {masteryItems.map((skill: any) => (
                    <div key={skill.topic}>
                      <div className="flex justify-between text-sm mb-1.5">
                        <span className="font-medium text-gray-300">{skill.topic}</span>
                        <span className="text-gray-400 font-mono">{skill.mastery_percent}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-ink-950 overflow-hidden border border-white/5">
                        <div 
                          className={`h-full rounded-full transition-all duration-1000 ${
                            skill.mastery_percent > 80 ? 'bg-hero-500' : 
                            skill.mastery_percent > 50 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${skill.mastery_percent}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>

          </div>
        </div>
      </div>
    </section>
  );
}
