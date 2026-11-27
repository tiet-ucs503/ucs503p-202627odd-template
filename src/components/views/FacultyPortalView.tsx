import React, { useMemo, useState } from 'react';
import { useTimetable } from '../../context/TimetableContext';
import { useAuth } from '../../context/AuthContext';
import type { DayOfWeek, TimeSlot } from '../../types';
import { api } from '../../lib/api';
import { facultyTeachingCap, facultyTeachingPeriods } from '../../lib/facultyWorkload';
import { PollComposer } from './PollComposer';
import {
  Calendar,
  Clock,
  CheckCircle2,
  ShieldCheck,
  BookOpen,
  MapPin
} from 'lucide-react';

/** Length of a period in hours from its "HH:MM" start/end (1 if unparseable). */
const slotHours = (slot?: TimeSlot) => {
  if (!slot) return 0;
  const mins = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  const h = (mins(slot.endTime) - mins(slot.startTime)) / 60;
  return Number.isFinite(h) && h > 0 ? h : 1;
};
const fmtHrs = (h: number) => `${Math.round(h * 10) / 10} hr${h === 1 ? '' : 's'}`;
const MAX_TAKE_OVER_OPTIONS = 3;

export function FacultyPortalView() {
  const { currentUser, roster } = useAuth();
  const {
    academicYear,
    departments,
    facultyMembers,
    sessions: _draftSessions,
    publishedSessions,
    courses,
    sections,
    rooms,
    makeupTasks,
    recoveryOpportunities,
    selectedFacultyId,
    setSelectedFacultyId,
    isLoading,
    scheduleMakeup,
    declineOpportunity,
    claimMarketplaceSlot,
    setFacultyProtectedSlot,
    cancelSession,
    undoCancellation,
  } = useTimetable();

  const roleCode = currentUser?.roleCode ?? '';
  const sessions = publishedSessions || [];
  // Teachers always see their own record; coordinators/admins pick a faculty member.
  const isTeacher = roleCode === 'FACULTY' || roleCode === 'HOD';
  // The server assigns an extra class to the signed-in teacher, so only FACULTY accounts can claim one.
  const canClaim = roleCode === 'FACULTY';
  const linkedFacultyId = currentUser?.facultyId || '';
  const facultyId = isTeacher
    ? roster?.facultyId || linkedFacultyId
    : roleCode === 'COORDINATOR' && linkedFacultyId
      ? linkedFacultyId
      : selectedFacultyId;
  const matchedFaculty = facultyMembers.find(f => f.id === facultyId);
  const hasOwnSessions = matchedFaculty ? sessions.some(s => s.facultyId === matchedFaculty.id) : false;
  const fallbackActiveFacultyId = !hasOwnSessions && currentUser?.isDemoUser ? sessions[0]?.facultyId : undefined;
  const currentFaculty = (fallbackActiveFacultyId ? facultyMembers.find(f => f.id === fallbackActiveFacultyId) : null) || matchedFaculty;

  const { workingDays, timeSlots, lunchPeriodId } = academicYear;
  const todayName: DayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()] as DayOfWeek;
  const slotById = useMemo(() => new Map(timeSlots.map(t => [t.id, t])), [timeSlots]);
  const slotLabel = (id: string) => slotById.get(id)?.label ?? id;
  const isBreakSlot = (t: TimeSlot) => Boolean(t.isBreak || t.isLunch || t.id === lunchPeriodId);

  const [pickedDay, setSelectedDay] = useState<DayOfWeek | ''>('');
  const selectedDay: DayOfWeek | undefined = pickedDay && workingDays.includes(pickedDay)
    ? pickedDay
    : workingDays.includes(todayName as DayOfWeek) ? todayName as DayOfWeek : workingDays[0];

  const [busy, setBusy] = useState<string | null>(null);
  const [sessionToCancel, setSessionToCancel] = useState<string | null>(null);
  const [cancellationReason, setCancellationReason] = useState<string>('');
  const [scheduledClassesOnly, setScheduledClassesOnly] = useState(true);
  const [oppToDecline, setOppToDecline] = useState<string | null>(null);
  const [scheduleChangeFeedback, setScheduleChangeFeedback] = useState('');

  // Available makeup slots where this teacher, one of their groups and a suitable room are all free.
  const takeOverOptions = useMemo(() => {
    if (!canClaim || !currentFaculty) return [];
    const taken = new Set<string>();
    const pairs = new Map<string, { courseId: string; sectionId: string }>();
    for (const s of sessions) {
      if (s.status === 'Cancelled') continue;
      const k = `${s.day}|${s.timeSlotId}`;
      taken.add(`${k}|f:${s.facultyId}`);
      taken.add(`${k}|s:${s.sectionId}`);
      taken.add(`${k}|r:${s.roomId}`);
      if (s.facultyId === currentFaculty.id) pairs.set(`${s.courseId}|${s.sectionId}`, s);
    }
    const teachingSlots = timeSlots.filter(t => !(t.isBreak || t.isLunch || t.id === lunchPeriodId));
    const isProtected = (day: DayOfWeek, slotId: string) =>
      currentFaculty.preferences.protectedSlots.some(p => p.day === day && p.periodId === slotId);
    const options = [];
    for (const [key, { courseId, sectionId }] of pairs) {
      const course = courses.find(c => c.id === courseId);
      const section = sections.find(s => s.id === sectionId);
      if (!course || !section) continue;
      search: for (const day of workingDays) {
        for (const slot of teachingSlots) {
          const k = `${day}|${slot.id}`;
          if (isProtected(day, slot.id) || taken.has(`${k}|f:${currentFaculty.id}`) || taken.has(`${k}|s:${section.id}`)) continue;
          const room = rooms.find(r =>
            r.isAvailable &&
            r.capacity >= section.studentCount &&
            (!course.requiresLab || r.type === 'ComputerLab' || r.type === 'HardwareLab') &&
            !taken.has(`${k}|r:${r.id}`)
          );
          if (!room) continue;
          options.push({ key: `${key}|${k}`, course, section, day, slot, room });
          break search;
        }
      }
      if (options.length >= MAX_TAKE_OVER_OPTIONS) break;
    }
    return options;
  }, [canClaim, currentFaculty, sessions, timeSlots, lunchPeriodId, workingDays, courses, sections, rooms]);

  /** Runs a server action with a busy flag; resolves to whether it succeeded (the context shows the toast). */
  const runBusy = async (key: string, action: () => Promise<{ success: boolean }>) => {
    setBusy(key);
    try {
      return (await action()).success;
    } finally {
      setBusy(null);
    }
  };

  const facultyPicker = !isTeacher && facultyMembers.length > 0 && (
    <div className="flex items-center gap-2">
      <label htmlFor="faculty-portal-picker" className="text-xs text-stone-500 dark:text-zinc-400 font-medium">
        Faculty
      </label>
      <select
        id="faculty-portal-picker"
        value={selectedFacultyId}
        onChange={e => setSelectedFacultyId(e.target.value)}
        className="bg-white dark:bg-zinc-950 border border-[#E5E2D9] dark:border-zinc-800 text-xs rounded-lg px-2.5 py-1.5 text-stone-800 dark:text-zinc-200 outline-none focus:border-[#8C1B2E]"
      >
        {facultyMembers.map(f => (
          <option key={f.id} value={f.id}>{f.name}</option>
        ))}
      </select>
    </div>
  );

  if (!currentFaculty) {
    return (
      <div className="max-w-6xl mx-auto space-y-4">
        {facultyPicker}
        <div className="bg-[#FAF9F5] dark:bg-zinc-900 border border-[#E5E2D9] dark:border-zinc-800 rounded-xl p-6 text-sm text-stone-600 dark:text-zinc-400">
          {isLoading
            ? 'Loading…'
            : isTeacher
            ? "Your account isn't linked to a faculty record yet — ask the coordinator."
            : 'No faculty members have been added yet.'}
        </div>
      </div>
    );
  }

  const mySessions = sessions.filter(s => s.facultyId === currentFaculty.id);
  const dailySessions = mySessions.filter(s => s.day === selectedDay);
  const activeHours = (match: (type: string) => boolean) => {
    const selected = mySessions.filter((session) => session.status !== 'Cancelled' && match(session.type));
    const countedLectures = new Set<string>();
    return selected.reduce((total, session) => {
      if (session.type === 'Lecture') {
        const key = `${session.courseId}:${session.day}:${session.timeSlotId}`;
        if (countedLectures.has(key)) return total;
        countedLectures.add(key);
      }
      return total + slotHours(slotById.get(session.timeSlotId)) * Math.max(1, Number(session.durationPeriods) || 1);
    }, 0);
  };
  const totalHours = facultyTeachingPeriods(mySessions, currentFaculty.id);
  const teachingCap = facultyTeachingCap(currentFaculty);
  const withinLimit = totalHours <= teachingCap;
  const workloadCards = [
    { label: 'Lectures', value: fmtHrs(activeHours(t => t === 'Lecture')), note: 'Scheduled' },
    { label: 'Tutorials', value: fmtHrs(activeHours(t => t === 'Tutorial')), note: 'Scheduled' },
    { label: 'Laboratory', value: fmtHrs(activeHours(t => t === 'Lab' || t === 'Practical')), note: 'Lab & practical' },
    { label: 'Make-up & other', value: fmtHrs(activeHours(t => !['Lecture', 'Tutorial', 'Lab', 'Practical'].includes(t))), note: 'Make-up, seminar, elective' },
    {
      label: 'Reserved Periods',
      value: fmtHrs(currentFaculty.preferences.protectedSlots.reduce((n, p) => n + slotHours(slotById.get(p.periodId)), 0)),
      note: 'Kept free',
    },
  ];
  const cancelledCount = mySessions.filter(s => s.status === 'Cancelled').length;
  const departmentName = departments.find(d => d.id === currentFaculty.departmentId)?.name;

  const pendingMakeups = [...new Map(makeupTasks
    .filter(t => t.facultyId === currentFaculty.id && t.status !== 'Scheduled' && t.status !== 'Dismissed')
    .map(task => [task.cancelledSessionId, task])).values()]
    .map(task => ({
      task,
      option: recoveryOpportunities
        .filter(o => o.makeupTaskId === task.id && o.status === 'Proposed')
        .sort((a, b) => b.matchScore - a.matchScore)[0],
    }));

  const handleExecuteCancel = async () => {
    if (!sessionToCancel) return;
    if (await runBusy('cancel', () => cancelSession(sessionToCancel, cancellationReason.trim()))) {
      setSessionToCancel(null);
      setCancellationReason('');
    } else {
      setScheduleChangeFeedback('Cancellation was not saved. Check your connection and try again.');
    }
  };

  const handleRequestChange = async (sessionId: string) => {
    const details = window.prompt('Why do you need this class rescheduled or swapped?');
    if (!details?.trim()) return;
    setBusy(`change:${sessionId}`);
    try {
      await api('/api/recovery/request-change', { body: { sessionId, details: details.trim() } });
      setScheduleChangeFeedback('Request saved. The coordinator can review it in Requests & Disruptions.');
    } catch (error) {
      setScheduleChangeFeedback(error instanceof Error ? error.message : 'Could not save your schedule change request.');
    } finally {
      setBusy(null);
    }
  };

  const handleConfirmDecline = async () => {
    if (!oppToDecline) return;
    if (await runBusy('decline', () => declineOpportunity(oppToDecline))) setOppToDecline(null);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header - Teacher Name & Department */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E5E2D9] dark:border-zinc-800 pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold font-serif text-stone-900 dark:text-zinc-100 tracking-tight">
            {currentFaculty.name}
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 dark:text-zinc-400 mt-1">
            {currentFaculty.designation}{departmentName ? ` · ${departmentName}` : ''}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {facultyPicker}
          <div className="flex items-center gap-2 bg-[#FAF9F5] dark:bg-zinc-900 border border-[#E5E2D9] dark:border-zinc-800 px-3 py-1.5 rounded-lg text-xs text-stone-700 dark:text-zinc-300 font-medium shadow-2xs">
            <BookOpen className="h-4 w-4 text-[#8C1B2E] dark:text-red-400" />
            <span>Faculty Portal</span>
          </div>
        </div>
      </div>

      {scheduleChangeFeedback && <p role="status" className="rounded-lg border border-[#E5E2D9] bg-white p-3 text-xs text-stone-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">{scheduleChangeFeedback}</p>}
      <PollComposer sectionIds={[...new Set(mySessions.map((session) => session.sectionId))]} />

      {/* Workload Summary Card */}
      <div className="bg-[#FAF9F5] dark:bg-zinc-900 border border-[#E5E2D9] dark:border-zinc-800 rounded-xl p-5 space-y-3.5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E5E2D9] dark:border-zinc-800/80 pb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
            <span className="text-xs font-bold text-stone-900 dark:text-zinc-100 font-serif">
              Weekly Teaching Workload Summary
            </span>
          </div>
          <span className="text-xs text-stone-500 dark:text-zinc-400 font-medium">
            Maximum Limit: {teachingCap} hours per week
          </span>
        </div>
        <p className="text-[11px] text-stone-500 dark:text-zinc-400 leading-relaxed">
          Computed from the scheduled classes in this timetable (cancelled classes excluded).
          {cancelledCount > 0 && ` ${cancelledCount} class${cancelledCount === 1 ? ' is' : 'es are'} currently cancelled.`}
        </p>

        {/* Workload Breakdown Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5 text-center text-xs">
          <div className="p-3 bg-white dark:bg-zinc-950/60 rounded-lg border border-[#E5E2D9] dark:border-zinc-800 shadow-2xs">
            <span className="text-stone-500 dark:text-zinc-400 block text-[11px]">Direct Teaching</span>
            <span className="text-base font-bold text-stone-900 dark:text-zinc-100 mt-0.5 block font-serif">{fmtHrs(totalHours)}</span>
            <span className={`text-[10px] font-medium ${withinLimit ? 'text-emerald-700 dark:text-emerald-400' : 'text-[#8C1B2E] dark:text-red-400'}`}>
              {withinLimit ? 'Within Limit' : 'Over Limit'}
            </span>
          </div>

          {workloadCards.map(card => (
            <div key={card.label} className="p-3 bg-white dark:bg-zinc-950/60 rounded-lg border border-[#E5E2D9] dark:border-zinc-800 shadow-2xs">
              <span className="text-stone-500 dark:text-zinc-400 block text-[11px]">{card.label}</span>
              <span className="text-base font-bold text-stone-900 dark:text-zinc-100 mt-0.5 block font-serif">{card.value}</span>
              <span className="text-[10px] text-stone-500">{card.note}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Main Grid: Class Schedule & Replacement Actions */}
      <div className="grid grid-cols-1 gap-6">
        {/* Daily Class Schedule spans the full content width for readable course titles. */}
        <div className="min-w-0 space-y-4">
          <div className="bg-[#FAF9F5] dark:bg-zinc-900 border border-[#E5E2D9] dark:border-zinc-800 rounded-xl overflow-hidden shadow-xs">
            {/* Day Selector */}
            <div className="p-3.5 border-b border-[#E5E2D9] dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-[#F4F2EC] dark:bg-zinc-950/50">
              <div className="text-xs font-bold font-serif text-stone-900 dark:text-zinc-100 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-[#8C1B2E] dark:text-red-400" />
                <span>Class Schedule for {selectedDay ?? '—'}</span>
              </div>

              <div className="flex bg-[#E5E2D9]/60 dark:bg-zinc-900 border border-[#E5E2D9] dark:border-zinc-800 p-0.5 rounded-lg text-xs">
                {workingDays.map(d => (
                  <button
                    key={d}
                    onClick={() => setSelectedDay(d)}
                    aria-pressed={selectedDay === d}
                    className={`px-2.5 py-1 rounded-md transition-colors font-medium ${
                      selectedDay === d
                        ? 'bg-[#8C1B2E] text-white font-semibold shadow-2xs'
                        : 'text-stone-700 dark:text-zinc-400 hover:text-stone-900 dark:hover:text-zinc-200'
                    }`}
                  >
                    {d.slice(0, 3)}
                  </button>
                ))}
              </div>
            </div>

            {(sessions.length === 0 || mySessions.length === 0) && (
              <div className="px-3.5 py-2.5 text-[11px] text-stone-500 dark:text-zinc-400 border-b border-[#E5E2D9] dark:border-zinc-800">
                {sessions.length === 0 ? 'No timetable published yet.' : 'No classes are assigned to this faculty member yet.'}
              </div>
            )}

            {isTeacher && <label className="flex items-center gap-2 border-b border-[#E5E2D9] px-3.5 py-2 text-xs font-medium text-stone-700 dark:border-zinc-800 dark:text-zinc-300"><input type="checkbox" checked={scheduledClassesOnly} onChange={(event) => setScheduledClassesOnly(event.target.checked)} className="accent-[#8C1B2E]" />Show scheduled classes only</label>}

            {/* List of Periods */}
            <div className="divide-y divide-[#E5E2D9] dark:divide-zinc-800/80">
              {selectedDay && timeSlots.filter((slot) => !scheduledClassesOnly || dailySessions.some((session) => session.timeSlotId === slot.id)).map(slot => {
                const session = dailySessions.find(s => s.timeSlotId === slot.id);
                const protectedBlock = currentFaculty.preferences.protectedSlots.find(
                  ps => ps.day === selectedDay && ps.periodId === slot.id
                );

                if (isBreakSlot(slot)) {
                  return (
                    <div key={slot.id} className="p-3 bg-[#F4F2EC] dark:bg-zinc-950/40 flex items-center justify-between text-xs text-stone-500 dark:text-zinc-500">
                      <span className="font-mono text-[11px]">{slot.startTime} – {slot.endTime}</span>
                      <span className="font-medium text-stone-700 dark:text-zinc-300">{slot.isLunch || slot.id === lunchPeriodId ? 'Lunch Break' : 'Break'}</span>
                      <span className="text-[11px] text-stone-400">No classes scheduled</span>
                    </div>
                  );
                }

                const course = session && courses.find(c => c.id === session.courseId);
                return (
                  <div
                    key={slot.id}
                    className={`p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs transition-colors ${
                      session?.status === 'Cancelled'
                        ? 'bg-rose-50/60 dark:bg-rose-950/20'
                        : protectedBlock
                        ? 'bg-[#F4F2EC]/60 dark:bg-zinc-950/60'
                        : 'hover:bg-white dark:hover:bg-zinc-800/50'
                    }`}
                  >
                    <div className="flex items-center gap-2 text-stone-600 dark:text-zinc-400 w-36 shrink-0 font-medium font-mono text-[11px]">
                      <Clock className="h-3.5 w-3.5 text-stone-400" />
                      <span>{slot.startTime} – {slot.endTime}</span>
                    </div>

                    <div className="flex-1">
                      {session ? (
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="font-bold text-stone-900 dark:text-zinc-100 flex items-center gap-2">
                              <span className="font-mono text-[#8C1B2E] dark:text-red-400">{course?.code ?? session.courseId}</span>
                              {course && <span className="text-stone-800 dark:text-zinc-200">({course.name})</span>}
                              <span className="text-stone-400">·</span>
                              <span className="text-stone-600 dark:text-zinc-400">{sections.find(s => s.id === session.sectionId)?.name ?? session.sectionId}</span>
                              {session.type !== 'Lecture' && (
                                <span className="text-[10px] text-stone-500 dark:text-zinc-400">{session.type}</span>
                              )}
                              {session.status === 'Cancelled' && (
                                <span className="text-[10px] px-2 py-0.5 rounded bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 font-semibold">
                                  Cancelled
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-stone-500 dark:text-zinc-400 mt-0.5 flex items-center gap-1.5">
                              <MapPin className="h-3 w-3 text-stone-400" />
                              <span>Room: {rooms.find(r => r.id === session.roomId)?.name ?? '—'}</span>
                            </div>
                          </div>

                          {session.status !== 'Cancelled' && (
                            <div className="flex flex-wrap gap-2">
                              <button type="button" onClick={() => void handleRequestChange(session.id)} disabled={busy !== null} className="px-2.5 py-1.5 bg-white dark:bg-zinc-800 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-stone-700 dark:text-zinc-300 border border-[#E5E2D9] dark:border-zinc-700 rounded-lg text-[11px] font-semibold disabled:opacity-50">Request reschedule / swap</button>
                              <button type="button" onClick={() => setSessionToCancel(session.id)} disabled={busy !== null} className="px-2.5 py-1.5 bg-white dark:bg-zinc-800 hover:bg-rose-50 hover:text-rose-800 dark:hover:bg-rose-950/60 dark:hover:text-rose-300 text-stone-700 dark:text-zinc-300 border border-[#E5E2D9] dark:border-zinc-700 rounded-lg text-[11px] font-semibold disabled:opacity-50">Cancel class</button>
                            </div>
                          )}
                          {session.status === 'Cancelled' && (
                            <button type="button" onClick={() => void runBusy(`undo:${session.id}`, () => undoCancellation(session.id))} disabled={busy !== null} className="mt-2 rounded-lg border border-emerald-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-900 dark:bg-zinc-900 dark:text-emerald-300">{busy === `undo:${session.id}` ? 'Restoring…' : 'Undo cancellation'}</button>
                          )}
                        </div>
                      ) : protectedBlock ? (
                        <div className="flex items-center justify-between">
                          <span className="text-stone-600 dark:text-zinc-400 font-medium">
                            Blocked slot (Unavailable)
                          </span>
                          <button
                            onClick={() => {
                              if (!selectedDay) return;
                              void runBusy(`slot:${slot.id}`, () => setFacultyProtectedSlot(currentFaculty.id, selectedDay, slot.id, 'Research'));
                            }}
                            disabled={busy !== null}
                            className="text-xs text-stone-500 dark:text-zinc-400 hover:text-stone-900 dark:hover:text-zinc-200 underline disabled:opacity-50"
                          >
                            {busy === `slot:${slot.id}` ? 'Saving…' : 'Release'}
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <span className="text-stone-400 dark:text-zinc-500 italic">No class scheduled</span>
                          <button
                            onClick={() => {
                              if (!selectedDay) return;
                              void runBusy(`slot:${slot.id}`, () => setFacultyProtectedSlot(currentFaculty.id, selectedDay, slot.id, 'Research'));
                            }}
                            disabled={busy !== null}
                            className="px-2.5 py-1 bg-white dark:bg-zinc-800 hover:bg-stone-50 dark:hover:bg-zinc-700 text-stone-700 dark:text-zinc-300 rounded-lg text-xs font-medium border border-[#E5E2D9] dark:border-zinc-700 transition-colors shadow-2xs disabled:opacity-50"
                          >
                            {busy === `slot:${slot.id}` ? 'Saving…' : 'Mark unavailable'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Replacement Class Suggestions & Extra Classes */}
        <div className="space-y-4">
          {/* Replacement Class Suggestion Cards (one per cancelled class awaiting a make-up) */}
          {pendingMakeups.map(({ task, option }) => {
            const course = courses.find(c => c.id === task.courseId);
            const section = sections.find(s => s.id === task.sectionId);
            return (
              <div key={task.id} className="bg-[#FAF9F5] dark:bg-zinc-900 border border-[#E5E2D9] dark:border-zinc-800 rounded-xl p-4 space-y-3 shadow-xs">
                <div className="flex items-center justify-between border-b border-[#E5E2D9] dark:border-zinc-800 pb-2.5">
                  <span className="text-xs font-bold font-serif text-stone-900 dark:text-zinc-100">
                    Replacement class suggested
                  </span>
                  {option && <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" aria-hidden="true" />}
                </div>

                <div>
                  <h4 className="font-bold font-serif text-sm text-stone-900 dark:text-zinc-100">
                    Replacement for {course?.name ?? task.courseId} class ({section?.name ?? task.sectionId})
                  </h4>
                  <p className="text-xs text-stone-600 dark:text-zinc-400 mt-1 leading-relaxed">
                    The {task.cancelledDay} {slotLabel(task.cancelledTimeSlot)} class was cancelled.
                  </p>
                </div>

                {option ? (
                  <>
                    <div className="bg-white dark:bg-zinc-950 border border-[#E5E2D9] dark:border-zinc-800 rounded-lg p-3 space-y-1.5 text-xs shadow-2xs">
                      <div className="flex items-center justify-between">
                        <span className="text-stone-500 dark:text-zinc-400 font-medium">Suggested time:</span>
                        <span className="font-semibold text-emerald-700 dark:text-emerald-400">{option.matchScore}% match</span>
                      </div>
                      <div className="font-bold text-stone-900 dark:text-zinc-100">
                        {option.targetDay} {slotLabel(option.timeSlotId)} ({rooms.find(r => r.id === option.roomId)?.name ?? option.roomId})
                      </div>
                      <p className="text-[11px] text-stone-500 dark:text-zinc-400 leading-relaxed">{option.rationale}</p>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => runBusy(`accept:${option.id}`, () => scheduleMakeup(option.id))}
                        disabled={busy !== null}
                        className="flex-1 py-2 bg-[#8C1B2E] hover:bg-[#721525] active:bg-[#5a111e] text-white rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 shadow-2xs disabled:opacity-50"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        <span>{busy === `accept:${option.id}` ? 'Confirming…' : 'Confirm this time'}</span>
                      </button>

                      <button
                        onClick={() => setOppToDecline(option.id)}
                        disabled={busy !== null}
                        className="px-3.5 py-2 bg-white dark:bg-zinc-800 hover:bg-stone-50 dark:hover:bg-zinc-700 text-stone-700 dark:text-zinc-300 rounded-lg text-xs font-medium border border-[#E5E2D9] dark:border-zinc-700 transition-colors shadow-2xs disabled:opacity-50"
                      >
                        Decline
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-stone-600 dark:text-zinc-400 leading-relaxed">
                    No suggested times are left for this class. Ask the coordinator to schedule the make-up.
                  </p>
                )}
              </div>
            );
          })}

          {/* Extra classes the teacher can add for themselves */}
          {canClaim && (
            <div className="bg-[#FAF9F5] dark:bg-zinc-900 border border-[#E5E2D9] dark:border-zinc-800 rounded-xl p-4 space-y-3 text-xs shadow-xs">
              <div className="border-b border-[#E5E2D9] dark:border-zinc-800 pb-2">
                <h4 className="font-bold font-serif text-stone-900 dark:text-zinc-100 text-xs">
                  Extra classes you can add (optional)
                </h4>
                <p className="text-[11px] text-stone-500 dark:text-zinc-400 mt-0.5">
                  Available makeup slots where you, your group and a room are all available.
                </p>
              </div>

              <div className="space-y-2.5">
                {takeOverOptions.length === 0 && (
                  <p className="text-[11px] text-stone-500 dark:text-zinc-400">No available makeup slots found for your groups.</p>
                )}
                {takeOverOptions.map(o => (
                  <div key={o.key} className="p-3 bg-white dark:bg-zinc-950/60 border border-[#E5E2D9] dark:border-zinc-800 rounded-lg flex items-center justify-between gap-2 shadow-2xs">
                    <div>
                      <div className="font-bold text-stone-900 dark:text-zinc-100">{o.course.code} Tutorial ({o.section.name})</div>
                      <div className="text-[11px] text-stone-500 dark:text-zinc-400 mt-0.5">{o.day} {o.slot.label} · {o.room.name}</div>
                    </div>

                    <button
                      onClick={() => runBusy(`claim:${o.key}`, () => claimMarketplaceSlot(o.course.id, o.section.id, o.day, o.slot.id, o.room.id, 'Tutorial'))}
                      disabled={busy !== null}
                      className="px-3 py-1.5 bg-[#8C1B2E] hover:bg-[#721525] text-white rounded-lg text-xs font-semibold transition-colors shrink-0 shadow-2xs disabled:opacity-50"
                    >
                      {busy === `claim:${o.key}` ? 'Adding…' : 'Take this class'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Decline Suggestion Modal */}
      {oppToDecline && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="decline-dialog-title" className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <h4 id="decline-dialog-title" className="text-base font-bold text-slate-900 dark:text-zinc-100">
              Decline this suggested class time?
            </h4>
            <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
              The next-best suggested time, if any, will be shown instead.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setOppToDecline(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
              >
                Go back
              </button>
              <button
                onClick={handleConfirmDecline}
                disabled={busy !== null}
                className="px-4 py-2 bg-red-700 hover:bg-red-800 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
              >
                {busy === 'decline' ? 'Declining…' : 'Decline suggestion'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Class Modal */}
      {sessionToCancel && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="cancel-dialog-title" className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <h4 id="cancel-dialog-title" className="text-base font-bold text-slate-900 dark:text-zinc-100">
              Cancel this class
            </h4>
            <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
              Students will be notified, and replacement class times will be suggested.
            </p>

            <div className="space-y-1.5">
              <label htmlFor="cancel-reason" className="text-xs font-semibold text-slate-700 dark:text-zinc-300">Why are you cancelling?</label>
              <input
                id="cancel-reason"
                type="text"
                placeholder="e.g. Medical leave, Official meeting"
                value={cancellationReason}
                onChange={e => setCancellationReason(e.target.value)}
                className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-800 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-red-600"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setSessionToCancel(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
              >
                Go back
              </button>
              <button
                onClick={handleExecuteCancel}
                disabled={busy !== null}
                className="px-4 py-2 bg-red-700 hover:bg-red-800 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
              >
                {busy === 'cancel' ? 'Cancelling…' : 'Yes, cancel class'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
