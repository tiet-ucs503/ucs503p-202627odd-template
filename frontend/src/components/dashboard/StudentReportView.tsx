import { Target, Clock, Eye, Award, CheckCircle2, XCircle, Zap, BookOpen, HelpCircle, ListChecks, ShieldCheck } from 'lucide-react';
import type { StudentReport } from '@/lib/api';
import TrendCharts from '@/components/dashboard/TrendCharts';
import { formatDay } from '@/lib/dates';

// One student's report, as seen by a linked parent or teacher.
//
// It has two clearly separate parts:
//   1. Learning progress  - built only from maths answers.
//   2. Attention estimate - optional, from the camera, shown on its own.
// Nothing in part 2 is mixed into, or used to explain, anything in part 1.

const card = 'bg-ink-900/80 rounded-2xl p-5 border border-white/10 backdrop-blur-md';
const panel = 'bg-ink-950/80 rounded-3xl p-6 sm:p-7 border border-white/10 backdrop-blur-xl';
const sectionTitle = 'font-comic text-lg text-white tracking-wide uppercase';

const when = (iso: string) =>
  new Date(iso + 'Z').toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

function Kpi({ label, value, note, icon: Icon, color }: { label: string; value: string; note: string; icon: typeof Target; color: string }) {
  return (
    <div className={card}>
      <div className="text-xs font-mono text-gray-400 uppercase tracking-wider mb-2 flex items-center justify-between">
        <span>{label}</span>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <div className={`text-3xl font-comic mb-1 ${color}`}>{value}</div>
      <div className="text-[11px] text-gray-400">{note}</div>
    </div>
  );
}

function masteryLevel(pct: number | null): { label: string; bar: string; text: string } {
  if (pct === null) return { label: 'Not started', bar: 'bg-transparent', text: 'text-gray-500' };
  if (pct > 75) return { label: 'Strong', bar: 'bg-green-500', text: 'text-green-400' };
  if (pct >= 40) return { label: 'Developing', bar: 'bg-blue-500', text: 'text-blue-300' };
  return { label: 'Needs practice', bar: 'bg-amber-500', text: 'text-amber-400' };
}

