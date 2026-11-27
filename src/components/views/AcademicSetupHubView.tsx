import React, { useEffect, useState } from 'react';
import { useTimetable } from '../../context/TimetableContext';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  CalendarDays,
  Building2,
  Award,
  GraduationCap,
  BookOpen,
  UserSquare2,
  DoorOpen,
  Users,
  Layers,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Plus,
  Trash2,
  Search,
  Check,
  Play,
  Eye,
  AlertCircle,
  FileSpreadsheet,
  Download
} from 'lucide-react';
import { AcademicYearConfig, Course, DayOfWeek, Faculty, Room } from '../../types';
import { MasterExcelHub } from './academic-setup/MasterExcelHub';
import { GroupsAndSubgroupsTab } from './academic-setup/GroupsAndSubgroupsTab';
import { CourseAllocationsTab } from './academic-setup/CourseAllocationsTab';
import { facultyTeachingCap, facultyTeachingPeriods } from '../../lib/facultyWorkload';
import { AcademicSetupOverview } from './academic-setup/AcademicSetupOverview';
import { StudentsTab } from './academic-setup/StudentsTab';
import { generateMasterExcelTemplate } from '../../lib/excelMasterService';

export type SetupSubTab =
  | 'master_excel'
  | 'overview'
  | 'academic_year'
  | 'departments'
  | 'programs'
  | 'courses'
  | 'faculty'
  | 'rooms'
  | 'sections'
  | 'students'
  | 'allocations'
  | 'constraints'
  | 'generator'
  | 'review';

const ALL_DAYS: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const INPUT = 'bg-[#FAF9F5] dark:bg-zinc-900 border border-[#E5E2D9] dark:border-zinc-800 rounded-lg p-2 text-xs text-stone-900 dark:text-zinc-200 outline-none focus:border-[#8C1B2E]';
const SAVE_BTN = 'px-3.5 py-1.5 bg-[#8C1B2E] text-white rounded-lg text-xs font-semibold disabled:opacity-50';
const DELETE_BTN = 'p-1.5 text-stone-400 hover:text-[#8C1B2E] dark:hover:text-red-400 transition-colors disabled:opacity-40';
const NEW_BTN = 'flex items-center gap-1.5 px-3 py-1.5 bg-[#8C1B2E] hover:bg-[#721525] text-white rounded-lg text-xs font-semibold transition-all shadow-2xs';

const EMPTY_DEPT = { name: '', code: '', hodName: '', contactEmail: '', status: 'Active' as const };
const EMPTY_PROG = { name: '', code: '', departmentId: '', durationYears: 4, totalSemesters: 8, status: 'Active' as const };
const EMPTY_COURSE: Omit<Course, 'id'> = {
  code: '',
  name: '',
  departmentId: '',
  credits: 4,
  requiredLecturesPerWeek: 3,
  requiredTutorialsPerWeek: 0,
  requiredLabsPerWeek: 0,
  totalSemesterHours: 45,
  completedHours: 0,
  cancelledHours: 0,
  requiresLab: false,
  requiredEquipment: [],
  primaryFacultyId: '',
  status: 'Active',
};
const EMPTY_FACULTY: Omit<Faculty, 'id'> = {
  name: '',
  email: '',
  departmentId: '',
  designation: 'Assistant Professor',
  subjectsQualified: [],
  maxDirectTeachingHours: 16,
  weeklyHoursLimit: 40,
  status: 'Active',
  preferences: {
    preferredDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    preferredPeriods: [1, 2, 3, 4],
    protectedSlots: [],
    maxConsecutivePeriods: 2,
    availableForMakeup: true,
    availableForTutorial: true,
  },
};
const EMPTY_ROOM: Omit<Room, 'id'> = { name: '', building: '', floor: 0, capacity: 60, type: 'LectureHall', equipment: [], isAvailable: true };

type YearDraft = Pick<AcademicYearConfig, 'yearLabel' | 'semesterType' | 'semesterNumber' | 'workingDays'>;

