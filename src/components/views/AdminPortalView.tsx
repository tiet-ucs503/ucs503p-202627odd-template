import React from 'react';
import { useTimetable } from '../../context/TimetableContext';
import { Shield, ArrowRight } from 'lucide-react';

import { TimetableGridView } from './TimetableGridView';
import { GovernanceView } from './GovernanceView';
import { AuthGovernanceView } from './AuthGovernanceView';

export function AdminPortalView() {
  const {
    health,
    publishedSessions,
    versions,
    activeVersionNumber,
    rooms,
    facultyMembers,
    courses,
    activeView,
    setActiveView,
  } = useTimetable();

  // The admin workspace renders its screens from the shared activeView, so the sidebar and these tabs agree.
  const subView =
    activeView === 'grid' ? 'grid' : activeView === 'governance' ? 'audit' : activeView === 'auth_gov' ? 'users' : 'overview';

  const activeFaculty = facultyMembers.filter(f => f.status !== 'Inactive').length;
  const activeCourses = courses.filter(c => c.status !== 'Archived').length;
  const buildings = [...new Set(rooms.map(r => r.building).filter(Boolean))];
  // Hard violations of the working draft as measured by the server's validator when the version was saved.
  const draftConflicts =
    versions.find(v => v.versionNumber === activeVersionNumber)?.hardViolationsCount ?? health.hardConstraintViolations;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E5E2D9] dark:border-zinc-800 pb-4">
        <div>
          <div className="flex items-center gap-2 text-[#8C1B2E] dark:text-red-400 text-xs font-semibold tracking-wider mb-0.5">
            <Shield className="h-4 w-4" />
            <span>Academic Administration & Governance</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-stone-900 dark:text-zinc-100 tracking-tight">
            Admin Console
          </h1>
          <p className="text-xs text-stone-600 dark:text-zinc-400 mt-0.5">
            Overview of university rooms, timetable approvals, and user accounts.
          </p>
        </div>

      </div>

      {/* Main Content Area */}
      {subView === 'overview' && (
        <div className="space-y-6">
          {/* Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 bg-[#FAF9F5] dark:bg-zinc-900/50 border border-[#E5E2D9] dark:border-zinc-800 rounded-xl space-y-1 shadow-xs">
              <span className="text-xs text-stone-500 dark:text-zinc-400 font-medium">Total Faculty</span>
              <div className="text-2xl font-bold font-serif text-stone-900 dark:text-zinc-100">{facultyMembers.length}</div>
              <span className="text-[11px] text-stone-500 dark:text-zinc-400">{activeFaculty} active</span>
            </div>

            <div className="p-4 bg-[#FAF9F5] dark:bg-zinc-900/50 border border-[#E5E2D9] dark:border-zinc-800 rounded-xl space-y-1 shadow-xs">
              <span className="text-xs text-stone-500 dark:text-zinc-400 font-medium">Total Courses</span>
              <div className="text-2xl font-bold font-serif text-stone-900 dark:text-zinc-100">{courses.length}</div>
              <span className="text-[11px] text-stone-500 dark:text-zinc-400">{activeCourses} active offerings</span>
            </div>

            <div className="p-4 bg-[#FAF9F5] dark:bg-zinc-900/50 border border-[#E5E2D9] dark:border-zinc-800 rounded-xl space-y-1 shadow-xs">
              <span className="text-xs text-stone-500 dark:text-zinc-400 font-medium">Classrooms & Labs</span>
              <div className="text-2xl font-bold font-serif text-stone-900 dark:text-zinc-100">{rooms.length}</div>
              <span className="break-words text-[11px] text-stone-500 dark:text-zinc-400" title={buildings.join(', ')}>
                {buildings.length ? buildings.join(', ') : 'No rooms yet'}
              </span>
            </div>

            <div className="p-4 bg-[#FAF9F5] dark:bg-zinc-900/50 border border-[#E5E2D9] dark:border-zinc-800 rounded-xl space-y-1 shadow-xs">
              <span className="text-xs text-stone-500 dark:text-zinc-400 font-medium">Timetable Health</span>
              <div className="text-2xl font-bold font-serif text-stone-900 dark:text-zinc-100">
                {publishedSessions?.length ? `${versions.find(version => version.versionNumber === activeVersionNumber)?.healthScore ?? health.overallScore}%` : '—'}
              </div>
              {!publishedSessions?.length ? (
                <span className="text-[11px] text-stone-500 dark:text-zinc-400">No timetable yet</span>
              ) : draftConflicts === 0 ? (
                <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">No clashes</span>
              ) : (
                <span className="text-[11px] text-rose-700 dark:text-rose-400 font-medium">{draftConflicts} hard clashes</span>
              )}
            </div>
          </div>

          {/* Quick Action Navigation */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={() => setActiveView('grid')}
              className="text-left p-4 bg-[#FAF9F5] dark:bg-zinc-900 border border-[#E5E2D9] dark:border-zinc-800 rounded-xl cursor-pointer hover:border-[#8C1B2E] transition-all shadow-xs space-y-2 group"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-stone-900 dark:text-zinc-100 text-sm group-hover:text-[#8C1B2E] transition-colors">View Full Master Timetable</span>
                <ArrowRight className="h-4 w-4 text-stone-400 group-hover:text-[#8C1B2E] transition-colors" />
              </div>
              <p className="text-xs text-stone-600 dark:text-zinc-400">
                Inspect weekly class schedules across all sections, teachers, and rooms, and publish the working draft.
              </p>
            </button>

            <button
              onClick={() => setActiveView('governance')}
              className="text-left p-4 bg-[#FAF9F5] dark:bg-zinc-900 border border-[#E5E2D9] dark:border-zinc-800 rounded-xl cursor-pointer hover:border-[#8C1B2E] transition-all shadow-xs space-y-2 group"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-stone-900 dark:text-zinc-100 text-sm group-hover:text-[#8C1B2E] transition-colors">Approvals & Timetable Status</span>
                <ArrowRight className="h-4 w-4 text-stone-400 group-hover:text-[#8C1B2E] transition-colors" />
              </div>
              <p className="text-xs text-stone-600 dark:text-zinc-400">
                Review timetable versions, locks, and the audit trail.
              </p>
            </button>
          </div>
        </div>
      )}

      {subView === 'grid' && <TimetableGridView />}
      {subView === 'audit' && <GovernanceView />}
      {subView === 'users' && <AuthGovernanceView />}
    </div>
  );
}
