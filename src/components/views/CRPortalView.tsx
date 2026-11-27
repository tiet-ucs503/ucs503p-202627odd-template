import React, { useState } from 'react';
import { useTimetable } from '../../context/TimetableContext';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { DayOfWeek, TimeSlot } from '../../types';
import {
  Users,
  Calendar,
  Clock,
  Vote,
  ThumbsUp,
  Send,
  Plus,
  X
} from 'lucide-react';

type PollOptionDraft = { day: DayOfWeek; timeSlotId: string };
const DEFAULT_POLL_QUESTION = 'Which time works best for the replacement class?';
const MAX_POLL_OPTIONS = 6;

export function CRPortalView() {
  const { roster } = useAuth();
  const {
    academicYear,
    sections,
    publishedSessions,
    allocations,
    courses,
    facultyMembers,
    rooms,
    polls,
    makeupTasks,
    votePoll,
    requestStudentMakeup,
    refresh,
    isLoading,
  } = useTimetable();
  const sessions = publishedSessions ?? [];
  const { workingDays: days, timeSlots } = academicYear;

  const sectionId = roster?.crSectionId ?? roster?.sectionId ?? null;
  const currentSection = sections.find(s => s.id === sectionId);

  const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' }) as DayOfWeek;
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>(days.includes(todayName) ? todayName : days[0] ?? 'Monday');
  const [requestCourseId, setRequestCourseId] = useState('');
  const [requesting, setRequesting] = useState(false);
  const [requestedCourseId, setRequestedCourseId] = useState<string | null>(null);
  const [votingPollId, setVotingPollId] = useState<string | null>(null);

  const [showPollModal, setShowPollModal] = useState(false);
  const [pollCourseId, setPollCourseId] = useState('');
  const [pollQuestion, setPollQuestion] = useState(DEFAULT_POLL_QUESTION);
  const [pollOptions, setPollOptions] = useState<PollOptionDraft[]>([]);
  const [pollSubmitting, setPollSubmitting] = useState(false);
  const [pollError, setPollError] = useState<string | null>(null);

  if (isLoading || !currentSection) {
    return (
      <div className="space-y-6 max-w-6xl mx-auto">
        <div className="flex items-center gap-2 text-[#8C1B2E] dark:text-red-400 text-xs font-semibold tracking-wider border-b border-[#E5E2D9] dark:border-zinc-800 pb-4">
          <Users className="h-4 w-4" />
          <span>Class Representative Portal</span>
        </div>
        <div className="p-6 bg-[#FAF9F5] dark:bg-zinc-900 border border-[#E5E2D9] dark:border-zinc-800 rounded-xl text-sm text-stone-600 dark:text-zinc-400">
          {isLoading ? 'Loading your section…' : "Your account isn't linked to a section yet — ask the coordinator."}
        </div>
      </div>
    );
  }

  const activeSection = currentSection;

  const isLunchSlot = (t: TimeSlot) => Boolean(t.isLunch || t.id === academicYear.lunchPeriodId);
  const isBreakSlot = (t: TimeSlot) => Boolean(t.isBreak || isLunchSlot(t));
  const teachingSlots = timeSlots.filter(t => !isBreakSlot(t));
  const courseOf = (id: string) => courses.find(c => c.id === id);

  const sectionSessions = sessions.filter(s => s.sectionId === activeSection.id);
  const daySessions = sectionSessions.filter(s => s.day === selectedDay);
  const sectionCourses = courses.filter(
    c => sectionSessions.some(s => s.courseId === c.id) || allocations.some(a => a.sectionId === activeSection.id && a.courseId === c.id),
  );
  const cancelledSessions = sectionSessions.filter(s => s.status === 'Cancelled');
  const defaultCourseId = cancelledSessions[0]?.courseId ?? sectionCourses[0]?.id ?? '';
  const reqCourseId = requestCourseId || defaultCourseId;
  const pendingTasks = makeupTasks.filter(t => t.sectionId === activeSection.id && t.status !== 'Scheduled' && t.status !== 'Dismissed');
  const pendingCodes = [...new Set(pendingTasks.map(t => courseOf(t.courseId)?.code ?? t.courseId))].join(', ');
  const sectionPolls = polls.filter(p => p.sectionId === activeSection.id && p.isActive);

  const handleRequest = async () => {
    if (!reqCourseId) return;
    setRequesting(true);
    const r = await requestStudentMakeup(reqCourseId, activeSection.id);
    setRequesting(false);
    if (r.success) setRequestedCourseId(reqCourseId);
  };

  const handleVote = async (pollId: string, optionId: string) => {
    setVotingPollId(pollId);
    await votePoll(pollId, optionId);
    setVotingPollId(null);
  };

  const openPollModal = () => {
    const firstSlot = teachingSlots[0]?.id ?? '';
    setPollCourseId(defaultCourseId);
    setPollQuestion(DEFAULT_POLL_QUESTION);
    setPollOptions([
      { day: days[0] ?? 'Monday', timeSlotId: firstSlot },
      { day: days[1] ?? days[0] ?? 'Monday', timeSlotId: firstSlot },
    ]);
    setPollError(null);
    setShowPollModal(true);
  };

  const optionLabel = (o: PollOptionDraft) => `${o.day} ${timeSlots.find(t => t.id === o.timeSlotId)?.label ?? ''}`.trim();
  const updateOption = (i: number, patch: Partial<PollOptionDraft>) =>
    setPollOptions(opts => opts.map((o, j) => (j === i ? { ...o, ...patch } : o)));

  const handleCreatePoll = async (e: React.FormEvent) => {
    e.preventDefault();
    const labels = pollOptions.map(optionLabel);
    if (new Set(labels).size !== labels.length) {
      setPollError('Each option must be a different day and time.');
      return;
    }
    setPollSubmitting(true);
    setPollError(null);
    try {
      await api('/api/voting/polls', {
        body: {
          sectionId: activeSection.id,
          courseId: pollCourseId || undefined,
          question: pollQuestion.trim(),
          options: pollOptions.map(o => ({ day: o.day, timeSlotLabel: optionLabel(o) })),
        },
      });
      await refresh?.();
      setShowPollModal(false);
    } catch (err) {
      setPollError(err instanceof Error ? err.message : 'Could not publish the poll.');
    } finally {
      setPollSubmitting(false);
    }
  };

  const inputClass =
    'w-full bg-white dark:bg-zinc-950 border border-[#E5E2D9] dark:border-zinc-800 rounded-lg p-2.5 text-stone-900 dark:text-zinc-200 outline-none focus:border-[#8C1B2E]';

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E5E2D9] dark:border-zinc-800 pb-4">
        <div>
          <div className="flex items-center gap-2 text-[#8C1B2E] dark:text-red-400 text-xs font-semibold tracking-wider mb-0.5">
            <Users className="h-4 w-4" />
            <span>Class Representative Portal</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-stone-900 dark:text-zinc-100 tracking-tight">
            Section {currentSection.name}
          </h1>
          <p className="text-xs text-stone-600 dark:text-zinc-400 mt-0.5">
            {currentSection.program} · Semester {currentSection.semester} · {currentSection.studentCount} Students
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={openPollModal}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#FAF9F5] dark:bg-zinc-900 hover:bg-stone-100 dark:hover:bg-zinc-800 text-stone-800 dark:text-zinc-200 border border-[#E5E2D9] dark:border-zinc-800 rounded-lg text-xs font-semibold shadow-xs transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>New Class Poll</span>
          </button>

          <select
            aria-label="Course for the replacement request"
            value={reqCourseId}
            onChange={e => setRequestCourseId(e.target.value)}
            disabled={sectionCourses.length === 0}
            className="px-2.5 py-2 bg-white dark:bg-zinc-950 border border-[#E5E2D9] dark:border-zinc-800 rounded-lg text-xs text-stone-900 dark:text-zinc-200 outline-none focus:border-[#8C1B2E]"
          >
            {sectionCourses.length === 0 && <option value="">No courses</option>}
            {sectionCourses.map(c => (
              <option key={c.id} value={c.id}>{c.code} – {c.name}</option>
            ))}
          </select>

          <button
            onClick={handleRequest}
            disabled={!reqCourseId || requesting || requestedCourseId === reqCourseId}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#8C1B2E] hover:bg-[#731625] text-white rounded-lg text-xs font-semibold shadow-xs transition-all disabled:opacity-60"
          >
            <Send className="h-3.5 w-3.5" />
            <span>
              {requestedCourseId === reqCourseId ? 'Request Submitted' : requesting ? 'Sending…' : 'Request Replacement Class'}
            </span>
          </button>
        </div>
      </div>

      {/* Cohort Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-[#FAF9F5] dark:bg-zinc-900/50 border border-[#E5E2D9] dark:border-zinc-800 rounded-xl space-y-1 shadow-xs">
          <div className="text-xs text-stone-500 dark:text-zinc-400 font-medium">Students in Section</div>
          <div className="text-2xl font-serif font-bold text-stone-900 dark:text-zinc-100">
            {currentSection.studentCount}
          </div>
          <div className="text-[11px] text-stone-500 dark:text-zinc-400">Section {currentSection.name}</div>
        </div>

        <div className="p-4 bg-[#FAF9F5] dark:bg-zinc-900/50 border border-[#E5E2D9] dark:border-zinc-800 rounded-xl space-y-1 shadow-xs">
          <div className="text-xs text-stone-500 dark:text-zinc-400 font-medium flex items-center gap-1.5">
            Attendance data
          </div>
          <div className="text-2xl font-serif font-bold text-emerald-700 dark:text-emerald-400">
            —
          </div>
          <div className="text-[11px] text-emerald-700 dark:text-emerald-400 flex items-center gap-1 font-medium">
            Not tracked in this timetable
          </div>
        </div>

        <div className="p-4 bg-[#FAF9F5] dark:bg-zinc-900/50 border border-[#E5E2D9] dark:border-zinc-800 rounded-xl space-y-1 shadow-xs">
          <div className="text-xs text-stone-500 dark:text-zinc-400 font-medium">Pending Replacement Classes</div>
          <div className={`text-2xl font-serif font-bold ${pendingTasks.length ? 'text-amber-700 dark:text-amber-400' : 'text-stone-900 dark:text-zinc-100'}`}>
            {pendingTasks.length} {pendingTasks.length === 1 ? 'Class' : 'Classes'}
          </div>
          <div className="text-[11px] text-stone-500 dark:text-zinc-400">{pendingCodes || 'Nothing pending'}</div>
        </div>
      </div>

      {/* Section Daily Schedule */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-3">
          <div className="bg-[#FAF9F5] dark:bg-zinc-900 border border-[#E5E2D9] dark:border-zinc-800 rounded-xl overflow-hidden shadow-xs">
            {/* Day Switcher */}
            <div className="p-3.5 border-b border-[#E5E2D9] dark:border-zinc-800 flex items-center justify-between bg-white dark:bg-zinc-950/50">
              <div className="text-xs font-bold text-stone-900 dark:text-zinc-100 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-stone-500 dark:text-zinc-400" />
                <span>Class Schedule for {selectedDay}</span>
              </div>

              <div className="flex bg-[#F7F6F2] dark:bg-zinc-900 border border-[#E5E2D9] dark:border-zinc-800 p-0.5 rounded-lg text-xs">
                {days.map(d => (
                  <button
                    key={d}
                    onClick={() => setSelectedDay(d)}
                    className={`px-2.5 py-1 rounded-md transition-colors ${
                      selectedDay === d
                        ? 'bg-[#8C1B2E] text-white font-semibold shadow-xs'
                        : 'text-stone-700 dark:text-zinc-400 hover:text-stone-900 dark:hover:text-zinc-200'
                    }`}
                  >
                    {d.slice(0, 3)}
                  </button>
                ))}
              </div>
            </div>

            {/* Schedule Items */}
            {(publishedSessions?.length ?? 0) === 0 ? (
              <div className="p-6 text-xs text-stone-500 dark:text-zinc-400 italic">No timetable published yet.</div>
            ) : (
              <div className="divide-y divide-[#E5E2D9] dark:divide-zinc-800/80">
                {timeSlots.map(slot => {
                  if (isBreakSlot(slot)) {
                    return (
                      <div key={slot.id} className="p-3 bg-stone-100/70 dark:bg-zinc-950/40 flex items-center justify-between text-xs text-stone-500 dark:text-zinc-500">
                        <span className="font-medium">{slot.startTime} – {slot.endTime}</span>
                        <span className="font-medium text-stone-700 dark:text-zinc-300">{isLunchSlot(slot) ? 'Lunch Break' : 'Break'}</span>
                        <span className="text-[11px] text-stone-400">No classes</span>
                      </div>
                    );
                  }

                  const slotSessions = daySessions.filter(s => s.timeSlotId === slot.id);

                  return (
                    <div
                      key={slot.id}
                      className={`p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs transition-colors ${
                        slotSessions.some(s => s.status === 'Cancelled')
                          ? 'bg-red-50 dark:bg-red-950/20'
                          : slotSessions.some(s => s.type === 'Makeup')
                          ? 'bg-emerald-50 dark:bg-emerald-950/20'
                          : 'hover:bg-white dark:hover:bg-zinc-800/50'
                      }`}
                    >
                      <div className="flex items-center gap-2 text-stone-600 dark:text-zinc-400 w-36 shrink-0 font-medium">
                        <Clock className="h-3.5 w-3.5 text-stone-400" />
                        <span>{slot.startTime} – {slot.endTime}</span>
                      </div>

                      <div className="flex-1 space-y-2">
                        {slotSessions.length === 0 ? (
                          <span className="text-stone-400 dark:text-zinc-500 italic">Free period</span>
                        ) : (
                          slotSessions.map(session => {
                            const course = courseOf(session.courseId);
                            const sub = session.subSectionId
                              ? currentSection.subSections?.find(x => x.id === session.subSectionId)?.name
                              : undefined;
                            return (
                              <div key={session.id}>
                                <div className="font-bold text-stone-900 dark:text-zinc-100 flex items-center gap-2">
                                  <span className="text-[#8C1B2E] dark:text-red-400 font-mono">{course?.code ?? '—'}</span>
                                  <span>·</span>
                                  <span>{course?.name ?? session.courseId}</span>
                                  {sub && <span className="text-[10px] font-medium text-stone-500 dark:text-zinc-400">({sub})</span>}
                                  {session.status === 'Cancelled' && (
                                    <span className="text-[10px] px-2 py-0.5 rounded bg-red-100 dark:bg-red-950 text-[#8C1B2E] dark:text-red-300 border border-red-200 dark:border-red-800/60 font-semibold">
                                      Cancelled
                                    </span>
                                  )}
                                  {session.type === 'Makeup' && (
                                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 font-semibold">
                                      Replacement Class
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-stone-500 dark:text-zinc-400 mt-0.5 flex items-center gap-2">
                                  <span>{facultyMembers.find(f => f.id === session.facultyId)?.name ?? '—'}</span>
                                  <span>·</span>
                                  <span>Room: {rooms.find(r => r.id === session.roomId)?.name ?? '—'}</span>
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
            )}
          </div>
        </div>

        {/* Right Column: Class Voting */}
        <div className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Vote className="h-4 w-4 text-stone-600 dark:text-zinc-400" />
                <h2 className="text-sm font-serif font-bold text-stone-900 dark:text-zinc-200">
                  Active Class Polls
                </h2>
              </div>
            </div>

            {sectionPolls.length === 0 && (
              <div className="p-4 bg-[#FAF9F5] dark:bg-zinc-900 border border-[#E5E2D9] dark:border-zinc-800 rounded-xl text-xs text-stone-500 dark:text-zinc-400 italic">
                No active polls for your section.
              </div>
            )}

            {sectionPolls.map(poll => {
              const pollCourse = courseOf(poll.courseId);
              const totalVotes = poll.options.reduce((sum, o) => sum + o.votes, 0) || 1;
              return (
                <div key={poll.id} className="p-4 bg-[#FAF9F5] dark:bg-zinc-900 border border-[#E5E2D9] dark:border-zinc-800 rounded-xl space-y-3 text-xs shadow-xs">
                  <div>
                    <div className="font-bold text-stone-900 dark:text-zinc-100">
                      {pollCourse ? `${pollCourse.code} Replacement Class` : 'Class Poll'}
                    </div>
                    <p className="text-[11px] text-stone-600 dark:text-zinc-400 mt-1 leading-relaxed">
                      {poll.question}
                    </p>
                  </div>

                  <div className="space-y-2.5">
                    <div className="flex justify-between text-[11px] text-stone-500 dark:text-zinc-400">
                      <span>Votes received ({poll.votedStudentsCount}/{poll.totalEligibleStudents || currentSection.studentCount}):</span>
                    </div>

                    <div className="space-y-2">
                      {poll.options.map(opt => {
                        const percentage = Math.round((opt.votes / totalVotes) * 100);
                        const isSelected = poll.userVotedOptionId === opt.id;
                        return (
                          <div key={opt.id} className="p-2.5 bg-white dark:bg-zinc-950 border border-[#E5E2D9] dark:border-zinc-800 rounded-lg space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-stone-900 dark:text-zinc-200 font-bold">{opt.timeSlotLabel} {opt.isSystemRecommended && <span className="text-emerald-800 dark:text-emerald-400 text-[10px] bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/50 font-semibold ml-1">Best time</span>}</span>
                              <span className="text-stone-500 dark:text-zinc-400">{opt.votes} votes ({percentage}%)</span>
                            </div>
                            <div className="h-1.5 bg-stone-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                              <div className="h-full bg-emerald-600 dark:bg-emerald-500 rounded-full" style={{ width: `${percentage}%` }} />
                            </div>
                            <button
                              onClick={() => handleVote(poll.id, opt.id)}
                              disabled={isSelected || votingPollId === poll.id}
                              className={`w-full mt-1 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${
                                isSelected
                                  ? 'bg-emerald-700 text-white'
                                  : 'bg-stone-100 dark:bg-zinc-800 hover:bg-stone-200 dark:hover:bg-zinc-700 text-stone-800 dark:text-zinc-200 disabled:opacity-50'
                              }`}
                            >
                              <ThumbsUp className="h-3.5 w-3.5" />
                              <span>{isSelected ? 'Your Vote' : poll.userHasVoted ? 'Change vote to this time' : 'Vote for this time'}</span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* New Poll Modal */}
      {showPollModal && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="cr-poll-dialog-title"
            className="bg-[#FAF9F5] dark:bg-zinc-900 border border-[#E5E2D9] dark:border-zinc-800 rounded-xl max-w-md w-full p-5 space-y-4 shadow-xl"
          >
            <h4 id="cr-poll-dialog-title" className="text-base font-serif font-bold text-stone-900 dark:text-zinc-100">Create new class vote poll</h4>
            <p className="text-xs text-stone-600 dark:text-zinc-400 leading-relaxed">
              Ask your section members which time works best for a replacement class.
            </p>

            <form onSubmit={handleCreatePoll} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label htmlFor="cr-poll-course" className="text-stone-700 dark:text-zinc-300 font-medium">Course</label>
                <select
                  id="cr-poll-course"
                  value={pollCourseId}
                  onChange={e => setPollCourseId(e.target.value)}
                  className={inputClass}
                >
                  <option value="">No specific course</option>
                  {sectionCourses.map(c => (
                    <option key={c.id} value={c.id}>{c.code} – {c.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label htmlFor="cr-poll-question" className="text-stone-700 dark:text-zinc-300 font-medium">Question</label>
                <input
                  id="cr-poll-question"
                  type="text"
                  required
                  maxLength={300}
                  value={pollQuestion}
                  onChange={e => setPollQuestion(e.target.value)}
                  className={inputClass}
                />
              </div>

              <fieldset className="space-y-2">
                <legend className="text-stone-700 dark:text-zinc-300 font-medium mb-1">Time options</legend>
                {pollOptions.map((o, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <select
                      aria-label={`Option ${i + 1} day`}
                      value={o.day}
                      onChange={e => updateOption(i, { day: e.target.value as DayOfWeek })}
                      className={inputClass}
                    >
                      {days.map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                    <select
                      aria-label={`Option ${i + 1} time`}
                      value={o.timeSlotId}
                      onChange={e => updateOption(i, { timeSlotId: e.target.value })}
                      className={inputClass}
                    >
                      {teachingSlots.map(t => (
                        <option key={t.id} value={t.id}>{t.label}</option>
                      ))}
                    </select>
                    {pollOptions.length > 2 && (
                      <button
                        type="button"
                        aria-label={`Remove option ${i + 1}`}
                        onClick={() => setPollOptions(opts => opts.filter((_, j) => j !== i))}
                        className="p-1.5 rounded text-stone-400 hover:text-stone-700 dark:hover:text-zinc-200 shrink-0"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
                {pollOptions.length < MAX_POLL_OPTIONS && (
                  <button
                    type="button"
                    onClick={() => setPollOptions(opts => [...opts, { day: days[0] ?? 'Monday', timeSlotId: teachingSlots[0]?.id ?? '' }])}
                    className="flex items-center gap-1 text-[#8C1B2E] dark:text-red-400 font-semibold"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add option</span>
                  </button>
                )}
              </fieldset>

              {pollError && (
                <div role="alert" className="text-rose-700 dark:text-rose-400 text-xs font-semibold py-1">
                  {pollError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPollModal(false)}
                  className="px-4 py-2 rounded-lg text-stone-600 dark:text-zinc-400 hover:text-stone-900 dark:hover:text-white font-medium"
                >
                  Go back
                </button>
                <button
                  type="submit"
                  disabled={pollSubmitting}
                  className="px-4 py-2 bg-[#8C1B2E] hover:bg-[#731625] text-white rounded-lg font-semibold transition-colors shadow-xs disabled:opacity-60"
                >
                  {pollSubmitting ? 'Publishing…' : 'Publish Poll'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