export function AcademicSetupHubView() {
  const {
    activeView,
    setActiveView,
    academicYear,
    updateAcademicYear,
    departments,
    addDepartment,
    deleteDepartment,
    toggleDepartmentStatus,
    programs,
    addProgram,
    deleteProgram,
    rooms,
    addRoom,
    deleteRoom,
    toggleRoomAvailability,
    facultyMembers,
    addFaculty,
    deleteFaculty,
    toggleFacultyStatus,
    sections,
    courses,
    addCourse,
    deleteCourse,
    allocations,
    constraints,
    toggleConstraint,
    validationReport,
    generateDraftTimetable,
    updatePublishStatus,
    publishMasterTimetable,
    sessions,
    studentsCount,
    selectedSectionId,
    setSelectedSectionId,
    selectedFacultyId,
    setSelectedFacultyId,
    selectedRoomId,
    setSelectedRoomId,
  } = useTimetable();
  const { currentUser } = useAuth();
  const isAdmin = ['COLLEGE_ADMIN', 'SUPER_ADMIN'].includes(currentUser?.roleCode ?? '');
  const canEdit = isAdmin || currentUser?.roleCode === 'COORDINATOR';
  const publishStatus = academicYear.publishStatus;

  const [activeTab, setActiveTabState] = useState<SetupSubTab>('courses');
  const setActiveTab = (tab: SetupSubTab) => {
    setActiveTabState(tab);
    const viewForTab: Partial<Record<SetupSubTab, typeof activeView>> = {
      master_excel: 'master_excel', academic_year: 'academic_year', departments: 'departments', programs: 'programs',
      courses: 'courses_mgmt', faculty: 'faculty_mgmt', rooms: 'rooms_mgmt', sections: 'sections_mgmt',
      students: 'students', allocations: 'allocations', constraints: 'constraints', generator: 'generation_validator', review: 'timetable_review',
    };
    setActiveView(viewForTab[tab] || 'academic_setup');
  };

  useEffect(() => {
    if (activeView === 'master_excel') setActiveTabState('master_excel');
    else if (activeView === 'academic_year') setActiveTabState('academic_year');
    else if (activeView === 'departments') setActiveTabState('departments');
    else if (activeView === 'programs') setActiveTabState('programs');
    else if (activeView === 'courses_mgmt') setActiveTabState('courses');
    else if (activeView === 'faculty_mgmt') setActiveTabState('faculty');
    else if (activeView === 'rooms_mgmt') setActiveTabState('rooms');
    else if (activeView === 'sections_mgmt') setActiveTabState('sections');
    else if (activeView === 'students') setActiveTabState('students');
    else if (activeView === 'allocations') setActiveTabState('allocations');
    else if (activeView === 'availability' || activeView === 'constraints') setActiveTabState('constraints');
    else if (activeView === 'generation_validator') setActiveTabState('generator');
    else if (activeView === 'timetable_review') setActiveTabState('review');
    else if (activeView === 'academic_setup') setActiveTabState('courses');
  }, [activeView]);
  const [courseSearch, setCourseSearch] = useState('');
  const [coursePage, setCoursePage] = useState(0);
  const [facultySearch, setFacultySearch] = useState('');
  const [facultyPage, setFacultyPage] = useState(0);
  const [facultyDepartment, setFacultyDepartment] = useState('ALL');

  // One in-flight request at a time: disables every mutating button while it runs.
  const [saving, setSaving] = useState(false);
  const submit = async (action: () => Promise<{ success: boolean }>, onSuccess?: () => void) => {
    setSaving(true);
    const r = await action();
    setSaving(false);
    if (r.success) onSuccess?.();
  };

  // Academic year: edited locally, saved explicitly.
  const yearFromServer = (): YearDraft => ({
    yearLabel: academicYear.yearLabel,
    semesterType: academicYear.semesterType,
    semesterNumber: academicYear.semesterNumber,
    workingDays: academicYear.workingDays,
  });
  const [yearDraft, setYearDraft] = useState<YearDraft>(yearFromServer);
  useEffect(() => setYearDraft(yearFromServer()), [academicYear]);
  const yearDirty = JSON.stringify(yearDraft) !== JSON.stringify(yearFromServer());
  const yearValid = yearDraft.yearLabel.trim() !== '' && yearDraft.workingDays.length > 0 && Number.isInteger(yearDraft.semesterNumber) && yearDraft.semesterNumber >= 1 && yearDraft.semesterNumber <= 20;

  // Generation status state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationResult, setGenerationResult] = useState<Awaited<ReturnType<typeof generateDraftTimetable>> | null>(null);

  // Review View Angle
  const [reviewAngle, setReviewAngle] = useState<'section' | 'faculty' | 'room'>('section');
  const [reviewDay, setReviewDay] = useState<DayOfWeek>('Monday');
  const activeReviewDay = academicYear.workingDays.includes(reviewDay) ? reviewDay : academicYear.workingDays[0];

  // Form states
  const [showAddDept, setShowAddDept] = useState(false);
  const [deptForm, setDeptForm] = useState(EMPTY_DEPT);
  const [showAddProg, setShowAddProg] = useState(false);
  const [progForm, setProgForm] = useState(EMPTY_PROG);
  const [showAddCourse, setShowAddCourse] = useState(false);
  const [courseForm, setCourseForm] = useState(EMPTY_COURSE);
  const [showAddFaculty, setShowAddFaculty] = useState(false);
  const [facultyForm, setFacultyForm] = useState(EMPTY_FACULTY);
  const [showAddRoom, setShowAddRoom] = useState(false);
  const [roomForm, setRoomForm] = useState(EMPTY_ROOM);

  const totalCoursesAllocated = new Set(allocations.map(a => a.courseId)).size;
  const activeFacultyCount = facultyMembers.filter(f => f.status !== 'Inactive').length;
  const filteredCourses = courses.filter(c => c.code.toLowerCase().includes(courseSearch.toLowerCase()) || c.name.toLowerCase().includes(courseSearch.toLowerCase()));
  const coursePageSize = 50;
  const coursePageCount = Math.max(1, Math.ceil(filteredCourses.length / coursePageSize));
  const visibleCourses = filteredCourses.slice(coursePage * coursePageSize, (coursePage + 1) * coursePageSize);
  const filteredFaculty = facultyMembers.filter(f =>
    (facultyDepartment === 'ALL' || f.departmentId === facultyDepartment) &&
    (f.name.toLowerCase().includes(facultySearch.toLowerCase()) || f.email.toLowerCase().includes(facultySearch.toLowerCase()))
  );
  const facultyPageSize = 20;
  const facultyPageCount = Math.max(1, Math.ceil(filteredFaculty.length / facultyPageSize));
  const visibleFaculty = filteredFaculty.slice(facultyPage * facultyPageSize, (facultyPage + 1) * facultyPageSize);
  useEffect(() => setFacultyPage(0), [facultySearch, facultyDepartment]);
  useEffect(() => setCoursePage(0), [courseSearch]);
  const activeCoursesCount = courses.filter(c => c.status !== 'Archived').length;
  const activeRoomsCount = rooms.filter(r => r.isAvailable).length;
  const activeSectionsCount = sections.filter(s => s.status !== 'Inactive').length;
  const totalSubgroupsCount = sections.reduce((acc, s) => acc + (s.subSections?.length || 0), 0);
  const isBreakSlot = (slot: { id: string; isBreak?: boolean; isLunch?: boolean }) => Boolean(slot.isBreak || slot.isLunch || slot.id === academicYear.lunchPeriodId);
  const academicYearComplete = academicYear.workingDays.length > 0 && academicYear.timeSlots.some(s => !isBreakSlot(s));

  const handleRunGeneration = async () => {
    setIsGenerating(true);
    setGenerationResult(null);
    const res = await generateDraftTimetable();
    setGenerationResult(res);
    setIsGenerating(false);
    if (res.isSuccess && res.conflicts.length === 0) setActiveTab('review');
  };

  const handleDownloadMasterTemplate = async () => {
    const blob = await generateMasterExcelTemplate({
      departments,
      programs,
      courses,
      facultyMembers,
      rooms,
      sections,
      allocations
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ThirdYear_Computer_Timetable_Dataset_${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const departmentSelect = (value: string, onChange: (id: string) => void) => (
    <select value={value} onChange={e => onChange(e.target.value)} aria-label="Department" className={INPUT} required>
      <option value="">Select department…</option>
      {departments.map(d => (
        <option key={d.id} value={d.id}>{d.name}</option>
      ))}
    </select>
  );

  const navTabs = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="h-3.5 w-3.5" /> },
    { id: 'academic_year', label: 'Academic Year', icon: <CalendarDays className="h-3.5 w-3.5" /> },
    { id: 'departments', label: 'Departments', icon: <Building2 className="h-3.5 w-3.5" />, badge: departments.length },
    { id: 'programs', label: 'Programs', icon: <Award className="h-3.5 w-3.5" />, badge: programs.length },
    { id: 'courses', label: 'Courses', icon: <BookOpen className="h-3.5 w-3.5" />, badge: courses.length },
    { id: 'faculty', label: 'Faculty', icon: <UserSquare2 className="h-3.5 w-3.5" />, badge: facultyMembers.length },
    { id: 'rooms', label: 'Rooms & Labs', icon: <DoorOpen className="h-3.5 w-3.5" />, badge: rooms.length },
    { id: 'sections', label: 'Sections & Groups', icon: <Users className="h-3.5 w-3.5" />, badge: sections.length },
    { id: 'students', label: 'Students', icon: <GraduationCap className="h-3.5 w-3.5" />, badge: studentsCount },
    { id: 'allocations', label: 'Allocations', icon: <Layers className="h-3.5 w-3.5" />, badge: allocations.length },
    { id: 'constraints', label: 'Constraints & Rules', icon: <ShieldCheck className="h-3.5 w-3.5" />, badge: constraints.filter(c => c.isActive).length },
    { id: 'generator', label: 'Validate & Generate', icon: <Play className="h-3.5 w-3.5" /> },
    { id: 'review', label: 'Review & Publish', icon: <Eye className="h-3.5 w-3.5" /> },
    { id: 'master_excel', label: 'Excel Import', icon: <FileSpreadsheet className="h-3.5 w-3.5" /> },
  ];

  const checklist: { tab: SetupSubTab; label: string; detail: React.ReactNode }[] = [
    { tab: 'departments', label: 'Departments', detail: `${departments.length} departments` },
    { tab: 'programs', label: 'Programs', detail: `${programs.length} programs` },
    { tab: 'courses', label: 'Courses', detail: `${activeCoursesCount} active courses` },
    { tab: 'faculty', label: 'Faculty', detail: `${activeFacultyCount} active members` },
    { tab: 'rooms', label: 'Rooms & labs', detail: `${activeRoomsCount} available rooms` },
    { tab: 'sections', label: 'Sections', detail: `${activeSectionsCount} student sections` },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* 1. Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E5E2D9] dark:border-zinc-800 pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold font-serif text-stone-900 dark:text-zinc-100 tracking-tight">
            Academic Setup & Master Data
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 dark:text-zinc-400 mt-1">
            Institutional coordinator workspace for curriculum, cohort groups/subgroups, and Excel master sync.
          </p>
          {!canEdit && (
            <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-1">
              Read-only: only coordinators and admins can change academic setup.
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleDownloadMasterTemplate}
            title="Download complete academic database as Excel workbook"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-zinc-950 border border-[#E5E2D9] dark:border-zinc-800 hover:border-stone-400 rounded-lg text-xs font-semibold text-stone-700 dark:text-zinc-300 transition-colors shadow-2xs"
          >
            <Download className="h-3.5 w-3.5 text-[#8C1B2E] dark:text-red-400" />
            <span>Download Master Excel (.xlsx)</span>
          </button>

          {canEdit && (
            <button
              onClick={() => setActiveTab('master_excel')}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#8C1B2E] hover:bg-[#731625] text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span>Import Master Data</span>
            </button>
          )}

          <div className="flex items-center gap-1.5 pl-1">
            <span className="text-xs text-stone-500 dark:text-zinc-400">Status:</span>
            <span className="px-2.5 py-1 bg-[#FAF9F5] dark:bg-zinc-900 border border-[#E5E2D9] dark:border-zinc-800 rounded-md text-xs font-semibold text-stone-800 dark:text-zinc-200 shadow-2xs">
              {publishStatus}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Sub-navigation: Horizontal Pill Bar + Mobile Dropdown */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-1.5 pb-1 w-full min-w-0">
          {navTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as SetupSubTab)}
              className={`flex shrink-0 items-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-medium whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? 'bg-[#8C1B2E] text-white dark:text-white font-semibold shadow-xs'
                  : 'bg-[#FAF9F5] dark:bg-zinc-900 hover:bg-stone-100 dark:hover:bg-zinc-800 text-stone-700 dark:text-zinc-300 border border-[#E5E2D9] dark:border-zinc-800'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-semibold ${
                    activeTab === tab.id
                      ? 'bg-white/20 text-white'
                      : 'bg-stone-200 dark:bg-zinc-800 text-stone-600 dark:text-zinc-400'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Mobile Dropdown fallback for narrow viewports */}
        <div className="flex sm:hidden items-center gap-2 pt-1">
          <label htmlFor="setup-tab-jump" className="text-xs text-stone-500 font-medium">Jump to:</label>
          <select
            id="setup-tab-jump"
            value={activeTab}
            onChange={e => setActiveTab(e.target.value as SetupSubTab)}
            className="flex-1 bg-[#FAF9F5] dark:bg-zinc-900 border border-[#E5E2D9] dark:border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-stone-800 dark:text-zinc-200 font-medium focus:outline-none focus:border-[#8C1B2E] shadow-2xs"
          >
            {navTabs.map(tab => (
              <option key={tab.id} value={tab.id}>
                {tab.label} {tab.badge !== undefined ? `(${tab.badge})` : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 3. Subtab Content */}

      {/* MASTER EXCEL SETUP HUB */}
      {activeTab === 'master_excel' && (
        <MasterExcelHub canEdit={canEdit} onNavigateToTab={tab => setActiveTab(tab as SetupSubTab)} />
      )}

      {/* OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-5">
          <AcademicSetupOverview
            academicYearLabel={academicYear.yearLabel}
            semesterType={academicYear.semesterType}
            workingDays={academicYear.workingDays}
            periodsRange={
              academicYear.timeSlots.length
                ? `${academicYear.timeSlots[0].startTime} – ${academicYear.timeSlots[academicYear.timeSlots.length - 1].endTime}`
                : 'Not configured'
            }
            counts={{
              departments: departments.length,
              programs: programs.length,
              courses: courses.length,
              faculty: facultyMembers.length,
              rooms: rooms.length,
              sections: sections.length,
              subgroups: totalSubgroupsCount,
              allocations: allocations.length,
            }}
          />

          <div className="bg-[#FAF9F5] dark:bg-zinc-900 border border-[#E5E2D9] dark:border-zinc-800 rounded-xl p-5 shadow-xs">
            <h2 className="text-base font-bold font-serif text-stone-900 dark:text-zinc-100">
              Academic Setup Checklist
            </h2>
            <p className="text-xs text-stone-500 dark:text-zinc-400 mt-1">
              Review current institutional setup prior to timetable generation. Click any item to inspect.
            </p>

            <div className="mt-4 border border-[#E5E2D9] dark:border-zinc-800 rounded-xl divide-y divide-[#E5E2D9] dark:divide-zinc-800/80 text-xs overflow-hidden shadow-2xs">
              <button type="button" onClick={() => setActiveTab('academic_year')} className="w-full text-left p-3.5 bg-white dark:bg-zinc-950/60 flex items-center justify-between hover:bg-stone-50 dark:hover:bg-zinc-800/50 cursor-pointer transition-colors">
                <div>
                  <span className="font-semibold text-stone-900 dark:text-zinc-100">Academic year</span>
                  <span className="text-stone-500 dark:text-zinc-400 ml-2">{academicYear.yearLabel} · Semester {academicYear.semesterNumber}</span>
                </div>
                <span className={`font-semibold ${academicYearComplete ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}>
                  {academicYearComplete ? 'Complete' : 'Incomplete'}
                </span>
              </button>

              {checklist.map(item => (
                <button key={item.tab} type="button" onClick={() => setActiveTab(item.tab)} className="w-full text-left p-3.5 bg-white dark:bg-zinc-950/60 flex items-center justify-between hover:bg-stone-50 dark:hover:bg-zinc-800/50 cursor-pointer transition-colors">
                  <span className="font-semibold text-stone-900 dark:text-zinc-100">{item.label}</span>
                  <span className="font-medium text-stone-700 dark:text-zinc-300">{item.detail}</span>
                </button>
              ))}

              <button type="button" onClick={() => setActiveTab('allocations')} className="w-full text-left p-3.5 bg-white dark:bg-zinc-950/60 flex items-center justify-between hover:bg-stone-50 dark:hover:bg-zinc-800/50 cursor-pointer transition-colors">
                <span className="font-semibold text-stone-900 dark:text-zinc-100">Course allocations</span>
                <span className={`font-semibold ${totalCoursesAllocated >= activeCoursesCount ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}>
                  {totalCoursesAllocated} / {activeCoursesCount} allocated
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ACADEMIC YEAR */}
      {activeTab === 'academic_year' && (
        <div className="p-5 bg-[#FAF9F5] dark:bg-zinc-900 border border-[#E5E2D9] dark:border-zinc-800 rounded-xl space-y-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E5E2D9] dark:border-zinc-800 pb-3">
            <div>
              <h3 className="text-base font-bold font-serif text-stone-900 dark:text-zinc-100">Academic Year & Semester Calendar</h3>
              <p className="text-xs text-stone-500 dark:text-zinc-400 mt-1">Configure the semester and working days. Changes apply when you press Save.</p>
            </div>
            {canEdit && (
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setYearDraft(yearFromServer())}
                  disabled={!yearDirty || saving}
                  className="px-3 py-1.5 text-xs text-stone-500 disabled:opacity-40"
                >
                  Discard
                </button>
                <button
                  type="button"
                  onClick={() => submit(() => updateAcademicYear({ ...yearDraft, yearLabel: yearDraft.yearLabel.trim() }))}
                  disabled={!yearDirty || !yearValid || saving}
                  className={SAVE_BTN}
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label htmlFor="ay-label" className="text-xs text-stone-600 dark:text-zinc-400 font-medium">Academic Year Label</label>
              <input
                id="ay-label"
                type="text"
                value={yearDraft.yearLabel}
                disabled={!canEdit}
                maxLength={50}
                onChange={e => setYearDraft(d => ({ ...d, yearLabel: e.target.value }))}
                className="w-full bg-white dark:bg-zinc-950 border border-[#E5E2D9] dark:border-zinc-800 rounded-lg p-2.5 text-xs text-stone-900 dark:text-zinc-200 outline-none focus:border-[#8C1B2E]"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="ay-semester-type" className="text-xs text-stone-600 dark:text-zinc-400 font-medium">Semester Type</label>
              <select
                id="ay-semester-type"
                value={yearDraft.semesterType}
                disabled={!canEdit}
                onChange={e => setYearDraft(d => ({ ...d, semesterType: e.target.value as YearDraft['semesterType'] }))}
                className="w-full bg-white dark:bg-zinc-950 border border-[#E5E2D9] dark:border-zinc-800 rounded-lg p-2.5 text-xs text-stone-900 dark:text-zinc-200 outline-none focus:border-[#8C1B2E]"
              >
                <option value="Odd (Autumn)">Odd (Autumn)</option>
                <option value="Even (Spring)">Even (Spring)</option>
                <option value="Summer">Summer Term</option>
              </select>
            </div>

            <div className="space-y-1">
              <label htmlFor="ay-semester-number" className="text-xs text-stone-600 dark:text-zinc-400 font-medium">Semester Level</label>
              <input
                id="ay-semester-number"
                type="number"
                min={1}
                max={20}
                value={yearDraft.semesterNumber}
                disabled={!canEdit}
                onChange={e => setYearDraft(d => ({ ...d, semesterNumber: Number(e.target.value) || 1 }))}
                className="w-full bg-white dark:bg-zinc-950 border border-[#E5E2D9] dark:border-zinc-800 rounded-lg p-2.5 text-xs text-stone-900 dark:text-zinc-200 outline-none focus:border-[#8C1B2E]"
              />
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-[#E5E2D9] dark:border-zinc-800">
            <span className="text-xs font-semibold text-stone-800 dark:text-zinc-300">Active Working Days</span>
            <div className="flex flex-wrap gap-2">
              {ALL_DAYS.map(day => {
                const isSelected = yearDraft.workingDays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    aria-pressed={isSelected}
                    disabled={!canEdit}
                    onClick={() =>
                      setYearDraft(d => ({ ...d, workingDays: ALL_DAYS.filter(x => (x === day ? !isSelected : d.workingDays.includes(x))) }))
                    }
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      isSelected
                        ? 'bg-[#8C1B2E] text-white font-semibold shadow-2xs'
                        : 'bg-white dark:bg-zinc-950 border border-[#E5E2D9] dark:border-zinc-800 text-stone-600 dark:text-zinc-400 hover:text-stone-900 dark:hover:text-zinc-200'
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
            {yearDraft.workingDays.length === 0 && (
              <p className="text-[11px] text-[#8C1B2E] dark:text-red-400">Select at least one working day.</p>
            )}
          </div>

          <div className="space-y-2 pt-2 border-t border-[#E5E2D9] dark:border-zinc-800">
            <span className="text-xs font-semibold text-stone-800 dark:text-zinc-300">Daily Teaching Periods</span>
            <div className="border border-[#E5E2D9] dark:border-zinc-800 rounded-xl overflow-hidden divide-y divide-[#E5E2D9] dark:divide-zinc-800 shadow-2xs">
              {academicYear.timeSlots.map(slot => (
                <div key={slot.id} className="p-3 bg-white dark:bg-zinc-950/60 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-stone-500 dark:text-zinc-400 font-semibold w-16">Period {slot.periodNumber}</span>
                    <span className="font-medium text-stone-900 dark:text-zinc-200">{slot.label}</span>
                    {isBreakSlot(slot) && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-500/20">
                        {slot.isBreak && !slot.isLunch ? 'Break' : 'Campus Lunch Break'}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-stone-500 dark:text-zinc-500 font-mono">{slot.startTime} – {slot.endTime}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* DEPARTMENTS */}
      {activeTab === 'departments' && (
        <div className="p-5 bg-[#FAF9F5] dark:bg-zinc-900 border border-[#E5E2D9] dark:border-zinc-800 rounded-xl space-y-4 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E5E2D9] dark:border-zinc-800 pb-3">
            <div>
              <h3 className="text-base font-bold font-serif text-stone-900 dark:text-zinc-100">Academic Departments</h3>
              <p className="text-xs text-stone-500 dark:text-zinc-400 mt-1">Manage departmental leadership and faculty placement</p>
            </div>
            {canEdit && (
              <button onClick={() => setShowAddDept(true)} className={`${NEW_BTN} self-start sm:self-auto`}>
                <Plus className="h-3.5 w-3.5" />
                <span>Add Department</span>
              </button>
            )}
          </div>

          <div className="border border-[#E5E2D9] dark:border-zinc-800 rounded-xl overflow-hidden divide-y divide-[#E5E2D9] dark:divide-zinc-800 shadow-2xs">
            {departments.length === 0 && <div className="p-6 text-center text-xs text-stone-400 italic">No departments yet.</div>}
            {departments.map(dept => (
              <div key={dept.id} className="p-3.5 bg-white dark:bg-zinc-950/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-stone-900 dark:text-zinc-100">{dept.name}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#FAF9F5] dark:bg-zinc-900 text-[#8C1B2E] dark:text-red-400 border border-[#E5E2D9] dark:border-zinc-800 font-semibold">
                      {dept.code}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                      dept.status === 'Active' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40' : 'bg-stone-100 text-stone-600 dark:bg-zinc-800 dark:text-zinc-400'
                    }`}>
                      {dept.status}
                    </span>
                  </div>
                  <div className="text-[11px] text-stone-500 dark:text-zinc-400">
                    HOD: <span className="text-stone-800 dark:text-zinc-200 font-medium">{dept.hodName || '—'}</span> · Contact: <span className="font-mono text-stone-600 dark:text-zinc-400">{dept.contactEmail || '—'}</span>
                  </div>
                </div>

                {canEdit && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => submit(() => toggleDepartmentStatus(dept.id))}
                      disabled={saving}
                      className="px-2.5 py-1 rounded bg-[#FAF9F5] dark:bg-zinc-900 hover:bg-stone-100 dark:hover:bg-zinc-850 text-stone-700 dark:text-zinc-300 border border-[#E5E2D9] dark:border-zinc-800 text-[11px] transition-colors disabled:opacity-50"
                    >
                      {dept.status === 'Active' ? 'Deactivate' : 'Activate'}
                    </button>
                    <button onClick={() => submit(() => deleteDepartment(dept.id))} disabled={saving} className={DELETE_BTN} aria-label={`Delete department ${dept.name}`} title="Delete">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {showAddDept && canEdit && (
            <form
              onSubmit={e => {
                e.preventDefault();
                submit(() => addDepartment(deptForm), () => {
                  setShowAddDept(false);
                  setDeptForm(EMPTY_DEPT);
                });
              }}
              className="p-4 bg-white dark:bg-zinc-950 border border-[#8C1B2E]/40 rounded-xl space-y-3 shadow-2xs"
            >
              <div className="text-xs font-semibold text-stone-900 dark:text-zinc-200">New Department</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input type="text" placeholder="Department Name" aria-label="Department name" value={deptForm.name} onChange={e => setDeptForm(d => ({ ...d, name: e.target.value }))} className={INPUT} required />
                <input type="text" placeholder="Code (e.g. CSED)" aria-label="Department code" value={deptForm.code} onChange={e => setDeptForm(d => ({ ...d, code: e.target.value }))} className={INPUT} required maxLength={30} />
                <input type="text" placeholder="HOD Name" aria-label="HOD name" value={deptForm.hodName} onChange={e => setDeptForm(d => ({ ...d, hodName: e.target.value }))} className={INPUT} />
                <input type="email" placeholder="Email" aria-label="Contact email" value={deptForm.contactEmail} onChange={e => setDeptForm(d => ({ ...d, contactEmail: e.target.value }))} className={INPUT} />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowAddDept(false)} className="px-3 py-1 text-xs text-stone-500">Cancel</button>
                <button type="submit" disabled={saving} className={SAVE_BTN}>{saving ? 'Saving…' : 'Save Department'}</button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* PROGRAMS */}
      {activeTab === 'programs' && (
        <div className="p-5 bg-[#FAF9F5] dark:bg-zinc-900 border border-[#E5E2D9] dark:border-zinc-800 rounded-xl space-y-4 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E5E2D9] dark:border-zinc-800 pb-3">
            <div>
              <h3 className="text-base font-bold font-serif text-stone-900 dark:text-zinc-100">Degree Programs</h3>
              <p className="text-xs text-stone-500 dark:text-zinc-400 mt-1">Programs offered across academic departments</p>
            </div>
            {canEdit && (
              <button onClick={() => setShowAddProg(true)} className={`${NEW_BTN} self-start sm:self-auto`}>
                <Plus className="h-3.5 w-3.5" />
                <span>Add Program</span>
              </button>
            )}
          </div>

          <div className="border border-[#E5E2D9] dark:border-zinc-800 rounded-xl overflow-hidden divide-y divide-[#E5E2D9] dark:divide-zinc-800 shadow-2xs">
            {programs.length === 0 && <div className="p-6 text-center text-xs text-stone-400 italic">No programs yet.</div>}
            {programs.map(prog => {
              const dept = departments.find(d => d.id === prog.departmentId);
              return (
                <div key={prog.id} className="p-3.5 bg-white dark:bg-zinc-950/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-stone-900 dark:text-zinc-100">{prog.name}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#FAF9F5] dark:bg-zinc-900 text-stone-700 dark:text-zinc-300 border border-[#E5E2D9] dark:border-zinc-800">
                        {prog.code}
                      </span>
                    </div>
                    <div className="text-[11px] text-stone-500 dark:text-zinc-400">
                      Dept: <span className="text-stone-800 dark:text-zinc-200 font-medium">{dept?.name || prog.departmentId}</span> · Duration: {prog.durationYears} Years
                    </div>
                  </div>
                  {canEdit && (
                    <button onClick={() => submit(() => deleteProgram(prog.id))} disabled={saving} className={DELETE_BTN} aria-label={`Delete program ${prog.name}`} title="Delete">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {showAddProg && canEdit && (
            <form
              onSubmit={e => {
                e.preventDefault();
                submit(() => addProgram(progForm), () => {
                  setShowAddProg(false);
                  setProgForm(EMPTY_PROG);
                });
              }}
              className="p-4 bg-white dark:bg-zinc-950 border border-[#8C1B2E]/40 rounded-xl space-y-3 shadow-2xs"
            >
              <div className="text-xs font-semibold text-stone-900 dark:text-zinc-200">New Degree Program</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input type="text" placeholder="Program Name" aria-label="Program name" value={progForm.name} onChange={e => setProgForm(p => ({ ...p, name: e.target.value }))} className={INPUT} required />
                <input type="text" placeholder="Code (e.g. BTECH-CSE)" aria-label="Program code" value={progForm.code} onChange={e => setProgForm(p => ({ ...p, code: e.target.value }))} className={INPUT} required maxLength={30} />
                {departmentSelect(progForm.departmentId, id => setProgForm(p => ({ ...p, departmentId: id })))}
                <input
                  type="number"
                  min={1}
                  max={10}
                  placeholder="Duration (Years)"
                  aria-label="Duration in years"
                  value={progForm.durationYears}
                  onChange={e => setProgForm(p => ({ ...p, durationYears: Number(e.target.value) || 4 }))}
                  className={INPUT}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowAddProg(false)} className="px-3 py-1 text-xs text-stone-500">Cancel</button>
                <button type="submit" disabled={saving} className={SAVE_BTN}>{saving ? 'Saving…' : 'Save Program'}</button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* COURSES */}
      {activeTab === 'courses' && (
        <div className="p-5 bg-[#FAF9F5] dark:bg-zinc-900 border border-[#E5E2D9] dark:border-zinc-800 rounded-xl space-y-4 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E5E2D9] dark:border-zinc-800 pb-3">
            <div>
              <h3 className="text-base font-bold font-serif text-stone-900 dark:text-zinc-100">Course & Subject Catalog</h3>
              <p className="text-xs text-stone-500 dark:text-zinc-400 mt-1">Accredited subjects, lecture/tutorial/lab requirements, and credit hours</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="h-3.5 w-3.5 text-stone-400 dark:text-zinc-500 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Search code / title..."
                  aria-label="Search courses"
                  value={courseSearch}
                  onChange={e => setCourseSearch(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-white dark:bg-zinc-950 border border-[#E5E2D9] dark:border-zinc-800 rounded-lg text-xs text-stone-900 dark:text-zinc-200 outline-none focus:border-[#8C1B2E] w-44 sm:w-56"
                />
              </div>
              <select aria-label="Filter faculty by department" value={facultyDepartment} onChange={e => setFacultyDepartment(e.target.value)} className="px-2 py-1.5 bg-white dark:bg-zinc-950 border border-[#E5E2D9] dark:border-zinc-800 rounded-lg text-xs">
                <option value="ALL">All departments</option>
                {departments.map(department => <option key={department.id} value={department.id}>{department.code}</option>)}
              </select>
              {canEdit && (
                <button onClick={() => setShowAddCourse(true)} className={NEW_BTN}>
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Course</span>
                </button>
              )}
            </div>
          </div>

          <div className="border border-[#E5E2D9] dark:border-zinc-800 rounded-xl overflow-hidden divide-y divide-[#E5E2D9] dark:divide-zinc-800 shadow-2xs">
            {courses.length === 0 && <div className="p-6 text-center text-xs text-stone-400 italic">No courses yet.</div>}
            {visibleCourses.map(course => {
                const isAllocated = allocations.some(a => a.courseId === course.id);
                return (
                  <div key={course.id} className="p-3.5 bg-white dark:bg-zinc-950/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-[#8C1B2E] dark:text-red-400">{course.code}</span>
                        <span className="font-semibold text-stone-900 dark:text-zinc-100">{course.name}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#FAF9F5] dark:bg-zinc-900 text-stone-700 dark:text-zinc-300 border border-[#E5E2D9] dark:border-zinc-800">
                          {course.credits} Credits
                        </span>
                        {course.requiresLab && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-500/20">
                            Lab
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-stone-500 dark:text-zinc-400 flex flex-wrap items-center gap-x-3">
                        <span>L-T-P: <strong className="text-stone-800 dark:text-zinc-200 font-mono">{course.requiredLecturesPerWeek}-{course.requiredTutorialsPerWeek}-{course.requiredLabsPerWeek}</strong></span>
                        <span>·</span>
                        <span className={isAllocated ? 'text-emerald-700 dark:text-emerald-400 font-medium' : 'text-amber-700 dark:text-amber-400 font-medium'}>
                          {isAllocated ? 'Allocated' : 'Unallocated'}
                        </span>
                      </div>
                    </div>
                    {canEdit && (
                      <button onClick={() => submit(() => deleteCourse(course.id))} disabled={saving} className={DELETE_BTN} aria-label={`Delete course ${course.code}`} title="Delete">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
          </div>

          {filteredCourses.length > coursePageSize && <div className="flex items-center justify-between text-xs text-stone-500 dark:text-zinc-400">
            <span>{coursePage * coursePageSize + 1}–{Math.min((coursePage + 1) * coursePageSize, filteredCourses.length)} of {filteredCourses.length} courses</span>
            <div className="flex gap-2"><button type="button" disabled={coursePage === 0} onClick={() => setCoursePage(page => Math.max(0, page - 1))} className="rounded border border-[#E5E2D9] px-2 py-1 disabled:opacity-40 dark:border-zinc-700">Previous</button><button type="button" disabled={coursePage + 1 >= coursePageCount} onClick={() => setCoursePage(page => Math.min(coursePageCount - 1, page + 1))} className="rounded border border-[#E5E2D9] px-2 py-1 disabled:opacity-40 dark:border-zinc-700">Next</button></div>
          </div>}

          {showAddCourse && canEdit && (
            <form
              onSubmit={e => {
                e.preventDefault();
                submit(() => addCourse({ ...courseForm, requiresLab: courseForm.requiredLabsPerWeek > 0 }), () => {
                  setShowAddCourse(false);
                  setCourseForm(EMPTY_COURSE);
                });
              }}
              className="p-4 bg-white dark:bg-zinc-950 border border-[#8C1B2E]/40 rounded-xl space-y-3 shadow-2xs"
            >
              <div className="text-xs font-semibold text-stone-900 dark:text-zinc-200">New Course Specification</div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input type="text" placeholder="Code (e.g. CS504)" aria-label="Course code" value={courseForm.code} onChange={e => setCourseForm(c => ({ ...c, code: e.target.value }))} className={INPUT} required maxLength={30} />
                <input type="text" placeholder="Title (e.g. Machine Learning)" aria-label="Course title" value={courseForm.name} onChange={e => setCourseForm(c => ({ ...c, name: e.target.value }))} className={`sm:col-span-2 ${INPUT}`} required />
                {departmentSelect(courseForm.departmentId, id => setCourseForm(c => ({ ...c, departmentId: id })))}
                <input type="number" min={0} max={40} placeholder="Credits" aria-label="Credits" value={courseForm.credits} onChange={e => setCourseForm(c => ({ ...c, credits: Math.max(0, Number(e.target.value) || 0) }))} className={INPUT} />
                <input type="number" min={0} max={40} placeholder="Lec / wk" aria-label="Lectures per week" value={courseForm.requiredLecturesPerWeek} onChange={e => setCourseForm(c => ({ ...c, requiredLecturesPerWeek: Math.max(0, Number(e.target.value) || 0) }))} className={INPUT} />
                <input type="number" min={0} max={40} placeholder="Tut / wk" aria-label="Tutorials per week" value={courseForm.requiredTutorialsPerWeek} onChange={e => setCourseForm(c => ({ ...c, requiredTutorialsPerWeek: Math.max(0, Number(e.target.value) || 0) }))} className={INPUT} />
                <input type="number" min={0} max={40} placeholder="Lab / wk" aria-label="Lab hours per week" value={courseForm.requiredLabsPerWeek} onChange={e => setCourseForm(c => ({ ...c, requiredLabsPerWeek: Math.max(0, Number(e.target.value) || 0) }))} className={INPUT} />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowAddCourse(false)} className="px-3 py-1 text-xs text-stone-500">Cancel</button>
                <button type="submit" disabled={saving} className={SAVE_BTN}>{saving ? 'Saving…' : 'Save Course'}</button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* FACULTY */}
      {activeTab === 'faculty' && (
        <div className="p-5 bg-[#FAF9F5] dark:bg-zinc-900 border border-[#E5E2D9] dark:border-zinc-800 rounded-xl space-y-4 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E5E2D9] dark:border-zinc-800 pb-3">
            <div>
              <h3 className="text-base font-bold font-serif text-stone-900 dark:text-zinc-100">Faculty & Instructional Roster</h3>
              <p className="text-xs text-stone-500 dark:text-zinc-400 mt-1">Manage instructors, designations, and UGC direct workload limits</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="h-3.5 w-3.5 text-stone-400 dark:text-zinc-500 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Search faculty..."
                  aria-label="Search faculty"
                  value={facultySearch}
                  onChange={e => setFacultySearch(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-white dark:bg-zinc-950 border border-[#E5E2D9] dark:border-zinc-800 rounded-lg text-xs text-stone-900 dark:text-zinc-200 outline-none focus:border-[#8C1B2E] w-44 shadow-2xs"
                />
              </div>
              {canEdit && (
                <button onClick={() => setShowAddFaculty(true)} className={NEW_BTN}>
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Faculty</span>
                </button>
              )}
            </div>
          </div>

          <div className="border border-[#E5E2D9] dark:border-zinc-800 rounded-xl overflow-hidden divide-y divide-[#E5E2D9] dark:divide-zinc-800 shadow-2xs">
            {facultyMembers.length === 0 && <div className="p-6 text-center text-xs text-stone-400 italic">No faculty yet.</div>}
            {visibleFaculty.map(fac => {
                const assignedHours = facultyTeachingPeriods(sessions, fac.id);
                const teachingCap = facultyTeachingCap(fac);

                return (
                  <div key={fac.id} className="p-3.5 bg-white dark:bg-zinc-950/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-stone-900 dark:text-zinc-100">{fac.name}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#FAF9F5] dark:bg-zinc-900 text-stone-700 dark:text-zinc-300 border border-[#E5E2D9] dark:border-zinc-800">
                          {fac.designation}
                        </span>
                        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                          assignedHours > teachingCap
                            ? 'bg-rose-50 text-rose-800 dark:bg-red-500/10 dark:text-red-300 border-rose-200 dark:border-red-500/20'
                            : 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/20'
                        }`}>
                          Load: {assignedHours}/{teachingCap} hrs/wk
                        </span>
                        {fac.status && fac.status !== 'Active' && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-stone-100 text-stone-600 dark:bg-zinc-800 dark:text-zinc-400">{fac.status}</span>
                        )}
                      </div>
                      <div className="text-[11px] text-stone-500 dark:text-zinc-400 font-mono">{fac.email}</div>
                    </div>

                    {canEdit && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => submit(() => toggleFacultyStatus(fac.id))}
                          disabled={saving}
                          className="px-2.5 py-1 rounded bg-[#FAF9F5] dark:bg-zinc-900 hover:bg-stone-100 text-stone-700 dark:text-zinc-300 border border-[#E5E2D9] dark:border-zinc-800 text-[11px] transition-colors disabled:opacity-50"
                        >
                          {fac.status === 'Inactive' ? 'Activate' : 'Deactivate'}
                        </button>
                        <button onClick={() => submit(() => deleteFaculty(fac.id))} disabled={saving} className={DELETE_BTN} aria-label={`Delete faculty ${fac.name}`} title="Delete">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>

          {filteredFaculty.length > 0 && <div className="flex items-center justify-between text-xs text-stone-500 dark:text-zinc-400">
            <span>{facultyPage * facultyPageSize + 1}–{Math.min((facultyPage + 1) * facultyPageSize, filteredFaculty.length)} of {filteredFaculty.length} faculty</span>
            <div className="flex items-center gap-2"><button type="button" disabled={facultyPage === 0} onClick={() => setFacultyPage(page => Math.max(0, page - 1))} className="rounded border border-[#E5E2D9] px-2 py-1 disabled:opacity-40 dark:border-zinc-700">Previous</button><span>Page {facultyPage + 1} of {facultyPageCount}</span><button type="button" disabled={facultyPage + 1 >= facultyPageCount} onClick={() => setFacultyPage(page => Math.min(facultyPageCount - 1, page + 1))} className="rounded border border-[#E5E2D9] px-2 py-1 disabled:opacity-40 dark:border-zinc-700">Next</button></div>
          </div>}

          {showAddFaculty && canEdit && (
            <form
              onSubmit={e => {
                e.preventDefault();
                submit(() => addFaculty(facultyForm), () => {
                  setShowAddFaculty(false);
                  setFacultyForm(EMPTY_FACULTY);
                });
              }}
              className="p-4 bg-white dark:bg-zinc-950 border border-[#8C1B2E]/40 rounded-xl space-y-3 shadow-2xs"
            >
              <div className="text-xs font-semibold text-stone-900 dark:text-zinc-200">New Faculty Member</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input type="text" placeholder="Full Name" aria-label="Full name" value={facultyForm.name} onChange={e => setFacultyForm(f => ({ ...f, name: e.target.value }))} className={INPUT} required />
                <input type="email" placeholder="Email" aria-label="Email" value={facultyForm.email} onChange={e => setFacultyForm(f => ({ ...f, email: e.target.value }))} className={INPUT} required />
                {departmentSelect(facultyForm.departmentId, id => setFacultyForm(f => ({ ...f, departmentId: id })))}
                <select
                  value={facultyForm.designation}
                  aria-label="Designation"
                  onChange={e => {
                    const designation = e.target.value as Faculty['designation'];
                    setFacultyForm(f => ({ ...f, designation, maxDirectTeachingHours: designation === 'Assistant Professor' ? 16 : 14 }));
                  }}
                  className={INPUT}
                >
                  <option value="Professor">Professor (14h cap)</option>
                  <option value="Associate Professor">Associate Professor (14h cap)</option>
                  <option value="Assistant Professor">Assistant Professor (16h cap)</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowAddFaculty(false)} className="px-3 py-1 text-xs text-stone-500">Cancel</button>
                <button type="submit" disabled={saving} className={SAVE_BTN}>{saving ? 'Saving…' : 'Save Faculty'}</button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* ROOMS */}
      {activeTab === 'rooms' && (
        <div className="p-5 bg-[#FAF9F5] dark:bg-zinc-900 border border-[#E5E2D9] dark:border-zinc-800 rounded-xl space-y-4 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E5E2D9] dark:border-zinc-800 pb-3">
            <div>
              <h3 className="text-base font-bold font-serif text-stone-900 dark:text-zinc-100">Physical Rooms & Labs</h3>
              <p className="text-xs text-stone-500 dark:text-zinc-400 mt-1">Manage lecture halls, computer labs, and capacities</p>
            </div>
            {canEdit && (
              <button onClick={() => setShowAddRoom(true)} className={`${NEW_BTN} self-start sm:self-auto`}>
                <Plus className="h-3.5 w-3.5" />
                <span>Add Facility</span>
              </button>
            )}
          </div>

          {rooms.length === 0 && <div className="p-6 text-center text-xs text-stone-400 italic">No rooms yet.</div>}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {rooms.map(room => (
              <div key={room.id} className="p-3.5 bg-white dark:bg-zinc-950/70 border border-[#E5E2D9] dark:border-zinc-800 rounded-xl space-y-2 shadow-2xs">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-bold text-stone-900 dark:text-zinc-100 text-xs sm:text-sm">{room.name}</div>
                    <div className="break-words text-[11px] text-stone-500 dark:text-zinc-400" title={room.building}>{room.building}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#FAF9F5] dark:bg-zinc-900 text-[#8C1B2E] dark:text-red-400 border border-[#E5E2D9] dark:border-zinc-800 font-semibold">
                      {room.type.replace(/([a-z])([A-Z])/g, '$1 $2')}
                    </span>
                    {canEdit && (
                      <button onClick={() => submit(() => deleteRoom(room.id))} disabled={saving} className={DELETE_BTN} aria-label={`Delete room ${room.name}`} title="Delete">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs pt-1 border-t border-[#E5E2D9] dark:border-zinc-800/80">
                  <span className="text-stone-500 dark:text-zinc-400">Capacity: <strong className="font-mono text-stone-800 dark:text-zinc-200">{room.capacity}</strong></span>
                  <button
                    onClick={() => submit(() => toggleRoomAvailability(room.id))}
                    disabled={!canEdit || saving}
                    title={canEdit ? 'Toggle availability' : undefined}
                    className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                      room.isAvailable ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20' : 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20'
                    }`}
                  >
                    {room.isAvailable ? 'Available' : 'Maintenance'}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {showAddRoom && canEdit && (
            <form
              onSubmit={e => {
                e.preventDefault();
                submit(() => addRoom(roomForm), () => {
                  setShowAddRoom(false);
                  setRoomForm(EMPTY_ROOM);
                });
              }}
              className="p-4 bg-white dark:bg-zinc-950 border border-[#8C1B2E]/40 rounded-xl space-y-3 shadow-2xs"
            >
              <div className="text-xs font-semibold text-stone-900 dark:text-zinc-200">New Physical Facility</div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <input type="text" placeholder="Facility Name (e.g. Lab 304)" aria-label="Facility name" value={roomForm.name} onChange={e => setRoomForm(r => ({ ...r, name: e.target.value }))} className={INPUT} required maxLength={100} />
                <input type="text" placeholder="Building" aria-label="Building" value={roomForm.building} onChange={e => setRoomForm(r => ({ ...r, building: e.target.value }))} className={INPUT} />
                <select value={roomForm.type} aria-label="Facility type" onChange={e => setRoomForm(r => ({ ...r, type: e.target.value as Room['type'] }))} className={INPUT}>
                  <option value="LectureHall">Lecture Hall</option>
                  <option value="ComputerLab">Computer Lab</option>
                  <option value="HardwareLab">Hardware Lab</option>
                  <option value="SeminarRoom">Seminar Room</option>
                  <option value="TutorialRoom">Tutorial Room</option>
                </select>
                <input type="number" min={1} max={5000} placeholder="Capacity" aria-label="Capacity" value={roomForm.capacity} onChange={e => setRoomForm(r => ({ ...r, capacity: Number(e.target.value) || 1 }))} className={INPUT} required />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowAddRoom(false)} className="px-3 py-1 text-xs text-stone-500">Cancel</button>
                <button type="submit" disabled={saving} className={SAVE_BTN}>{saving ? 'Saving…' : 'Save Facility'}</button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* SECTIONS (GROUPS & SUBGROUPS) */}
      {activeTab === 'sections' && <GroupsAndSubgroupsTab canEdit={canEdit} />}

      {/* STUDENTS ROSTER */}
      {activeTab === 'students' && <StudentsTab />}

      {/* ALLOCATIONS */}
      {activeTab === 'allocations' && <CourseAllocationsTab canEdit={canEdit} />}

      {/* CONSTRAINTS */}
      {activeTab === 'constraints' && (
        <div className="p-5 bg-[#FAF9F5] dark:bg-zinc-900 border border-[#E5E2D9] dark:border-zinc-800 rounded-xl space-y-4 shadow-xs">
          <div className="border-b border-[#E5E2D9] dark:border-zinc-800 pb-3">
            <h3 className="font-serif text-base font-semibold text-stone-900 dark:text-zinc-100">Timetabling Constraints</h3>
            <p className="text-xs text-stone-500 dark:text-zinc-400 mt-0.5">
              Hard constraints are always enforced by the scheduler and cannot be switched off. Soft constraints can be enabled or disabled.
            </p>
          </div>

          <div className="border border-[#E5E2D9] dark:border-zinc-800 rounded-lg overflow-hidden divide-y divide-[#E5E2D9] dark:divide-zinc-800">
            {constraints.length === 0 && <div className="p-6 text-center text-xs text-stone-400 italic">No constraints configured.</div>}
            {constraints.map(item => {
              const isHard = item.type === 'Hard';
              return (
                <div key={item.id} className="p-3.5 bg-white dark:bg-zinc-950/60 flex items-start justify-between gap-3 text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-stone-900 dark:text-zinc-100">{item.name}</span>
                      <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                        isHard ? 'bg-red-50 text-[#8C1B2E] dark:bg-red-500/10 dark:text-red-300 border border-red-200 dark:border-red-500/20 font-bold' : 'bg-stone-100 text-stone-600 dark:bg-zinc-900 dark:text-zinc-400 border border-[#E5E2D9] dark:border-zinc-800'
                      }`}>
                        {item.type}
                      </span>
                    </div>
                    <p className="text-[11px] text-stone-500 dark:text-zinc-400 mt-0.5">{item.description}</p>
                  </div>
                  <button
                    onClick={() => submit(() => toggleConstraint(item.id))}
                    disabled={isHard || !canEdit || saving}
                    aria-pressed={isHard ? undefined : item.isActive}
                    title={isHard ? 'Hard constraints are always enforced by the scheduler and cannot be switched off.' : undefined}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium shrink-0 transition-colors ${
                      isHard || item.isActive ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20' : 'bg-stone-100 text-stone-500 dark:bg-zinc-900 dark:text-zinc-500 border border-[#E5E2D9] dark:border-zinc-800'
                    } ${isHard ? 'cursor-not-allowed' : ''}`}
                  >
                    {isHard ? 'Always enforced' : item.isActive ? 'Active' : 'Disabled'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VALIDATE & GENERATE */}
      {activeTab === 'generator' && (
        <div className="p-5 bg-[#FAF9F5] dark:bg-zinc-900 border border-[#E5E2D9] dark:border-zinc-800 rounded-xl space-y-5 shadow-xs">
          <div className="border-b border-[#E5E2D9] dark:border-zinc-800 pb-3">
            <h3 className="font-serif text-base font-semibold text-stone-900 dark:text-zinc-100">Validate & Generate</h3>
            <p className="text-xs text-stone-500 dark:text-zinc-400 mt-0.5">Readiness checks on your configured data, then a solver run on the server. The first routine becomes the working draft.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-3.5 bg-white dark:bg-zinc-950/80 border border-[#E5E2D9] dark:border-zinc-800 rounded-xl shadow-xs">
              <span className="text-xs text-stone-500 dark:text-zinc-400 font-medium">Passed Checks</span>
              <div className="text-2xl font-bold font-mono text-emerald-700 dark:text-emerald-400">{validationReport.passedCount}</div>
            </div>
            <div className="p-3.5 bg-white dark:bg-zinc-950/80 border border-[#E5E2D9] dark:border-zinc-800 rounded-xl shadow-xs">
              <span className="text-xs text-stone-500 dark:text-zinc-400 font-medium">Warnings</span>
              <div className="text-2xl font-bold font-mono text-amber-700 dark:text-amber-400">{validationReport.warningCount}</div>
            </div>
            <div className="p-3.5 bg-white dark:bg-zinc-950/80 border border-[#E5E2D9] dark:border-zinc-800 rounded-xl shadow-xs">
              <span className="text-xs text-stone-500 dark:text-zinc-400 font-medium">Blocking Errors</span>
              <div className="text-2xl font-bold font-mono text-[#8C1B2E] dark:text-red-400">{validationReport.errorCount}</div>
            </div>
          </div>

          <div className="border border-[#E5E2D9] dark:border-zinc-800 rounded-lg overflow-hidden divide-y divide-[#E5E2D9] dark:divide-zinc-800">
            {validationReport.items.map(item => (
              <div key={item.id} className="p-3.5 bg-white dark:bg-zinc-950/60 flex items-start justify-between gap-3 text-xs">
                <div className="flex items-start gap-2.5">
                  <div className="pt-0.5 shrink-0">
                    {item.status === 'Passed' && <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
                    {item.status === 'Warning' && <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />}
                    {item.status === 'Error' && <AlertCircle className="h-4 w-4 text-[#8C1B2E] dark:text-red-400" />}
                  </div>
                  <div>
                    <span className="font-semibold text-stone-900 dark:text-zinc-100">{item.title}</span>
                    <p className="text-[11px] text-stone-500 dark:text-zinc-400 mt-0.5">{item.message}</p>
                  </div>
                </div>
                {item.fixTab && item.status !== 'Passed' && (
                  <button
                    onClick={() => setActiveTab(item.fixTab as SetupSubTab)}
                    className="px-2.5 py-1 rounded bg-[#FAF9F5] dark:bg-zinc-900 text-[#8C1B2E] dark:text-red-400 border border-[#E5E2D9] dark:border-zinc-800 text-[11px] font-medium hover:bg-stone-100 transition-colors shrink-0"
                  >
                    Fix Issue →
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="p-4 bg-white dark:bg-zinc-950/80 rounded-xl border border-[#E5E2D9] dark:border-zinc-800 space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-stone-800 dark:text-zinc-200">Pre-Flight Readiness</span>
              <span className={`text-[11px] font-mono px-2 py-0.5 rounded font-bold ${
                validationReport.isReadyForGeneration
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20'
                  : 'bg-red-50 text-[#8C1B2E] border border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20'
              }`}>
                {validationReport.isReadyForGeneration ? 'Ready for Solver' : 'Errors Detected'}
              </span>
            </div>

            <p className="text-xs text-stone-600 dark:text-zinc-400 leading-relaxed">
              Processing <strong className="text-stone-900 dark:text-zinc-200">{allocations.length} allocations</strong> across <strong className="text-stone-900 dark:text-zinc-200">{sections.length} sections</strong> and <strong className="text-stone-900 dark:text-zinc-200">{rooms.length} facilities</strong> over <strong className="text-stone-900 dark:text-zinc-200">{academicYear.workingDays.length} working days</strong>.
            </p>

            {canEdit ? (
              <button
                onClick={handleRunGeneration}
                disabled={isGenerating || !validationReport.isReadyForGeneration}
                className={`w-full py-3 rounded-lg font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-all ${
                  validationReport.isReadyForGeneration && !isGenerating
                    ? 'bg-[#8C1B2E] hover:bg-[#731625] text-white cursor-pointer active:scale-[0.99]'
                    : 'bg-stone-200 text-stone-400 dark:bg-zinc-800 dark:text-zinc-500 cursor-not-allowed'
                }`}
              >
                {isGenerating ? (
                  <>
                    <Sparkles className="h-4 w-4 animate-spin" />
                    <span>Generating timetable on the server...</span>
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" />
                    <span>Generate Draft Master Timetable</span>
                  </>
                )}
              </button>
            ) : (
              <p className="text-[11px] text-stone-500 dark:text-zinc-400">Only coordinators and admins can run the generator.</p>
            )}
          </div>

          {generationResult && (
            <div className={`p-4 rounded-xl border space-y-2 animate-in fade-in ${
              generationResult.isSuccess ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900 dark:bg-emerald-950/20 dark:border-emerald-800/40 dark:text-emerald-300' : 'bg-red-50/70 border-red-200 text-[#8C1B2E] dark:bg-red-950/20 dark:border-red-800/40 dark:text-red-300'
            }`}>
              <div className="flex items-center gap-2 font-bold text-xs">
                {generationResult.isSuccess ? <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> : <AlertCircle className="h-4 w-4 text-[#8C1B2E] dark:text-red-400" />}
                <span>
                  {generationResult.isSuccess
                    ? `Generated ${generationResult.sessionsGenerated} class sessions (${generationResult.scheduledHours} of ${generationResult.totalHours} weekly hours scheduled). This is now the working draft.`
                    : 'No timetable could be generated.'}
                </span>
              </div>
              {generationResult.conflicts.length > 0 && (
                <ul className="list-disc pl-6 text-[11px] space-y-0.5">
                  {generationResult.conflicts.slice(0, 10).map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                  {generationResult.conflicts.length > 10 && <li>…and {generationResult.conflicts.length - 10} more.</li>}
                </ul>
              )}
              {generationResult.isSuccess && (
                <button onClick={() => setActiveTab('review')} className="text-[11px] font-semibold underline">
                  Review the draft →
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* REVIEW & PUBLISH */}
      {activeTab === 'review' && (
        <div className="p-5 bg-[#FAF9F5] dark:bg-zinc-900 border border-[#E5E2D9] dark:border-zinc-800 rounded-xl space-y-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E5E2D9] dark:border-zinc-800 pb-3">
            <div>
              <h3 className="font-serif text-base font-semibold text-stone-900 dark:text-zinc-100">Timetable Review & Publish</h3>
              <p className="text-xs text-stone-500 dark:text-zinc-400 mt-0.5">Inspect the working draft across Sections, Faculty, and Facilities</p>
            </div>

            <div className="flex items-center gap-2">
              {publishStatus === 'Draft' && canEdit && (
                <button
                  onClick={() => submit(() => updatePublishStatus('Review'))}
                  disabled={saving || sessions.length === 0}
                  className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 dark:bg-zinc-800 text-stone-800 dark:text-zinc-200 rounded-lg text-xs font-medium border border-[#E5E2D9] dark:border-zinc-700 transition-colors disabled:opacity-50"
                >
                  Submit for Approval
                </button>
              )}

              {publishStatus === 'Review' &&
                (isAdmin ? (
                  <button
                    onClick={() => submit(() => updatePublishStatus('Approved'))}
                    disabled={saving}
                    className="px-3 py-1.5 bg-sky-700 hover:bg-sky-800 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50"
                  >
                    Approve Schedule
                  </button>
                ) : (
                  <span className="text-[11px] text-stone-500 dark:text-zinc-400">Awaiting admin approval</span>
                ))}

              {publishStatus === 'Approved' &&
                (isAdmin ? (
                  <button
                    onClick={() => submit(publishMasterTimetable)}
                    disabled={saving}
                    className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50"
                  >
                    Publish to Campus
                  </button>
                ) : (
                  <span className="text-[11px] text-stone-500 dark:text-zinc-400">Approved · awaiting publication by an admin</span>
                ))}

              {publishStatus === 'Published' && (
                <span className="text-[11px] font-mono px-2.5 py-1 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20 font-bold flex items-center gap-1">
                  <Check className="h-3 w-3" /> Published & Live
                </span>
              )}
            </div>
          </div>

          {sessions.length === 0 ? (
            <div className="p-8 text-center text-xs text-stone-400 italic border border-dashed border-[#E5E2D9] dark:border-zinc-800 rounded-lg">
              No draft timetable yet. Generate one in Validate & Generate.
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex bg-[#F7F6F2] dark:bg-zinc-950 border border-[#E5E2D9] dark:border-zinc-800 p-0.5 rounded-lg text-xs">
                  {([['section', 'By Section'], ['faculty', 'By Faculty'], ['room', 'By Room/Lab']] as const).map(([angle, label]) => (
                    <button
                      key={angle}
                      onClick={() => setReviewAngle(angle)}
                      aria-pressed={reviewAngle === angle}
                      className={`px-3 py-1 rounded-md transition-colors ${
                        reviewAngle === angle ? 'bg-[#8C1B2E] text-white font-semibold shadow-xs' : 'text-stone-600 dark:text-zinc-400 hover:text-stone-900 dark:hover:text-zinc-200'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {reviewAngle === 'section' && (
                  <select
                    aria-label="Section"
                    value={selectedSectionId}
                    onChange={e => setSelectedSectionId(e.target.value)}
                    className="bg-white dark:bg-zinc-950 border border-[#E5E2D9] dark:border-zinc-800 text-xs rounded-lg px-3 py-1.5 text-stone-800 dark:text-zinc-200 outline-none focus:border-[#8C1B2E]"
                  >
                    {sections.map(s => (
                      <option key={s.id} value={s.id}>Section: {s.name} ({s.studentCount} Students)</option>
                    ))}
                  </select>
                )}

                {reviewAngle === 'faculty' && (
                  <select
                    aria-label="Faculty"
                    value={selectedFacultyId}
                    onChange={e => setSelectedFacultyId(e.target.value)}
                    className="bg-white dark:bg-zinc-950 border border-[#E5E2D9] dark:border-zinc-800 text-xs rounded-lg px-3 py-1.5 text-stone-800 dark:text-zinc-200 outline-none focus:border-[#8C1B2E]"
                  >
                    {facultyMembers.map(f => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                )}

                {reviewAngle === 'room' && (
                  <select
                    aria-label="Room"
                    value={selectedRoomId}
                    onChange={e => setSelectedRoomId(e.target.value)}
                    className="bg-white dark:bg-zinc-950 border border-[#E5E2D9] dark:border-zinc-800 text-xs rounded-lg px-3 py-1.5 text-stone-800 dark:text-zinc-200 outline-none focus:border-[#8C1B2E]"
                  >
                    {rooms.map(r => (
                      <option key={r.id} value={r.id}>{r.name} ({r.type})</option>
                    ))}
                  </select>
                )}
              </div>

              <div className="flex bg-[#F7F6F2] dark:bg-zinc-950 border border-[#E5E2D9] dark:border-zinc-800 p-1 rounded-lg text-xs gap-1">
                {academicYear.workingDays.map(d => (
                  <button
                    key={d}
                    onClick={() => setReviewDay(d)}
                    aria-pressed={activeReviewDay === d}
                    className={`flex-1 py-1.5 rounded-md text-center font-medium transition-colors ${
                      activeReviewDay === d ? 'bg-[#8C1B2E] text-white font-semibold shadow-xs' : 'text-stone-600 dark:text-zinc-400 hover:text-stone-900 dark:hover:text-zinc-200'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>

              <div className="border border-[#E5E2D9] dark:border-zinc-800 rounded-lg overflow-hidden divide-y divide-[#E5E2D9] dark:divide-zinc-800">
                {academicYear.timeSlots.map(slot => {
                  if (isBreakSlot(slot)) {
                    return (
                      <div key={slot.id} className="p-3 bg-stone-100/70 dark:bg-zinc-950/40 flex items-center justify-between text-xs text-stone-500 dark:text-zinc-500 font-mono">
                        <span>{slot.label}</span>
                        <span>{slot.isBreak && !slot.isLunch ? 'Break' : 'Campus Lunch Break'}</span>
                        <span>Protected</span>
                      </div>
                    );
                  }

                  const matching = sessions.filter(s => {
                    if (s.day !== activeReviewDay || s.timeSlotId !== slot.id) return false;
                    if (reviewAngle === 'section') return s.sectionId === selectedSectionId;
                    if (reviewAngle === 'faculty') return s.facultyId === selectedFacultyId;
                    return s.roomId === selectedRoomId;
                  });

                  return (
                    <div key={slot.id} className="p-3 bg-white dark:bg-zinc-950/60 flex items-center justify-between text-xs">
                      <span className="font-mono text-stone-500 dark:text-zinc-400 w-28 shrink-0">{slot.label}</span>
                      {matching.length > 0 ? (
                        <div className="flex-1 space-y-2 px-3">
                          {matching.map(m => {
                            const course = courses.find(c => c.id === m.courseId);
                            const faculty = facultyMembers.find(f => f.id === m.facultyId);
                            const room = rooms.find(r => r.id === m.roomId);
                            const section = sections.find(s => s.id === m.sectionId);
                            const sub = section?.subSections?.find(x => x.id === m.subSectionId);
                            return (
                              <div key={m.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-stone-900 dark:text-zinc-100">{course?.name || m.courseId}</span>
                                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-red-50 text-[#8C1B2E] dark:bg-zinc-900 dark:text-red-400 border border-red-200 dark:border-zinc-800">
                                      {course?.code}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-stone-500 dark:text-zinc-400">
                                    {reviewAngle !== 'section' && <span>{section?.name}{sub ? ` · ${sub.name}` : ''} · </span>}
                                    {reviewAngle === 'section' && sub && <span>Subgroup {sub.name} · </span>}
                                    {reviewAngle !== 'faculty' && <span>{faculty?.name} · </span>}
                                    {reviewAngle !== 'room' && <span>{room?.name}</span>}
                                  </div>
                                </div>
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                                  {m.type}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <span className="text-stone-400 dark:text-zinc-600 italic">Free Slot</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
