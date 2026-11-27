import React, { useState } from 'react';
import { useTimetable } from '../../../context/TimetableContext';
import { SubSection } from '../../../types';
import {
  Users,
  Layers,
  Plus,
  Trash2,
  Sparkles,
  Search
} from 'lucide-react';

type SubgroupType = NonNullable<SubSection['type']>;

const INPUT = 'w-full bg-[#FAF9F5] dark:bg-zinc-900 border border-[#E5E2D9] dark:border-zinc-800 rounded-lg p-2 text-xs text-stone-900 dark:text-zinc-200 outline-none focus:border-[#8C1B2E]';
const EMPTY_SECTION = { name: '', departmentId: '', programId: '', semester: 1, batchYear: new Date().getFullYear(), studentCount: 60, numInitialSubgroups: 2 };
const EMPTY_BULK = {
  programName: '',
  batchYear: new Date().getFullYear(),
  totalStudents: 240,
  numGroups: 4,
  namingPattern: 'CSE-{A}',
  numSubgroupsPerGroup: 2,
  departmentId: ''
};

export function GroupsAndSubgroupsTab({ canEdit = true }: { canEdit?: boolean }) {
  const {
    sections,
    addSection,
    deleteSection,
    addSubSection,
    deleteSubSection,
    bulkGenerateGroups,
    programs,
    departments
  } = useTimetable();

  const [search, setSearch] = useState('');
  const [showAddSection, setShowAddSection] = useState(false);
  const [showBulkGenerator, setShowBulkGenerator] = useState(false);
  const [activeAddSubgroupId, setActiveAddSubgroupId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [newSectionForm, setNewSectionForm] = useState(EMPTY_SECTION);
  const [subgroupForm, setSubgroupForm] = useState<{ name: string; studentCount: number; type: SubgroupType }>({
    name: '',
    studentCount: 15,
    type: 'Lab'
  });
  const [bulkForm, setBulkForm] = useState(EMPTY_BULK);

  const run = async (action: () => Promise<{ success: boolean }>, onSuccess?: () => void) => {
    setSaving(true);
    const r = await action();
    setSaving(false);
    if (r.success) onSuccess?.();
  };

  const handleCreateSection = (e: React.FormEvent) => {
    e.preventDefault();
    const f = newSectionForm;
    if (!f.name.trim() || !f.departmentId) return;
    const prog = programs.find(p => p.id === f.programId);
    const letter = f.name.trim().slice(-1).toUpperCase();
    // The server builds subgroup ids; send only name, size and type.
    const subSections = Array.from({ length: f.numInitialSubgroups }, (_, i) => ({
      name: `${letter}${i + 1}`,
      studentCount: Math.max(1, Math.round(f.studentCount / f.numInitialSubgroups)),
      type: 'Lab' as const
    }));

    run(
      () =>
        addSection({
          name: f.name.trim(),
          departmentId: f.departmentId,
          program: prog?.name ?? '',
          programId: prog?.id,
          semester: f.semester,
          batchYear: f.batchYear,
          studentCount: f.studentCount,
          targetSize: f.studentCount,
          maxSize: Math.ceil(f.studentCount * 1.2),
          subSections: subSections as unknown as SubSection[],
          classRepresentative: { name: '', email: '', studentId: '' },
          status: 'Active'
        }),
      () => {
        setShowAddSection(false);
        setNewSectionForm(EMPTY_SECTION);
      }
    );
  };

  const handleAddSubgroup = (sectionId: string) => {
    if (!subgroupForm.name.trim()) return;
    run(
      () => addSubSection(sectionId, { name: subgroupForm.name.trim(), studentCount: subgroupForm.studentCount, type: subgroupForm.type }),
      () => {
        setActiveAddSubgroupId(null);
        setSubgroupForm({ name: '', studentCount: 15, type: 'Lab' });
      }
    );
  };

  const handleRunBulkGenerator = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkForm.departmentId) return;
    bulkGenerateGroups(bulkForm);
    setShowBulkGenerator(false);
  };

  // Filter sections by name
  const filteredSections = sections.filter(
    s => s.name.toLowerCase().includes(search.toLowerCase()) || (s.program ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const totalStudentsCount = sections.reduce((acc, s) => acc + (s.studentCount || 0), 0);
  const totalSubgroupsCount = sections.reduce((acc, s) => acc + (s.subSections?.length || 0), 0);

  const departmentSelect = (id: string, value: string, onChange: (v: string) => void) => (
    <select id={id} value={value} onChange={e => onChange(e.target.value)} className={INPUT} required>
      <option value="">Select department…</option>
      {departments.map(d => (
        <option key={d.id} value={d.id}>{d.name}</option>
      ))}
    </select>
  );

  return (
    <div className="p-5 bg-[#FAF9F5] dark:bg-zinc-900 border border-[#E5E2D9] dark:border-zinc-800 rounded-xl space-y-5 shadow-xs">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E5E2D9] dark:border-zinc-800 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1 rounded bg-[#8C1B2E]/10 dark:bg-red-500/10 text-[#8C1B2E] dark:text-red-400">
              <Users className="h-4 w-4" />
            </span>
            <h3 className="font-serif text-base font-semibold text-stone-900 dark:text-zinc-100">
              Student Cohorts & Subgroup Hierarchy
            </h3>
          </div>
          <p className="text-xs text-stone-500 dark:text-zinc-400 mt-0.5">
            Manage whole groups (e.g. CSE-A for lectures) and nested subgroups (e.g. A1, A2 for concurrent labs & tutorials)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="h-3.5 w-3.5 text-stone-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search groups..."
              aria-label="Search groups"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-white dark:bg-zinc-950 border border-[#E5E2D9] dark:border-zinc-800 rounded-lg text-xs text-stone-900 dark:text-zinc-200 outline-none focus:border-[#8C1B2E] w-36 sm:w-44 shadow-2xs"
            />
          </div>

          {canEdit && (
            <>
              <button
                onClick={() => setShowBulkGenerator(!showBulkGenerator)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-zinc-950 hover:bg-stone-50 dark:hover:bg-zinc-800 text-stone-700 dark:text-zinc-300 border border-[#E5E2D9] dark:border-zinc-800 rounded-lg text-xs font-semibold shadow-2xs transition-colors"
              >
                <Sparkles className="h-3.5 w-3.5 text-[#8C1B2E] dark:text-red-400" />
                <span>Bulk Generator</span>
              </button>

              <button
                onClick={() => setShowAddSection(!showAddSection)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#8C1B2E] hover:bg-[#731625] text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Group</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Cohort Metric Summary Bar */}
      <div className="grid grid-cols-3 gap-3 text-xs">
        <div className="p-3 bg-white dark:bg-zinc-950/60 rounded-lg border border-[#E5E2D9] dark:border-zinc-800 flex items-center justify-between">
          <span className="text-stone-500 dark:text-zinc-400">Total Student Groups</span>
          <span className="font-serif font-bold text-base text-[#8C1B2E] dark:text-red-400">{sections.length}</span>
        </div>
        <div className="p-3 bg-white dark:bg-zinc-950/60 rounded-lg border border-[#E5E2D9] dark:border-zinc-800 flex items-center justify-between">
          <span className="text-stone-500 dark:text-zinc-400">Total Nested Subgroups</span>
          <span className="font-serif font-bold text-base text-stone-900 dark:text-zinc-100">{totalSubgroupsCount}</span>
        </div>
        <div className="p-3 bg-white dark:bg-zinc-950/60 rounded-lg border border-[#E5E2D9] dark:border-zinc-800 flex items-center justify-between">
          <span className="text-stone-500 dark:text-zinc-400">Total Group Strength</span>
          <span className="font-serif font-bold text-base text-emerald-700 dark:text-emerald-400">{totalStudentsCount}</span>
        </div>
      </div>

      {/* Bulk Generator Drawer / Form */}
      {showBulkGenerator && canEdit && (
        <form
          onSubmit={handleRunBulkGenerator}
          className="p-4 bg-white dark:bg-zinc-950 border border-[#8C1B2E]/30 rounded-xl space-y-3 shadow-xs animate-in fade-in duration-150"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#8C1B2E]" />
              <span className="text-xs font-bold font-serif text-stone-900 dark:text-zinc-100">
                Bulk Cohort Matrix Generator
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowBulkGenerator(false)}
              className="text-xs text-stone-400 hover:text-stone-600"
            >
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <label htmlFor="bulk-dept" className="text-[11px] text-stone-500 block mb-1">Department</label>
              {departmentSelect('bulk-dept', bulkForm.departmentId, v => setBulkForm(b => ({ ...b, departmentId: v })))}
            </div>

            <div>
              <label htmlFor="bulk-program" className="text-[11px] text-stone-500 block mb-1">Program</label>
              <input
                id="bulk-program"
                type="text"
                value={bulkForm.programName}
                onChange={e => setBulkForm(b => ({ ...b, programName: e.target.value }))}
                placeholder="e.g. B.Tech Computer Science & Engineering"
                className={INPUT}
                required
              />
            </div>

            <div>
              <label htmlFor="bulk-batch" className="text-[11px] text-stone-500 block mb-1">Batch Year</label>
              <input
                id="bulk-batch"
                type="number"
                min={1950}
                max={2100}
                value={bulkForm.batchYear}
                onChange={e => setBulkForm(b => ({ ...b, batchYear: Number(e.target.value) || EMPTY_BULK.batchYear }))}
                className={INPUT}
                required
              />
            </div>

            <div>
              <label htmlFor="bulk-total" className="text-[11px] text-stone-500 block mb-1">Total Students</label>
              <input
                id="bulk-total"
                type="number"
                min={1}
                max={20000}
                value={bulkForm.totalStudents}
                onChange={e => setBulkForm(b => ({ ...b, totalStudents: Number(e.target.value) || 1 }))}
                className={INPUT}
                required
              />
            </div>

            <div>
              <label htmlFor="bulk-groups" className="text-[11px] text-stone-500 block mb-1">Number of Groups</label>
              <input
                id="bulk-groups"
                type="number"
                min={1}
                max={52}
                value={bulkForm.numGroups}
                onChange={e => setBulkForm(b => ({ ...b, numGroups: Number(e.target.value) || 1 }))}
                className={INPUT}
                required
              />
            </div>

            <div>
              <label htmlFor="bulk-pattern" className="text-[11px] text-stone-500 block mb-1">Group Naming Pattern ({'{A}'} = letter, {'{N}'} = number)</label>
              <input
                id="bulk-pattern"
                type="text"
                value={bulkForm.namingPattern}
                onChange={e => setBulkForm(b => ({ ...b, namingPattern: e.target.value }))}
                placeholder="CSE-{A}"
                pattern=".*\{(A|N)\}.*"
                title="Include {A} or {N} so each group gets a unique name"
                className={INPUT}
                required
              />
            </div>

            <div>
              <label htmlFor="bulk-subs" className="text-[11px] text-stone-500 block mb-1">Subgroups per Group</label>
              <input
                id="bulk-subs"
                type="number"
                min={1}
                max={10}
                value={bulkForm.numSubgroupsPerGroup}
                onChange={e => setBulkForm(b => ({ ...b, numSubgroupsPerGroup: Number(e.target.value) || 1 }))}
                className={INPUT}
                required
              />
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                disabled={saving}
                className="w-full py-2 bg-[#8C1B2E] hover:bg-[#731625] text-white rounded-lg text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
              >
                Generate {bulkForm.numGroups} Groups & {bulkForm.numGroups * bulkForm.numSubgroupsPerGroup} Subgroups
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Add Single Section Form */}
      {showAddSection && canEdit && (
        <form
          onSubmit={handleCreateSection}
          className="p-4 bg-white dark:bg-zinc-950 border border-[#8C1B2E]/30 rounded-xl space-y-3 shadow-xs animate-in fade-in duration-150"
        >
          <div className="text-xs font-bold font-serif text-stone-900 dark:text-zinc-200">
            Create Single Cohort Section
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <label htmlFor="sec-name" className="text-[11px] text-stone-500 block mb-1">Section Name</label>
              <input
                id="sec-name"
                type="text"
                placeholder="e.g. CSE-D"
                value={newSectionForm.name}
                onChange={e => setNewSectionForm(s => ({ ...s, name: e.target.value }))}
                className={INPUT}
                maxLength={100}
                required
              />
            </div>
            <div>
              <label htmlFor="sec-dept" className="text-[11px] text-stone-500 block mb-1">Department</label>
              {departmentSelect('sec-dept', newSectionForm.departmentId, v => setNewSectionForm(s => ({ ...s, departmentId: v })))}
            </div>
            <div>
              <label htmlFor="sec-program" className="text-[11px] text-stone-500 block mb-1">Program</label>
              <select
                id="sec-program"
                value={newSectionForm.programId}
                onChange={e => setNewSectionForm(s => ({ ...s, programId: e.target.value }))}
                className={INPUT}
              >
                <option value="">No program</option>
                {programs.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.code} - {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="sec-count" className="text-[11px] text-stone-500 block mb-1">Student Count</label>
              <input
                id="sec-count"
                type="number"
                min={1}
                max={5000}
                value={newSectionForm.studentCount}
                onChange={e => setNewSectionForm(s => ({ ...s, studentCount: Number(e.target.value) || 1 }))}
                className={INPUT}
                required
              />
            </div>
            <div>
              <label htmlFor="sec-subs" className="text-[11px] text-stone-500 block mb-1">Initial Lab Subgroups</label>
              <input
                id="sec-subs"
                type="number"
                min={1}
                max={10}
                value={newSectionForm.numInitialSubgroups}
                onChange={e => setNewSectionForm(s => ({ ...s, numInitialSubgroups: Math.min(10, Math.max(1, Number(e.target.value) || 1)) }))}
                className={INPUT}
              />
            </div>
            <div>
              <label htmlFor="sec-sem" className="text-[11px] text-stone-500 block mb-1">Semester</label>
              <input
                id="sec-sem"
                type="number"
                min={1}
                max={20}
                value={newSectionForm.semester}
                onChange={e => setNewSectionForm(s => ({ ...s, semester: Number(e.target.value) || 1 }))}
                className={INPUT}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowAddSection(false)}
              className="px-3 py-1.5 text-xs text-stone-500 hover:text-stone-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-1.5 bg-[#8C1B2E] hover:bg-[#731625] text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save Section'}
            </button>
          </div>
        </form>
      )}

      {/* Cohort Groups & Nested Subgroups Cards */}
      <div className="space-y-3">
        {filteredSections.length === 0 && (
          <div className="p-6 text-center text-xs text-stone-400 italic">
            {sections.length === 0 ? 'No student groups yet.' : 'No groups match your search.'}
          </div>
        )}
        {filteredSections.map(sec => {
          const isAddingSubgroup = activeAddSubgroupId === sec.id;
          const subCount = sec.subSections?.length || 0;

          return (
            <div
              key={sec.id}
              className="bg-white dark:bg-zinc-950/70 border border-[#E5E2D9] dark:border-zinc-800 rounded-xl p-4 shadow-2xs space-y-3"
            >
              {/* Group Main Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E5E2D9]/80 dark:border-zinc-800/80 pb-2.5">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-serif font-bold text-sm text-stone-900 dark:text-zinc-100">
                      Section {sec.name}
                    </span>
                    {sec.program && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#FAF9F5] dark:bg-zinc-900 text-[#8C1B2E] dark:text-red-400 border border-[#E5E2D9] dark:border-zinc-800 font-semibold">
                        {sec.program}
                      </span>
                    )}
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-stone-100 text-stone-700 dark:bg-zinc-800 dark:text-zinc-300">
                      Sem {sec.semester} · Batch {sec.batchYear}
                    </span>
                  </div>
                  <div className="text-[11px] text-stone-500 dark:text-zinc-400">
                    Strength: <strong className="font-mono text-stone-800 dark:text-zinc-200">{sec.studentCount} Students</strong> ·{' '}
                    CR: {sec.classRepresentative?.name || sec.classRepresentative?.email
                      ? `${sec.classRepresentative.name}${sec.classRepresentative.email ? ` (${sec.classRepresentative.email})` : ''}`
                      : 'Not assigned'}
                  </div>
                </div>

                {canEdit && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        if (isAddingSubgroup) {
                          setActiveAddSubgroupId(null);
                        } else {
                          setActiveAddSubgroupId(sec.id);
                          const letter = sec.name.slice(-1).toUpperCase();
                          setSubgroupForm({
                            name: `${letter}${subCount + 1}`,
                            studentCount: Math.max(1, Math.round(sec.studentCount / Math.max(1, subCount + 1))),
                            type: 'Lab'
                          });
                        }
                      }}
                      className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#FAF9F5] dark:bg-zinc-900 hover:bg-stone-100 text-stone-700 dark:text-zinc-300 border border-[#E5E2D9] dark:border-zinc-800 text-[11px] font-medium transition-colors"
                    >
                      <Plus className="h-3 w-3 text-[#8C1B2E]" />
                      <span>Add Subgroup</span>
                    </button>

                    <button
                      onClick={() => run(() => deleteSection(sec.id))}
                      disabled={saving}
                      title="Delete Group"
                      aria-label={`Delete group ${sec.name}`}
                      className="p-1.5 text-stone-400 hover:text-[#8C1B2E] dark:hover:text-red-400 transition-colors disabled:opacity-40"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Nested Subgroups List */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-stone-500">
                  <span className="font-medium flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5 text-stone-400" />
                    <span>Lab / Tutorial Subgroups ({subCount})</span>
                  </span>
                  <span className="text-[10px] text-stone-400">Independent scheduling cohorts</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                  {(sec.subSections || []).map(sub => (
                    <div
                      key={sub.id}
                      className="p-2.5 bg-[#FAF9F5] dark:bg-zinc-900 border border-[#E5E2D9] dark:border-zinc-800 rounded-lg flex items-center justify-between text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-stone-900 dark:text-zinc-100">{sub.name}</span>
                          <span
                            className={`text-[9px] font-mono px-1.5 py-0.2 rounded border ${
                              sub.type === 'Lab'
                                ? 'bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/20 dark:text-sky-300 dark:border-sky-800'
                                : 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/20 dark:text-amber-300 dark:border-amber-800'
                            }`}
                          >
                            {sub.type || 'Lab'}
                          </span>
                        </div>
                        <span className="text-[10px] text-stone-500 dark:text-zinc-400 font-mono">
                          {sub.studentCount} students
                        </span>
                      </div>

                      {canEdit && (
                        <button
                          onClick={() => run(() => deleteSubSection(sec.id, sub.id))}
                          disabled={saving}
                          title="Remove Subgroup"
                          aria-label={`Remove subgroup ${sub.name} from ${sec.name}`}
                          className="p-1 text-stone-400 hover:text-rose-600 transition-colors disabled:opacity-40"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  ))}

                  {subCount === 0 && (
                    <div className="col-span-full p-2 text-center text-xs text-stone-400 italic">
                      No subgroups defined. Add subgroups for lab/tutorial split schedules.
                    </div>
                  )}
                </div>
              </div>

              {/* Inline Subgroup Creation Form */}
              {isAddingSubgroup && canEdit && (
                <form
                  onSubmit={e => {
                    e.preventDefault();
                    handleAddSubgroup(sec.id);
                  }}
                  className="p-3 bg-stone-50 dark:bg-zinc-900/60 border border-[#8C1B2E]/30 rounded-lg space-y-2 animate-in fade-in duration-150"
                >
                  <div className="text-[11px] font-semibold text-stone-800 dark:text-zinc-200">
                    Add Subgroup to {sec.name}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
                    <input
                      type="text"
                      placeholder="Subgroup Name (e.g. A3)"
                      aria-label="Subgroup name"
                      value={subgroupForm.name}
                      onChange={e => setSubgroupForm(s => ({ ...s, name: e.target.value }))}
                      className="bg-white dark:bg-zinc-950 border border-[#E5E2D9] dark:border-zinc-800 rounded p-1.5 text-xs text-stone-900 dark:text-zinc-200 outline-none focus:border-[#8C1B2E]"
                      required
                    />
                    <input
                      type="number"
                      min={1}
                      placeholder="Students"
                      aria-label="Subgroup student count"
                      value={subgroupForm.studentCount}
                      onChange={e => setSubgroupForm(s => ({ ...s, studentCount: Number(e.target.value) || 1 }))}
                      className="bg-white dark:bg-zinc-950 border border-[#E5E2D9] dark:border-zinc-800 rounded p-1.5 text-xs text-stone-900 dark:text-zinc-200 outline-none focus:border-[#8C1B2E]"
                      required
                    />
                    <select
                      aria-label="Subgroup type"
                      value={subgroupForm.type}
                      onChange={e => setSubgroupForm(s => ({ ...s, type: e.target.value as SubgroupType }))}
                      className="bg-white dark:bg-zinc-950 border border-[#E5E2D9] dark:border-zinc-800 rounded p-1.5 text-xs text-stone-900 dark:text-zinc-200 outline-none focus:border-[#8C1B2E]"
                    >
                      <option value="Lab">Lab Cohort</option>
                      <option value="Tutorial">Tutorial Cohort</option>
                      <option value="Practical">Practical Cohort</option>
                      <option value="General">General</option>
                    </select>
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={saving}
                        className="flex-1 py-1.5 bg-[#8C1B2E] text-white rounded text-xs font-semibold hover:bg-[#731625] disabled:opacity-50"
                      >
                        Add
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveAddSubgroupId(null)}
                        className="px-2 py-1.5 text-xs text-stone-500 hover:text-stone-700"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
