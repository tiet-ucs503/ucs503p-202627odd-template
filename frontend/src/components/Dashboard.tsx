import { useState, useEffect } from 'react';
import { Target, Trophy, Clock, Zap, AlertTriangle, CheckCircle2, XCircle, KeyRound } from 'lucide-react';
import Reveal from '@/components/Reveal';
import { api, StudentReport } from '@/lib/api';
import { useGame } from '@/context/GameContext';
import { useAuth } from '@/context/AuthContext';

const bossDetails: Record<string, { title: string; desc: string; villainName: string }> = {
  goblin: { villainName: 'Green Goblin', title: 'Oscorp Formula Crisis', desc: "Green Goblin has damaged Oscorp's research formulas. Restore the calculations before the experiment destroys the city." },
  'doc-ock': { villainName: 'Doc Ock', title: 'The Web Network Failure', desc: 'Doc Ock is building a mechanical lab. Use geometry to calculate the area and perimeter to shut down his grid.' },
  mysterio: { villainName: 'Mysterio', title: 'The Illusion Maze', desc: "Mysterio's drones are spawning in sequences. Crack the pattern to break the illusion." },
  venom: { villainName: 'Venom', title: 'Final Symbiote Challenge', desc: 'The symbiote is spreading rapidly! Calculate the percentages to contain the outbreak.' },
  lizard: { villainName: 'Lizard', title: 'Sewer Mutation Threat', desc: 'The Lizard is mixing a new serum. Use radicals and exponents to calculate the neutralizing dosage.' },
  kingpin: { villainName: 'Kingpin', title: 'Underworld Takeover', desc: 'Kingpin is transferring funds. Use proportions to intercept his underworld transactions.' },
};

