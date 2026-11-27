import React from 'react';

interface AcademicSetupOverviewProps {
  academicYearLabel: string;
  semesterType: string;
  workingDays: string[];
  periodsRange: string;
  counts: {
    departments: number;
    programs: number;
    courses: number;
    faculty: number;
    rooms: number;
    sections: number;
    subgroups: number;
    allocations: number;
  };
}

export function AcademicSetupOverview({
  academicYearLabel,
  semesterType,
  workingDays,
  periodsRange,
  counts,
}: AcademicSetupOverviewProps) {
  return (
    <div id="overview" className="bg-[#FAF9F5] dark:bg-zinc-900 border border-[#E5E2D9] dark:border-zinc-800 rounded-xl p-4 sm:p-5 space-y-4 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E5E2D9] dark:border-zinc-800 pb-3">
        <div>
          <h2 className="font-serif text-lg font-bold text-stone-900 dark:text-zinc-100">
            Setup Overview & Academic Scope
          </h2>
          <p className="text-xs text-stone-500 dark:text-zinc-400 mt-0.5">
            Active scheduling context for institutional timetable generation
          </p>
        </div>

        {/* Configuration pills */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="px-2.5 py-1 rounded-md bg-stone-100 dark:bg-zinc-800 border border-[#E5E2D9] dark:border-zinc-700 font-medium text-stone-800 dark:text-zinc-200">
            Academic Year: <strong className="font-semibold text-[#8C1B2E] dark:text-red-400">{academicYearLabel}</strong>
          </span>
          <span className="px-2.5 py-1 rounded-md bg-stone-100 dark:bg-zinc-800 border border-[#E5E2D9] dark:border-zinc-700 font-medium text-stone-800 dark:text-zinc-200">
            Semester: <strong className="font-semibold text-stone-900 dark:text-zinc-100">{semesterType}</strong>
          </span>
          <span className="px-2.5 py-1 rounded-md bg-stone-100 dark:bg-zinc-800 border border-[#E5E2D9] dark:border-zinc-700 font-medium text-stone-600 dark:text-zinc-300">
            Days: <strong>{workingDays.length ? `${workingDays.length} (${workingDays[0]}–${workingDays[workingDays.length - 1]})` : 'None set'}</strong>
          </span>
          <span className="px-2.5 py-1 rounded-md bg-stone-100 dark:bg-zinc-800 border border-[#E5E2D9] dark:border-zinc-700 font-medium text-stone-600 dark:text-zinc-300">
            Periods: <strong>{periodsRange}</strong>
          </span>
        </div>
      </div>

      {/* Compact Entity Count Grid (Table-style, not giant cards) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 text-center text-xs">
        <div className="p-2.5 bg-white dark:bg-zinc-950/60 rounded-lg border border-[#E5E2D9] dark:border-zinc-800">
          <span className="text-[11px] text-stone-500 block">Departments</span>
          <span className="font-serif font-bold text-base text-stone-900 dark:text-zinc-100">{counts.departments}</span>
        </div>
        <div className="p-2.5 bg-white dark:bg-zinc-950/60 rounded-lg border border-[#E5E2D9] dark:border-zinc-800">
          <span className="text-[11px] text-stone-500 block">Programs</span>
          <span className="font-serif font-bold text-base text-stone-900 dark:text-zinc-100">{counts.programs}</span>
        </div>
        <div className="p-2.5 bg-white dark:bg-zinc-950/60 rounded-lg border border-[#E5E2D9] dark:border-zinc-800">
          <span className="text-[11px] text-stone-500 block">Courses</span>
          <span className="font-serif font-bold text-base text-stone-900 dark:text-zinc-100">{counts.courses}</span>
        </div>
        <div className="p-2.5 bg-white dark:bg-zinc-950/60 rounded-lg border border-[#E5E2D9] dark:border-zinc-800">
          <span className="text-[11px] text-stone-500 block">Faculty</span>
          <span className="font-serif font-bold text-base text-stone-900 dark:text-zinc-100">{counts.faculty}</span>
        </div>
        <div className="p-2.5 bg-white dark:bg-zinc-950/60 rounded-lg border border-[#E5E2D9] dark:border-zinc-800">
          <span className="text-[11px] text-stone-500 block">Rooms & Labs</span>
          <span className="font-serif font-bold text-base text-stone-900 dark:text-zinc-100">{counts.rooms}</span>
        </div>
        <div className="p-2.5 bg-white dark:bg-zinc-950/60 rounded-lg border border-[#E5E2D9] dark:border-zinc-800">
          <span className="text-[11px] text-stone-500 block">Groups</span>
          <span className="font-serif font-bold text-base text-[#8C1B2E] dark:text-red-400">{counts.sections}</span>
        </div>
        <div className="p-2.5 bg-white dark:bg-zinc-950/60 rounded-lg border border-[#E5E2D9] dark:border-zinc-800">
          <span className="text-[11px] text-stone-500 block">Subgroups</span>
          <span className="font-serif font-bold text-base text-stone-900 dark:text-zinc-100">{counts.subgroups}</span>
        </div>
        <div className="p-2.5 bg-white dark:bg-zinc-950/60 rounded-lg border border-[#E5E2D9] dark:border-zinc-800">
          <span className="text-[11px] text-stone-500 block">Allocations</span>
          <span className="font-serif font-bold text-base text-emerald-700 dark:text-emerald-400">{counts.allocations}</span>
        </div>
      </div>
    </div>
  );
}
