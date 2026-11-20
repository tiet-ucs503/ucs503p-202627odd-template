import { useCallback, useEffect, useState } from 'react';
import { Shield, Printer, UserPlus, Users, ArrowLeft } from 'lucide-react';
import { api, LinkedStudent, reportPath, StudentReport } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import StudentReportView from '@/components/dashboard/StudentReportView';

// Parent and teacher portal: the list of linked students, and one student's report.
// The server decides which students an account may see; this page only displays them.

const lastActive = (iso: string | null) =>
  iso ? new Date(iso + 'Z').toLocaleDateString([], { month: 'short', day: 'numeric' }) : 'Not yet';

export default function ParentDashboard() {
  const { user, logout } = useAuth();
  const isTeacher = user?.role === 'teacher';
  const portalName = isTeacher ? 'Teacher Portal' : 'Parent Portal';

  const [students, setStudents] = useState<LinkedStudent[] | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [report, setReport] = useState<StudentReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [showLinkForm, setShowLinkForm] = useState(false);
  const [linkCode, setLinkCode] = useState('');
  const [linkMsg, setLinkMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [linking, setLinking] = useState(false);

  const loadStudents = useCallback(async () => {
    try {
      const list = await api<LinkedStudent[]>('/guardians/students');
      setStudents(list);
      // With exactly one student, go straight to their report. With several, show the list first.
      setSelectedId((current) => {
        if (current !== null && list.some((s) => s.id === current)) return current;
        return list.length === 1 ? list[0].id : null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your students.');
      setStudents([]);
    }
  }, []);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  useEffect(() => {
    setReport(null);
    if (selectedId === null) return;
    let cancelled = false;
    setError(null);
    api<StudentReport>(reportPath(selectedId))
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

  const headerButton = 'inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-ink-900 border border-white/10 hover:border-blue-500/50 text-xs font-semibold text-gray-300 hover:text-white transition-all';

  return (
    <section className="relative py-20 min-h-screen text-white font-sans">
      <div className="absolute inset-0 halftone opacity-25 pointer-events-none" />
      <div className="relative max-w-7xl mx-auto px-5 sm:px-8">

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8 bg-ink-950/60 p-4 rounded-2xl border border-white/10 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30"><Shield className="w-5 h-5" /></div>
            <div>
              <div className="text-xs text-blue-400 font-mono font-bold uppercase tracking-wider">{portalName}</div>
              <div className="text-sm font-semibold text-white">{user?.name}</div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {students.length > 1 && selectedId !== null && (
              <>
                <button onClick={() => setSelectedId(null)} className={headerButton}>
                  <ArrowLeft className="w-3.5 h-3.5 text-blue-400" /> All students
                </button>
                <label htmlFor="student-picker" className="sr-only">Student</label>
                <select
                  id="student-picker"
                  value={selectedId}
                  onChange={(e) => setSelectedId(Number(e.target.value))}
                  className="bg-ink-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-400"
                >
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </>
            )}
            <button onClick={() => { setShowLinkForm(!showLinkForm); setLinkMsg(null); }} className={headerButton}>
              <UserPlus className="w-3.5 h-3.5 text-blue-400" /> Add student
            </button>
            {selectedId !== null && (
              <button onClick={() => window.print()} className={headerButton}>
                <Printer className="w-3.5 h-3.5 text-gray-300" /> Print
              </button>
            )}
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

        {selectedId === null ? (
          // ── The list of linked students ──
          <div className="bg-ink-950/80 rounded-3xl p-6 sm:p-7 border border-white/10 backdrop-blur-xl">
            <h1 className="font-comic text-2xl text-white tracking-wide uppercase mb-1 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-400" /> {isTeacher ? 'Your students' : 'Your children'}
            </h1>
            <p className="text-xs text-gray-400 mb-5">Choose a student to see their full report.</p>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-gray-400 font-mono text-[11px] uppercase tracking-wider">
                    <th className="py-3 px-4">Student</th>
                    <th className="py-3 px-4">Level</th>
                    <th className="py-3 px-4">Questions answered</th>
                    <th className="py-3 px-4">Accuracy</th>
                    <th className="py-3 px-4">Last practised</th>
                    <th className="py-3 px-4"><span className="sr-only">Open</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {students.map((s) => (
                    <tr key={s.id}>
                      <td className="py-3 px-4 font-bold text-white">{s.name}</td>
                      <td className="py-3 px-4 text-gray-300">{s.level}</td>
                      <td className="py-3 px-4 text-gray-300">{s.questions_answered}</td>
                      <td className="py-3 px-4 text-gray-300">{s.accuracy_pct === null ? 'No answers yet' : `${s.accuracy_pct}%`}</td>
                      <td className="py-3 px-4 text-gray-300">{lastActive(s.last_active)}</td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setSelectedId(s.id)}
                          aria-label={`View report for ${s.name}`}
                          className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold"
                        >
                          View report
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : report ? (
          <StudentReportView report={report} />
        ) : (
          !error && <div className="py-20 text-center text-blue-400 font-mono text-sm uppercase tracking-widest">Loading report...</div>
        )}
      </div>
    </section>
  );
}
