import React, { useState } from 'react';
import { useTimetable } from '../../../context/TimetableContext';
import { SessionType } from '../../../types';
import {
  BookOpen,
  Plus,
  Trash2,
  Search,
  Users,
  Layers,
  DoorOpen,
  UserSquare2,
  Clock
} from 'lucide-react';

type AllocForm = {
  courseId: string;
  facultyId: string;
  sectionId: string;
  subSectionId?: string;
  sessionType: SessionType;
  hoursPerWeek: number;
  preferredRoomId?: string;
};

const EMPTY_FORM: AllocForm = { courseId: '', facultyId: '', sectionId: '', sessionType: 'Lecture', hoursPerWeek: 3 };
const SELECT = 'w-full bg-[#FAF9F5] dark:bg-zinc-900 border border-[#E5E2D9] dark:border-zinc-800 rounded-lg p-2 text-xs text-stone-900 dark:text-zinc-200 outline-none focus:border-[#8C1B2E]';

export function CourseAllocationsTab({ canEdit = true }: { canEdit?: boolean }) {
  const {
    allocations,
    addAllocation,
    deleteAllocation,
    courses,
    facultyMembers,
    sections,
    rooms
  } = useTimetable();

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [sectionFilter, setSectionFilter] = useState<string>('ALL');
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [allocForm, setAllocForm] = useState<AllocForm>(EMPTY_FORM);

  // Selected section to derive available subgroups
  const selectedSectionObj = sections.find(s => s.id === allocForm.sectionId);
  const availableSubgroups = selectedSectionObj?.subSections || [];

  const handleSectionChange = (secId: string) => {
    setAllocForm(prev => ({
      ...prev,
      sectionId: secId,
      subSectionId: undefined
    }));
  };

  const handleSessionTypeChange = (sType: SessionType) => {
    let defaultHours = 3;
    if (sType === 'Lab') defaultHours = 2;
    if (sType === 'Tutorial') defaultHours = 1;
    if (sType === 'Practical') defaultHours = 2;

    setAllocForm(prev => ({
      ...prev,
      sessionType: sType,
      hoursPerWeek: defaultHours
    }));
  };

  const handleCreateAllocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allocForm.courseId || !allocForm.facultyId || !allocForm.sectionId) {
      setFormError('Choose a course, a faculty member and a section.');
      return;
    }
    if (!Number.isInteger(allocForm.hoursPerWeek) || allocForm.hoursPerWeek < 1 || allocForm.hoursPerWeek > 40) {
      setFormError('Hours per week must be a whole number between 1 and 40.');
      return;
    }
    if ((allocForm.sessionType === 'Lab' || allocForm.sessionType === 'Practical') && allocForm.hoursPerWeek % 2 !== 0) {
      setFormError('Labs and practicals are scheduled in 2-hour blocks, so hours per week must be even.');
      return;
    }
    setFormError('');
    setSaving(true);
    const r = await addAllocation({
      courseId: allocForm.courseId,
      facultyId: allocForm.facultyId,
      sectionId: allocForm.sectionId,
      subSectionId: allocForm.subSectionId || undefined,
      sessionType: allocForm.sessionType,
      hoursPerWeek: allocForm.hoursPerWeek,
      preferredRoomId: allocForm.preferredRoomId || undefined
    });
    setSaving(false);
    if (r.success) {
      setShowAddForm(false);
      setAllocForm(EMPTY_FORM);
    }
  };

  // Filtered Allocations
  const filteredAllocations = allocations.filter(a => {
    const course = courses.find(c => c.id === a.courseId);
    const faculty = facultyMembers.find(f => f.id === a.facultyId);
    const section = sections.find(s => s.id === a.sectionId);

    const matchesSearch =
      search === '' ||
      course?.code.toLowerCase().includes(search.toLowerCase()) ||
      course?.name.toLowerCase().includes(search.toLowerCase()) ||
      faculty?.name.toLowerCase().includes(search.toLowerCase()) ||
      section?.name.toLowerCase().includes(search.toLowerCase());

    const matchesType = typeFilter === 'ALL' || a.sessionType === typeFilter;
    const matchesSection = sectionFilter === 'ALL' || a.sectionId === sectionFilter;

    return matchesSearch && matchesType && matchesSection;
  });

  const lectureCount = allocations.filter(a => a.sessionType === 'Lecture').length;
  const labCount = allocations.filter(a => a.sessionType === 'Lab').length;
  const tutCount = allocations.filter(a => a.sessionType === 'Tutorial' || a.sessionType === 'Practical').length;

  return (
    <div className="p-5 bg-[#FAF9F5] dark:bg-zinc-900 border border-[#E5E2D9] dark:border-zinc-800 rounded-xl space-y-5 shadow-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E5E2D9] dark:border-zinc-800 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1 rounded bg-[#8C1B2E]/10 dark:bg-red-500/10 text-[#8C1B2E] dark:text-red-400">
              <BookOpen className="h-4 w-4" />
            </span>
            <h3 className="font-serif text-base font-semibold text-stone-900 dark:text-zinc-100">
              Curriculum Course Allocations
            </h3>
          </div>
          <p className="text-xs text-stone-500 dark:text-zinc-400 mt-0.5">
            Assign courses to faculty instructors and target cohorts (whole sections or dedicated subgroups)
          </p>
        </div>

        {canEdit && (
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#8C1B2E] hover:bg-[#731625] text-white rounded-lg text-xs font-semibold shadow-xs transition-colors self-start sm:self-auto"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New Teaching Assignment</span>
          </button>
        )}
      </div>

      {/* Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="p-3 bg-white dark:bg-zinc-950/60 rounded-lg border border-[#E5E2D9] dark:border-zinc-800 flex items-center justify-between">
          <span className="text-stone-500">Total Allocations</span>
          <span className="font-serif font-bold text-base text-stone-900 dark:text-zinc-100">{allocations.length}</span>
        </div>
        <div className="p-3 bg-white dark:bg-zinc-950/60 rounded-lg border border-[#E5E2D9] dark:border-zinc-800 flex items-center justify-between">
          <span className="text-stone-500">Lectures (Whole Cohort)</span>
          <span className="font-serif font-bold text-base text-[#8C1B2E] dark:text-red-400">{lectureCount}</span>
        </div>
        <div className="p-3 bg-white dark:bg-zinc-950/60 rounded-lg border border-[#E5E2D9] dark:border-zinc-800 flex items-center justify-between">
          <span className="text-stone-500">Labs (Subgroup Cohorts)</span>
          <span className="font-serif font-bold text-base text-sky-700 dark:text-sky-400">{labCount}</span>
        </div>
        <div className="p-3 bg-white dark:bg-zinc-950/60 rounded-lg border border-[#E5E2D9] dark:border-zinc-800 flex items-center justify-between">
          <span className="text-stone-500">Tutorials / Practicals</span>
          <span className="font-serif font-bold text-base text-amber-700 dark:text-amber-400">{tutCount}</span>
        </div>
      </div>

      {/* Add Allocation Form */}
      {showAddForm && canEdit && (
        <form
          onSubmit={handleCreateAllocation}
          className="p-4 bg-white dark:bg-zinc-950 border border-[#8C1B2E]/30 rounded-xl space-y-3 shadow-xs animate-in fade-in duration-150"
        >
          <div className="text-xs font-bold font-serif text-stone-900 dark:text-zinc-200">
            Create Course Teaching Assignment
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            {/* Course */}
            <div>
              <label htmlFor="alloc-course" className="text-[11px] text-stone-500 block mb-1">Course</label>
              <select
                id="alloc-course"
                value={allocForm.courseId}
                onChange={e => setAllocForm(a => ({ ...a, courseId: e.target.value }))}
                className={SELECT}
                required
              >
                <option value="">Select course…</option>
                {courses.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.code} · {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Faculty */}
            <div>
              <label htmlFor="alloc-faculty" className="text-[11px] text-stone-500 block mb-1">Faculty Instructor</label>
              <select
                id="alloc-faculty"
                value={allocForm.facultyId}
                onChange={e => setAllocForm(a => ({ ...a, facultyId: e.target.value }))}
                className={SELECT}
                required
              >
                <option value="">Select faculty…</option>
                {facultyMembers.map(f => (
                  <option key={f.id} value={f.id}>
                    {f.name} ({f.designation})
                  </option>
                ))}
              </select>
            </div>

            {/* Target Section */}
            <div>
              <label htmlFor="alloc-section" className="text-[11px] text-stone-500 block mb-1">Target Section</label>
              <select
                id="alloc-section"
                value={allocForm.sectionId}
                onChange={e => handleSectionChange(e.target.value)}
                className={SELECT}
                required
              >
                <option value="">Select section…</option>
                {sections.map(s => (
                  <option key={s.id} value={s.id}>
                    Section {s.name} ({s.studentCount} students)
                  </option>
                ))}
              </select>
            </div>

            {/* Subgroup or Whole Section */}
            <div>
              <label htmlFor="alloc-scope" className="text-[11px] text-stone-500 block mb-1">Cohort Scope (Group / Subgroup)</label>
              <select
                id="alloc-scope"
                value={allocForm.subSectionId || ''}
                onChange={e => setAllocForm(a => ({ ...a, subSectionId: e.target.value || undefined }))}
                className={SELECT}
              >
                <option value="">Whole Section (All students)</option>
                {availableSubgroups.map(sub => (
                  <option key={sub.id} value={sub.id}>
                    Subgroup {sub.name} ({sub.studentCount} students · {sub.type || 'Lab'})
                  </option>
                ))}
              </select>
            </div>

            {/* Session Type */}
            <div>
              <label htmlFor="alloc-type" className="text-[11px] text-stone-500 block mb-1">Session Type</label>
              <select
                id="alloc-type"
                value={allocForm.sessionType}
                onChange={e => handleSessionTypeChange(e.target.value as SessionType)}
                className={SELECT}
              >
                <option value="Lecture">Lecture</option>
                <option value="Lab">Lab (Practical Session)</option>
                <option value="Tutorial">Tutorial</option>
                <option value="Practical">Practical</option>
                <option value="Elective">Elective</option>
              </select>
            </div>

            {/* Hours per Week */}
            <div>
              <label htmlFor="alloc-hours" className="text-[11px] text-stone-500 block mb-1">Hours / Week</label>
              <input
                id="alloc-hours"
                type="number"
                value={allocForm.hoursPerWeek}
                onChange={e => setAllocForm(a => ({ ...a, hoursPerWeek: Number(e.target.value) || 1 }))}
                min={1}
                max={40}
                step={allocForm.sessionType === 'Lab' || allocForm.sessionType === 'Practical' ? 2 : 1}
                className={SELECT}
                required
              />
            </div>

            {/* Preferred Room */}
            <div className="sm:col-span-2">
              <label htmlFor="alloc-room" className="text-[11px] text-stone-500 block mb-1">Preferred Room / Lab</label>
              <select
                id="alloc-room"
                value={allocForm.preferredRoomId || ''}
                onChange={e => setAllocForm(a => ({ ...a, preferredRoomId: e.target.value || undefined }))}
                className={SELECT}
              >
                <option value="">Auto-assign suitable room during solver run</option>
                {rooms.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.type} · Cap {r.capacity})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-3 py-2 text-xs text-stone-500 hover:text-stone-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-[#8C1B2E] hover:bg-[#731625] text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save Assignment'}
              </button>
            </div>
          </div>
          {formError && (
            <p role="alert" className="text-[11px] text-[#8C1B2E] dark:text-red-400">{formError}</p>
          )}
        </form>
      )}

      {/* Search and Filters Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="h-3.5 w-3.5 text-stone-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search course, faculty, group..."
              aria-label="Search allocations"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-white dark:bg-zinc-950 border border-[#E5E2D9] dark:border-zinc-800 rounded-lg text-xs text-stone-900 dark:text-zinc-200 outline-none focus:border-[#8C1B2E] w-48 sm:w-64 shadow-2xs"
            />
          </div>

          <select
            aria-label="Filter by session type"
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="bg-white dark:bg-zinc-950 border border-[#E5E2D9] dark:border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-stone-800 dark:text-zinc-200 outline-none focus:border-[#8C1B2E] shadow-2xs"
          >
            <option value="ALL">All Session Types</option>
            <option value="Lecture">Lectures</option>
            <option value="Lab">Labs</option>
            <option value="Tutorial">Tutorials</option>
            <option value="Practical">Practicals</option>
          </select>

          <select
            aria-label="Filter by section"
            value={sectionFilter}
            onChange={e => setSectionFilter(e.target.value)}
            className="bg-white dark:bg-zinc-950 border border-[#E5E2D9] dark:border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-stone-800 dark:text-zinc-200 outline-none focus:border-[#8C1B2E] shadow-2xs"
          >
            <option value="ALL">All Sections</option>
            {sections.map(s => (
              <option key={s.id} value={s.id}>
                Section {s.name}
              </option>
            ))}
          </select>
        </div>

        <span className="text-[11px] text-stone-500 font-mono">
          Showing {filteredAllocations.length} of {allocations.length} assignments
        </span>
      </div>

      {/* Allocations Table */}
      <div className="border border-[#E5E2D9] dark:border-zinc-800 rounded-xl overflow-hidden divide-y divide-[#E5E2D9] dark:divide-zinc-800 shadow-2xs">
        {filteredAllocations.map(alloc => {
          const course = courses.find(c => c.id === alloc.courseId);
          const faculty = facultyMembers.find(f => f.id === alloc.facultyId);
          const section = sections.find(s => s.id === alloc.sectionId);
          const subgroup = section?.subSections?.find(sub => sub.id === alloc.subSectionId);
          const room = rooms.find(r => r.id === alloc.preferredRoomId);

          return (
            <div
              key={alloc.id}
              className="p-3.5 bg-white dark:bg-zinc-950/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
            >
              <div className="space-y-1 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono font-bold text-[#8C1B2E] dark:text-red-400">
                    {course?.code || alloc.courseId}
                  </span>
                  <span className="font-semibold text-stone-900 dark:text-zinc-100">{course?.name}</span>

                  {/* Target Cohort Badge: Whole Group vs Subgroup */}
                  {subgroup ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-sky-50 text-sky-800 border border-sky-200 dark:bg-sky-950/20 dark:text-sky-300 dark:border-sky-800">
                      <Layers className="h-3 w-3" />
                      <span>{section?.name} · Subgroup {subgroup.name}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-[#FAF9F5] text-stone-700 dark:bg-zinc-900 dark:text-zinc-300 border border-[#E5E2D9] dark:border-zinc-800">
                      <Users className="h-3 w-3" />
                      <span>{section?.name} (Entire Section)</span>
                    </span>
                  )}

                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                      alloc.sessionType === 'Lab'
                        ? 'bg-purple-50 text-purple-800 border-purple-200 dark:bg-purple-950/20 dark:text-purple-300'
                        : alloc.sessionType === 'Tutorial'
                        ? 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/20 dark:text-amber-300'
                        : 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300'
                    }`}
                  >
                    {alloc.sessionType}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-stone-500 dark:text-zinc-400">
                  <span className="flex items-center gap-1">
                    <UserSquare2 className="h-3 w-3 text-stone-400" />
                    <span>Instructor: <strong className="text-stone-800 dark:text-zinc-200">{faculty?.name}</strong></span>
                  </span>

                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3 text-stone-400" />
                    <span>Workload: <strong className="text-emerald-700 dark:text-emerald-400 font-mono">{alloc.hoursPerWeek} hrs/week</strong></span>
                  </span>

                  {room && (
                    <span className="flex items-center gap-1">
                      <DoorOpen className="h-3 w-3 text-stone-400" />
                      <span>Room: <strong className="text-stone-700 dark:text-zinc-300">{room.name}</strong></span>
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center">
                {canEdit && (
                  <button
                    onClick={async () => {
                      setSaving(true);
                      await deleteAllocation(alloc.id);
                      setSaving(false);
                    }}
                    disabled={saving}
                    title="Delete Teaching Assignment"
                    aria-label={`Delete allocation ${course?.code ?? alloc.courseId} for ${section?.name ?? alloc.sectionId}`}
                    className="p-1.5 text-stone-400 hover:text-[#8C1B2E] dark:hover:text-red-400 transition-colors disabled:opacity-40"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {filteredAllocations.length === 0 && (
          <div className="p-8 text-center text-xs text-stone-400 italic">
            No course allocations match your current search/filter.
          </div>
        )}
      </div>
    </div>
  );
}
