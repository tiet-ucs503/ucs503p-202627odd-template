import React, { useState } from 'react';
import { useTimetable } from '../../context/TimetableContext';
import type { TimeSlot } from '../../types';
import { facultyTeachingCap, facultyTeachingPeriods } from '../../lib/facultyWorkload';
import {
  BarChart3,
  BookOpen,
  ShieldCheck,
  Info
} from 'lucide-react';

/** Length of a period in hours from its "HH:MM" start/end (1 if unparseable). */
const slotHours = (slot?: TimeSlot) => {
  if (!slot) return 1;
  const mins = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  const h = (mins(slot.endTime) - mins(slot.startTime)) / 60;
  return Number.isFinite(h) && h > 0 ? h : 1;
};
const fmtHrs = (h: number) => `${Math.round(h * 10) / 10}`;

export function WorkloadSyllabusView() {
  const { academicYear, courses, facultyMembers, sessions } = useTimetable();
  const [coursePage, setCoursePage] = useState(0);
  const [facultyPage, setFacultyPage] = useState(0);
  const pageSize = 50;
  const coursePageCount = Math.max(1, Math.ceil(courses.length / pageSize));
  const facultyPageCount = Math.max(1, Math.ceil(facultyMembers.length / pageSize));
  const visibleCourses = courses.slice(coursePage * pageSize, (coursePage + 1) * pageSize);
  const visibleFaculty = facultyMembers.slice(facultyPage * pageSize, (facultyPage + 1) * pageSize);

  const slotById = new Map(academicYear.timeSlots.map(t => [t.id, t]));
  // Weekly direct-teaching hours per faculty member, from the (non-cancelled) timetable sessions.
  const loadByFaculty = new Map(facultyMembers.map((faculty) => [faculty.id, facultyTeachingPeriods(sessions, faculty.id)]));
  const overloadedCount = facultyMembers.filter(f => (loadByFaculty.get(f.id) ?? 0) > facultyTeachingCap(f)).length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="border-b border-[#E5E2D9] dark:border-zinc-800 pb-4">
        <div className="flex items-center gap-2 text-[#8C1B2E] dark:text-red-400 text-xs font-semibold uppercase tracking-wider mb-1">
          <BarChart3 className="h-4 w-4" />
          <span>Academic Operations</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-serif font-bold text-stone-900 dark:text-zinc-100 tracking-tight">
          Syllabus Progress & Faculty UGC Workload
        </h1>
        <p className="text-xs text-stone-600 dark:text-zinc-400 mt-1 max-w-3xl leading-relaxed">
          Syllabus progress per course, and each faculty member's weekly teaching load from the timetable compared with their teaching cap.
        </p>
      </div>

      {/* Syllabus Progress & Risk Breakdown */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-serif font-bold text-stone-900 dark:text-zinc-100 flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-[#8C1B2E] dark:text-red-400" />
            <span>Syllabus Completion & Course Progress</span>
          </h2>
          <span className="text-xs text-stone-500 dark:text-zinc-400 font-mono flex items-center gap-1.5">
            Progress uses timetable sessions marked Completed or Cancelled.
          </span>
        </div>

        {courses.length === 0 && (
          <div className="p-4 bg-[#FAF9F5] dark:bg-zinc-900 border border-[#E5E2D9] dark:border-zinc-800 rounded-xl text-xs text-stone-500 dark:text-zinc-400 italic">
            No courses yet.
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleCourses.map(course => {
            const faculty = facultyMembers.find(f => f.id === course.primaryFacultyId);
            const courseSessions = sessions.filter(session => session.courseId === course.id);
            const completedHours = courseSessions.filter(session => session.status === 'Completed').reduce((sum, session) => sum + slotHours(slotById.get(session.timeSlotId)), 0);
            const cancelledHours = courseSessions.filter(session => session.status === 'Cancelled').reduce((sum, session) => sum + slotHours(slotById.get(session.timeSlotId)), 0);
            const remaining = Math.max(0, course.totalSemesterHours - completedHours);
            const completionPercent = course.totalSemesterHours > 0
              ? Math.min(100, Math.round((completedHours / course.totalSemesterHours) * 100))
              : 0;

            // Risk from cancelled (not yet recovered) hours
            let risk: 'GREEN' | 'YELLOW' | 'RED' | 'NOT_STARTED' = completionPercent === 0 ? 'NOT_STARTED' : 'GREEN';
            let riskNote = completionPercent === 0 ? 'No completed sessions recorded' : 'No cancelled hours';

            if (cancelledHours >= 2) {
              risk = 'RED';
              riskNote = `${fmtHrs(cancelledHours)}h cancelled — make-up classes needed`;
            } else if (cancelledHours > 0) {
              risk = 'YELLOW';
              riskNote = `${fmtHrs(cancelledHours)}h cancelled — schedule a make-up class`;
            }

            return (
              <div
                key={course.id}
                className="bg-[#FAF9F5] dark:bg-zinc-900 border border-[#E5E2D9] dark:border-zinc-800 rounded-xl p-5 space-y-4 shadow-xs"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs font-mono font-bold text-[#8C1B2E] dark:text-red-400">
                      {course.code}
                    </span>
                    <h3 className="font-serif font-bold text-sm text-stone-900 dark:text-zinc-100 mt-0.5">{course.name}</h3>
                    <div className="text-[11px] text-stone-500 dark:text-zinc-400 mt-1">
                      Lead: {faculty?.name ?? 'Unassigned'}
                    </div>
                  </div>

                  <span
                    className={`shrink-0 whitespace-nowrap text-[10px] font-mono font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${
                      risk === 'RED'
                        ? 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/30'
                        : risk === 'YELLOW'
                        ? 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30'
                        : risk === 'NOT_STARTED'
                        ? 'bg-stone-100 text-stone-700 border-stone-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700'
                        : 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30'
                    }`}
                  >
                    {risk === 'NOT_STARTED' ? 'Not Started' : `Risk: ${risk}`}
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-stone-500 dark:text-zinc-400">Completion</span>
                    <span className="text-stone-900 dark:text-zinc-100 font-bold">{completionPercent}%</span>
                  </div>
                  <div className="h-2 w-full bg-stone-200 dark:bg-zinc-950 rounded-full overflow-hidden border border-[#E5E2D9] dark:border-zinc-800">
                    <div
                      className={`h-full transition-all duration-500 ${
                        risk === 'RED' ? 'bg-[#8C1B2E]' : risk === 'YELLOW' ? 'bg-amber-600' : risk === 'NOT_STARTED' ? 'bg-stone-300 dark:bg-zinc-700' : 'bg-emerald-600'
                      }`}
                      style={{ width: `${completionPercent}%` }}
                    />
                  </div>
                </div>

                {/* Numbers Grid */}
                <div className="grid grid-cols-4 gap-2 text-center text-[10px] font-mono pt-2 border-t border-[#E5E2D9] dark:border-zinc-800">
                  <div className="p-1.5 bg-white dark:bg-zinc-950/60 rounded border border-[#E5E2D9] dark:border-zinc-800">
                    <span className="text-stone-500 dark:text-zinc-500 block">Required</span>
                    <span className="text-stone-800 dark:text-zinc-200 font-bold">{course.totalSemesterHours}h</span>
                  </div>
                  <div className="p-1.5 bg-white dark:bg-zinc-950/60 rounded border border-[#E5E2D9] dark:border-zinc-800">
                    <span className="text-stone-500 dark:text-zinc-500 block">Done</span>
                    <span className="text-emerald-700 dark:text-emerald-400 font-bold">{fmtHrs(completedHours)}h</span>
                  </div>
                  <div className="p-1.5 bg-white dark:bg-zinc-950/60 rounded border border-[#E5E2D9] dark:border-zinc-800">
                    <span className="text-stone-500 dark:text-zinc-500 block">Cancelled</span>
                    <span className="text-rose-700 dark:text-rose-400 font-bold">{fmtHrs(cancelledHours)}h</span>
                  </div>
                  <div className="p-1.5 bg-white dark:bg-zinc-950/60 rounded border border-[#E5E2D9] dark:border-zinc-800">
                    <span className="text-stone-500 dark:text-zinc-500 block">Remain</span>
                    <span className="text-amber-700 dark:text-amber-400 font-bold">{remaining}h</span>
                  </div>
                </div>

                <div className="text-[11px] text-stone-500 dark:text-zinc-400 flex items-center gap-1.5">
                  <Info className="h-3 w-3 shrink-0 text-stone-400 dark:text-zinc-500" />
                  <span>{riskNote}</span>
                </div>
              </div>
            );
          })}
        </div>
        {courses.length > pageSize && <div className="flex items-center justify-between text-xs text-stone-500 dark:text-zinc-400">
          <span>{coursePage * pageSize + 1}–{Math.min((coursePage + 1) * pageSize, courses.length)} of {courses.length} courses</span>
          <div className="flex gap-2"><button type="button" disabled={coursePage === 0} onClick={() => setCoursePage(page => Math.max(0, page - 1))} className="rounded border border-[#E5E2D9] px-2 py-1 disabled:opacity-40 dark:border-zinc-700">Previous</button><button type="button" disabled={coursePage + 1 >= coursePageCount} onClick={() => setCoursePage(page => Math.min(coursePageCount - 1, page + 1))} className="rounded border border-[#E5E2D9] px-2 py-1 disabled:opacity-40 dark:border-zinc-700">Next</button></div>
        </div>}
      </div>

      {/* UGC Faculty Workload Matrix */}
      <div className="bg-[#FAF9F5] dark:bg-zinc-900 border border-[#E5E2D9] dark:border-zinc-800 rounded-xl p-6 space-y-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E5E2D9] dark:border-zinc-800 pb-4">
          <div>
            <h2 className="text-base font-serif font-bold text-stone-900 dark:text-zinc-100 flex items-center gap-2">
              <ShieldCheck className={`h-5 w-5 ${overloadedCount ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`} />
              <span>UGC 2026 Faculty Direct Teaching Compliance</span>
            </h2>
            <p className="text-xs text-stone-500 dark:text-zinc-400 mt-0.5">
              Professors/Associate: 14 teaching hrs/wk · Assistant Professors: 16 teaching hrs/wk · Overall 40 hrs institutional
            </p>
          </div>

          {facultyMembers.length > 0 && sessions.length > 0 && (
            <span
              className={`text-xs font-mono px-3 py-1 rounded-full border font-semibold self-start sm:self-auto ${
                overloadedCount
                  ? 'text-rose-800 dark:text-rose-300 bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30'
                  : 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20'
              }`}
            >
              {overloadedCount
                ? `${overloadedCount} of ${facultyMembers.length} faculty over their cap`
                : `All ${facultyMembers.length} faculty within their cap`}
            </span>
          )}
        </div>

        {sessions.length === 0 && (
          <div className="text-xs text-stone-500 dark:text-zinc-400 italic">
            No timetable yet — loads will appear once sessions are scheduled.
          </div>
        )}

        <div className="divide-y divide-[#E5E2D9] dark:divide-zinc-800">
          {visibleFaculty.map(faculty => {
            const activeHours = loadByFaculty.get(faculty.id) ?? 0;
            const cap = facultyTeachingCap(faculty);
            const isOverloaded = activeHours > cap;
            const researchHours = (faculty.preferences?.protectedSlots ?? [])
              .filter(p => p.reason === 'Research')
              .reduce((n, p) => n + slotHours(slotById.get(p.periodId)), 0);

            return (
              <div key={faculty.id} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
                <div className="w-64 shrink-0">
                  <div className="font-bold text-stone-900 dark:text-white text-sm">{faculty.name}</div>
                  <div className="text-stone-500 dark:text-zinc-400 text-[11px]">{faculty.designation} · {faculty.email}</div>
                </div>

                {/* Hours Metric Bar */}
                <div className="flex-1 max-w-md space-y-1.5">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-stone-500 dark:text-zinc-400">Direct Teaching Load</span>
                    <span className="text-stone-800 dark:text-zinc-200 font-bold">
                      {fmtHrs(activeHours)} / {cap} hrs
                    </span>
                  </div>
                  <div className="h-2 w-full bg-stone-200 dark:bg-zinc-950 rounded-full overflow-hidden border border-[#E5E2D9] dark:border-zinc-800">
                    <div
                      className={`h-full transition-all duration-300 ${
                        isOverloaded ? 'bg-[#8C1B2E]' : 'bg-stone-700 dark:bg-zinc-400'
                      }`}
                      style={{
                        width: `${cap > 0 ? Math.min(100, Math.round((activeHours / cap) * 100)) : activeHours > 0 ? 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0 text-right">
                  <div>
                    <span className="text-stone-500 dark:text-zinc-400 block text-[10px]">Research Hours</span>
                    <span className="font-mono text-stone-800 dark:text-zinc-200 font-semibold">{fmtHrs(researchHours)} hrs (Protected)</span>
                  </div>

                  <span
                    className={`px-3 py-1 rounded-full text-[11px] font-semibold font-mono ${
                      isOverloaded
                        ? 'bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/30'
                        : 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/20'
                    }`}
                  >
                    {isOverloaded ? 'Over Cap' : 'Within Cap'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        {facultyMembers.length > pageSize && <div className="flex items-center justify-between text-xs text-stone-500 dark:text-zinc-400">
          <span>{facultyPage * pageSize + 1}–{Math.min((facultyPage + 1) * pageSize, facultyMembers.length)} of {facultyMembers.length} faculty</span>
          <div className="flex gap-2"><button type="button" disabled={facultyPage === 0} onClick={() => setFacultyPage(page => Math.max(0, page - 1))} className="rounded border border-[#E5E2D9] px-2 py-1 disabled:opacity-40 dark:border-zinc-700">Previous</button><button type="button" disabled={facultyPage + 1 >= facultyPageCount} onClick={() => setFacultyPage(page => Math.min(facultyPageCount - 1, page + 1))} className="rounded border border-[#E5E2D9] px-2 py-1 disabled:opacity-40 dark:border-zinc-700">Next</button></div>
        </div>}
      </div>
    </div>
  );
}
