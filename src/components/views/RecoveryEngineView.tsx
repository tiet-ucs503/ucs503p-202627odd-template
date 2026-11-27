import React, { useState } from 'react';
import { useTimetable } from '../../context/TimetableContext';
import {
  Repeat,
  RotateCcw,
  ArrowRight,
  Sliders,
  UserCheck
} from 'lucide-react';
import { findSubstituteFaculty } from '../../lib/recoveryEngine';

// Sample content shown to explain the mechanism — edit freely.
const SAMPLE_FLOW_STEPS = [
  {
    tag: 'STEP 1: DISRUPTION A',
    title: 'Monday 08:00',
    text: 'Prof. Sharma cancels DBMS for CSE-A.',
    footer: 'Makeup Task Created (Priority 96)',
    box: 'bg-red-50/70 dark:bg-red-950/20 border-red-200 dark:border-red-900/40',
    tagColor: 'text-[#8C1B2E] dark:text-red-400',
  },
  {
    tag: 'STEP 2: DISRUPTION B',
    title: 'Thursday 11:00',
    text: 'Dr. Gupta cancels OS for CSE-A.',
    footer: 'CSE-A Students become FREE',
    box: 'bg-amber-50/70 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/40',
    tagColor: 'text-amber-700 dark:text-amber-400',
  },
  {
    tag: 'STEP 3: AUTONOMOUS MATCH',
    title: 'Thursday 11-12',
    text: 'CSE-A free + Prof. Sharma free + Room 204 free.',
    footer: 'Match Score: 96%',
    box: 'bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40 md:col-span-4 lg:col-span-1',
    tagColor: 'text-emerald-700 dark:text-emerald-400',
  },
];

