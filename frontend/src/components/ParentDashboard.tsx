import { useCallback, useEffect, useState } from 'react';
import { Shield, Target, Clock, Eye, Award, CheckCircle2, XCircle, Printer, UserPlus, Zap, BookOpen, HelpCircle } from 'lucide-react';
import { api, LinkedStudent, StudentReport } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

// Parent and teacher view. Every number comes from the student's stored answers.
// Phase D adds trends over time; this version shows honest totals.

export default function ParentDashboard() {
  const { user, logout } = useAuth();

  const [students, setStudents] = useState<LinkedStudent[] | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [report, setReport] = useState<StudentReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [showLinkForm, setShowLinkForm] = useState(false);
  const [linkCode, setLinkCode] = useState('');
  const [linkMsg, setLinkMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [linking, setLinking] = useState(false);

  const portalName = user?.role === 'teacher' ? 'Teacher Portal' : 'Parent Portal';

  const loadStudents = useCallback(async () => {
    try {
      const list = await api<LinkedStudent[]>('/guardians/students');
      setStudents(list);
      setSelectedId((current) => (current !== null && list.some((s) => s.id === current) ? current : list[0]?.id ?? null));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your students.');
      setStudents([]);
    }
  }, []);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  useEffect(() => {
    if (selectedId === null) {
      setReport(null);
      return;
    }
    let cancelled = false;
    setReport(null);
    setError(null);
    api<StudentReport>(`/students/${selectedId}/report`)
      .then((r) => { if (!cancelled) setReport(r); })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load the report.'); });
    return () => { cancelled = true; };
  }, [selectedId]);

  const handleLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkCode.trim()) return;
    setLinking(true);
    setLinkMsg(null);
    try {
      const student = await api<LinkedStudent>('/guardians/links', { body: { link_code: linkCode.trim() } });
      setLinkMsg({ ok: true, text: `Connected to ${student.name}.` });
      setLinkCode('');
      setShowLinkForm(false);
      await loadStudents();
      setSelectedId(student.id);
    } catch (err) {
      setLinkMsg({ ok: false, text: err instanceof Error ? err.message : 'Could not connect.' });
    } finally {
      setLinking(false);
    }
  };

  const linkForm = (
    <form onSubmit={handleLink} className="space-y-3 text-left">
      <label htmlFor="link-code" className="block text-xs font-mono uppercase tracking-wider text-gray-300">
        Student&apos;s link code
      </label>
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          id="link-code"
          type="text"
          required
          placeholder="SPIDER-XXXXXX"
          value={linkCode}
          onChange={(e) => setLinkCode(e.target.value.toUpperCase())}
          className="flex-1 bg-ink-900 border border-white/10 rounded-xl py-2.5 px-4 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-400 font-mono"
        />
        <button
          type="submit"
          disabled={linking}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <UserPlus className="w-4 h-4" /> {linking ? 'Connecting...' : 'Connect'}
        </button>
      </div>
      <p className="text-xs text-gray-400">
        The student finds this code on their own dashboard and chooses whether to share it with you.
      </p>
      {linkMsg && !linkMsg.ok && (
        <div role="alert" className="p-3 rounded-xl text-xs font-mono bg-red-950/80 border border-red-500/40 text-red-200">{linkMsg.text}</div>
      )}
    </form>
  );

  if (students === null) {
    return (
      <div className="min-h-screen flex items-center justify-center text-blue-400 font-mono text-sm uppercase tracking-widest">
        Loading...
      </div>
    );
  }

  // No student connected yet
  if (students.length === 0) {
    return (
      <section className="relative py-24 min-h-screen flex items-center justify-center text-white">
        <div className="relative max-w-lg w-full mx-auto px-6">
          <div className="p-8 rounded-3xl bg-ink-950/95 border border-blue-500/40 backdrop-blur-xl text-center">
            <div className="w-16 h-16 rounded-2xl bg-blue-950/80 border border-blue-500/50 flex items-center justify-center mx-auto mb-5">
              <Shield className="w-8 h-8 text-blue-400" />
            </div>
            <div className="text-blue-300 text-xs font-mono font-bold uppercase tracking-wider mb-2">{portalName}</div>
            <h2 className="font-comic text-3xl text-white tracking-wide">Connect a student</h2>
            <p className="mt-2 mb-6 text-sm text-gray-400 leading-relaxed">
              Enter a student&apos;s link code to see their practice history and how well they know each topic.
            </p>
            {error && <div role="alert" className="mb-4 p-3 rounded-xl bg-red-950/80 border border-red-500/50 text-red-300 text-xs text-left">{error}</div>}
            {linkForm}
            <div className="mt-6 pt-5 border-t border-white/10 flex justify-between items-center text-xs text-gray-400">
              <span>Signed in as <strong className="text-white">{user?.name}</strong></span>
              <button onClick={logout} className="text-red-400 hover:text-red-300 font-semibold">Sign Out</button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  const r = report;
  const card = 'bg-ink-900/80 rounded-2xl p-5 border border-white/10 backdrop-blur-md';
  const panel = 'bg-ink-950/80 rounded-3xl p-6 sm:p-7 border border-white/10 backdrop-blur-xl';

  return (
    <section className="relative py-20 min-h-screen text-white font-sans">
      <div className="absolute inset-0 halftone opacity-25 pointer-events-none" />
      <div className="relative max-w-7xl mx-auto px-5 sm:px-8">

        {/* Header: who is signed in, which student, actions */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8 bg-ink-950/60 p-4 rounded-2xl border border-white/10 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30"><Shield className="w-5 h-5" /></div>
            <div>
              <div className="text-xs text-blue-400 font-mono font-bold uppercase tracking-wider">{portalName}</div>
              <div className="text-sm font-semibold text-white">{user?.name}</div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label htmlFor="student-picker" className="text-xs text-gray-400">Student</label>
            <select
              id="student-picker"
              value={selectedId ?? ''}
              onChange={(e) => setSelectedId(Number(e.target.value))}
              className="bg-ink-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-400"
            >
              {students.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <button
              onClick={() => { setShowLinkForm(!showLinkForm); setLinkMsg(null); }}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-ink-900 border border-white/10 hover:border-blue-500/50 text-xs font-semibold text-gray-300 hover:text-white transition-all"
            >
              <UserPlus className="w-3.5 h-3.5 text-blue-400" /> Add student
            </button>
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-ink-800 border border-white/10 hover:bg-white/10 text-xs font-semibold text-white transition-all"
            >
              <Printer className="w-3.5 h-3.5 text-gray-300" /> Print
            </button>
            <button
              onClick={logout}
              className="px-3.5 py-2 rounded-xl bg-red-950/60 border border-red-500/30 hover:bg-red-900/40 text-xs font-semibold text-red-300 hover:text-white transition-all"
            >
              Sign Out
            </button>
          </div>
        </div>

        {showLinkForm && <div className="mb-6 p-5 rounded-2xl bg-ink-900/90 border border-blue-500/30">{linkForm}</div>}
        {linkMsg?.ok && (
          <div role="status" className="mb-6 p-3 rounded-xl bg-blue-950/60 border border-blue-500/40 text-blue-200 text-sm">{linkMsg.text}</div>
        )}
        {error && <div role="alert" className="mb-6 p-3 rounded-xl bg-red-950/80 border border-red-500/50 text-red-200 text-sm">{error}</div>}

        {!r ? (
          !error && <div className="py-20 text-center text-blue-400 font-mono text-sm uppercase tracking-widest">Loading report...</div>
        ) : (
          <>
            <h1 className="font-comic text-3xl sm:text-4xl text-white tracking-wide mb-1">{r.student_name}</h1>
            <p className="text-sm text-gray-400 mb-6">Level {r.level} of {r.total_bosses}</p>

            {r.questions_answered === 0 && (
              <div className="mb-8 p-6 rounded-2xl bg-ink-900/80 border border-white/10 text-center">
                <HelpCircle className="w-8 h-8 text-gray-500 mx-auto mb-2" />
                <div className="font-semibold text-white">No practice recorded yet</div>
                <p className="text-sm text-gray-400 mt-1">
                  {r.student_name} has not answered any questions. Results will appear here after their first mission.
                </p>
              </div>
            )}

            {/* ── Learning progress: based only on maths answers ── */}
            <h2 className="font-comic text-xl text-white tracking-wide uppercase mb-4 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-blue-400" /> Learning progress
            </h2>

            <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
              <div className={card}>
                <div className="text-xs font-mono text-gray-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span>Accuracy</span><Target className="w-4 h-4 text-green-400" />
                </div>
                <div className="text-3xl font-comic text-green-400 mb-1">{r.accuracy_pct === null ? '–' : `${r.accuracy_pct}%`}</div>
                <div className="text-[11px] text-gray-400">{r.correct_answers} of {r.questions_answered} correct</div>
              </div>
              <div className={card}>
                <div className="text-xs font-mono text-gray-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span>Questions</span><CheckCircle2 className="w-4 h-4 text-blue-400" />
                </div>
                <div className="text-3xl font-comic text-blue-400 mb-1">{r.questions_answered}</div>
                <div className="text-[11px] text-gray-400">answered in total</div>
              </div>
              <div className={card}>
                <div className="text-xs font-mono text-gray-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span>Bosses defeated</span><Award className="w-4 h-4 text-yellow-400" />
                </div>
                <div className="text-3xl font-comic text-yellow-400 mb-1">{r.bosses_defeated} / {r.total_bosses}</div>
                <div className="text-[11px] text-gray-400">{r.missions_won} of {r.missions_played} missions won</div>
              </div>
              <div className={card}>
                <div className="text-xs font-mono text-gray-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span>Practice time</span><Clock className="w-4 h-4 text-purple-400" />
                </div>
                <div className="text-3xl font-comic text-purple-400 mb-1">{r.practice_minutes}m</div>
                <div className="text-[11px] text-gray-400">spent answering questions</div>
              </div>
              <div className={card}>
                <div className="text-xs font-mono text-gray-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span>Spider Points</span><Zap className="w-4 h-4 text-pink-400" />
                </div>
                <div className="text-3xl font-comic text-pink-400 mb-1">{r.points}</div>
                <div className="text-[11px] text-gray-400">in-game reward points</div>
              </div>
            </div>

            <div className={`${panel} mb-8`}>
              <h3 className="font-comic text-lg text-white tracking-wide uppercase mb-1">Mastery by topic</h3>
              <p className="text-xs text-gray-400 mb-5 leading-relaxed">
                An estimate of how well each topic is understood. It goes up with correct answers and down with incorrect ones, and depends on nothing else.
              </p>
              <div className="grid md:grid-cols-2 gap-4">
                {r.topic_mastery.map((t) => (
                  <div key={t.topic} className="bg-black/40 p-3 rounded-2xl border border-white/5">
                    <div className="flex justify-between items-center mb-1.5 text-xs">
                      <span className="font-bold text-gray-200">{t.label}</span>
                      <span className="font-mono font-bold text-white">
                        {t.mastery_pct === null ? 'Not started' : `${t.mastery_pct}%`}
                      </span>
                    </div>
                    <div className="h-2 bg-black/60 rounded-full overflow-hidden border border-white/10">
                      <div
                        className={`h-full rounded-full ${(t.mastery_pct ?? 0) > 75 ? 'bg-green-500' : (t.mastery_pct ?? 0) >= 40 ? 'bg-blue-500' : 'bg-amber-500'}`}
                        style={{ width: `${t.mastery_pct ?? 0}%` }}
                      />
                    </div>
                    <div className="text-[10px] text-gray-500 mt-1">{t.questions_answered} questions answered</div>
                  </div>
                ))}
              </div>
            </div>

            <div className={`${panel} mb-8`}>
              <h3 className="font-comic text-lg text-white tracking-wide uppercase mb-5">Recent answers</h3>
              {r.recent_attempts.length === 0 ? (
                <p className="text-sm text-gray-500">Nothing to show yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs sm:text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-gray-400 font-mono text-[11px] uppercase tracking-wider">
                        <th className="py-3 px-4">Topic</th>
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
                          <td className="py-3 px-4">
                            {a.is_correct ? (
                              <span className="text-green-400 font-bold inline-flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Correct</span>
                            ) : (
                              <span className="text-red-400 font-bold inline-flex items-center gap-1"><XCircle className="w-3.5 h-3.5" /> Incorrect</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-gray-300">{a.response_time_s}s</td>
                          <td className="py-3 px-4 text-gray-300">{a.hint_used ? 'Used' : 'No'}</td>
                          <td className="py-3 px-4 text-gray-400">
                            {new Date(a.answered_at + 'Z').toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* ── Attention estimate: optional, separate, never part of the scores above ── */}
            <h2 className="font-comic text-xl text-white tracking-wide uppercase mb-4 flex items-center gap-2">
              <Eye className="w-5 h-5 text-gray-400" /> Attention estimate <span className="text-xs font-sans normal-case text-gray-500">(optional)</span>
            </h2>
            <div className={panel}>
              {r.attention.measured_questions === 0 ? (
                <p className="text-sm text-gray-300">Camera not used, so there is no estimate. This is not a problem and does not affect any score.</p>
              ) : (
                <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
                  <div>
                    <span className="text-3xl font-comic text-white">{r.attention.avg_on_screen_pct}%</span>
                    <span className="text-sm text-gray-400 ml-2">of the time facing the screen</span>
                  </div>
                  <div className="text-sm text-gray-400">
                    Measured on {r.attention.measured_questions} of {r.attention.total_questions} questions
                  </div>
                </div>
              )}
              <p className="text-xs text-gray-500 mt-4 leading-relaxed">
                If the student chooses to switch on their camera, MathVerse estimates how often they were facing the screen.
                It is a rough estimate, not a medical assessment and not a measure of ability, and it never changes mastery, difficulty or points.
              </p>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