export default function Dashboard({ setView }: { setView: (view: string) => void }) {
  const { user } = useAuth();
  const { progress, refreshProgress } = useGame();
  const [report, setReport] = useState<StudentReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    refreshProgress();
    api<StudentReport>(`/students/${user.id}/report`)
      .then(setReport)
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load your stats.'));
  }, [user, refreshProgress]);

  if (!user) return null;

  const currentBossId = progress.unlocked_bosses[progress.unlocked_bosses.length - 1] || 'goblin';
  const currentBoss = bossDetails[currentBossId] || bossDetails.goblin;

  const stats = [
    { label: 'Missions Won', value: report ? String(report.missions_won) : '–', icon: Target, color: 'text-hero-400' },
    { label: 'Villains Defeated', value: report ? `${report.bosses_defeated} / ${report.total_bosses}` : '–', icon: Trophy, color: 'text-yellow-400' },
    { label: 'Practice Time', value: report ? `${report.practice_minutes}m` : '–', icon: Clock, color: 'text-blue-400' },
    { label: 'Spider Points', value: String(progress.points), icon: Zap, color: 'text-pink-400' },
  ];

  return (
    <section className="relative py-24 min-h-screen">
      <div className="absolute inset-0 halftone opacity-30" />
      <div className="relative max-w-7xl mx-auto px-5 sm:px-8">
        <Reveal>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
            <div>
              <span className="text-hero-500 font-comic text-xl tracking-wide">Hero Command Center</span>
              <h2 className="mt-2 font-comic text-4xl sm:text-5xl text-white tracking-wide leading-tight">
                {user.name}&apos;s Spider Profile
              </h2>
              <p className="mt-3 text-gray-400">Your missions, points and how well you know each topic.</p>
            </div>
            <div className="flex items-center gap-4 bg-ink-800/80 p-3 rounded-2xl border border-white/10 backdrop-blur-md">
              <img src="/spiderman-gif.gif" alt="" className="w-12 h-12 rounded-xl object-cover border-2 border-hero-500" />
              <div className="pr-4">
                <div className="text-white font-bold">{user.name}</div>
                <div className="text-xs text-hero-400 font-medium">Level {progress.level} of 6 Web-Slinger</div>
              </div>
            </div>
          </div>
        </Reveal>

        {error && (
          <div role="alert" className="mb-6 p-3 rounded-xl bg-red-950/80 border border-red-500/50 text-red-200 text-sm">{error}</div>
        )}

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          {stats.map((stat, i) => (
            <Reveal key={stat.label} delay={i * 100}>
              <div className="bg-ink-800/80 rounded-2xl p-5 border border-white/10 backdrop-blur-sm">
                <div className={`inline-flex p-2.5 rounded-xl bg-ink-900 border border-white/5 mb-4 ${stat.color}`}>
                  <stat.icon className="w-5 h-5" />
                </div>
                <div className="text-3xl font-comic text-white mb-1 tracking-wide">{stat.value}</div>
                <div className="text-sm font-medium text-gray-300">{stat.label}</div>
              </div>
            </Reveal>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <Reveal delay={400}>
              <div className="bg-ink-800/80 rounded-2xl border border-white/10 backdrop-blur-sm overflow-hidden">
                <div className="p-5 border-b border-white/5 flex justify-between items-center bg-ink-900/50">
                  <h3 className="font-comic text-xl text-white tracking-wide">Recent Answers</h3>
                  {report && report.accuracy_pct !== null && (
                    <span className="text-xs text-gray-400 font-mono">
                      {report.correct_answers} of {report.questions_answered} correct ({report.accuracy_pct}%)
                    </span>
                  )}
                </div>
                <div className="divide-y divide-white/5">
                  {report && report.recent_attempts.length > 0 ? (
                    report.recent_attempts.slice(0, 6).map((a) => (
                      <div key={a.id} className="p-5 flex items-center justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-lg mt-1 border ${a.is_correct ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                            {a.is_correct ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                          </div>
                          <div>
                            <div className="font-semibold text-white">{a.boss_name}</div>
                            <div className="text-sm text-gray-400 mt-0.5">{a.topic_label}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-hero-400">+{a.points_awarded} SP</div>
                          <div className="text-xs text-gray-500">
                            {a.response_time_s}s • {new Date(a.answered_at + 'Z').toLocaleDateString([], { month: 'short', day: 'numeric' })}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-8 text-center text-gray-500 font-medium">
                      {report ? 'No questions answered yet. Take on Green Goblin to get started!' : 'Loading...'}
                    </div>
                  )}
                </div>
              </div>
            </Reveal>

            {progress.link_code && (
              <Reveal delay={450}>
                <div className="bg-blue-950/40 rounded-2xl border border-blue-500/30 p-5 flex items-start gap-4">
                  <div className="p-2.5 rounded-xl bg-blue-900/50 text-blue-300 border border-blue-500/30"><KeyRound className="w-5 h-5" /></div>
                  <div>
                    <h3 className="font-comic text-lg text-white tracking-wide">Your link code</h3>
                    <p className="text-sm text-gray-300 mt-1">
                      Give this code to a parent or teacher if you want them to see your progress:
                    </p>
                    <div className="mt-2 inline-block font-mono text-lg font-bold text-blue-200 bg-black/40 border border-blue-500/30 rounded-lg px-3 py-1 select-all">
                      {progress.link_code}
                    </div>
                    <p className="text-xs text-gray-400 mt-2">Only people who have this code can connect to your account.</p>
                  </div>
                </div>
              </Reveal>
            )}
          </div>

          <div className="space-y-8">
            <Reveal delay={500}>
              <div className="bg-red-950/40 rounded-2xl border border-red-500/30 backdrop-blur-sm p-5">
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                  <h3 className="font-comic text-xl text-white tracking-wide">Active Threat (Level {progress.level})</h3>
                </div>
                <div className="bg-red-900/40 rounded-xl p-4 border border-red-500/20">
                  <div className="font-bold text-red-100 text-sm mb-1">{currentBoss.title}</div>
                  <p className="text-xs text-red-200/80 leading-relaxed mb-3">{currentBoss.desc}</p>
                  <button
                    onClick={() => setView(`mission:${currentBossId}`)}
                    className="w-full py-2 bg-hero-600 hover:bg-hero-500 text-white text-xs font-bold rounded-lg border border-red-500/50 transition-colors"
                  >
                    Engage Target ({currentBoss.villainName})
                  </button>
                </div>
              </div>
            </Reveal>

            <Reveal delay={600}>
              <div className="bg-ink-800/80 rounded-2xl border border-white/10 backdrop-blur-sm p-5">
                <h3 className="font-comic text-xl text-white tracking-wide mb-5">Topic Mastery</h3>
                <div className="space-y-4">
                  {(report?.topic_mastery ?? []).map((t) => (
                    <div key={t.topic}>
                      <div className="flex justify-between text-sm mb-1.5">
                        <span className="font-medium text-gray-300">{t.label}</span>
                        <span className="text-gray-400 font-mono">{t.mastery_pct === null ? 'Not started' : `${t.mastery_pct}%`}</span>
                      </div>
                      <div className="h-2 rounded-full bg-ink-950 overflow-hidden border border-white/5">
                        <div
                          className={`h-full rounded-full transition-all duration-1000 ${
                            (t.mastery_pct ?? 0) > 75 ? 'bg-green-500' : (t.mastery_pct ?? 0) >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${t.mastery_pct ?? 0}%` }}
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