export function RecoveryEngineView() {
  const {
    academicYear,
    makeupTasks,
    recoveryOpportunities,
    courses,
    facultyMembers,
    sections,
    rooms,
    sessions,
    publishedSessions,
    scheduleMakeup,
    declineOpportunity,
    requestSubstituteCover,
  } = useTimetable();

  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [requestedSubs, setRequestedSubs] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const slotLabel = (id: string) => academicYear.timeSlots.find(t => t.id === id)?.label ?? id;
  const activeTask = makeupTasks.find(t => t.id === selectedTaskId) ?? makeupTasks[0];
  const opportunities = recoveryOpportunities.filter(o => o.makeupTaskId === activeTask?.id);
  const topOpportunityId = opportunities.find(o => o.status === 'Proposed')?.id;
  const canSchedule = Boolean(activeTask && activeTask.status !== 'Scheduled' && activeTask.status !== 'Dismissed');
  const activeCourse = courses.find(c => c.id === activeTask?.courseId);

  // Substitutes for the selected cancelled class, checked against the live timetable at its real day/slot.
  const substitutes = activeTask
    ? findSubstituteFaculty(
        activeTask.courseId,
        activeTask.cancelledDay,
        activeTask.cancelledTimeSlot,
        facultyMembers,
        (publishedSessions?.length ? publishedSessions : sessions),
        activeCourse?.code
      ).filter(s => s.faculty.id !== activeTask.facultyId)
    : [];

  /** Runs a server action with a busy flag; resolves to whether it succeeded (the context shows the toast). */
  const runBusy = async (key: string, action: () => Promise<{ success: boolean }>) => {
    setBusy(key);
    try {
      return (await action()).success;
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Title & Operational Header */}
      <div className="border-b border-[#E5E2D9] dark:border-zinc-800 pb-4">
        <div className="flex items-center gap-2 text-[#8C1B2E] dark:text-red-400 text-xs font-semibold uppercase tracking-wider mb-1">
          <RotateCcw className="h-4 w-4" />
          <span>Dynamic Rescheduling & Makeup Routing</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-serif font-bold text-stone-900 dark:text-zinc-100 tracking-tight">
          Automated Recovery & Cross-Cancellation Engine
        </h1>
        <p className="text-xs sm:text-sm text-stone-600 dark:text-zinc-400 mt-1 max-w-3xl leading-relaxed">
          When a class is cancelled, the recovery engine looks for open slots where the teacher, the student group and a suitable room are all free, and ranks them as make-up options.
        </p>
      </div>

      {/* Cross-Cancellation Flow Diagram (static illustration) */}
      <div className="bg-[#FAF9F5] dark:bg-zinc-900 border border-[#E5E2D9] dark:border-zinc-800 rounded-xl p-5 relative overflow-hidden shadow-xs">
        <div className="flex items-center justify-between border-b border-[#E5E2D9] dark:border-zinc-800 pb-3 mb-4">
          <h2 className="text-sm font-serif font-bold text-stone-900 dark:text-zinc-100 flex items-center gap-2">
            <Repeat className="h-4 w-4 text-[#8C1B2E] dark:text-red-400" />
            Cross-Cancellation Matching Mechanism
          </h2>
          <span className="text-[10px] font-semibold text-stone-600 bg-stone-100 px-2 py-0.5 rounded border border-stone-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700">
            Sample
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
          {SAMPLE_FLOW_STEPS.map((step, idx) => (
            <React.Fragment key={step.tag}>
              {idx > 0 && (
                <div className="hidden md:flex justify-center text-stone-400">
                  <ArrowRight className="h-5 w-5" />
                </div>
              )}
              <div className={`p-4 rounded-xl border text-stone-900 dark:text-zinc-100 space-y-1 ${step.box}`}>
                <span className={`text-[10px] font-mono font-bold block ${step.tagColor}`}>{step.tag}</span>
                <div className="font-bold text-sm">{step.title}</div>
                <div className="text-xs text-stone-600 dark:text-zinc-400">{step.text}</div>
                <div className="text-[11px] text-stone-500 dark:text-zinc-500 pt-1 font-mono">{step.footer}</div>
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Main Recovery Workspace: Queue Selection & Ranked Opportunity Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Pending Task Selector */}
        <div className="space-y-4">
          <div className="bg-[#FAF9F5] dark:bg-zinc-900 border border-[#E5E2D9] dark:border-zinc-800 rounded-xl p-4 space-y-3 shadow-xs">
            <h3 className="text-xs font-serif font-bold text-stone-700 dark:text-zinc-300 uppercase tracking-wider">
              Pending Makeups Queue
            </h3>
            <div className="space-y-2">
              {makeupTasks.length === 0 && (
                <p className="text-xs text-stone-500 dark:text-zinc-400">No cancelled classes need a make-up right now.</p>
              )}
              {makeupTasks.map(task => {
                const c = courses.find(cr => cr.id === task.courseId);
                const s = sections.find(sc => sc.id === task.sectionId);
                const isSelected = task.id === activeTask?.id;

                return (
                  <button
                    key={task.id}
                    onClick={() => setSelectedTaskId(task.id)}
                    aria-pressed={isSelected}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${
                      isSelected
                        ? 'bg-red-50 border-[#8C1B2E] text-stone-900 dark:bg-red-950/30 dark:border-red-600 dark:text-zinc-100 shadow-xs'
                        : 'bg-white dark:bg-zinc-950/60 border-[#E5E2D9] dark:border-zinc-800 text-stone-700 dark:text-zinc-300 hover:border-stone-400'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs">{c?.code ?? task.courseId} ({s?.name ?? task.sectionId})</span>
                      <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-red-100 text-[#8C1B2E] dark:bg-red-950/60 dark:text-red-300">
                        P: {task.priorityScore}
                      </span>
                    </div>
                    <div className="text-[11px] text-stone-500 dark:text-zinc-400">
                      Cancelled on {task.cancelledDay} ({slotLabel(task.cancelledTimeSlot)})
                    </div>
                    <div className="text-[10px] text-[#8C1B2E] dark:text-red-400 mt-1 font-medium">
                      Status: {task.status}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Recovery Compatibility Formula (weights used by findSelfHealingRecoverySlots) */}
          <div className="bg-[#FAF9F5] dark:bg-zinc-900 border border-[#E5E2D9] dark:border-zinc-800 rounded-xl p-4 space-y-3 text-xs shadow-xs">
            <div className="flex items-center gap-2 text-stone-800 dark:text-zinc-200 font-semibold border-b border-[#E5E2D9] dark:border-zinc-800 pb-2">
              <Sliders className="h-4 w-4 text-[#8C1B2E] dark:text-red-400" />
              <span>Matching Formula Weights</span>
            </div>
            <div className="space-y-2 font-mono text-[11px]">
              <div className="flex justify-between text-stone-500 dark:text-zinc-400">
                <span>Teacher Availability (w₁)</span>
                <span className="text-stone-900 dark:text-zinc-200 font-semibold">25%</span>
              </div>
              <div className="flex justify-between text-stone-500 dark:text-zinc-400">
                <span>Student Availability (w₂)</span>
                <span className="text-stone-900 dark:text-zinc-200 font-semibold">25%</span>
              </div>
              <div className="flex justify-between text-stone-500 dark:text-zinc-400">
                <span>Room Suitability (w₃)</span>
                <span className="text-stone-900 dark:text-zinc-200 font-semibold">15%</span>
              </div>
              <div className="flex justify-between text-stone-500 dark:text-zinc-400">
                <span>Syllabus Urgency (w₄)</span>
                <span className="text-stone-900 dark:text-zinc-200 font-semibold">15%</span>
              </div>
              <div className="flex justify-between text-stone-500 dark:text-zinc-400">
                <span>Teacher Preference (w₅)</span>
                <span className="text-stone-900 dark:text-zinc-200 font-semibold">10%</span>
              </div>
              <div className="flex justify-between text-stone-500 dark:text-zinc-400">
                <span>Schedule Stability (w₆)</span>
                <span className="text-stone-900 dark:text-zinc-200 font-semibold">10%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Ranked Candidate Recovery Slots */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-[#FAF9F5] dark:bg-zinc-900 border border-[#E5E2D9] dark:border-zinc-800 rounded-xl p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-[#E5E2D9] dark:border-zinc-800 pb-3">
              <div>
                <h3 className="font-serif font-bold text-stone-900 dark:text-zinc-100 text-sm">
                  Ranked Recovery Windows{activeCourse ? ` for ${activeCourse.code}` : ''}
                </h3>
                <p className="text-[11px] text-stone-500 dark:text-zinc-400 mt-0.5">
                  Ordered by match score. Each option was free of teacher, student and room clashes when it was generated; the server re-checks before scheduling.
                </p>
              </div>
              <span className="text-xs font-mono text-[#8C1B2E] dark:text-red-400 font-semibold">
                {opportunities.length} Slots Generated
              </span>
            </div>

            <div className="space-y-3">
              {activeTask && opportunities.length === 0 && (
                <p className="text-xs text-stone-500 dark:text-zinc-400">No free make-up windows were found for this class.</p>
              )}
              {opportunities.map(opp => {
                const isTop = opp.id === topOpportunityId;
                const actionable = canSchedule && opp.status === 'Proposed';
                return (
                  <div
                    key={opp.id}
                    className={`p-4 rounded-xl border transition-all ${
                      isTop
                        ? 'bg-emerald-50/70 border-emerald-300 dark:bg-emerald-950/20 dark:border-emerald-800/40 shadow-xs'
                        : 'bg-white dark:bg-zinc-950/60 border-[#E5E2D9] dark:border-zinc-800'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-base font-bold text-stone-900 dark:text-zinc-100">
                          {opp.targetDay} {slotLabel(opp.timeSlotId)}
                        </span>
                        <span className="text-[11px] text-stone-500 dark:text-zinc-400">
                          {rooms.find(r => r.id === opp.roomId)?.name ?? opp.roomId}
                        </span>
                        {isTop && canSchedule && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30 uppercase tracking-wide">
                            Top Recommendation
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span className="text-xl font-bold font-mono text-emerald-700 dark:text-emerald-400 tabular-nums">
                            {opp.matchScore}%
                          </span>
                          <span className="block text-[10px] text-stone-500 dark:text-zinc-400">Compatibility</span>
                        </div>

                        {actionable ? (
                          <>
                            <button
                              onClick={() => runBusy(`decline:${opp.id}`, () => declineOpportunity(opp.id))}
                              disabled={busy !== null}
                              className="px-3 py-2 bg-white dark:bg-zinc-800 border border-[#E5E2D9] dark:border-zinc-700 text-stone-700 dark:text-zinc-300 rounded-lg text-xs font-medium transition-all disabled:opacity-50"
                            >
                              {busy === `decline:${opp.id}` ? 'Declining…' : 'Decline'}
                            </button>
                            <button
                              onClick={() => runBusy(`schedule:${opp.id}`, () => scheduleMakeup(opp.id))}
                              disabled={busy !== null}
                              className="px-4 py-2 bg-[#8C1B2E] hover:bg-[#731625] text-white rounded-lg text-xs font-semibold shadow-xs transition-all active:scale-95 disabled:opacity-50"
                            >
                              {busy === `schedule:${opp.id}` ? 'Scheduling…' : 'Approve & Schedule'}
                            </button>
                          </>
                        ) : (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded border border-[#E5E2D9] dark:border-zinc-700 text-stone-600 dark:text-zinc-300">
                            {opp.status === 'Proposed' ? 'Not needed' : opp.status}
                          </span>
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-stone-600 dark:text-zinc-300 mb-3 leading-relaxed">
                      {opp.rationale}
                    </p>

                    {/* Factor Matrix breakdown */}
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center pt-2 border-t border-[#E5E2D9] dark:border-zinc-800 text-[10px] font-mono">
                      <div className="p-1.5 bg-[#FAF9F5] dark:bg-zinc-900 rounded border border-[#E5E2D9] dark:border-zinc-800">
                        <span className="text-stone-500 block">Teacher</span>
                        <span className="text-stone-900 dark:text-zinc-200 font-bold">{opp.factors.teacherAvailability}%</span>
                      </div>
                      <div className="p-1.5 bg-[#FAF9F5] dark:bg-zinc-900 rounded border border-[#E5E2D9] dark:border-zinc-800">
                        <span className="text-stone-500 block">Students</span>
                        <span className="text-stone-900 dark:text-zinc-200 font-bold">{opp.factors.studentAvailability}%</span>
                      </div>
                      <div className="p-1.5 bg-[#FAF9F5] dark:bg-zinc-900 rounded border border-[#E5E2D9] dark:border-zinc-800">
                        <span className="text-stone-500 block">Room</span>
                        <span className="text-stone-900 dark:text-zinc-200 font-bold">{opp.factors.roomSuitability}%</span>
                      </div>
                      <div className="p-1.5 bg-[#FAF9F5] dark:bg-zinc-900 rounded border border-[#E5E2D9] dark:border-zinc-800">
                        <span className="text-stone-500 block">Syllabus</span>
                        <span className="text-stone-900 dark:text-zinc-200 font-bold">{opp.factors.syllabusUrgency}%</span>
                      </div>
                      <div className="p-1.5 bg-[#FAF9F5] dark:bg-zinc-900 rounded border border-[#E5E2D9] dark:border-zinc-800">
                        <span className="text-stone-500 block">Pref</span>
                        <span className="text-stone-900 dark:text-zinc-200 font-bold">{opp.factors.preferenceScore}%</span>
                      </div>
                      <div className="p-1.5 bg-[#FAF9F5] dark:bg-zinc-900 rounded border border-[#E5E2D9] dark:border-zinc-800">
                        <span className="text-stone-500 block">Stability</span>
                        <span className="text-stone-900 dark:text-zinc-200 font-bold">{opp.factors.stabilityImpact}%</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Substitute Faculty Engine */}
          <div className="bg-[#FAF9F5] dark:bg-zinc-900 border border-[#E5E2D9] dark:border-zinc-800 rounded-xl p-5 space-y-4 shadow-xs">
            <div className="border-b border-[#E5E2D9] dark:border-zinc-800 pb-3">
              <h3 className="font-serif font-bold text-stone-900 dark:text-zinc-100 text-sm flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-[#8C1B2E] dark:text-red-400" />
                Substitute Faculty Engine
              </h3>
              <p className="text-[11px] text-stone-500 dark:text-zinc-400 mt-0.5">
                {activeTask
                  ? `Qualified teachers for ${activeCourse?.code ?? activeTask.courseId} who are free on ${activeTask.cancelledDay} ${slotLabel(activeTask.cancelledTimeSlot)}, with their current weekly load.`
                  : 'Select a cancelled class to find a substitute teacher.'}
              </p>
            </div>

            <div className="space-y-2">
              {activeTask && substitutes.length === 0 && (
                <p className="text-xs text-stone-500 dark:text-zinc-400">No other teacher is listed as qualified for this course.</p>
              )}
              {activeTask && substitutes.map(({ faculty, isAvailable, compatibilityScore, currentLoad, maxLoad }) => {
                const requestKey = `${activeTask.id}:${faculty.id}`;
                const requested = requestedSubs[requestKey];
                return (
                  <div
                    key={faculty.id}
                    className="p-3 bg-white dark:bg-zinc-950/60 border border-[#E5E2D9] dark:border-zinc-800 rounded-lg flex items-center justify-between text-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="font-bold text-stone-900 dark:text-zinc-100">{faculty.name}</div>
                      <div className="text-[11px] text-stone-500 dark:text-zinc-400">
                        {faculty.designation} · Teaching Load: {currentLoad}/{maxLoad} hrs
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="font-mono font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                          {compatibilityScore}%
                        </div>
                        <div className="text-[10px] text-stone-500 dark:text-zinc-400">Compatibility</div>
                      </div>

                      <button
                        disabled={!isAvailable || requested || busy !== null}
                        onClick={async () => {
                          const ok = await runBusy(`cover:${requestKey}`, () =>
                            requestSubstituteCover(faculty.id, activeTask.courseId, activeTask.sectionId, activeTask.cancelledDay, activeTask.cancelledTimeSlot)
                          );
                          if (ok) setRequestedSubs(prev => ({ ...prev, [requestKey]: true }));
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          requested
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-600/20 dark:text-emerald-300'
                            : isAvailable
                            ? 'bg-[#8C1B2E] hover:bg-[#731625] text-white shadow-xs active:scale-95 disabled:opacity-50'
                            : 'bg-stone-200 text-stone-400 dark:bg-zinc-900 dark:text-zinc-600 cursor-not-allowed border border-[#E5E2D9] dark:border-zinc-800'
                        }`}
                      >
                        {requested
                          ? 'Cover Requested'
                          : busy === `cover:${requestKey}`
                          ? 'Requesting…'
                          : isAvailable
                          ? 'Request Cover'
                          : 'Busy at this time'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
