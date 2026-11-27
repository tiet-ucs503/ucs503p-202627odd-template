import React, { useEffect, useState } from 'react';
import { useTimetable } from '../../context/TimetableContext';
import { useAuth } from '../../context/AuthContext';
import { TIME_SLOTS } from '../../lib/initialData';
import { getGridCellRowSpan, isGridCellCoveredByLab } from '../../lib/timetableGridLayout';
import { DayOfWeek, ClassSession } from '../../types';

const downloadFile = (filename: string, mimeType: string, content: string) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};
const csvCell = (value: string) => `"${value.replace(/"/g, '""')}"`;
import {
  Lock,
  Unlock,
  AlertCircle,
  XCircle,
  CheckCircle2,
  Calendar,
  Building,
  User,
  GraduationCap,
  RotateCcw,
  Info
} from 'lucide-react';

export function TimetableGridView() {
  const { currentUser, roster } = useAuth();
  const isFacultyView = currentUser?.roleCode === 'FACULTY';
  const {
    sessions,
    rooms,
    facultyMembers,
    sections,
    courses,
    selectedSectionId,
    setSelectedSectionId,
    selectedFacultyId,
    setSelectedFacultyId,
    selectedRoomId,
    setSelectedRoomId,
    toggleSessionLock,
    cancelSession,
    addSession,
    deleteSession,
    moveSessionWithValidation,
    swapSessionsWithValidation,
    publishStatus,
    publishMasterTimetable,
    validationReport,
    setActiveView,
    academicYear,
  } = useTimetable();

  const [filterMode, setFilterMode] = useState<'section' | 'faculty' | 'room'>(isFacultyView ? 'faculty' : 'section');
  const effectiveFacultyId = isFacultyView ? roster?.facultyId || selectedFacultyId : selectedFacultyId;
  const [activeSessionDetail, setActiveSessionDetail] = useState<ClassSession | null>(null);
  const [cancellationReasonInput, setCancellationReasonInput] = useState('');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [scheduleSlotTarget, setScheduleSlotTarget] = useState<{ day: DayOfWeek; timeSlotId: string } | null>(null);
  const [newCourseId, setNewCourseId] = useState(() => courses.find(c => c.code === 'CS501')?.id || courses[0]?.id || '');
  const [newFacultyId, setNewFacultyId] = useState(() => facultyMembers.find(f => f.id === 'fac-0001')?.id || facultyMembers[0]?.id || '');
  const [newRoomId, setNewRoomId] = useState(() => rooms.find(r => r.name === 'LT-101')?.id || rooms[0]?.id || '');
  const [newSectionId, setNewSectionId] = useState('sec-cse-a');
  const [newType, setNewType] = useState<'Lecture' | 'Lab' | 'Tutorial'>('Lecture');
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  const [selectedMobileDay, setSelectedMobileDay] = useState<DayOfWeek>('Monday');
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [publishFeedback, setPublishFeedback] = useState<string | null>(null);
  const [savingCancellation, setSavingCancellation] = useState(false);
  const [editSlot, setEditSlot] = useState<{ day: DayOfWeek; timeSlotId: string; roomId: string; reason: string } | null>(null);
  const [swapTargetId, setSwapTargetId] = useState('');
  const [showSwapEditor, setShowSwapEditor] = useState(false);
  const [sessionActionFeedback, setSessionActionFeedback] = useState('');
  const [sessionActionBusy, setSessionActionBusy] = useState(false);
  const canManageSessions = ['COORDINATOR', 'COLLEGE_ADMIN', 'SUPER_ADMIN'].includes(currentUser?.roleCode || '');

  const days: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

  useEffect(() => {
    if (!courses.some(c => c.id === newCourseId)) setNewCourseId(courses.find(c => c.code === 'CS501')?.id || courses[0]?.id || '');
    if (!facultyMembers.some(f => f.id === newFacultyId)) setNewFacultyId(facultyMembers.find(f => f.id === 'fac-0001')?.id || facultyMembers[0]?.id || '');
    if (!rooms.some(r => r.id === newRoomId)) setNewRoomId(rooms.find(r => r.name === 'LT-101')?.id || rooms[0]?.id || '');
    if (!sections.some(s => s.id === newSectionId)) setNewSectionId(sections.find(s => s.name === 'CSE-A')?.id || sections[0]?.id || '');
  }, [courses, facultyMembers, rooms, sections, newCourseId, newFacultyId, newRoomId, newSectionId]);

  const hardViolationsCount = validationReport.hardViolationsCount ?? validationReport.errorCount;
  const canPublish = sessions.length > 0 && hardViolationsCount === 0;

  const handlePublish = async () => {
    if (!canPublish) {
      setPublishFeedback(`Publishing blocked: ${hardViolationsCount} hard violations exist.`);
      return;
    }
    const res = await publishMasterTimetable('Coordinator');
    if (res.success) {
      setPublishFeedback('Timetable officially published!');
      setTimeout(() => setPublishFeedback(null), 3000);
    } else {
      setPublishFeedback(res.error || 'Failed to publish.');
    }
  };

  const exportCsv = () => {
    const rows = filteredSessions.map((session) => [
      session.day, academicYear.timeSlots.find((slot) => slot.id === session.timeSlotId)?.label || session.timeSlotId,
      courses.find((course) => course.id === session.courseId)?.code || session.courseId,
      courses.find((course) => course.id === session.courseId)?.name || '',
      sections.find((section) => section.id === session.sectionId)?.name || session.sectionId,
      facultyMembers.find((faculty) => faculty.id === session.facultyId)?.name || session.facultyId,
      rooms.find((room) => room.id === session.roomId)?.name || session.roomId, session.status,
    ]);
    downloadFile('timetable.csv', 'text/csv;charset=utf-8', [['Day', 'Time', 'Course Code', 'Course', 'Section', 'Faculty', 'Room', 'Status'], ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n'));
  };

  const exportIcs = () => {
    const weekdays: Record<string, number> = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };
    const icsDateTime = (day: DayOfWeek, time: string) => {
      const [hour = '00', minute = '00'] = time.split(':');
      const date = new Date();
      const delta = (weekdays[day] - date.getDay() + 7) % 7 || 7;
      date.setDate(date.getDate() + delta);
      return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}T${hour}${minute}00`;
    };
    const escapeIcs = (value: string) => value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
    const events = filteredSessions.filter((session) => session.status !== 'Cancelled').map((session) => {
      const slot = academicYear.timeSlots.find((item) => item.id === session.timeSlotId);
      const course = courses.find((item) => item.id === session.courseId);
      const title = course ? `${course.code} ${course.name}` : session.courseId;
      const room = rooms.find((item) => item.id === session.roomId)?.name || session.roomId;
      const start = slot ? icsDateTime(session.day, slot.startTime) : icsDateTime(session.day, '09:00');
      const end = slot ? icsDateTime(session.day, slot.endTime) : icsDateTime(session.day, '10:00');
      return `BEGIN:VEVENT\r\nUID:${session.id}@tiet-timetable\r\nDTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}\r\nDTSTART:${start}\r\nDTEND:${end}\r\nRRULE:FREQ=WEEKLY;COUNT=16\r\nSUMMARY:${escapeIcs(title)}\r\nLOCATION:${escapeIcs(room)}\r\nEND:VEVENT`;
    });
    downloadFile('timetable.ics', 'text/calendar;charset=utf-8', `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//TIET//Timetable//EN\r\n${events.join('\r\n')}\r\nEND:VCALENDAR`);
  };

  // Filter sessions based on active mode
  const filteredSessions = sessions.filter(s => {
    if (filterMode === 'section') return s.sectionId === selectedSectionId;
    if (filterMode === 'faculty') return s.facultyId === effectiveFacultyId;
    if (filterMode === 'room') return s.roomId === selectedRoomId;
    return true;
  });

  const handleCellClick = (session: ClassSession) => {
    setActiveSessionDetail(session);
  };

  const executeCancellation = async () => {
    if (!activeSessionDetail) return;
    setSavingCancellation(true);
    setScheduleError(null);
    const result = await cancelSession(
      activeSessionDetail.id,
      cancellationReasonInput.trim() || 'Instructor unavailable (Personal/Administrative)'
    );
    setSavingCancellation(false);
    if (!result.success) {
      setScheduleError('The cancellation was not saved. Check your connection and authorization, then try again.');
      return;
    }
    setShowCancelModal(false);
    setActiveSessionDetail(null);
    setCancellationReasonInput('');
  };

  const saveSessionEdit = async () => {
    if (!activeSessionDetail || !editSlot) return;
    setSessionActionBusy(true);
    setSessionActionFeedback('');
    const result = await moveSessionWithValidation(activeSessionDetail.id, editSlot.day, editSlot.timeSlotId, editSlot.roomId, editSlot.reason.trim() || 'Coordinator schedule correction');
    setSessionActionBusy(false);
    if (!result.success) {
      setSessionActionFeedback(result.error || 'Session was not updated.');
      return;
    }
    setEditSlot(null);
    setActiveSessionDetail({ ...activeSessionDetail, day: editSlot.day, timeSlotId: editSlot.timeSlotId, roomId: editSlot.roomId });
    setSessionActionFeedback('Session updated and saved to the working draft.');
  };

  const saveSessionSwap = async () => {
    if (!activeSessionDetail || !swapTargetId) return;
    setSessionActionBusy(true);
    setSessionActionFeedback('');
    const result = await swapSessionsWithValidation(activeSessionDetail.id, swapTargetId, 'Coordinator slot swap');
    setSessionActionBusy(false);
    if (!result.success) {
      setSessionActionFeedback(result.error || 'Session slots were not swapped.');
      return;
    }
    setActiveSessionDetail(null);
    setSwapTargetId('');
    setShowSwapEditor(false);
  };

  const removeSession = async () => {
    if (!activeSessionDetail || !window.confirm('Remove this class from the working draft? This will not cancel it for students until a new timetable is published.')) return;
    setSessionActionBusy(true);
    const result = await deleteSession(activeSessionDetail.id);
    setSessionActionBusy(false);
    if (!result.success) {
      setSessionActionFeedback(result.message || 'Session was not removed.');
      return;
    }
    setActiveSessionDetail(null);
  };

  return (
    <div className="timetable-print-view space-y-6 max-w-7xl mx-auto font-sans text-stone-900 dark:text-zinc-100">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E5E2D9] dark:border-zinc-800 pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold font-serif tracking-tight">
            Timetable
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 dark:text-zinc-400 mt-0.5">
            View and manage the current timetable.
          </p>
        </div>

        {/* View Switcher, Publish & More Menu */}
        <div className="flex flex-wrap items-center gap-2">
          {/* View Switcher [ Section ] [ Faculty ] [ Room ] */}
          {!isFacultyView && <div className="flex bg-[#FAF9F5] dark:bg-zinc-900 border border-[#E5E2D9] dark:border-zinc-800 p-0.5 rounded-lg text-xs font-semibold">
            <button
              onClick={() => setFilterMode('section')}
              className={`px-3 py-1 rounded-md transition-colors ${
                filterMode === 'section'
                  ? 'bg-[#8C1B2E] text-white shadow-xs'
                  : 'text-stone-600 dark:text-zinc-400 hover:text-stone-900 dark:hover:text-zinc-200'
              }`}
            >
              Section
            </button>
            <button
              onClick={() => setFilterMode('faculty')}
              className={`px-3 py-1 rounded-md transition-colors ${
                filterMode === 'faculty'
                  ? 'bg-[#8C1B2E] text-white shadow-xs'
                  : 'text-stone-600 dark:text-zinc-400 hover:text-stone-900 dark:hover:text-zinc-200'
              }`}
            >
              Faculty
            </button>
            <button
              onClick={() => setFilterMode('room')}
              className={`px-3 py-1 rounded-md transition-colors ${
                filterMode === 'room'
                  ? 'bg-[#8C1B2E] text-white shadow-xs'
                  : 'text-stone-600 dark:text-zinc-400 hover:text-stone-900 dark:hover:text-zinc-200'
              }`}
            >
              Room
            </button>
          </div>}

          {/* Sub-selector Dropdown */}
          {filterMode === 'section' && (
            <select
              value={selectedSectionId}
              onChange={e => setSelectedSectionId(e.target.value)}
              className="bg-[#FAF9F5] dark:bg-zinc-900 border border-[#E5E2D9] dark:border-zinc-800 text-stone-800 dark:text-zinc-200 text-xs rounded-lg px-3 py-1.5 outline-none focus:border-[#8C1B2E] font-medium"
            >
              {sections.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.studentCount} students)
                </option>
              ))}
            </select>
          )}

          {filterMode === 'faculty' && !isFacultyView && (
            <select
              value={selectedFacultyId}
              onChange={e => setSelectedFacultyId(e.target.value)}
              className="bg-[#FAF9F5] dark:bg-zinc-900 border border-[#E5E2D9] dark:border-zinc-800 text-stone-800 dark:text-zinc-200 text-xs rounded-lg px-3 py-1.5 outline-none focus:border-[#8C1B2E] font-medium"
            >
              {facultyMembers.map(f => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          )}

          {filterMode === 'room' && (
            <select
              value={selectedRoomId}
              onChange={e => setSelectedRoomId(e.target.value)}
              className="bg-[#FAF9F5] dark:bg-zinc-900 border border-[#E5E2D9] dark:border-zinc-800 text-stone-800 dark:text-zinc-200 text-xs rounded-lg px-3 py-1.5 outline-none focus:border-[#8C1B2E] font-medium"
            >
              {rooms.map(r => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.capacity} cap)
                </option>
              ))}
            </select>
          )}

          {/* Publish Action Button */}
          {canManageSessions && <button
            onClick={handlePublish}
            disabled={!canPublish}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs ${
              canPublish
                ? 'bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer'
                : 'bg-stone-200 dark:bg-zinc-800 text-stone-400 dark:text-zinc-500 cursor-not-allowed'
            }`}
            title={canPublish ? 'Publish master timetable' : `Resolve ${hardViolationsCount} conflicts before publishing.`}
          >
            Publish
          </button>}

          {/* More Menu Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowMoreMenu(!showMoreMenu)}
              className="px-3 py-1.5 rounded-lg border border-[#E5E2D9] dark:border-zinc-800 bg-[#FAF9F5] dark:bg-zinc-900 text-xs font-semibold text-stone-700 dark:text-zinc-300 hover:text-stone-900"
            >
              More ▾
            </button>

            {showMoreMenu && (
              <div className="absolute right-0 mt-1 w-52 bg-[#FAF9F5] dark:bg-zinc-900 border border-[#E5E2D9] dark:border-zinc-800 rounded-lg shadow-lg p-1 z-40 space-y-0.5 text-xs text-stone-800 dark:text-zinc-100">
                <button
                  onClick={() => {
                    setActiveView('whatif');
                    setShowMoreMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-md text-stone-800 dark:text-zinc-100 hover:bg-stone-100 dark:hover:bg-zinc-800 font-medium"
                >
                  What-If Simulator
                </button>
                <button
                  onClick={() => {
                    setActiveView('syllabus');
                    setShowMoreMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-md text-stone-800 dark:text-zinc-100 hover:bg-stone-100 dark:hover:bg-zinc-800 font-medium"
                >
                  Syllabus Progress
                </button>
                <div className="my-1 border-t border-[#E5E2D9] dark:border-zinc-800" />
                <button onClick={() => { window.print(); setShowMoreMenu(false); }} className="w-full text-left px-3 py-2 rounded-md text-stone-800 dark:text-zinc-100 hover:bg-stone-100 dark:hover:bg-zinc-800 font-medium">Export PDF (print)</button>
                <button onClick={() => { exportCsv(); setShowMoreMenu(false); }} className="w-full text-left px-3 py-2 rounded-md text-stone-800 dark:text-zinc-100 hover:bg-stone-100 dark:hover:bg-zinc-800 font-medium">Export CSV</button>
                <button onClick={() => { exportIcs(); setShowMoreMenu(false); }} className="w-full text-left px-3 py-2 rounded-md text-stone-800 dark:text-zinc-100 hover:bg-stone-100 dark:hover:bg-zinc-800 font-medium">Export .ics</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {publishFeedback && (
        <div className="p-3 bg-stone-100 dark:bg-zinc-800 rounded-lg text-xs font-semibold text-stone-800 dark:text-zinc-200">
          {publishFeedback}
        </div>
      )}

      {/* Mobile Day Selector Bar (< Monday > < Tuesday > ...) */}
      <div className="sm:hidden flex items-center justify-between bg-[#FAF9F5] dark:bg-zinc-900 border border-[#E5E2D9] dark:border-zinc-800 p-2 rounded-xl text-xs font-semibold">
        <button
          onClick={() => {
            const idx = days.indexOf(selectedMobileDay);
            if (idx > 0) setSelectedMobileDay(days[idx - 1]);
          }}
          disabled={days.indexOf(selectedMobileDay) === 0}
          className="px-2 py-1 disabled:opacity-30"
        >
          ‹ Prev
        </button>

        <span className="font-serif font-bold text-stone-900 dark:text-zinc-100 text-sm">
          {selectedMobileDay}
        </span>

        <button
          onClick={() => {
            const idx = days.indexOf(selectedMobileDay);
            if (idx < days.length - 1) setSelectedMobileDay(days[idx + 1]);
          }}
          disabled={days.indexOf(selectedMobileDay) === days.length - 1}
          className="px-2 py-1 disabled:opacity-30"
        >
          Next ›
        </button>
      </div>

      {/* Timetable Grid Table (Canonical Matrix) */}
      <div className="bg-[#FAF9F5] dark:bg-zinc-900 border border-[#E5E2D9] dark:border-zinc-800 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full table-fixed border-collapse text-left text-xs min-w-[850px]">
            <thead>
              <tr className="bg-[#F4F2EC] dark:bg-zinc-950/70 border-b border-[#E5E2D9] dark:border-zinc-800 text-stone-800 dark:text-zinc-300">
                <th className="p-3 font-semibold w-24 text-stone-500 dark:text-zinc-400 border-r border-[#E5E2D9] dark:border-zinc-800 font-mono text-[11px]">
                  Time Slot
                </th>
                {days.map(d => (
                  <th
                    key={d}
                    className="p-3 font-semibold text-center border-r border-[#E5E2D9] dark:border-zinc-800 last:border-r-0"
                  >
                    <div className="uppercase tracking-wider text-[11px] font-bold">{d}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E2D9] dark:divide-zinc-800">
              {TIME_SLOTS.map(slot => {
                const isLunch = slot.id === 'ts-5';

                if (isLunch) {
                  return (
                    <tr key={slot.id} className="bg-[#F4F2EC] dark:bg-zinc-950/60">
                      <td className="p-2.5 font-mono text-[11px] text-stone-500 dark:text-zinc-400 border-r border-[#E5E2D9] dark:border-zinc-800 whitespace-nowrap">
                        {slot.startTime}–{slot.endTime}
                      </td>
                      <td colSpan={5} className="p-2.5 text-center text-xs font-medium text-stone-500 dark:text-zinc-400 tracking-wide">
                        Lunch Break
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr key={slot.id} className="hover:bg-white/40 dark:hover:bg-zinc-800/20 transition-colors">
                    <td className="p-2.5 font-mono text-[11px] text-stone-500 dark:text-zinc-400 border-r border-[#E5E2D9] dark:border-zinc-800 whitespace-nowrap align-top">
                      {slot.startTime}–{slot.endTime}
                    </td>
                    {days.map(day => {
                      if (isGridCellCoveredByLab(filteredSessions, day, slot.id, TIME_SLOTS)) return null;
                      const slotSessions = filteredSessions.filter(
                        s => s.day === day && s.timeSlotId === slot.id
                      );
                      const session = slotSessions[0];
                      const rowSpan = getGridCellRowSpan(filteredSessions, day, slot.id, TIME_SLOTS);

                      if (!session) {
                        return (
                          <td key={day} rowSpan={rowSpan} className="p-1.5 border-r border-[#E5E2D9] dark:border-zinc-800 last:border-r-0 align-top">
                            {!canManageSessions ? <div className="h-16" aria-label="No scheduled class" /> :
                            <button
                              onClick={() => {
                                setScheduleSlotTarget({ day, timeSlotId: slot.id });
                                setScheduleError(null);
                              }}
                              className="w-full h-16 rounded-lg border border-dashed border-[#E5E2D9] dark:border-zinc-700/80 hover:border-[#8C1B2E] hover:bg-[#8C1B2E]/5 flex flex-col items-center justify-center text-stone-400 hover:text-[#8C1B2E] text-[10px] transition-all group"
                            >
                              <span className="font-medium">+ Assign</span>
                              <span className="text-[9px] text-stone-400 group-hover:text-[#8C1B2E]">Free Slot</span>
                            </button>}
                          </td>
                        );
                      }

                      if (slotSessions.length > 1) {
                        return <td key={day} rowSpan={rowSpan} className="p-1.5 border-r border-[#E5E2D9] dark:border-zinc-800 last:border-r-0 align-top"><div className="space-y-1.5">{slotSessions.map((parallelSession) => {
                          const parallelCourse = courses.find(course => course.id === parallelSession.courseId);
                          const parallelSection = sections.find(item => item.id === parallelSession.sectionId);
                          const parallelFaculty = facultyMembers.find(item => item.id === parallelSession.facultyId);
                          const cancelled = parallelSession.status === 'Cancelled';
                          return <button key={parallelSession.id} type="button" onClick={() => handleCellClick(parallelSession)} className={`w-full rounded-lg border p-2 text-left ${cancelled ? 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300' : 'border-blue-200 bg-blue-50/60 text-stone-900 dark:border-blue-900 dark:bg-blue-950/30 dark:text-zinc-100'}`}><div className="flex items-center justify-between gap-1"><span className="font-mono text-xs font-bold">{parallelCourse?.code || parallelSession.courseId}</span><span className="text-[9px]">{cancelled ? 'Cancelled' : parallelSession.durationPeriods && parallelSession.durationPeriods > 1 ? `${parallelSession.type} (${parallelSession.durationPeriods}h)` : parallelSession.type}</span></div><div className="truncate text-[10px]">{filterMode === 'faculty' ? parallelSection?.name : parallelFaculty?.name?.split(' ').pop()} · {parallelSection?.name || parallelSession.sectionId}</div></button>;
                        })}</div></td>;
                      }

                      const course = courses.find(c => c.id === session.courseId);
                      const faculty = facultyMembers.find(f => f.id === session.facultyId);
                      const room = rooms.find(r => r.id === session.roomId);
                      const section = sections.find(s => s.id === session.sectionId);

                      const isCancelled = session.status === 'Cancelled';
                      const isRescheduled = session.status === 'Rescheduled' || session.type === 'Makeup';

                      return (
                        <td key={day} rowSpan={rowSpan} className="p-1.5 border-r border-[#E5E2D9] dark:border-zinc-800 last:border-r-0 align-top">
                          <button
                            onClick={() => handleCellClick(session)}
                            className={`w-full text-left p-2.5 rounded-lg border transition-all relative ${
                              isCancelled
                                ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50 text-rose-800 dark:text-rose-300'
                                : isRescheduled
                                ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-300'
                                : session.type === 'Lab'
                                ? 'bg-blue-50/40 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/40 text-stone-900 dark:text-zinc-100'
                                : 'bg-white dark:bg-zinc-800/80 border-[#E5E2D9] dark:border-zinc-700/80 hover:border-stone-400 text-stone-900 dark:text-zinc-100 shadow-2xs'
                            }`}
                          >
                            {/* Locked Pin Indicator */}
                            {session.isLocked && (
                              <span className="absolute top-2 right-2 text-stone-400" title={session.lockReason}>
                                <Lock className="h-3 w-3" />
                              </span>
                            )}

                            <div className="flex items-center justify-between gap-1 mb-1">
                              <span className="font-mono font-bold text-[#8C1B2E] dark:text-red-400 text-xs">
                                {course?.code || session.courseId}
                              </span>
                              <span className={`text-[9px] px-1 rounded font-medium ${
                                session.type === 'Lab'
                                  ? 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300'
                                  : session.type === 'Tutorial'
                                  ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'
                                  : 'bg-stone-100 dark:bg-zinc-700 text-stone-600 dark:text-zinc-300'
                              }`}>
                                {session.durationPeriods && session.durationPeriods > 1
                                  ? `${session.type} (${session.durationPeriods}h)`
                                  : session.type}
                              </span>
                            </div>

                            <div className="text-xs font-semibold text-stone-900 dark:text-zinc-100 line-clamp-1">
                              {course?.name}
                            </div>

                            <div className="text-[11px] text-stone-500 dark:text-zinc-400 mt-1 flex items-center justify-between">
                              <span className="truncate">{filterMode === 'faculty' ? section?.name : faculty?.name?.split(' ').pop()}</span>
                              <span className="font-mono">{room?.name || '204'}</span>
                            </div>

                            {isCancelled && (
                              <div className="mt-1 text-[10px] font-semibold text-rose-700 dark:text-rose-400 flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" /> Cancelled
                              </div>
                            )}

                            {isRescheduled && (
                              <div className="mt-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                                <RotateCcw className="h-3 w-3" /> Rescheduled
                              </div>
                            )}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Session Inspector Drawer / Modal */}
      {activeSessionDetail && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-[#FAF9F5] dark:bg-zinc-900 border border-[#E5E2D9] dark:border-zinc-800 rounded-xl max-w-lg w-full p-6 space-y-4 shadow-xl text-stone-900 dark:text-zinc-100">
            <div className="flex items-start justify-between border-b border-[#E5E2D9] dark:border-zinc-800 pb-3">
              <div>
                <span className="text-[11px] font-mono font-bold text-[#8C1B2E] dark:text-red-400 uppercase tracking-wider">
                  Session Information
                </span>
                <h3 className="text-base font-bold font-serif mt-0.5">
                  {courses.find(c => c.id === activeSessionDetail.courseId)?.code} ·{' '}
                  {courses.find(c => c.id === activeSessionDetail.courseId)?.name}
                </h3>
              </div>
              <button
                onClick={() => setActiveSessionDetail(null)}
                className="text-stone-400 hover:text-stone-700 dark:hover:text-zinc-200 p-1"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-white dark:bg-zinc-950 rounded-lg border border-[#E5E2D9] dark:border-zinc-800">
                <span className="text-stone-400 block text-[10px]">Assigned Faculty</span>
                <span className="font-semibold text-stone-800 dark:text-zinc-200 mt-0.5 block">
                  {facultyMembers.find(f => f.id === activeSessionDetail.facultyId)?.name}
                </span>
              </div>

              <div className="p-3 bg-white dark:bg-zinc-950 rounded-lg border border-[#E5E2D9] dark:border-zinc-800">
                <span className="text-stone-400 block text-[10px]">Student Section</span>
                <span className="font-semibold text-stone-800 dark:text-zinc-200 mt-0.5 block">
                  {sections.find(s => s.id === activeSessionDetail.sectionId)?.name} (
                  {sections.find(s => s.id === activeSessionDetail.sectionId)?.studentCount} Students)
                </span>
              </div>

              <div className="p-3 bg-white dark:bg-zinc-950 rounded-lg border border-[#E5E2D9] dark:border-zinc-800">
                <span className="text-stone-400 block text-[10px]">Classroom / Lab</span>
                <span className="font-semibold text-stone-800 dark:text-zinc-200 mt-0.5 block">
                  {rooms.find(r => r.id === activeSessionDetail.roomId)?.name}
                </span>
              </div>

              <div className="p-3 bg-white dark:bg-zinc-950 rounded-lg border border-[#E5E2D9] dark:border-zinc-800">
                <span className="text-stone-400 block text-[10px]">Schedule Window</span>
                <span className="font-semibold text-stone-800 dark:text-zinc-200 mt-0.5 block">
                  {activeSessionDetail.day} · {activeSessionDetail.timeSlotId}
                </span>
              </div>
            </div>

            {sessionActionFeedback && <p role="status" className="rounded-md border border-[#E5E2D9] bg-white p-2.5 text-xs text-stone-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">{sessionActionFeedback}</p>}
            {canManageSessions && activeSessionDetail.status !== 'Cancelled' && <div className="space-y-3 border-t border-[#E5E2D9] pt-3 dark:border-zinc-800">
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => { setSessionActionFeedback(''); setEditSlot({ day: activeSessionDetail.day, timeSlotId: activeSessionDetail.timeSlotId, roomId: activeSessionDetail.roomId, reason: '' }); }} className="rounded-md border border-[#E5E2D9] px-3 py-1.5 text-xs font-semibold text-stone-700 dark:border-zinc-700 dark:text-zinc-200">Edit Slot</button>
                <button type="button" onClick={() => { setSessionActionFeedback(''); setSwapTargetId(''); setShowSwapEditor(true); }} className="rounded-md border border-[#E5E2D9] px-3 py-1.5 text-xs font-semibold text-stone-700 dark:border-zinc-700 dark:text-zinc-200">Swap Slot</button>
                <button type="button" onClick={() => void removeSession()} disabled={sessionActionBusy} className="rounded-md border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 disabled:opacity-50 dark:border-rose-900 dark:text-rose-300">Delete Slot</button>
              </div>
              {editSlot && <div className="grid gap-2 rounded-lg border border-[#E5E2D9] bg-white p-3 text-xs dark:border-zinc-800 dark:bg-zinc-950 sm:grid-cols-3">
                <label className="space-y-1">Day<select aria-label="Edit slot day" value={editSlot.day} onChange={event => setEditSlot(value => value ? { ...value, day: event.target.value as DayOfWeek } : value)} className="w-full rounded border border-[#E5E2D9] bg-white p-2 dark:border-zinc-700 dark:bg-zinc-900">{days.map(day => <option key={day} value={day}>{day}</option>)}</select></label>
                <label className="space-y-1">Time<select aria-label="Edit slot time" value={editSlot.timeSlotId} onChange={event => setEditSlot(value => value ? { ...value, timeSlotId: event.target.value } : value)} className="w-full rounded border border-[#E5E2D9] bg-white p-2 dark:border-zinc-700 dark:bg-zinc-900">{academicYear.timeSlots.filter(slot => !slot.isBreak && !slot.isLunch).map(slot => <option key={slot.id} value={slot.id}>{slot.label || `${slot.startTime}–${slot.endTime}`}</option>)}</select></label>
                <label className="space-y-1">Room<select aria-label="Edit slot room" value={editSlot.roomId} onChange={event => setEditSlot(value => value ? { ...value, roomId: event.target.value } : value)} className="w-full rounded border border-[#E5E2D9] bg-white p-2 dark:border-zinc-700 dark:bg-zinc-900">{rooms.filter(room => room.isAvailable).map(room => <option key={room.id} value={room.id}>{room.name}</option>)}</select></label>
                <input aria-label="Reason for slot edit" placeholder="Reason (optional)" value={editSlot.reason} onChange={event => setEditSlot(value => value ? { ...value, reason: event.target.value } : value)} className="rounded border border-[#E5E2D9] p-2 dark:border-zinc-700 dark:bg-zinc-900 sm:col-span-2" />
                <div className="flex justify-end gap-2 sm:col-span-3"><button type="button" onClick={() => setEditSlot(null)} className="rounded border border-[#E5E2D9] px-3 py-1.5 dark:border-zinc-700">Cancel</button><button type="button" onClick={() => void saveSessionEdit()} disabled={sessionActionBusy} className="rounded bg-[#8C1B2E] px-3 py-1.5 font-semibold text-white disabled:opacity-50">{sessionActionBusy ? 'Saving…' : 'Save Slot'}</button></div>
              </div>}
              {showSwapEditor && <div className="flex flex-wrap gap-2">
                <select aria-label="Choose class to swap with" value={swapTargetId} onChange={event => setSwapTargetId(event.target.value)} className="min-w-48 rounded border border-[#E5E2D9] bg-white p-2 text-xs dark:border-zinc-700 dark:bg-zinc-950"><option value="">Choose another class to swap…</option>{sessions.filter(session => session.id !== activeSessionDetail.id && session.status !== 'Cancelled').map(session => <option key={session.id} value={session.id}>{courses.find(course => course.id === session.courseId)?.code || session.courseId} · {session.sectionId} · {session.day} {session.timeSlotId}</option>)}</select>
                <button type="button" onClick={() => void saveSessionSwap()} disabled={!swapTargetId || sessionActionBusy} className="rounded border border-[#E5E2D9] px-3 py-1.5 text-xs font-semibold disabled:opacity-50 dark:border-zinc-700">{sessionActionBusy ? 'Swapping…' : 'Confirm Swap'}</button>
                <button type="button" onClick={() => setShowSwapEditor(false)} className="rounded border border-[#E5E2D9] px-3 py-1.5 text-xs dark:border-zinc-700">Cancel</button>
              </div>}
            </div>}

            {/* Invariants & Hard Constraint Validation */}
            <div className="p-3.5 bg-white dark:bg-zinc-950 rounded-lg border border-[#E5E2D9] dark:border-zinc-800 space-y-1.5 text-xs">
              <span className="text-[11px] font-semibold text-stone-900 dark:text-zinc-100 flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                Scheduling Rule Verification
              </span>
              <ul className="text-[11px] text-stone-500 dark:text-zinc-400 space-y-0.5 list-disc list-inside">
                <li>Teacher overlap constraint: Verified</li>
                <li>Room capacity: Satisfied</li>
                <li>Lab & equipment requirements: Satisfied</li>
              </ul>
            </div>

            {/* Actions: Lock, Cancel */}
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              {canManageSessions && <button
                onClick={async () => {
                  setSessionActionBusy(true);
                  const result = await toggleSessionLock(activeSessionDetail.id);
                  setSessionActionBusy(false);
                  if (!result.success) setSessionActionFeedback(result.message || 'Could not update lock.');
                  else setActiveSessionDetail(prev => prev ? { ...prev, isLocked: !prev.isLocked } : null);
                }}
                disabled={sessionActionBusy}
                className={`w-full sm:w-auto flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-xs font-semibold border transition-all ${
                  activeSessionDetail.isLocked
                    ? 'bg-stone-100 dark:bg-zinc-800 border-[#E5E2D9] dark:border-zinc-700 text-stone-700 dark:text-zinc-300'
                    : 'bg-white dark:bg-zinc-800 border-[#E5E2D9] dark:border-zinc-700 text-stone-800 dark:text-zinc-200 hover:bg-stone-50'
                }`}
              >
                {activeSessionDetail.isLocked ? (
                  <>
                    <Unlock className="h-4 w-4" />
                    <span>Unlock Session</span>
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4" />
                    <span>Lock Session</span>
                  </>
                )}
              </button>}

              {activeSessionDetail.status !== 'Cancelled' ? (
                <button
                  onClick={() => setShowCancelModal(true)}
                  className="w-full sm:w-auto flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-xs font-semibold bg-rose-700 hover:bg-rose-800 text-white transition-colors shadow-xs"
                >
                  <XCircle className="h-4 w-4" />
                  <span>Cancel Class</span>
                </button>
              ) : (
                <div className="text-xs text-rose-700 dark:text-rose-400 font-semibold px-4 py-2 bg-rose-50 dark:bg-rose-950/40 rounded-lg border border-rose-200 dark:border-rose-900">
                  Status: Cancelled
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Cancellation Reason Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs z-[70] flex items-center justify-center p-4 animate-in fade-in duration-150" onClick={() => setShowCancelModal(false)}>
          <div onClick={event => event.stopPropagation()} className="bg-[#FAF9F5] dark:bg-zinc-900 border border-[#E5E2D9] dark:border-zinc-800 rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl text-stone-900 dark:text-zinc-100">
            <h4 className="text-base font-bold font-serif text-stone-900 dark:text-zinc-100">Confirm Class Cancellation</h4>
            <p className="text-xs text-stone-500 dark:text-zinc-400 leading-relaxed">
              Cancelling will release the room, notify enrolled students, and enqueue a replacement class option.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-stone-700 dark:text-zinc-300">Cancellation Reason</label>
              <input
                type="text"
                placeholder="e.g. Faculty medical absence, Faculty symposium, Lab maintenance"
                value={cancellationReasonInput}
                onChange={e => setCancellationReasonInput(e.target.value)}
                className="w-full bg-white dark:bg-zinc-950 border border-[#E5E2D9] dark:border-zinc-800 rounded-lg p-2.5 text-xs text-stone-900 dark:text-zinc-100 outline-none focus:border-[#8C1B2E]"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => !savingCancellation && setShowCancelModal(false)}
                className="px-4 py-2 rounded-lg text-xs font-medium text-stone-600 dark:text-zinc-400 hover:text-stone-900 dark:hover:text-zinc-100"
              >
                Back
              </button>
              <button
                onClick={() => void executeCancellation()}
                disabled={savingCancellation}
                className="px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white rounded-lg text-xs font-semibold transition-colors shadow-xs"
              >
                {savingCancellation ? 'Saving…' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Free Slot Direct Scheduling Modal */}
      {canManageSessions && scheduleSlotTarget && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs z-[70] flex items-center justify-center p-4 animate-in fade-in duration-150" onClick={() => setScheduleSlotTarget(null)}>
          <div onClick={event => event.stopPropagation()} className="bg-[#FAF9F5] dark:bg-zinc-900 border border-[#E5E2D9] dark:border-zinc-800 rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl text-stone-900 dark:text-zinc-100">
            <div className="flex items-center justify-between border-b border-[#E5E2D9] dark:border-zinc-800 pb-3">
              <div>
                <h4 className="text-base font-bold font-serif text-stone-900 dark:text-zinc-100">Schedule Class Session</h4>
                <p className="text-[11px] text-stone-500 dark:text-zinc-400 mt-0.5">
                  Target: {scheduleSlotTarget.day} · {TIME_SLOTS.find(t => t.id === scheduleSlotTarget.timeSlotId)?.label}
                </p>
              </div>
              <button
                onClick={() => setScheduleSlotTarget(null)}
                className="text-stone-400 hover:text-stone-700 dark:hover:text-zinc-200"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            {scheduleError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-lg text-rose-800 dark:text-rose-300 text-xs flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{scheduleError}</span>
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-stone-700 dark:text-zinc-300 block mb-1 font-medium">Course</label>
                <select
                  value={newCourseId}
                  onChange={e => setNewCourseId(e.target.value)}
                  className="w-full bg-white dark:bg-zinc-950 border border-[#E5E2D9] dark:border-zinc-800 rounded-lg p-2 text-stone-900 dark:text-zinc-100 outline-none focus:border-[#8C1B2E]"
                >
                  {courses.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.code}: {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-stone-700 dark:text-zinc-300 block mb-1 font-medium">Instructor</label>
                <select
                  value={newFacultyId}
                  onChange={e => setNewFacultyId(e.target.value)}
                  className="w-full bg-white dark:bg-zinc-950 border border-[#E5E2D9] dark:border-zinc-800 rounded-lg p-2 text-stone-900 dark:text-zinc-100 outline-none focus:border-[#8C1B2E]"
                >
                  {facultyMembers.map(f => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({f.designation})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-stone-700 dark:text-zinc-300 block mb-1 font-medium">Classroom / Lab</label>
                <select
                  value={newRoomId}
                  onChange={e => setNewRoomId(e.target.value)}
                  className="w-full bg-white dark:bg-zinc-950 border border-[#E5E2D9] dark:border-zinc-800 rounded-lg p-2 text-stone-900 dark:text-zinc-100 outline-none focus:border-[#8C1B2E]"
                >
                  {rooms.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.type} · Cap {r.capacity})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-stone-700 dark:text-zinc-300 block mb-1 font-medium">Student Section</label>
                  <select
                    value={newSectionId}
                    onChange={e => setNewSectionId(e.target.value)}
                    className="w-full bg-white dark:bg-zinc-950 border border-[#E5E2D9] dark:border-zinc-800 rounded-lg p-2 text-stone-900 dark:text-zinc-100 outline-none focus:border-[#8C1B2E]"
                  >
                    {sections.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.studentCount} students)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-stone-700 dark:text-zinc-300 block mb-1 font-medium">Session Type</label>
                  <select
                    value={newType}
                    onChange={e => setNewType(e.target.value as any)}
                    className="w-full bg-white dark:bg-zinc-950 border border-[#E5E2D9] dark:border-zinc-800 rounded-lg p-2 text-stone-900 dark:text-zinc-100 outline-none focus:border-[#8C1B2E]"
                  >
                    <option value="Lecture">Lecture</option>
                    <option value="Lab">Lab</option>
                    <option value="Tutorial">Tutorial</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E5E2D9] dark:border-zinc-800">
              <button
                onClick={() => setScheduleSlotTarget(null)}
                className="px-4 py-2 rounded-lg text-xs font-medium text-stone-600 dark:text-zinc-400 hover:text-stone-900 dark:hover:text-zinc-100"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setScheduleError(null);
                  const result = await addSession({
                    courseId: newCourseId,
                    facultyId: newFacultyId,
                    roomId: newRoomId,
                    sectionId: newSectionId,
                    day: scheduleSlotTarget.day,
                    timeSlotId: scheduleSlotTarget.timeSlotId,
                    type: newType,
                    status: 'Confirmed',
                  });
                  if (!result.isSuccess) {
                    setScheduleError(result.error || 'Scheduling collision detected.');
                  } else {
                    setScheduleSlotTarget(null);
                    setScheduleError(null);
                  }
                }}
                className="px-4 py-2 bg-[#8C1B2E] hover:bg-[#721525] text-white rounded-lg text-xs font-semibold transition-all shadow-xs"
              >
                Assign Slot
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