export default function StudentReportView({ report: r }: { report: StudentReport }) {
  const history = Object.fromEntries(r.mastery_history.map((h) => [h.topic, h.points]));
  const measuredDays = r.daily.filter((d) => d.attention_measured > 0);

  return (
    <div>
      <h1 className="font-comic text-3xl sm:text-4xl text-white tracking-wide mb-1">{r.student_name}</h1>
      <p className="text-sm text-gray-400 mb-6">
        Level {r.level} of {r.total_bosses}
        {r.last_active ? ` · last practised ${when(r.last_active)}` : ''}
      </p>

      {r.questions_answered === 0 && (
        <div className="mb-8 p-6 rounded-2xl bg-ink-900/80 border border-white/10 text-center">
          <HelpCircle className="w-8 h-8 text-gray-500 mx-auto mb-2" />
          <div className="font-semibold text-white">No practice recorded yet</div>
          <p className="text-sm text-gray-400 mt-1">
            {r.student_name} has not answered any questions. Results will appear here after their first mission.
          </p>
        </div>
      )}

      {/* ══ Part 1: learning progress. Built only from maths answers. ══ */}
      <section aria-labelledby="learning-heading" className="mb-12">
        <h2 id="learning-heading" className="font-comic text-xl text-white tracking-wide uppercase mb-1 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-blue-400" /> Learning progress
        </h2>
        <p className="text-xs text-gray-400 mb-4">Everything in this section comes from the maths answers alone.</p>

        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <Kpi label="Accuracy" icon={Target} color="text-green-400"
            value={r.accuracy_pct === null ? '–' : `${r.accuracy_pct}%`}
            note={`${r.correct_answers} of ${r.questions_answered} correct`} />
          <Kpi label="Questions" icon={CheckCircle2} color="text-blue-400"
            value={String(r.questions_answered)} note="answered in total" />
          <Kpi label="Bosses defeated" icon={Award} color="text-yellow-400"
            value={`${r.bosses_defeated} / ${r.total_bosses}`}
            note={`${r.missions_won} of ${r.missions_played} missions won`} />
          <Kpi label="Practice time" icon={Clock} color="text-purple-400"
            value={`${r.practice_minutes}m`} note="spent answering questions" />
          <Kpi label="Spider Points" icon={Zap} color="text-pink-400"
            value={String(r.points)} note="in-game reward points" />
        </div>

        {r.questions_answered > 0 && (
          <div className={`${panel} mb-8`}>
            <h3 className={`${sectionTitle} mb-4`}>Practice over time</h3>
            <TrendCharts days={r.daily} />
          </div>
        )}

        <div className={`${panel} mb-8`}>
          <h3 className={`${sectionTitle} mb-1`}>Mastery by topic</h3>
          <p className="text-xs text-gray-400 mb-5 leading-relaxed">
            An estimate of how well each topic is understood. It goes up with correct answers and down with
            incorrect ones, and depends on nothing else.
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            {r.topic_mastery.map((t) => {
              const level = masteryLevel(t.mastery_pct);
              const points = history[t.topic] ?? [];
              const first = points[0];
              return (
                <div key={t.topic} className="bg-black/40 p-3 rounded-2xl border border-white/5">
                  <div className="flex justify-between items-center mb-1.5 text-xs gap-2">
                    <span className="font-bold text-gray-200">{t.label}</span>
                    <span className="flex items-center gap-2 shrink-0">
                      <span className={`font-mono font-bold ${level.text}`}>{level.label}</span>
                      {t.mastery_pct !== null && <span className="font-mono font-bold text-white">{t.mastery_pct}%</span>}
                    </span>
                  </div>
                  <div className="h-2 bg-black/60 rounded-full overflow-hidden border border-white/10">
                    <div className={`h-full rounded-full ${level.bar}`} style={{ width: `${t.mastery_pct ?? 0}%` }} />
                  </div>
                  <div className="text-[10px] text-gray-500 mt-1">
                    {t.questions_answered} questions answered
                    {points.length > 1 && t.mastery_pct !== null
                      ? ` · was ${first.mastery_pct}% on ${formatDay(first.date)}, now ${t.mastery_pct}%`
                      : ''}
                  </div>
                </div>
              );
            })}
          </div>

          {r.needs_practice.length > 0 && (
            <div className="mt-5 p-4 rounded-2xl bg-amber-950/30 border border-amber-500/30">
              <div className="text-sm font-bold text-amber-300 mb-1">Topics that need practice</div>
              <ul className="text-sm text-gray-200 list-disc list-inside space-y-0.5">
                {r.needs_practice.map((t) => (
                  <li key={t.topic}>{t.label} (mastery {t.mastery_pct}%)</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="grid lg:grid-cols-2 gap-8 mb-8">
          <div className={panel}>
            <h3 className={`${sectionTitle} mb-1 flex items-center gap-2`}><ListChecks className="w-4 h-4 text-blue-400" /> What the numbers show</h3>
            <p className="text-xs text-gray-400 mb-4">Plain statements worked out from the figures on this page by fixed rules. Not written by AI.</p>
            {r.observations.length === 0 ? (
              <p className="text-sm text-gray-500">Not enough practice yet to say anything useful. This fills in after about ten answers.</p>
            ) : (
              <ul className="space-y-2 text-sm text-gray-200">
                {r.observations.map((line) => (
                  <li key={line} className="flex items-start gap-2"><span className="text-blue-400 mt-0.5">•</span><span>{line}</span></li>
                ))}
              </ul>
            )}
          </div>

          <div className={panel}>
            <h3 className={`${sectionTitle} mb-1 flex items-center gap-2`}><Award className="w-4 h-4 text-yellow-400" /> Badges earned</h3>
            <p className="text-xs text-gray-400 mb-4">Each badge is earned by something the student actually did.</p>
            {r.badges.length === 0 ? (
              <p className="text-sm text-gray-500">No badges yet. The first one comes from defeating a boss.</p>
            ) : (
              <ul className="space-y-2">
                {r.badges.map((b) => (
                  <li key={b.id} className="text-sm">
                    <span className="font-bold text-white">{b.label}</span>
                    <span className="text-gray-400"> · {b.description}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className={panel}>
          <h3 className={`${sectionTitle} mb-5`}>Recent answers</h3>
          {r.recent_attempts.length === 0 ? (
            <p className="text-sm text-gray-500">Nothing to show yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-gray-400 font-mono text-[11px] uppercase tracking-wider">
                    <th className="py-3 px-4">Topic</th>
                    <th className="py-3 px-4">Level</th>
                    <th className="py-3 px-4">Result</th>
                    <th className="py-3 px-4">Time taken</th>
                    <th className="py-3 px-4">Hint</th>
                    <th className="py-3 px-4">When</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {r.recent_attempts.map((a) => (
                    <tr key={a.id}>
                      <td className="py-3 px-4 text-white">{a.topic_label}</td>
                      <td className="py-3 px-4 text-gray-300 capitalize">{a.difficulty}</td>
                      <td className="py-3 px-4">
                        {a.is_correct ? (
                          <span className="text-green-400 font-bold inline-flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Correct</span>
                        ) : (
                          <span className="text-red-400 font-bold inline-flex items-center gap-1"><XCircle className="w-3.5 h-3.5" /> Incorrect</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-gray-300">{a.response_time_s}s</td>
                      <td className="py-3 px-4 text-gray-300">{a.hint_used ? 'Used' : 'No'}</td>
                      <td className="py-3 px-4 text-gray-400">{when(a.answered_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* ══ Part 2: attention estimate. Optional, separate, never part of the scores above. ══ */}
      <section aria-labelledby="attention-heading" className="mb-10">
        <h2 id="attention-heading" className="font-comic text-xl text-white tracking-wide uppercase mb-1 flex items-center gap-2">
          <Eye className="w-5 h-5 text-gray-400" /> Attention estimate
          <span className="text-xs font-sans normal-case text-gray-500">(optional)</span>
        </h2>
        <p className="text-xs text-gray-400 mb-4">
          Separate from learning progress. It is an estimate from the webcam, not a medical assessment and not a measure of ability.
        </p>

        <div className={panel}>
          {r.attention.measured_questions === 0 ? (
            <p className="text-sm text-gray-200">
              Camera not used, so there is no estimate. That is completely fine: the camera is optional and does not affect any score.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
                <div>
                  <span className="text-3xl font-comic text-white">{r.attention.avg_on_screen_pct}%</span>
                  <span className="text-sm text-gray-300 ml-2">of the time facing the screen</span>
                </div>
                <div className="text-sm text-gray-400">
                  Measured on {r.attention.measured_questions} of {r.attention.total_questions} questions
                </div>
              </div>
              {r.attention.measured_questions < r.attention.total_questions && (
                <p className="text-xs text-gray-400 mt-2">
                  The other {r.attention.total_questions - r.attention.measured_questions} questions were answered with the camera off.
                  They are left out of this figure; they are not counted as inattention.
                </p>
              )}
              {measuredDays.length > 0 && (
                <div className="overflow-x-auto mt-5">
                  <table className="w-full text-left border-collapse text-xs sm:text-sm max-w-xl">
                    <thead>
                      <tr className="border-b border-white/10 text-gray-400 font-mono text-[11px] uppercase tracking-wider">
                        <th className="py-2 pr-4">Day</th>
                        <th className="py-2 pr-4">Facing the screen</th>
                        <th className="py-2 pr-4">Questions measured</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-gray-300">
                      {measuredDays.map((d) => (
                        <tr key={d.date}>
                          <td className="py-2 pr-4">{formatDay(d.date)}</td>
                          <td className="py-2 pr-4">{d.avg_on_screen_pct}%</td>
                          <td className="py-2 pr-4">{d.attention_measured} of {d.questions}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      <details className={`${panel} text-sm text-gray-300`}>
        <summary className="cursor-pointer font-bold text-white flex items-center gap-2 w-fit">
          <ShieldCheck className="w-4 h-4 text-green-400" /> How the camera and this data are handled
        </summary>
        <ul className="mt-4 space-y-2 list-disc list-inside leading-relaxed">
          <li>The camera is optional. A student who never switches it on gets the same game, the same questions and the same scores.</li>
          <li>When it is on, the picture is analysed inside the student&apos;s own browser. No photos or video are saved or sent to MathVerse.</li>
          <li>Only a few numbers per question are kept: how much of the time a face was visible and facing the screen, and a blink rate.</li>
          <li>&quot;Facing the screen&quot; is judged from head direction. It is a rough estimate and can be wrong, for example in poor light.</li>
          <li>It is not a medical or psychological assessment and says nothing about a child&apos;s ability or intelligence.</li>
          <li>Attention figures never change mastery, question difficulty, points or progress.</li>
          <li>The student can switch the camera off at any time during a mission.</li>
        </ul>
      </details>
    </div>
  );
}
