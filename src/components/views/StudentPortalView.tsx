import React, { useState, useMemo } from 'react';
import { useTimetable } from '../../context/TimetableContext';
import { getGridCellRowSpan, isGridCellCoveredByLab } from '../../lib/timetableGridLayout';
import { useAuth } from '../../context/AuthContext';
import { DayOfWeek, ClassSession, Course, TimeSlot } from '../../types';
import {
  Calendar,
  Clock,
  MapPin,
  User,
  BookOpen,
  Users,
  AlertTriangle,
  CheckCircle2,
  X,
  ChevronRight,
  Printer,
} from 'lucide-react';

const dayName = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'long' });
const formatTimestamp = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleString();
};

export function StudentPortalView() {
  const { currentUser, roster } = useAuth();
  const {
    academicYear,
    sections,
    sessions: _draftSessions,
    publishedSessions,
    courses,
    departments,
    facultyMembers,
    rooms,
    polls,
    notifications,
    votePoll,
    activeView,
    setActiveView,
    isLoading,
  } = useTimetable();
  const { workingDays: days, timeSlots } = academicYear;

  // Identity & section come from the signed-in user's roster record.
  const studentName = (currentUser?.name ?? '').replace(/\s*\(Student\)/i, '').replace(/\s*\(CR\)/i, '');
  const firstName = studentName.split(' ')[0];
  const studentRollNo = roster?.rollNumber ?? currentUser?.rollNumber;
  const currentSection = sections.find(s => s.id === roster?.sectionId);
  const subSectionId = roster?.subSectionId ?? null;
  const sessions = publishedSessions || [];

  const now = new Date();
  const todayName = dayName(now);
  const nowTime = now.toTimeString().slice(0, 5); // "HH:MM", local time
  const isWorkingDay = days.includes(todayName as DayOfWeek);

  // Tab State: sync with activeView or default to overview
  const currentTab = useMemo(() => {
    if (activeView === 'grid') return 'timetable';
    if (activeView === 'student_courses') return 'courses';
    if (activeView === 'student_section') return 'section';
    return 'dashboard';
  }, [activeView]);

  const setTab = (tab: 'dashboard' | 'timetable' | 'courses' | 'section') => {
    if (tab === 'timetable') setActiveView('grid');
    else if (tab === 'courses') setActiveView('student_courses');
    else if (tab === 'section') setActiveView('student_section');
    else setActiveView('overview');
  };

  const [selectedMobileDay, setSelectedMobileDay] = useState<DayOfWeek>(
    isWorkingDay ? (todayName as DayOfWeek) : days[0] ?? 'Monday',
  );
  const [timetableMode, setTimetableMode] = useState<'grid' | 'agenda'>('grid');

  // Selected session detail modal
  const [selectedSession, setSelectedSession] = useState<ClassSession | null>(null);
  const [selectedCourseDetail, setSelectedCourseDetail] = useState<Course | null>(null);

  const [votingPollId, setVotingPollId] = useState<string | null>(null);

  // Whole-section sessions plus the student's own lab subgroup (every subgroup if not assigned to one).
  const sectionSessions = useMemo(
    () =>
      sessions.filter(
        s => s.sectionId === currentSection?.id && (!subSectionId || !s.subSectionId || s.subSectionId === subSectionId),
      ),
    [sessions, currentSection?.id, subSectionId],
  );

  const enrolledCourses = useMemo(() => {
    const ids = new Set(sectionSessions.map(s => s.courseId));
    return courses.filter(c => ids.has(c.id));
  }, [sectionSessions, courses]);

  // Time greeting helper
  const getGreeting = () => {
    const hour = now.getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  if (!currentSection) {
    return (
      <div className="space-y-6 max-w-6xl mx-auto font-sans">
        <div className="border-b border-[#E5E2D9] dark:border-zinc-800 pb-4">
          <h1 className="text-2xl sm:text-3xl font-bold font-serif text-stone-900 dark:text-zinc-100 tracking-tight">
            {getGreeting()}{firstName ? `, ${firstName}` : ''}
          </h1>
        </div>
        <div className="p-6 bg-[#FAF9F5] dark:bg-zinc-900 border border-[#E5E2D9] dark:border-zinc-800 rounded-xl text-sm text-stone-600 dark:text-zinc-400">
          {isLoading
            ? 'Loading your timetable…'
            : "Your account isn't linked to a section yet — ask the coordinator."}
        </div>
      </div>
    );
  }

  const slotById = (id: string) => timeSlots.find(t => t.id === id);
  const slotTime = (id: string) => {
    const t = slotById(id);
    return t ? `${t.startTime}–${t.endTime}` : id;
  };
  const slotOrder = (id: string) => timeSlots.findIndex(t => t.id === id);
  const isLunchSlot = (t: TimeSlot) => Boolean(t.isLunch || t.id === academicYear.lunchPeriodId);
  const isBreakSlot = (t: TimeSlot) => Boolean(t.isBreak || isLunchSlot(t));
  const sessionsAt = (day: string, slotId: string) => sectionSessions.filter(s => s.day === day && s.timeSlotId === slotId);
  const courseOf = (id: string) => courses.find(c => c.id === id);
  const facultyName = (id: string) => facultyMembers.find(f => f.id === id)?.name ?? '—';
  const roomOf = (id: string) => rooms.find(r => r.id === id);
  const subName = (id?: string) => (id ? currentSection.subSections?.find(x => x.id === id)?.name : undefined);
  const isNowSlot = (day: string, t: TimeSlot) => day === todayName && t.startTime <= nowTime && nowTime < t.endTime;
  const homeRoom = (currentSection.homeRoomId ? roomOf(currentSection.homeRoomId) : undefined)
    || sectionSessions.map(session => roomOf(session.roomId)).find(Boolean);
  const facultyMentor = sectionSessions.map(session => facultyMembers.find(faculty => faculty.id === session.facultyId)).find(Boolean)
    || facultyMembers.find(faculty => faculty.departmentId === currentSection.departmentId);
  const sectionAnnouncements = [...new Map(notifications.filter(item =>
    ['cancellation', 'makeup_request', 'poll_created', 'timetable_published'].includes(item.type) &&
    item.message.toLowerCase().includes(currentSection.name.toLowerCase()),
  ).map(item => [`${item.type}|${item.actionPayload?.sessionId || item.title}`, item])).values()];

  // Today
  const todaySessions = isWorkingDay ? sectionSessions.filter(s => s.day === todayName) : [];
  const todayCancelled = todaySessions.filter(s => s.status === 'Cancelled').length;
  const todayScheduled = todaySessions.length - todayCancelled;

  // Next class: the first not-yet-finished class today, else the first class on the following days.
  let nextClass: { session: ClassSession; when: string } | null = null;
  for (let offset = 0; offset < 7 && !nextClass; offset++) {
    const d = new Date(now);
    d.setDate(now.getDate() + offset);
    const day = dayName(d);
    const upcoming = sectionSessions
      .filter(s => s.day === day && s.status !== 'Cancelled' && (offset > 0 || (slotById(s.timeSlotId)?.endTime ?? '') > nowTime))
      .sort((a, b) => slotOrder(a.timeSlotId) - slotOrder(b.timeSlotId));
    if (upcoming[0]) nextClass = { session: upcoming[0], when: offset === 0 ? 'Today' : offset === 1 ? 'Tomorrow' : day };
  }
  const nextCourse = nextClass ? courseOf(nextClass.session.courseId) : undefined;
  const nextRoom = nextClass ? roomOf(nextClass.session.roomId) : undefined;

  const cancelledSessions = sectionSessions.filter(s => s.status === 'Cancelled');
  const sectionPolls = polls.filter(p => p.sectionId === currentSection.id && p.isActive);

  const handleVote = async (pollId: string, optionId: string) => {
    setVotingPollId(pollId);
    await votePoll(pollId, optionId);
    setVotingPollId(null);
  };

  const handlePrint = () => {
    window.print();
  };

  const selectedRoom = selectedSession ? roomOf(selectedSession.roomId) : undefined;

  return (
    <div className="space-y-6 max-w-6xl mx-auto font-sans">

      {/* 1. Academic Header & Sub-Navigation */}
      <div className="border-b border-[#E5E2D9] dark:border-zinc-800 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold font-serif text-stone-900 dark:text-zinc-100 tracking-tight">
              {getGreeting()}{firstName ? `, ${firstName}` : ''}
            </h1>
            <p className="text-xs sm:text-sm text-stone-500 dark:text-zinc-400 mt-1">
              {currentSection.program} · Semester {currentSection.semester} · {currentSection.name}
            </p>
          </div>

          {studentRollNo && (
            <div className="flex items-center gap-2">
              <span className="text-xs px-2.5 py-1 rounded-md bg-[#FAF9F5] dark:bg-zinc-900 border border-[#E5E2D9] dark:border-zinc-800 font-mono text-stone-700 dark:text-zinc-300">
                Roll No. {studentRollNo}
              </span>
            </div>
          )}
        </div>

        {/* Clean Student Navigation Bar */}
        <div className="hidden">
          <button
            onClick={() => setTab('dashboard')}
            className={`py-2 px-3 border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
              currentTab === 'dashboard'
                ? 'border-[#8C1B2E] text-[#8C1B2E] dark:text-red-400 font-semibold'
                : 'border-transparent text-stone-600 dark:text-zinc-400 hover:text-stone-900 dark:hover:text-zinc-200'
            }`}
          >
            <Calendar className="h-3.5 w-3.5" />
            <span>Dashboard</span>
          </button>

          <button
            onClick={() => setTab('timetable')}
            className={`py-2 px-3 border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
              currentTab === 'timetable'
                ? 'border-[#8C1B2E] text-[#8C1B2E] dark:text-red-400 font-semibold'
                : 'border-transparent text-stone-600 dark:text-zinc-400 hover:text-stone-900 dark:hover:text-zinc-200'
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            <span>My Timetable</span>
          </button>

          <button
            onClick={() => setTab('courses')}
            className={`py-2 px-3 border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
              currentTab === 'courses'
                ? 'border-[#8C1B2E] text-[#8C1B2E] dark:text-red-400 font-semibold'
                : 'border-transparent text-stone-600 dark:text-zinc-400 hover:text-stone-900 dark:hover:text-zinc-200'
            }`}
          >
            <BookOpen className="h-3.5 w-3.5" />
            <span>My Courses</span>
          </button>

          <button
            onClick={() => setTab('section')}
            className={`py-2 px-3 border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
              currentTab === 'section'
                ? 'border-[#8C1B2E] text-[#8C1B2E] dark:text-red-400 font-semibold'
                : 'border-transparent text-stone-600 dark:text-zinc-400 hover:text-stone-900 dark:hover:text-zinc-200'
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            <span>My Section</span>
          </button>
        </div>
      </div>

      {(publishedSessions?.length ?? 0) === 0 && (
        <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          No timetable has been published yet. Your Courses and Section pages are still available; the schedule will appear after publication.
        </div>
      )}

      {/* ============================================================ */}
      {/* 2. TAB 1: DASHBOARD */}
      {/* ============================================================ */}
      {currentTab === 'dashboard' && (
        <div className="space-y-6 animate-in fade-in duration-150">

          {/* Top Row: Next Class Section & Today Schedule Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

            {/* NEXT CLASS COMPACT SECTION */}
            <div className="md:col-span-2 p-5 bg-[#FAF9F5] dark:bg-zinc-900 border border-[#E5E2D9] dark:border-zinc-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#8C1B2E] dark:text-red-400">
                    Next Class
                  </span>
                  {nextClass && (
                    <>
                      <span className="text-stone-300 dark:text-zinc-600">·</span>
                      <span className="text-xs text-stone-500 dark:text-zinc-400 font-mono">
                        {nextClass.when} · {slotTime(nextClass.session.timeSlotId)}
                      </span>
                    </>
                  )}
                </div>

                <div className="text-base sm:text-lg font-bold text-stone-900 dark:text-zinc-100 font-serif">
                  {nextClass
                    ? nextCourse
                      ? `${nextCourse.code} · ${nextCourse.name}`
                      : nextClass.session.courseId
                    : 'No upcoming classes this week'}
                </div>

                {nextClass && (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-600 dark:text-zinc-400 pt-0.5">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 text-stone-400" />
                      <span>{nextRoom ? `${nextRoom.name} · ${nextRoom.building}` : '—'}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <User className="h-3.5 w-3.5 text-stone-400" />
                      <span>{facultyName(nextClass.session.facultyId)}</span>
                    </span>
                  </div>
                )}
              </div>

              <div className="shrink-0">
                <button
                  onClick={() => setTab('timetable')}
                  className="px-3.5 py-1.5 rounded-lg border border-[#E5E2D9] dark:border-zinc-700 bg-white dark:bg-zinc-800 text-stone-800 dark:text-zinc-200 hover:bg-stone-100 dark:hover:bg-zinc-700 text-xs font-medium transition-all shadow-xs flex items-center gap-1"
                >
                  <span>View timetable</span>
                  <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            </div>

            {/* Today Summary Card */}
            <div className="p-5 bg-[#FAF9F5] dark:bg-zinc-900 border border-[#E5E2D9] dark:border-zinc-800 rounded-xl flex flex-col justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500 dark:text-zinc-400 block mb-1">
                  Today's Schedule
                </span>
                <div className="text-base font-bold text-stone-900 dark:text-zinc-100 font-serif">
                  {now.toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long' })}
                </div>
                <div className="text-xs text-stone-500 dark:text-zinc-400 mt-1">
                  {isWorkingDay
                    ? `${todayScheduled} scheduled class${todayScheduled === 1 ? '' : 'es'} · ${todayCancelled} cancelled`
                    : `${todayName} isn't a working day — no classes today`}
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-[#E5E2D9] dark:border-zinc-800 flex items-center justify-between text-xs">
                <span className="text-stone-500 dark:text-zinc-400">Class Section</span>
                <span className="font-semibold text-stone-800 dark:text-zinc-200">
                  {currentSection.name}{subName(subSectionId ?? undefined) ? ` · ${subName(subSectionId ?? undefined)}` : ''}
                </span>
              </div>
            </div>
          </div>

          {/* Academic Alert: Cancelled Classes */}
          {cancelledSessions.length > 0 && (
            <div className="p-4 bg-[#FAF9F5] dark:bg-zinc-900 border border-[#E5E2D9] dark:border-zinc-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-md bg-[#8C1B2E]/10 text-[#8C1B2E] dark:text-red-400 flex items-center justify-center shrink-0 font-bold mt-0.5">
                  <AlertTriangle className="h-3.5 w-3.5" />
                </div>
                <div className="space-y-0.5">
                  {cancelledSessions.map(s => {
                    const c = courseOf(s.courseId);
                    const makeup = sectionSessions.find(m => m.originalSessionId === s.id && m.status !== 'Cancelled');
                    return (
                      <div key={s.id} className="font-semibold text-stone-900 dark:text-zinc-100">
                        {s.day} · {slotTime(s.timeSlotId)} · {c ? `${c.code} ${c.name}` : s.courseId} cancelled
                        {makeup && (
                          <span className="font-normal text-stone-500 dark:text-zinc-400">
                            {' '}— replacement on {makeup.day} {slotTime(makeup.timeSlotId)}
                          </span>
                        )}
                      </div>
                    );
                  })}
                  {sectionPolls.length > 0 && (
                    <div className="text-stone-500 dark:text-zinc-400 mt-0.5">
                      Replacement class times are available. Please select the time that works best for your section.
                    </div>
                  )}
                </div>
              </div>

              {sectionPolls.length > 0 && (
                <div className="shrink-0">
                  <a
                    href="#replacement-vote-section"
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#8C1B2E] hover:bg-[#721525] text-white font-medium text-xs shadow-xs transition-colors"
                  >
                    <span>View options</span>
                    <ChevronRight className="h-3 w-3" />
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Today's Classes List (Clean Academic Preview) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-stone-900 dark:text-zinc-100 font-serif">
                Today's Classes
              </h2>
              <span className="text-xs text-stone-500 dark:text-zinc-400 font-mono">
                {todayName}{homeRoom ? ` · ${homeRoom.name}` : ''}
              </span>
            </div>

            <div className="bg-[#FAF9F5] dark:bg-zinc-900 border border-[#E5E2D9] dark:border-zinc-800 rounded-xl overflow-hidden divide-y divide-[#E5E2D9] dark:divide-zinc-800 text-xs">
              {!isWorkingDay ? (
                <div className="p-4 text-stone-500 dark:text-zinc-400 italic">
                  No classes today — {todayName} isn't a working day.
                </div>
              ) : (
                timeSlots.map(slot => {
                  if (isBreakSlot(slot)) {
                    return (
                      <div key={slot.id} className="p-3 bg-[#F4F2EC] dark:bg-zinc-950/40 flex items-center justify-between text-stone-500 dark:text-zinc-400">
                        <div className="flex items-center gap-2 w-32 shrink-0 font-mono text-[11px]">
                          <span>{slot.startTime}–{slot.endTime}</span>
                        </div>
                        <span className="font-medium text-stone-700 dark:text-zinc-300">{isLunchSlot(slot) ? 'Lunch Break' : 'Break'}</span>
                        <span className="text-[11px] text-stone-400">No classes</span>
                      </div>
                    );
                  }

                  const slotSessions = sessionsAt(todayName, slot.id);
                  const isNow = isNowSlot(todayName, slot);

                  return (
                    <div
                      key={slot.id}
                      className={`p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                        slotSessions.some(s => s.status === 'Cancelled')
                          ? 'bg-rose-50/30 dark:bg-rose-950/10'
                          : isNow
                          ? 'bg-[#8C1B2E]/5 dark:bg-red-950/20'
                          : ''
                      }`}
                    >
                      <div className="flex items-center gap-2 text-stone-500 dark:text-zinc-400 w-32 shrink-0 font-mono text-[11px]">
                        <span>{slot.startTime}–{slot.endTime}</span>
                        {isNow && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-[#8C1B2E] text-white">
                            Now
                          </span>
                        )}
                      </div>

                      <div className="flex-1 space-y-2">
                        {slotSessions.length === 0 ? (
                          <span className="text-stone-400 dark:text-zinc-500 italic">Free period</span>
                        ) : (
                          slotSessions.map(session => {
                            const course = courseOf(session.courseId);
                            return (
                              <div
                                key={session.id}
                                onClick={() => setSelectedSession(session)}
                                className="cursor-pointer rounded hover:bg-white dark:hover:bg-zinc-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                              >
                                <div>
                                  <div className="flex items-center gap-2 font-medium text-stone-900 dark:text-zinc-100">
                                    <span className="font-mono font-semibold text-[#8C1B2E] dark:text-red-400">{course?.code ?? '—'}</span>
                                    <span className="text-stone-300">·</span>
                                    <span>{course?.name ?? session.courseId}</span>
                                    {session.status === 'Cancelled' && (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-900 font-medium">
                                        Cancelled
                                      </span>
                                    )}
                                    {session.type === 'Lab' && (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-900 font-medium">
                                        Lab{subName(session.subSectionId) ? ` · ${subName(session.subSectionId)}` : ''}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-stone-500 dark:text-zinc-400 mt-0.5 flex items-center gap-3">
                                    <span>{facultyName(session.facultyId)}</span>
                                    <span>·</span>
                                    <span>{roomOf(session.roomId)?.name ?? '—'}</span>
                                  </div>
                                </div>

                                <span className="text-[11px] text-stone-400 dark:text-zinc-500 hidden sm:inline">
                                  Details →
                                </span>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Replacement Time Voting (polls for this section) */}
          {sectionPolls.length > 0 && (
            <div id="replacement-vote-section" className="space-y-3 pt-2">
              <div>
                <h2 className="text-base font-bold text-stone-900 dark:text-zinc-100 font-serif">
                  Choose a replacement class time
                </h2>
                <p className="text-xs text-stone-500 dark:text-zinc-400 mt-0.5">
                  Cast or change your vote until the poll closes.
                </p>
              </div>

              {sectionPolls.map(poll => {
                const pollCourse = courseOf(poll.courseId);
                const totalVotes = poll.options.reduce((sum, o) => sum + o.votes, 0) || 1;
                return (
                  <div key={poll.id} className="bg-[#FAF9F5] dark:bg-zinc-900 border border-[#E5E2D9] dark:border-zinc-800 rounded-xl p-5 space-y-4 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#E5E2D9] dark:border-zinc-800">
                      <div className="font-semibold text-stone-900 dark:text-zinc-100">
                        {pollCourse ? `${pollCourse.code} · ${pollCourse.name} — ` : ''}{poll.question}
                      </div>
                      <div className="text-stone-500 dark:text-zinc-400 text-[11px]">
                        {poll.votedStudentsCount} {poll.votedStudentsCount === 1 ? 'response' : 'responses'} recorded
                      </div>
                    </div>

                    <div className="space-y-3">
                      {poll.options.map(opt => {
                        const percentage = Math.round((opt.votes / totalVotes) * 100);
                        const isSelected = poll.userVotedOptionId === opt.id;

                        return (
                          <div
                            key={opt.id}
                            className={`p-4 rounded-xl border transition-all ${
                              isSelected
                                ? 'bg-white dark:bg-zinc-950 border-[#8C1B2E]/40 dark:border-red-900/60 shadow-xs'
                                : 'bg-white dark:bg-zinc-900/80 border-[#E5E2D9] dark:border-zinc-800'
                            }`}
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div className="space-y-1">
                                <div className="font-bold text-stone-900 dark:text-zinc-100 text-sm">
                                  {opt.timeSlotLabel}
                                </div>
                                <div className="text-xs text-stone-500 dark:text-zinc-400">
                                  {percentage}% of students selected this option
                                </div>
                              </div>

                              <div className="shrink-0">
                                <button
                                  onClick={() => handleVote(poll.id, opt.id)}
                                  disabled={isSelected || votingPollId === poll.id}
                                  className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                    isSelected
                                      ? 'bg-[#8C1B2E] text-white cursor-default'
                                      : 'bg-white dark:bg-zinc-800 border border-[#E5E2D9] dark:border-zinc-700 hover:bg-[#8C1B2E] hover:text-white text-stone-800 dark:text-zinc-200 disabled:opacity-50 disabled:pointer-events-none'
                                  }`}
                                >
                                  {isSelected ? 'Selected' : poll.userHasVoted ? 'Change to this time' : 'Select this time'}
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {poll.userHasVoted && (
                      <div className="p-3 rounded-lg bg-[#F4F2EC] dark:bg-zinc-950 border border-[#E5E2D9] dark:border-zinc-800 text-stone-700 dark:text-zinc-300 text-xs flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-[#8C1B2E] shrink-0" />
                        <span>Your vote is recorded. You can change it while the poll is active.</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* 3. TAB 2: MY TIMETABLE (TRUE WEEKLY MATRIX GRID) */}
      {/* ============================================================ */}
      {currentTab === 'timetable' && (
        <div className="space-y-4 animate-in fade-in duration-150">

          {/* Timetable Header & Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold font-serif text-stone-900 dark:text-zinc-100 tracking-tight">
                Weekly Academic Schedule
              </h2>
              <p className="text-xs text-stone-500 dark:text-zinc-400 mt-0.5">
                Semester {currentSection.semester} · Section {currentSection.name}{homeRoom ? ` · ${homeRoom.name}` : ''}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {/* Desktop / Mobile mode switch */}
              <div className="flex bg-[#FAF9F5] dark:bg-zinc-900 border border-[#E5E2D9] dark:border-zinc-800 p-0.5 rounded-lg text-xs font-medium">
                <button
                  onClick={() => setTimetableMode('grid')}
                  className={`px-3 py-1 rounded-md transition-colors ${
                    timetableMode === 'grid'
                      ? 'bg-white dark:bg-zinc-800 text-stone-900 dark:text-zinc-100 font-semibold shadow-xs'
                      : 'text-stone-600 dark:text-zinc-400 hover:text-stone-900 dark:hover:text-zinc-200'
                  }`}
                >
                  Weekly Grid
                </button>
                <button
                  onClick={() => setTimetableMode('agenda')}
                  className={`px-3 py-1 rounded-md transition-colors ${
                    timetableMode === 'agenda'
                      ? 'bg-white dark:bg-zinc-800 text-stone-900 dark:text-zinc-100 font-semibold shadow-xs'
                      : 'text-stone-600 dark:text-zinc-400 hover:text-stone-900 dark:hover:text-zinc-200'
                  }`}
                >
                  Day View
                </button>
              </div>

              {/* Print Action */}
              <button
                onClick={handlePrint}
                className="px-3 py-1.5 rounded-lg border border-[#E5E2D9] dark:border-zinc-800 bg-[#FAF9F5] dark:bg-zinc-900 hover:bg-stone-100 dark:hover:bg-zinc-800 text-stone-700 dark:text-zinc-300 text-xs font-medium transition-colors flex items-center gap-1.5"
                title="Print Timetable"
              >
                <Printer className="h-3.5 w-3.5 text-stone-500" />
                <span>Print</span>
              </button>
            </div>
          </div>

          {/* DESKTOP TIMETABLE GRID (TRUE MATRIX) */}
          {timetableMode === 'grid' && (
            <div className="bg-[#FAF9F5] dark:bg-zinc-900 border border-[#E5E2D9] dark:border-zinc-800 rounded-xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <p className="px-3 py-2 text-[10px] text-stone-500 dark:text-zinc-400 sm:hidden">Swipe sideways to view all weekdays, including Friday.</p>
                <table className="w-full border-collapse text-left text-xs min-w-[780px]">
                  <thead>
                    <tr className="bg-[#F4F2EC] dark:bg-zinc-950/70 border-b border-[#E5E2D9] dark:border-zinc-800 text-stone-800 dark:text-zinc-300">
                      <th className="p-3 font-semibold w-24 text-stone-500 dark:text-zinc-400 border-r border-[#E5E2D9] dark:border-zinc-800 font-mono text-[11px]">
                        Time Slot
                      </th>
                      {days.map(d => (
                        <th
                          key={d}
                          className={`p-3 font-semibold text-center border-r border-[#E5E2D9] dark:border-zinc-800 last:border-r-0 ${
                            d === todayName
                              ? 'bg-[#8C1B2E]/5 dark:bg-red-950/20 text-[#8C1B2E] dark:text-red-300'
                              : ''
                          }`}
                        >
                          <div className="uppercase tracking-wider text-[11px] font-bold">{d}</div>
                          <div className="text-[10px] text-stone-400 dark:text-zinc-500 font-normal">
                            {d === todayName ? 'Today' : ''}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E2D9] dark:divide-zinc-800">
                    {timeSlots.map(slot => {
                      if (isBreakSlot(slot)) {
                        return (
                          <tr key={slot.id} className="bg-[#F4F2EC] dark:bg-zinc-950/60">
                            <td className="p-2.5 font-mono text-[11px] text-stone-500 dark:text-zinc-400 border-r border-[#E5E2D9] dark:border-zinc-800 whitespace-nowrap">
                              {slot.startTime}–{slot.endTime}
                            </td>
                            <td colSpan={days.length} className="p-2.5 text-center text-xs font-medium text-stone-500 dark:text-zinc-400 tracking-wide">
                              {isLunchSlot(slot) ? 'Lunch Break' : 'Break'}
                            </td>
                          </tr>
                        );
                      }

                      return (
                        <tr key={slot.id} className="hover:bg-white/40 dark:hover:bg-zinc-800/20 transition-colors">
                          {/* Time Column */}
                          <td className="p-2.5 font-mono text-[11px] text-stone-500 dark:text-zinc-400 border-r border-[#E5E2D9] dark:border-zinc-800 whitespace-nowrap align-top">
                            {slot.startTime}–{slot.endTime}
                          </td>

                          {/* Working days */}
                          {days.map(d => {
                            if (isGridCellCoveredByLab(sectionSessions, d, slot.id, timeSlots)) return null;
                            const cellSessions = sessionsAt(d, slot.id);
                            const isNow = isNowSlot(d, slot);
                            const rowSpan = getGridCellRowSpan(sectionSessions, d, slot.id, timeSlots);

                            return (
                              <td
                                key={d}
                                rowSpan={rowSpan}
                                className={`p-1.5 border-r border-[#E5E2D9] dark:border-zinc-800 last:border-r-0 align-top space-y-1 ${
                                  d === todayName ? 'bg-[#8C1B2E]/3 dark:bg-red-950/10' : ''
                                }`}
                              >
                                {cellSessions.length === 0 ? (
                                  <div className="h-full min-h-[56px] rounded flex items-center justify-center text-[10px] text-stone-300 dark:text-zinc-700">
                                    —
                                  </div>
                                ) : (
                                  cellSessions.map(session => {
                                    const course = courseOf(session.courseId);
                                    return (
                                      <div
                                        key={session.id}
                                        onClick={() => setSelectedSession(session)}
                                        className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all hover:-translate-y-0.5 ${
                                          session.status === 'Cancelled'
                                            ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50'
                                            : session.type === 'Lab'
                                            ? 'bg-blue-50/40 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/40'
                                            : isNow
                                            ? 'bg-white dark:bg-zinc-800 border-[#8C1B2E] shadow-xs'
                                            : 'bg-white dark:bg-zinc-800/80 border-[#E5E2D9] dark:border-zinc-700/80 hover:border-stone-400'
                                        }`}
                                      >
                                        <div className="flex items-center justify-between gap-1 mb-1">
                                          <span className="font-mono font-bold text-[#8C1B2E] dark:text-red-400 text-xs">
                                            {course?.code ?? '—'}
                                          </span>
                                          {isNow && (
                                            <span className="text-[9px] font-bold px-1 rounded bg-[#8C1B2E] text-white">
                                              Now
                                            </span>
                                          )}
                                          {session.status === 'Cancelled' && (
                                            <span className="text-[9px] font-medium text-rose-700 dark:text-rose-400">
                                              Cancelled
                                            </span>
                                          )}
                                          {session.type === 'Lab' && (
                                            <span className="text-[9px] font-medium text-blue-700 dark:text-blue-400">
                                              Lab{subName(session.subSectionId) ? ` · ${subName(session.subSectionId)}` : ''}
                                            </span>
                                          )}
                                        </div>

                                        <div className="text-xs font-semibold text-stone-900 dark:text-zinc-100 line-clamp-1">
                                          {course?.name ?? session.courseId}
                                        </div>

                                        <div className="text-[11px] text-stone-500 dark:text-zinc-400 mt-1 flex items-center justify-between">
                                          <span className="truncate">{facultyName(session.facultyId).split(' ').pop()}</span>
                                          <span className="font-mono">{roomOf(session.roomId)?.name ?? '—'}</span>
                                        </div>
                                      </div>
                                    );
                                  })
                                )}
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
          )}

          {/* DAY VIEW / MOBILE AGENDA MODE */}
          {timetableMode === 'agenda' && (
            <div className="space-y-4">
              {/* Day selector pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {days.map(d => (
                  <button
                    key={d}
                    onClick={() => setSelectedMobileDay(d)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 ${
                      selectedMobileDay === d
                        ? 'bg-[#8C1B2E] text-white shadow-xs'
                        : 'bg-[#FAF9F5] dark:bg-zinc-900 border border-[#E5E2D9] dark:border-zinc-800 text-stone-700 dark:text-zinc-300 hover:bg-stone-100 dark:hover:bg-zinc-800'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>

              {/* Day Agenda Cards */}
              <div className="bg-[#FAF9F5] dark:bg-zinc-900 border border-[#E5E2D9] dark:border-zinc-800 rounded-xl overflow-hidden divide-y divide-[#E5E2D9] dark:divide-zinc-800 text-xs">
                {timeSlots.map(slot => {
                  if (isBreakSlot(slot)) {
                    return (
                      <div key={slot.id} className="p-3 bg-[#F4F2EC] dark:bg-zinc-950 flex items-center justify-between text-stone-500">
                        <span className="font-mono text-[11px]">{slot.startTime}–{slot.endTime}</span>
                        <span className="font-medium">{isLunchSlot(slot) ? 'Lunch Break' : 'Break'}</span>
                        <span>—</span>
                      </div>
                    );
                  }

                  const slotSessions = sessionsAt(selectedMobileDay, slot.id);

                  return (
                    <div
                      key={slot.id}
                      className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <div className="font-mono text-stone-500 dark:text-zinc-400 w-28 shrink-0 text-[11px]">
                        {slot.startTime}–{slot.endTime}
                      </div>

                      <div className="flex-1 space-y-2">
                        {slotSessions.length === 0 ? (
                          <span className="text-stone-400 dark:text-zinc-600 italic">Free period</span>
                        ) : (
                          slotSessions.map(session => {
                            const course = courseOf(session.courseId);
                            return (
                              <div
                                key={session.id}
                                onClick={() => setSelectedSession(session)}
                                className="cursor-pointer rounded hover:bg-white dark:hover:bg-zinc-800/60"
                              >
                                <div className="font-medium text-stone-900 dark:text-zinc-100 flex items-center gap-2">
                                  <span className="font-mono font-bold text-[#8C1B2E]">{course?.code ?? '—'}</span>
                                  <span>·</span>
                                  <span>{course?.name ?? session.courseId}</span>
                                  {session.status === 'Cancelled' && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 font-medium">
                                      Cancelled
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-stone-500 dark:text-zinc-400 mt-0.5">
                                  {facultyName(session.facultyId)} · {roomOf(session.roomId)?.name ?? '—'}
                                  {subName(session.subSectionId) ? ` · ${subName(session.subSectionId)}` : ''}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* 4. TAB 3: MY COURSES */}
      {/* ============================================================ */}
      {currentTab === 'courses' && (
        <div className="space-y-4 animate-in fade-in duration-150">

          {(() => {
            const totalCredits = enrolledCourses.reduce((sum, c) => sum + c.credits, 0);
            return (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold font-serif text-stone-900 dark:text-zinc-100 tracking-tight">
                    My Courses
                  </h2>
                  <p className="text-xs text-stone-500 dark:text-zinc-400 mt-0.5">
                    Semester {currentSection.semester} · Section {currentSection.name} · {enrolledCourses.length} Registered Courses ({totalCredits} Credits)
                  </p>
                </div>

                <div className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#FAF9F5] dark:bg-zinc-900 border border-[#E5E2D9] dark:border-zinc-800 text-stone-700 dark:text-zinc-300">
                  Total Enrolled Credits: {totalCredits}
                </div>
              </div>
            );
          })()}

          {/* Courses List / Table */}
          <div className="bg-[#FAF9F5] dark:bg-zinc-900 border border-[#E5E2D9] dark:border-zinc-800 rounded-xl overflow-hidden divide-y divide-[#E5E2D9] dark:divide-zinc-800 text-xs">
            {enrolledCourses.length === 0 && (
              <div className="p-4 text-stone-500 dark:text-zinc-400 italic">No courses in your published timetable yet.</div>
            )}
            {enrolledCourses.map(course => {
              const courseSessions = sectionSessions.filter(s => s.courseId === course.id);
              const facultyNames = [...new Set(courseSessions.map(s => facultyName(s.facultyId)))].join(', ');
              const roomNames = [...new Set(courseSessions.map(s => roomOf(s.roomId)?.name).filter(Boolean))].join(' & ');
              const types = [...new Set(courseSessions.map(s => s.type))].join(' + ');

              return (
                <div key={course.id} className="p-4 hover:bg-white/60 dark:hover:bg-zinc-800/30 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-[#8C1B2E] dark:text-red-400 font-mono">
                          {course.code}
                        </span>
                        <span className="text-stone-300">·</span>
                        <h3 className="font-bold text-sm text-stone-900 dark:text-zinc-100">
                          {course.name}
                        </h3>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-white dark:bg-zinc-800 text-stone-600 dark:text-zinc-400 border border-[#E5E2D9] dark:border-zinc-700">
                          {course.credits} Credits
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-stone-500 dark:text-zinc-400 text-xs">
                        <span className="flex items-center gap-1">
                          <User className="h-3.5 w-3.5 text-stone-400" />
                          <span>Faculty: {facultyNames || '—'}</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5 text-stone-400" />
                          <span>Room: {roomNames || '—'}</span>
                        </span>
                        <span>
                          Type: {types || '—'}
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0">
                      <button
                        onClick={() => setSelectedCourseDetail(course)}
                        className="px-3 py-1.5 rounded-lg border border-[#E5E2D9] dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-stone-100 dark:hover:bg-zinc-700 text-stone-800 dark:text-zinc-200 font-medium text-xs transition-colors"
                      >
                        View course details
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 5. TAB 4: MY SECTION */}
      {/* ============================================================ */}
      {currentTab === 'section' && (
        <div className="space-y-6 animate-in fade-in duration-150">

          <div>
            <h2 className="text-xl sm:text-2xl font-bold font-serif text-stone-900 dark:text-zinc-100 tracking-tight">
              Section {currentSection.name}
            </h2>
            <p className="text-xs text-stone-500 dark:text-zinc-400 mt-0.5">
              {currentSection.program} · Semester {currentSection.semester} · Batch {currentSection.batchYear}
            </p>
          </div>

          {/* Section Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div className="p-4 rounded-xl bg-[#FAF9F5] dark:bg-zinc-900 border border-[#E5E2D9] dark:border-zinc-800">
              <span className="text-[11px] text-stone-500 dark:text-zinc-400 block mb-0.5">Enrolled Students</span>
              <span className="text-base font-bold text-stone-900 dark:text-zinc-100 font-serif">
                {currentSection.studentCount} Students
              </span>
            </div>

            <div className="p-4 rounded-xl bg-[#FAF9F5] dark:bg-zinc-900 border border-[#E5E2D9] dark:border-zinc-800">
              <span className="text-[11px] text-stone-500 dark:text-zinc-400 block mb-0.5">Home Classroom</span>
              <span className="text-base font-bold text-stone-900 dark:text-zinc-100 font-serif">
                {homeRoom?.name ?? 'LT-101'}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-[#FAF9F5] dark:bg-zinc-900 border border-[#E5E2D9] dark:border-zinc-800">
              <span className="text-[11px] text-stone-500 dark:text-zinc-400 block mb-0.5">Class Representative</span>
              <span className="text-xs font-semibold text-stone-900 dark:text-zinc-100 truncate block">
                {currentSection.classRepresentative?.name || 'Not assigned'}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-[#FAF9F5] dark:bg-zinc-900 border border-[#E5E2D9] dark:border-zinc-800">
              <span className="text-[11px] text-stone-500 dark:text-zinc-400 mb-0.5 flex items-center gap-1.5">
                Faculty Mentor
              </span>
              <span className="text-xs font-semibold text-stone-900 dark:text-zinc-100 truncate block">
                {facultyMentor?.name || 'Dr. Arvind Sharma'}
              </span>
            </div>
          </div>

          {/* Sub-sections / Lab Batches */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-stone-900 dark:text-zinc-100 font-serif">
              Laboratory Batches
            </h3>
            {(currentSection.subSections ?? []).length === 0 ? (
              <div className="p-4 rounded-xl bg-[#FAF9F5] dark:bg-zinc-900 border border-[#E5E2D9] dark:border-zinc-800 text-xs text-stone-500 dark:text-zinc-400 italic">
                No lab batches defined for this section.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {(currentSection.subSections ?? []).map((sub, i) => {
                  const labRooms = [
                    ...new Set(sessions.filter(s => s.subSectionId === sub.id).map(s => roomOf(s.roomId)?.name).filter(Boolean)),
                  ].join(', ');
                  return (
                    <div key={sub.id} className="p-4 rounded-xl bg-[#FAF9F5] dark:bg-zinc-900 border border-[#E5E2D9] dark:border-zinc-800">
                      <div className="flex items-center justify-between gap-2 font-semibold text-stone-900 dark:text-zinc-100 mb-1">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span>Batch {sub.name}</span>
                        </span>
                        {sub.id === subSectionId && (
                          <span className="text-[#8C1B2E] dark:text-red-400 text-[11px] font-bold shrink-0">Your Batch</span>
                        )}
                      </div>
                      <p className="text-stone-500 dark:text-zinc-400 text-[11px]">
                        {sub.studentCount} Students{labRooms ? ` · Practical sessions in ${labRooms}` : ''}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section Notices */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-stone-900 dark:text-zinc-100 font-serif flex items-center gap-2">
              Section Announcements
            </h3>
            <div className="bg-[#FAF9F5] dark:bg-zinc-900 border border-[#E5E2D9] dark:border-zinc-800 rounded-xl divide-y divide-[#E5E2D9] dark:divide-zinc-800 text-xs">
              {sectionAnnouncements.length === 0 ? <p className="p-4 text-stone-500 dark:text-zinc-400">No section announcements.</p> : sectionAnnouncements.map(item => (
                <div key={item.id} className="p-4 space-y-1">
                  <div className="flex items-center justify-between"><span className="font-semibold text-stone-900 dark:text-zinc-100">{item.title}</span><time className="text-[10px] text-stone-400">{formatTimestamp(item.timestamp)}</time></div>
                  <p className="text-stone-600 dark:text-zinc-400 leading-relaxed">{item.message}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 6. MODAL: CLASS SESSION DETAILS DIALOG */}
      {/* ============================================================ */}
      {selectedSession && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="student-session-dialog-title"
            className="bg-[#FAF9F5] dark:bg-zinc-900 border border-[#E5E2D9] dark:border-zinc-800 rounded-xl max-w-md w-full p-6 shadow-xl space-y-4 text-stone-900 dark:text-zinc-100"
          >
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] font-mono font-bold text-[#8C1B2E] dark:text-red-400">
                  {courseOf(selectedSession.courseId)?.code}
                </span>
                <h3 id="student-session-dialog-title" className="text-base font-bold font-serif mt-0.5">
                  {courseOf(selectedSession.courseId)?.name ?? selectedSession.courseId}
                </h3>
              </div>
              <button
                onClick={() => setSelectedSession(null)}
                aria-label="Close"
                className="p-1 rounded text-stone-400 hover:text-stone-700 dark:hover:text-zinc-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs bg-white dark:bg-zinc-950 p-4 rounded-lg border border-[#E5E2D9] dark:border-zinc-800 divide-y divide-[#E5E2D9] dark:divide-zinc-800/60">
              <div className="flex justify-between py-1.5 first:pt-0">
                <span className="text-stone-500 dark:text-zinc-400">Instructor:</span>
                <span className="font-semibold text-stone-800 dark:text-zinc-200">{facultyName(selectedSession.facultyId)}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-stone-500 dark:text-zinc-400">Room:</span>
                <span className="font-semibold text-stone-800 dark:text-zinc-200">{selectedRoom ? `${selectedRoom.name} (${selectedRoom.building})` : '—'}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-stone-500 dark:text-zinc-400">Scheduled Time:</span>
                <span className="font-semibold text-stone-800 dark:text-zinc-200">{selectedSession.day} · {slotTime(selectedSession.timeSlotId)}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-stone-500 dark:text-zinc-400">Section:</span>
                <span className="font-semibold text-stone-800 dark:text-zinc-200">
                  {currentSection.name}{subName(selectedSession.subSectionId) ? ` · ${subName(selectedSession.subSectionId)}` : ''}
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-stone-500 dark:text-zinc-400">Session Type:</span>
                <span className="font-semibold text-stone-800 dark:text-zinc-200">{selectedSession.type}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-stone-500 dark:text-zinc-400">Status:</span>
                <span className={`font-semibold ${selectedSession.status === 'Cancelled' ? 'text-rose-700' : 'text-emerald-700'}`}>
                  {selectedSession.status}
                </span>
              </div>

              {selectedSession.status === 'Cancelled' && (
                <div className="pt-2 text-rose-700 dark:text-rose-400 text-[11px] leading-relaxed">
                  Reason: {selectedSession.cancellationReason || 'No reason given.'}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setSelectedSession(null)}
                className="px-4 py-1.5 rounded-lg border border-[#E5E2D9] dark:border-zinc-700 bg-white dark:bg-zinc-800 text-stone-700 dark:text-zinc-200 font-medium text-xs shadow-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 7. MODAL: COURSE DETAIL DIALOG */}
      {/* ============================================================ */}
      {selectedCourseDetail && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="student-course-dialog-title"
            className="bg-[#FAF9F5] dark:bg-zinc-900 border border-[#E5E2D9] dark:border-zinc-800 rounded-xl max-w-lg w-full p-6 shadow-xl space-y-4 text-stone-900 dark:text-zinc-100"
          >
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] font-mono font-bold text-[#8C1B2E] dark:text-red-400">
                  {selectedCourseDetail.code}
                </span>
                <h3 id="student-course-dialog-title" className="text-base font-bold font-serif mt-0.5">
                  {selectedCourseDetail.name}
                </h3>
              </div>
              <button
                onClick={() => setSelectedCourseDetail(null)}
                aria-label="Close"
                className="p-1 rounded text-stone-400 hover:text-stone-700 dark:hover:text-zinc-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-stone-600 dark:text-zinc-300">
              <div className="grid grid-cols-2 gap-2 p-3 bg-white dark:bg-zinc-950 rounded-lg border border-[#E5E2D9] dark:border-zinc-800">
                <div>
                  <span className="text-[10px] text-stone-400 block">Credits</span>
                  <span className="font-bold text-stone-900 dark:text-zinc-100">{selectedCourseDetail.credits} Credits</span>
                </div>
                <div>
                  <span className="text-[10px] text-stone-400 block">Department</span>
                  <span className="font-bold text-stone-900 dark:text-zinc-100">
                    {departments.find(d => d.id === selectedCourseDetail.departmentId)?.code ?? '—'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-stone-400 block">Weekly Lectures</span>
                  <span className="font-bold text-stone-900 dark:text-zinc-100">{selectedCourseDetail.requiredLecturesPerWeek} Hours</span>
                </div>
                <div>
                  <span className="text-[10px] text-stone-400 block">Weekly Labs</span>
                  <span className="font-bold text-stone-900 dark:text-zinc-100">{selectedCourseDetail.requiredLabsPerWeek} Hours</span>
                </div>
              </div>

              <div className="p-3 bg-white dark:bg-zinc-950 rounded-lg border border-[#E5E2D9] dark:border-zinc-800 space-y-1">
                <span className="text-[11px] font-semibold text-stone-900 dark:text-zinc-100 flex items-center gap-1.5">
                  Course Syllabus Coverage
                </span>
                <p className="text-[11px] text-stone-500 dark:text-zinc-400 leading-relaxed">
                  Syllabus details have not been entered for this course.
                </p>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setSelectedCourseDetail(null)}
                className="px-4 py-1.5 rounded-lg border border-[#E5E2D9] dark:border-zinc-700 bg-white dark:bg-zinc-800 text-stone-700 dark:text-zinc-200 font-medium text-xs shadow-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
