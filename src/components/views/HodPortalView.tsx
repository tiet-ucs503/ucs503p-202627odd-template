import React, { useMemo, useState } from 'react';
import { AlertTriangle, BarChart3, CheckCircle2, ClipboardCheck, Users } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTimetable } from '../../context/TimetableContext';
import { PollComposer } from './PollComposer';
import { facultyTeachingCap, facultyTeachingPeriods } from '../../lib/facultyWorkload';

const card = 'rounded-xl border border-[#E5E2D9] dark:border-zinc-800 bg-[#FAF9F5] dark:bg-zinc-900';

export function HodPortalView() {
  const { currentUser } = useAuth();
  const { academicYear, auditLogs, courses, facultyMembers, publishStatus, sections, publishedSessions, versions } = useTimetable();
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const facultyId = currentUser?.facultyId;
  const departmentId = facultyMembers.find((f) => f.id === facultyId)?.departmentId;
  const departmentFaculty = useMemo(
    () => facultyMembers.filter((f) => !departmentId || f.departmentId === departmentId),
    [departmentId, facultyMembers],
  );
  const facultyIds = useMemo(() => new Set(departmentFaculty.map((f) => f.id)), [departmentFaculty]);
  const departmentSessions = (publishedSessions || []).filter((s) => facultyIds.has(s.facultyId));
  const alreadySignedOff = auditLogs.some((event) => event.action === 'HOD_DEPARTMENT_SIGNED_OFF' && event.entityId.startsWith(`${departmentId}:`));
  const cancelled = departmentSessions.filter((s) => s.status === 'Cancelled');
  const hoursByFaculty = useMemo(() => new Map(
    departmentFaculty.map((faculty) => [faculty.id, facultyTeachingPeriods(departmentSessions, faculty.id)]),
  ), [departmentFaculty, departmentSessions]);

  const signOff = async () => {
    setSaving(true);
    setNotice(null);
    try {
      const response = await fetch('/api/timetable/department-approval', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        body: JSON.stringify({ versionId: `V${versions[0]?.versionNumber || 1}.0` }),
      });
      const result = await response.json().catch(() => ({}));
      setNotice(response.ok && result.success ? 'Department sign-off recorded.' : result.message || 'The sign-off could not be saved.');
    } catch {
      setNotice('The sign-off could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="border-b border-[#E5E2D9] dark:border-zinc-800 pb-4">
        <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#8C1B2E] dark:text-red-400">
          <Users className="h-4 w-4" aria-hidden="true" /> Department workspace
        </div>
        <h1 className="text-2xl font-serif font-bold text-stone-900 dark:text-zinc-100 sm:text-3xl">HOD Portal</h1>
        <p className="mt-1 text-sm text-stone-600 dark:text-zinc-400">Workload balance, schedule disruptions, and timetable sign-off for your department.</p>
      </header>

      {notice && <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">{notice}</div>}
      <PollComposer sectionIds={[...new Set(departmentSessions.map((session) => session.sectionId))]} />

      <section className="grid gap-3 sm:grid-cols-3" aria-label="Department summary">
        <Metric icon={<Users className="h-4 w-4" />} label="Faculty" value={departmentFaculty.length} />
        <Metric icon={<BarChart3 className="h-4 w-4" />} label="Scheduled classes" value={departmentSessions.length - cancelled.length} />
        <Metric icon={<AlertTriangle className="h-4 w-4" />} label="Cancelled classes" value={cancelled.length} />
      </section>

      <section className={`${card} overflow-hidden`}>
        <div className="flex items-center justify-between gap-3 border-b border-[#E5E2D9] p-4 dark:border-zinc-800">
          <div>
            <h2 className="font-serif font-bold text-stone-900 dark:text-zinc-100">Faculty workload</h2>
            <p className="mt-1 text-xs text-stone-500 dark:text-zinc-400">Weekly hours are calculated from the active timetable.</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-xs">
            <thead className="bg-stone-100 text-stone-600 dark:bg-zinc-950 dark:text-zinc-400">
              <tr><th className="p-3">Faculty</th><th className="p-3">Course load</th><th className="p-3">Weekly hours</th><th className="p-3">Limit</th></tr>
            </thead>
            <tbody className="divide-y divide-[#E5E2D9] dark:divide-zinc-800">
              {departmentFaculty.map((faculty) => {
                const hours = Math.round((hoursByFaculty.get(faculty.id) || 0) * 10) / 10;
                const coursesTaught = new Set(departmentSessions.filter((s) => s.facultyId === faculty.id).map((s) => s.courseId));
                const cap = facultyTeachingCap(faculty);
                const over = hours > cap;
                return <tr key={faculty.id}>
                  <td className="p-3 font-medium text-stone-900 dark:text-zinc-100">{faculty.name}</td>
                  <td className="p-3 text-stone-600 dark:text-zinc-400">{[...coursesTaught].map((id) => courses.find((c) => c.id === id)?.code || id).join(', ') || 'No classes assigned'}</td>
                  <td className={`p-3 font-mono whitespace-nowrap ${over ? 'text-rose-700 dark:text-rose-400' : 'text-stone-700 dark:text-zinc-300'}`}>{Number(hours.toFixed(1))}&nbsp;h</td>
                  <td className="p-3 text-stone-600 dark:text-zinc-400">{cap} h</td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className={`${card} p-4`}>
          <h2 className="mb-3 flex items-center gap-2 font-serif font-bold text-stone-900 dark:text-zinc-100"><AlertTriangle className="h-4 w-4 text-amber-600" />Class disruptions</h2>
          {cancelled.length === 0 ? <p className="text-xs text-stone-500 dark:text-zinc-400">No cancelled classes in the current timetable.</p> : <ul className="space-y-2">{cancelled.slice(0, 8).map((session) => <li key={session.id} className="rounded-lg bg-white p-3 text-xs dark:bg-zinc-950"><strong>{courses.find((c) => c.id === session.courseId)?.code || session.courseId}</strong> · {sections.find((s) => s.id === session.sectionId)?.name || session.sectionId} · {session.day} {session.timeSlotId}<div className="mt-1 text-stone-500 dark:text-zinc-400">{session.cancellationReason || 'No reason provided'}</div></li>)}</ul>}
        </section>

        <section className={`${card} p-4`}>
          <h2 className="mb-3 flex items-center gap-2 font-serif font-bold text-stone-900 dark:text-zinc-100"><ClipboardCheck className="h-4 w-4 text-[#8C1B2E]" />Timetable approval</h2>
          <p className="mb-4 text-xs text-stone-600 dark:text-zinc-400">Current status: <strong>{publishStatus}</strong>. Approve the reviewed draft for the College Admin’s final publication step.</p>
          <button type="button" onClick={() => void signOff()} disabled={saving || alreadySignedOff} className="inline-flex items-center gap-2 rounded-lg bg-[#8C1B2E] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />{saving ? 'Saving…' : alreadySignedOff ? 'Department sign-off complete' : 'Approve reviewed timetable'}
          </button>
          <div className="mt-4 border-t border-[#E5E2D9] pt-3 dark:border-zinc-800">
            <h3 className="mb-2 text-xs font-semibold text-stone-700 dark:text-zinc-300">Recent department activity</h3>
            <ul className="space-y-2 text-[11px] text-stone-500 dark:text-zinc-400">{auditLogs.filter((event) => /CLASS_CANCELLED|TIMETABLE_APPROVED|TIMETABLE_PUBLISHED|HOD_DEPARTMENT_SIGNED_OFF/.test(event.action)).slice(0, 4).map((event) => <li key={event.id}>{event.action.replaceAll('_', ' ')} · {event.details}</li>)}</ul>
          </div>
        </section>
      </div>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return <div className={`${card} flex items-center gap-3 p-4`}><div className="text-[#8C1B2E] dark:text-red-400">{icon}</div><div><div className="text-xs text-stone-500 dark:text-zinc-400">{label}</div><div className="font-mono text-xl font-bold text-stone-900 dark:text-zinc-100">{value}</div></div></div>;
}
