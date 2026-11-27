import React, { useState, useEffect } from 'react';
import { useTimetable } from '../../../context/TimetableContext';
import {
  Users,
  Search,
  Filter,
  GraduationCap,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  X,
  UserCheck
} from 'lucide-react';
import { StudentRecord } from '../../../lib/initialData';
import { api } from '../../../lib/api';

const PAGE_SIZE = 20;

type StudentsPage = { total: number; page: number; limit: number; totalPages: number; students: StudentRecord[] };

export function StudentsTab() {
  const { sections, sessions, courses, rooms, facultyMembers, academicYear } = useTimetable();

  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [totalStudents, setTotalStudents] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [selectedSection, setSelectedSection] = useState('ALL');
  const [selectedStudent, setSelectedStudent] = useState<StudentRecord | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    // Ignore responses from requests superseded by a newer page/search/filter.
    let stale = false;
    setIsLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: String(PAGE_SIZE),
      search: search.trim(),
      sectionId: selectedSection,
    });
    api<StudentsPage>(`/api/students?${params.toString()}`)
      .then(json => {
        if (stale) return;
        setStudents(json.students ?? []);
        setTotalStudents(json.total ?? 0);
        setTotalPages(Math.max(1, json.totalPages ?? 1));
        setLoadError('');
      })
      .catch(err => {
        if (stale) return;
        setStudents([]);
        setTotalStudents(0);
        setTotalPages(1);
        setLoadError(err instanceof Error ? err.message : 'Could not load students.');
      })
      .finally(() => {
        if (!stale) setIsLoading(false);
      });
    return () => {
      stale = true;
    };
  }, [page, search, selectedSection]);

  // Derived (draft) timetable for the selected student
  const getStudentTimetable = (stu: StudentRecord) =>
    sessions.filter(s => s.sectionId === stu.sectionId && (!s.subSectionId || s.subSectionId === stu.subSectionId));
  const slotLabel = (id: string) => academicYear.timeSlots.find(t => t.id === id)?.label ?? id;

  const totalGroups = sections.length;
  const totalSubgroups = sections.reduce((acc, s) => acc + (s.subSections?.length || 0), 0);
  const studentSessions = selectedStudent ? getStudentTimetable(selectedStudent) : [];

  return (
    <div className="space-y-4">
      {/* 1. Header Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white dark:bg-zinc-900 border border-[#E5E2D9] dark:border-zinc-800 rounded-xl p-3.5 flex items-center justify-between shadow-2xs">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-stone-500">
              {search.trim() || selectedSection !== 'ALL' ? 'Matching Students' : 'Enrolled Students'}
            </span>
            <div className="text-xl font-bold font-serif text-stone-900 dark:text-zinc-100">{totalStudents.toLocaleString()}</div>
          </div>
          <GraduationCap className="h-5 w-5 text-[#8C1B2E] dark:text-red-400" />
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-[#E5E2D9] dark:border-zinc-800 rounded-xl p-3.5 flex items-center justify-between shadow-2xs">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-stone-500">Active Cohort Groups</span>
            <div className="text-xl font-bold font-serif text-stone-900 dark:text-zinc-100">{totalGroups} Sections</div>
          </div>
          <Users className="h-5 w-5 text-stone-600 dark:text-zinc-400" />
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-[#E5E2D9] dark:border-zinc-800 rounded-xl p-3.5 flex items-center justify-between shadow-2xs">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-stone-500">Lab Subgroups</span>
            <div className="text-xl font-bold font-serif text-stone-900 dark:text-zinc-100">{totalSubgroups} Subgroups</div>
          </div>
          <BookOpen className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
        </div>
      </div>

      {/* 2. Search & Filter Bar */}
      <div className="bg-white dark:bg-zinc-900 border border-[#E5E2D9] dark:border-zinc-800 rounded-xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-stone-400" />
          <input
            type="text"
            placeholder="Search by Student ID, Name, or Email..."
            aria-label="Search students"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-3 py-1.5 bg-[#FAF9F5] dark:bg-zinc-800 border border-[#E5E2D9] dark:border-zinc-700 rounded-lg text-xs focus:ring-1 focus:ring-[#8C1B2E] outline-hidden"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="h-3.5 w-3.5 text-stone-400 shrink-0" />
          <select
            aria-label="Filter by section"
            value={selectedSection}
            onChange={e => { setSelectedSection(e.target.value); setPage(1); }}
            className="px-2.5 py-1.5 bg-[#FAF9F5] dark:bg-zinc-800 border border-[#E5E2D9] dark:border-zinc-700 rounded-lg text-xs font-medium text-stone-700 dark:text-zinc-300"
          >
            <option value="ALL">All Sections ({sections.length})</option>
            {sections.map(sec => (
              <option key={sec.id} value={sec.id}>{sec.name}{sec.program ? ` (${sec.program})` : ''}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 3. Paginated Students Table */}
      <div className="bg-white dark:bg-zinc-900 border border-[#E5E2D9] dark:border-zinc-800 rounded-xl overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FAF9F5] dark:bg-zinc-800/80 border-b border-[#E5E2D9] dark:border-zinc-800 text-[11px] font-mono text-stone-600 dark:text-zinc-400 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-2.5">Student ID</th>
                <th className="px-4 py-2.5">Name</th>
                <th className="px-4 py-2.5">Email</th>
                <th className="px-4 py-2.5">Program</th>
                <th className="px-4 py-2.5">Section</th>
                <th className="px-4 py-2.5">Subgroup</th>
                <th className="px-4 py-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E2D9] dark:divide-zinc-800">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-stone-500 font-mono text-xs">
                    Loading student database records...
                  </td>
                </tr>
              ) : loadError ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[#8C1B2E] dark:text-red-400 font-mono text-xs" role="alert">
                    {loadError}
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-stone-500 font-mono text-xs">
                    {search.trim() || selectedSection !== 'ALL'
                      ? 'No student records match the search filter.'
                      : 'No students imported yet. Add them via the Students sheet in the Excel import.'}
                  </td>
                </tr>
              ) : (
                students.map(stu => (
                  <tr key={stu.id} className="hover:bg-[#FAF9F5] dark:hover:bg-zinc-800/50 transition-colors">
                    <td className="px-4 py-2.5 font-mono font-bold text-stone-900 dark:text-zinc-100">
                      {stu.studentId}
                    </td>
                    <td className="px-4 py-2.5 font-semibold text-stone-800 dark:text-zinc-200">
                      {stu.name}
                    </td>
                    <td className="px-4 py-2.5 text-stone-500 font-mono text-[11px]">
                      {stu.email}
                    </td>
                    <td className="px-4 py-2.5 text-stone-700 dark:text-zinc-300 font-medium">
                      {stu.programCode || '—'} (Sem {stu.semester})
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-stone-100 dark:bg-zinc-800 text-stone-800 dark:text-zinc-200">
                        {stu.sectionName}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      {stu.subSectionName ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300">
                          {stu.subSectionName}
                        </span>
                      ) : (
                        <span className="text-stone-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        onClick={() => setSelectedStudent(stu)}
                        className="px-2.5 py-1 bg-[#8C1B2E] text-white hover:bg-[#721525] rounded text-[11px] font-medium transition-colors"
                      >
                        Inspect Routine
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="p-3 bg-[#FAF9F5] dark:bg-zinc-800/50 border-t border-[#E5E2D9] dark:border-zinc-800 flex items-center justify-between text-xs text-stone-600 dark:text-zinc-400 font-mono">
          <div>
            {totalStudents === 0
              ? 'No students'
              : `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, totalStudents)} of ${totalStudents} students`}
          </div>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1 || isLoading}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              aria-label="Previous page"
              className="p-1 rounded border border-[#E5E2D9] dark:border-zinc-700 disabled:opacity-40 hover:bg-stone-100 dark:hover:bg-zinc-800"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span>Page {page} of {totalPages}</span>
            <button
              disabled={page >= totalPages || isLoading}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              aria-label="Next page"
              className="p-1 rounded border border-[#E5E2D9] dark:border-zinc-700 disabled:opacity-40 hover:bg-stone-100 dark:hover:bg-zinc-800"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 4. Student Academic Membership Modal */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="student-dialog-title"
            className="bg-[#FAF9F5] dark:bg-zinc-900 border border-[#E5E2D9] dark:border-zinc-800 rounded-xl p-5 max-w-2xl w-full space-y-4 shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-[#E5E2D9] dark:border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-[#8C1B2E]" />
                <div>
                  <h3 id="student-dialog-title" className="font-serif font-bold text-base text-stone-900 dark:text-zinc-100">{selectedStudent.name}</h3>
                  <div className="text-xs text-stone-500 font-mono">{selectedStudent.studentId} · {selectedStudent.email}</div>
                </div>
              </div>
              <button onClick={() => setSelectedStudent(null)} aria-label="Close" className="p-1 text-stone-400 hover:text-stone-900 dark:hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
              <div className="p-2 rounded bg-white dark:bg-zinc-800 border border-[#E5E2D9] dark:border-zinc-700">
                <span className="text-stone-400 block text-[10px]">PROGRAM</span>
                <span className="font-bold text-stone-800 dark:text-zinc-200">{selectedStudent.programCode || '—'}</span>
              </div>
              <div className="p-2 rounded bg-white dark:bg-zinc-800 border border-[#E5E2D9] dark:border-zinc-700">
                <span className="text-stone-400 block text-[10px]">SEMESTER</span>
                <span className="font-bold text-stone-800 dark:text-zinc-200">Sem {selectedStudent.semester}</span>
              </div>
              <div className="p-2 rounded bg-white dark:bg-zinc-800 border border-[#E5E2D9] dark:border-zinc-700">
                <span className="text-stone-400 block text-[10px]">SECTION</span>
                <span className="font-bold text-[#8C1B2E] dark:text-red-400">{selectedStudent.sectionName}</span>
              </div>
              <div className="p-2 rounded bg-white dark:bg-zinc-800 border border-[#E5E2D9] dark:border-zinc-700">
                <span className="text-stone-400 block text-[10px]">SUBGROUP</span>
                <span className="font-bold text-emerald-700 dark:text-emerald-400">{selectedStudent.subSectionName || '—'}</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-serif font-bold text-stone-900 dark:text-zinc-100 flex items-center justify-between">
                <span>Working-draft timetable ({studentSessions.length} weekly sessions)</span>
                <span className="text-[10px] font-mono text-stone-400">
                  Section {selectedStudent.sectionName}{selectedStudent.subSectionName ? ` + Subgroup ${selectedStudent.subSectionName}` : ''}
                </span>
              </div>

              <div className="max-h-60 overflow-y-auto space-y-1 text-xs">
                {studentSessions.length === 0 ? (
                  <div className="p-4 text-center text-stone-500 text-xs font-mono">No timetable generated yet.</div>
                ) : (
                  studentSessions.map(sess => {
                    const crs = courses.find(c => c.id === sess.courseId);
                    const rm = rooms.find(r => r.id === sess.roomId);
                    const fac = facultyMembers.find(f => f.id === sess.facultyId);
                    return (
                      <div key={sess.id} className="p-2 rounded bg-white dark:bg-zinc-800 border border-[#E5E2D9] dark:border-zinc-700 flex items-center justify-between">
                        <div>
                          <div className="font-bold text-stone-900 dark:text-zinc-100">{crs?.code || sess.courseId} — {crs?.name || 'Course'} ({sess.type})</div>
                          <div className="text-[11px] text-stone-500">{fac?.name || 'Faculty'} · Room {rm?.name || sess.roomId}</div>
                        </div>
                        <div className="text-right font-mono text-[11px]">
                          <div className="font-semibold text-[#8C1B2E] dark:text-red-400">{sess.day}</div>
                          <div className="text-stone-400">{slotLabel(sess.timeSlotId)}</div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button onClick={() => setSelectedStudent(null)} className="px-4 py-1.5 bg-stone-200 dark:bg-zinc-800 text-stone-800 dark:text-zinc-200 text-xs font-medium rounded-lg">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
