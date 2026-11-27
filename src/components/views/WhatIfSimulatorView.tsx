import React, { useMemo, useState } from 'react';
import { useTimetable } from '../../context/TimetableContext';
import {
  FlaskConical,
  Play,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldAlert,
  GitBranch,
  Building,
  RotateCcw
} from 'lucide-react';

export function WhatIfSimulatorView() {
  const { applySimulation, health, rooms, facultyMembers, sessions, courses, sections, academicYear } = useTimetable();

  const [activeScenario, setActiveScenario] = useState<string>('lab301-closure');
  const [simulationRunning, setSimulationRunning] = useState<boolean>(false);
  const [hasApplied, setHasApplied] = useState<boolean>(false);
  const [feedback, setFeedback] = useState('');

  const scenarios = [
    {
      id: 'lab301-closure',
      title: 'Hardware Lab Closure',
      description: 'A hardware lab is taken out of service. The simulator looks for compatible rooms in the current timetable.',
      target: 'Hardware lab',
    },
    {
      id: 'faculty-leave',
      title: 'Faculty Leave / Absence Scenario',
      description: 'A faculty member is unavailable. The simulator checks qualified faculty for schedule conflicts.',
      target: 'Faculty member',
    },
    {
      id: 'exam-block',
      title: 'Auditorium 101 Reserved for GATE Mock Exams',
      description: 'A large lecture hall is blocked. The simulator finds available rooms that can hold each section.',
      target: 'Lecture hall',
    },
  ];

  const targetRoom = useMemo(() => activeScenario === 'exam-block'
    ? [...rooms].filter((room) => room.type === 'LectureHall' && room.isAvailable).sort((a, b) => b.capacity - a.capacity)[0]
    : rooms.find((room) => /lab\s*301/i.test(`${room.id} ${room.name}`)) || rooms.find((room) => room.type === 'HardwareLab' && room.isAvailable), [activeScenario, rooms]);
  const targetFaculty = useMemo(() => facultyMembers.find((faculty) => /arvind sharma/i.test(faculty.name) && sessions.some((session) => session.facultyId === faculty.id))
    || facultyMembers.find((faculty) => sessions.some((session) => session.facultyId === faculty.id)), [facultyMembers, sessions]);
  const simulationDiff = useMemo(() => {
    const affected = sessions.filter((session) => session.status !== 'Cancelled' && (activeScenario === 'faculty-leave'
      ? session.facultyId === targetFaculty?.id
      : session.roomId === targetRoom?.id));
    const affectedIds = new Set(affected.map((session) => session.id));
    const occupied = new Set(sessions.filter((session) => session.status !== 'Cancelled' && !affectedIds.has(session.id))
      .flatMap((session) => [`r:${session.day}:${session.timeSlotId}:${session.roomId}`, `f:${session.day}:${session.timeSlotId}:${session.facultyId}`]));
    return affected.map((original) => {
      const section = sections.find((item) => item.id === original.sectionId);
      const course = courses.find((item) => item.id === original.courseId);
      if (activeScenario === 'faculty-leave') {
        const substitute = facultyMembers.find((faculty) => faculty.id !== targetFaculty?.id
          && faculty.subjectsQualified.includes(original.courseId)
          && !occupied.has(`f:${original.day}:${original.timeSlotId}:${faculty.id}`));
        return { original, roomId: original.roomId, facultyId: substitute?.id || original.facultyId, changed: Boolean(substitute), reason: substitute ? 'Qualified substitute available' : 'No qualified free substitute' };
      }
      const replacement = rooms.find((room) => room.isAvailable && room.id !== targetRoom?.id
        && room.capacity >= (section?.studentCount || 0)
        && (!course?.requiresLab || ['ComputerLab', 'HardwareLab'].includes(room.type))
        && !occupied.has(`r:${original.day}:${original.timeSlotId}:${room.id}`));
      return { original, roomId: replacement?.id || original.roomId, facultyId: original.facultyId, changed: Boolean(replacement), reason: replacement ? 'Compatible replacement room' : 'No compatible room available' };
    });
  }, [activeScenario, courses, facultyMembers, rooms, sections, sessions, targetFaculty?.id, targetRoom?.id]);
  const changedCount = simulationDiff.filter((diff) => diff.changed).length;
  const roomChangeCount = simulationDiff.filter((diff) => diff.changed && diff.roomId !== diff.original.roomId).length;
  const unresolvedCount = simulationDiff.length - changedCount;
  const stabilityScore = simulationDiff.length
    ? Math.max(0, Math.round(100 - unresolvedCount / simulationDiff.length * 100))
    : 100;
  const projectedHealth = Math.max(0, health.overallScore - unresolvedCount * 2);
  const sessionLabel = (session: typeof sessions[number], roomId: string, facultyId: string) => {
    const course = courses.find((item) => item.id === session.courseId);
    const slot = academicYear.timeSlots.find((item) => item.id === session.timeSlotId);
    const room = rooms.find((item) => item.id === roomId);
    const faculty = facultyMembers.find((item) => item.id === facultyId);
    const section = sections.find((item) => item.id === session.sectionId);
    return { course: `${course?.code || session.courseId} ${course?.name || ''}`, detail: `${session.day} ${slot?.startTime || session.timeSlotId} · ${section?.name || session.sectionId} · ${room?.name || roomId}${faculty ? ` · ${faculty.name}` : ''}` };
  };

  const handleRunSimulation = () => {
    setSimulationRunning(true);
    setTimeout(() => {
      setSimulationRunning(false);
      setHasApplied(false);
      setFeedback(`Optimization complete: ${simulationDiff.length} affected classes, ${changedCount} feasible changes, ${simulationDiff.length - changedCount} requiring coordinator review.`);
    }, 400);
  };

  const handleApply = () => {
    applySimulation();
    setHasApplied(true);
    setFeedback('Simulation result recorded. The live timetable was not changed.');
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="border-b border-[#E5E2D9] dark:border-zinc-800 pb-4">
        <div className="flex items-center gap-2 text-[#8C1B2E] dark:text-red-400 text-xs font-semibold uppercase tracking-wider mb-1">
          <FlaskConical className="h-4 w-4" />
          <span>Non-Destructive Schedule Impact Analysis</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-serif font-bold text-stone-900 dark:text-zinc-100 tracking-tight">
          Timetable Impact Analysis & What-If Simulator
        </h1>
        <p className="text-xs sm:text-sm text-stone-600 dark:text-zinc-400 mt-1 max-w-3xl leading-relaxed">
          Check current schedule assignments against room capacity and faculty availability. Recommended changes are a preview; the live timetable remains unchanged.
        </p>
      </div>

      {/* Scenario Selection Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {scenarios.map(s => {
          const isSelected = activeScenario === s.id;
          return (
            <button
              key={s.id}
              onClick={() => {
                setActiveScenario(s.id);
                setHasApplied(false);
                setFeedback('');
              }}
              className={`text-left p-4 rounded-xl border transition-all ${
                isSelected
                  ? 'bg-red-50/70 border-[#8C1B2E] text-stone-900 dark:bg-red-950/20 dark:border-red-600 dark:text-zinc-100 shadow-xs'
                  : 'bg-[#FAF9F5] dark:bg-zinc-900 border-[#E5E2D9] dark:border-zinc-800 text-stone-700 dark:text-zinc-300 hover:border-stone-400'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold font-mono text-[#8C1B2E] dark:text-red-400">
                  SCENARIO
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-stone-100 dark:bg-zinc-800 text-stone-600 dark:text-zinc-400 font-mono border border-[#E5E2D9] dark:border-zinc-700">
                  {activeScenario === s.id ? (s.id === 'faculty-leave' ? targetFaculty?.name || 'No faculty with classes' : targetRoom?.name || 'No matching room') : s.target}
                </span>
              </div>
              <h3 className="font-serif font-bold text-sm text-stone-900 dark:text-zinc-100 mb-1.5">{s.title}</h3>
              <p className="text-xs text-stone-500 dark:text-zinc-400 leading-relaxed">{s.description}</p>
            </button>
          );
        })}
      </div>

      {/* Simulation Controls & Side-by-Side Comparison */}
      <div className="bg-[#FAF9F5] dark:bg-zinc-900 border border-[#E5E2D9] dark:border-zinc-800 rounded-xl p-5 space-y-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E5E2D9] dark:border-zinc-800 pb-3">
          <div>
            <span className="text-[10px] font-mono text-[#8C1B2E] dark:text-red-400 font-semibold uppercase tracking-wider">
              Simulation Sandbox · Active Run
            </span>
            <h2 className="text-lg font-serif font-bold text-stone-900 dark:text-zinc-100 mt-0.5">
              {scenarios.find(s => s.id === activeScenario)?.title}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleRunSimulation}
              disabled={simulationRunning}
              className="flex items-center gap-2 px-3.5 py-2 bg-stone-100 hover:bg-stone-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-stone-800 dark:text-zinc-200 border border-[#E5E2D9] dark:border-zinc-700 rounded-lg text-xs font-semibold transition-colors"
            >
              <RotateCcw className={`h-3.5 w-3.5 ${simulationRunning ? 'animate-spin' : ''}`} />
              <span>Re-run Optimization</span>
            </button>

            <button
              onClick={handleApply}
              disabled={hasApplied}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold shadow-xs transition-all ${
                hasApplied
                  ? 'bg-emerald-700 text-white cursor-default'
                  : 'bg-[#8C1B2E] hover:bg-[#731625] text-white active:scale-95'
              }`}
            >
              {hasApplied ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Applied to Master V2.0</span>
                </>
              ) : (
                <>
                  <GitBranch className="h-3.5 w-3.5" />
                  <span>Record Simulation Result</span>
                </>
              )}
            </button>
          </div>
        </div>
        {feedback && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">{feedback}</p>}

        {/* Quantified Impact Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
          <div className="p-3.5 bg-white dark:bg-zinc-950/60 rounded-xl border border-[#E5E2D9] dark:border-zinc-800 shadow-xs">
            <span className="text-[11px] text-stone-500 dark:text-zinc-400 block mb-1">Affected Classes</span>
            <span className="text-2xl font-bold font-mono text-stone-900 dark:text-zinc-100 tabular-nums">
              {simulationDiff.length}
            </span>
            <span className="text-[10px] text-stone-400 dark:text-zinc-500 block mt-1">From {sessions.length} scheduled classes</span>
          </div>

          <div className="p-3.5 bg-white dark:bg-zinc-950/60 rounded-xl border border-[#E5E2D9] dark:border-zinc-800 shadow-xs">
            <span className="text-[11px] text-stone-500 dark:text-zinc-400 block mb-1">Required Room Changes</span>
            <span className="text-2xl font-bold font-mono text-amber-700 dark:text-amber-400 tabular-nums">
              {roomChangeCount}
            </span>
            <span className="text-[10px] text-amber-700/80 block mt-1">Based on available compatible rooms</span>
          </div>

          <div className="p-3.5 bg-white dark:bg-zinc-950/60 rounded-xl border border-[#E5E2D9] dark:border-zinc-800 shadow-xs">
            <span className="text-[11px] text-stone-500 dark:text-zinc-400 block mb-1">Unresolved Assignments</span>
            <span className={`text-2xl font-bold font-mono tabular-nums ${unresolvedCount === 0 ? 'text-emerald-700 dark:text-emerald-400' : unresolvedCount / Math.max(1, simulationDiff.length) > 0.5 ? 'text-rose-700 dark:text-rose-400' : 'text-amber-700 dark:text-amber-400'}`}>
              {unresolvedCount}
            </span>
            <span className={`text-[10px] block mt-1 ${unresolvedCount === 0 ? 'text-emerald-700 dark:text-emerald-400' : unresolvedCount / Math.max(1, simulationDiff.length) > 0.5 ? 'text-rose-700 dark:text-rose-400' : 'text-amber-700 dark:text-amber-400'}`}>Classes needing manual review</span>
          </div>

          <div className="p-3.5 bg-white dark:bg-zinc-950/60 rounded-xl border border-[#E5E2D9] dark:border-zinc-800 shadow-xs">
            <span className="text-[11px] text-stone-500 dark:text-zinc-400 block mb-1">Schedule Stability</span>
            <span className={`text-2xl font-bold font-mono tabular-nums ${stabilityScore >= 80 ? 'text-emerald-700 dark:text-emerald-400' : stabilityScore >= 50 ? 'text-amber-700 dark:text-amber-400' : 'text-rose-700 dark:text-rose-400'}`}>
              {stabilityScore}%
            </span>
            <span className="text-[10px] text-stone-400 dark:text-zinc-500 block mt-1">Based on feasible changes / schedule size</span>
          </div>

          <div className="p-3.5 bg-white dark:bg-zinc-950/60 rounded-xl border border-[#E5E2D9] dark:border-zinc-800 shadow-xs">
            <span className="text-[11px] text-stone-500 dark:text-zinc-400 block mb-1">Projected Health Score</span>
            <span className="text-2xl font-bold font-mono text-emerald-700 dark:text-emerald-400 tabular-nums">
              {projectedHealth}
            </span>
            <span className="text-[10px] text-stone-400 dark:text-zinc-500 block mt-1">Current: {health.overallScore}</span>
          </div>
        </div>

        {/* Side-by-Side Schedule Comparison (V1 vs Candidate V2) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-white dark:bg-zinc-950/80 border border-[#E5E2D9] dark:border-zinc-800 space-y-3 shadow-xs">
            <div className="flex items-center justify-between border-b border-[#E5E2D9] dark:border-zinc-800 pb-2">
              <span className="font-bold text-xs text-stone-800 dark:text-zinc-200">Master Schedule V1.0 (Live Baseline)</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-stone-100 dark:bg-zinc-800 text-stone-600 dark:text-zinc-400 border border-[#E5E2D9] dark:border-zinc-700">
                {sessions.length} classes
              </span>
            </div>
            <ul className="text-xs text-stone-600 dark:text-zinc-400 space-y-2">
              {simulationDiff.map((diff) => { const label = sessionLabel(diff.original, diff.original.roomId, diff.original.facultyId); return <li key={diff.original.id} className="flex flex-col justify-between gap-1 sm:flex-row"><span>{label.course}</span><span className="font-mono text-stone-800 dark:text-zinc-300">{label.detail}</span></li>; })}
              {simulationDiff.length === 0 && <li>No scheduled classes match this scenario.</li>}
            </ul>
          </div>

          <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-300 dark:bg-emerald-950/20 dark:border-emerald-800/40 space-y-3 shadow-xs">
            <div className="flex items-center justify-between border-b border-emerald-200 dark:border-emerald-800/40 pb-2">
              <span className="font-bold text-xs text-emerald-900 dark:text-emerald-300">Simulated Candidate V2.0 (Optimized)</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300 font-semibold">
                {unresolvedCount === 0 ? 'All affected classes have a feasible change' : `${unresolvedCount} require manual review`}
              </span>
            </div>
            <ul className="text-xs text-emerald-900 dark:text-emerald-200/90 space-y-2">
              {simulationDiff.map((diff) => { const label = sessionLabel(diff.original, diff.roomId, diff.facultyId); return <li key={diff.original.id} className="flex flex-col justify-between gap-1 sm:flex-row"><span>{label.course}</span><span className="font-mono text-emerald-700 dark:text-emerald-400 font-semibold">{label.detail} · {diff.reason}</span></li>; })}
              {simulationDiff.length === 0 && <li>No candidate changes required.</li>}
            </ul>
          </div>
        </div>

        {/* Solver Recommended Next Actions */}
        <div className="p-4 bg-white dark:bg-zinc-950/60 rounded-xl border border-[#E5E2D9] dark:border-zinc-800 space-y-2 text-xs shadow-xs">
          <span className="font-semibold text-stone-900 dark:text-zinc-200 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            Optimization Solver Recommendation & Mitigation Strategy
          </span>
          <ul className="text-stone-600 dark:text-zinc-400 space-y-1 list-disc list-inside text-[11px] leading-relaxed">
            <li>{simulationDiff.length} active sessions match the selected disruption scenario.</li>
            <li>{changedCount} feasible placement changes were found; {unresolvedCount} need manual review.</li>
            <li>{roomChangeCount} of the feasible changes require a different room.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
