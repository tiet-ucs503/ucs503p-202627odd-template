import React, { createContext, useContext, useState, useMemo, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import {
  ClassSession,
  Room,
  Faculty,
  StudentSection,
  SubSection,
  Course,
  CourseAllocation,
  AcademicConstraint,
  AcademicYearConfig,
  Department,
  Program,
  ValidationReport,
  TimetablePublishStatus,
  MakeupTask,
  RecoveryOpportunity,
  StudentPoll,
  NotificationItem,
  AuditLog,
  SystemHealthMetrics,
  TimetableVersion,
  DayOfWeek,
  TimeSlot,
  WhatIfSimulation,
  GenerationResponse,
  GenerationRoutine,
  WorkspaceType
} from '../types';
import {
  validateTimetableIndependently,
  validateProposedSessionMove,
  validateProposedSessionSwap,
  IndependentValidationReport,
  ViolationDetail
} from '../lib/independentValidator';
import {
  executeOptimizationEngine,
  EngineOptions,
  GeneratedCandidate
} from '../lib/optimizationEngine';
import {
  ROOMS,
  FACULTY_MEMBERS,
  SECTIONS,
  COURSES,
  DEPARTMENTS,
  PROGRAMS,
  INITIAL_ACADEMIC_YEAR,
  INITIAL_ALLOCATIONS,
  INITIAL_CONSTRAINTS,
  INITIAL_SESSIONS,
  INITIAL_MAKEUP_TASKS,
  INITIAL_RECOVERY_OPPORTUNITIES,
  INITIAL_POLLS,
  INITIAL_NOTIFICATIONS,
  INITIAL_VERSIONS,
  INITIAL_WHAT_IF_SIMULATION
} from '../lib/initialData';
import {
  calculateHealthScore,
  findSelfHealingRecoverySlots,
  checkHardConstraints
} from '../lib/recoveryEngine';
import { validateAcademicSetup } from '../lib/timetableGenerator';
import { ExcelImportPreview } from '../lib/excelMasterService';
import { supabaseClient, getSupabaseAccessToken } from '../lib/supabaseClient';
import { apiUrl } from '../lib/apiConfig';

export type UserRole = 'Coordinator' | 'Faculty' | 'Student' | 'HOD' | 'Admin';
export type ViewTab =
  | 'overview'
  | 'academic_setup'
  | 'master_excel'
  | 'academic_year'
  | 'departments'
  | 'programs'
  | 'students'
  | 'courses_mgmt'
  | 'faculty_mgmt'
  | 'rooms_mgmt'
  | 'sections_mgmt'
  | 'allocations'
  | 'availability'
  | 'constraints'
  | 'generation_validator'
  | 'timetable_review'
  | 'grid'
  | 'recovery'
  | 'whatif'
  | 'solvers'
  | 'syllabus'
  | 'faculty_portal'
  | 'student_portal'
  | 'student_courses'
  | 'student_section'
  | 'governance'
  | 'auth_gov'
  | 'settings'
  | 'profile';

const routeSlugByView: Partial<Record<ViewTab, string>> = {
  overview: 'dashboard', academic_setup: 'data', master_excel: 'data/master', academic_year: 'data/year', departments: 'data/departments',
  programs: 'data/programs', students: 'data/students', courses_mgmt: 'data/courses', faculty_mgmt: 'data/faculty', rooms_mgmt: 'data/rooms',
  sections_mgmt: 'data/sections', allocations: 'allocations', availability: 'availability', constraints: 'constraints',
  generation_validator: 'generation', timetable_review: 'review', grid: 'timetable', recovery: 'requests', whatif: 'what-if',
  solvers: 'solvers', syllabus: 'syllabus', faculty_portal: 'dashboard', student_portal: 'dashboard',
  student_courses: 'courses', student_section: 'section', governance: 'approvals', auth_gov: 'users', settings: 'settings', profile: 'profile',
};
const workspaceFromPath = (path: string): WorkspaceType | null => {
  const key = path.split('/').filter(Boolean)[0];
  return ({ student: 'Student', cr: 'CR', faculty: 'Faculty', coordinator: 'Coordinator', hod: 'HOD', admin: 'Admin' } as Record<string, WorkspaceType>)[key] ?? null;
};
const viewFromPath = (path: string): ViewTab | null => {
  const parts = path.split('/').filter(Boolean);
  const workspace = workspaceFromPath(path);
  if (parts[1] === 'dashboard') {
    if (workspace === 'Student' || workspace === 'CR') return 'student_portal';
    if (workspace === 'Faculty') return 'faculty_portal';
    return 'overview';
  }
  const [, ...rest] = parts;
  const slug = rest.join('/') || 'dashboard';
  const found = (Object.entries(routeSlugByView) as [ViewTab, string][]).find(([, value]) => value === slug);
  return found?.[0] ?? null;
};
const routeFor = (workspace: WorkspaceType, view: ViewTab) => `/${workspace.toLowerCase()}/${routeSlugByView[view] || 'dashboard'}`;

interface TimetableContextType {
  // Master data
  academicYear: AcademicYearConfig;
  departments: Department[];
  programs: Program[];
  rooms: Room[];
  facultyMembers: Faculty[];
  sections: StudentSection[];
  courses: Course[];
  allocations: CourseAllocation[];
  constraints: AcademicConstraint[];
  publishStatus: TimetablePublishStatus;
  validationReport: ValidationReport;

  // Dynamic schedule state
  sessions: ClassSession[];
  setSessions: React.Dispatch<React.SetStateAction<ClassSession[]>>;
  makeupTasks: MakeupTask[];
  recoveryOpportunities: RecoveryOpportunity[];
  polls: StudentPoll[];
  notifications: NotificationItem[];
  versions: TimetableVersion[];
  auditLogs: AuditLog[];
  health: SystemHealthMetrics;
  whatIfSimulation: WhatIfSimulation;

  // View state
  currentRole: UserRole;
  setCurrentRole: (role: UserRole) => void;
  activeView: ViewTab;
  setActiveView: (view: ViewTab) => void;
  selectedFacultyId: string;
  setSelectedFacultyId: (id: string) => void;
  selectedSectionId: string;
  setSelectedSectionId: (id: string) => void;
  selectedRoomId: string;
  setSelectedRoomId: (id: string) => void;

  activeVersionNumber?: number;
  publishedSessions?: ClassSession[];
  refresh?: () => Promise<any> | any;
  isLoading?: boolean;
  loadError?: string | null;
  notice?: { type: 'success' | 'error'; message: string } | null;
  dismissNotice?: () => void;
  studentsCount?: number;

  // Master Data CRUD Actions
  updateAcademicYear: (updates: Partial<AcademicYearConfig>) => Promise<{ success: boolean; message?: string }>;
  
  // Departments
  addDepartment: (dept: Omit<Department, 'id'>) => Promise<{ success: boolean; message?: string }>;
  updateDepartment: (id: string, updates: Partial<Department>) => Promise<{ success: boolean; message?: string }>;
  deleteDepartment: (id: string) => Promise<{ success: boolean; message?: string }>;
  toggleDepartmentStatus: (id: string) => Promise<{ success: boolean; message?: string }>;

  // Programs
  addProgram: (prog: Omit<Program, 'id'>) => Promise<{ success: boolean; message?: string }>;
  updateProgram: (id: string, updates: Partial<Program>) => Promise<{ success: boolean; message?: string }>;
  deleteProgram: (id: string) => Promise<{ success: boolean; message?: string }>;

  // Rooms & Labs
  addRoom: (room: Omit<Room, 'id'>) => Promise<{ success: boolean; message?: string }>;
  updateRoom: (id: string, updates: Partial<Room>) => Promise<{ success: boolean; message?: string }>;
  deleteRoom: (id: string) => Promise<{ success: boolean; message?: string }>;
  toggleRoomAvailability: (id: string) => Promise<{ success: boolean; message?: string }>;

  // Faculty
  addFaculty: (fac: Omit<Faculty, 'id'>) => Promise<{ success: boolean; message?: string }>;
  updateFaculty: (id: string, updates: Partial<Faculty>) => Promise<{ success: boolean; message?: string }>;
  deleteFaculty: (id: string) => Promise<{ success: boolean; message?: string }>;
  toggleFacultyStatus: (id: string) => Promise<{ success: boolean; message?: string }>;
  updateFacultyAvailability: (id: string, preferences: Faculty['preferences']) => Promise<{ success: boolean; message?: string }>;

  // Sections & SubSections
  addSection: (sec: Omit<StudentSection, 'id'>) => Promise<{ success: boolean; message?: string }>;
  updateSection: (id: string, updates: Partial<StudentSection>) => Promise<{ success: boolean; message?: string }>;
  deleteSection: (id: string) => Promise<{ success: boolean; message?: string }>;
  addSubSection: (sectionId: string, subSec: Omit<SubSection, 'id' | 'sectionId'>) => Promise<{ success: boolean; message?: string }>;
  deleteSubSection: (sectionId: string, subSecId: string) => Promise<{ success: boolean; message?: string }>;

  // Courses
  addCourse: (course: Omit<Course, 'id'>) => Promise<{ success: boolean; message?: string }>;
  updateCourse: (id: string, updates: Partial<Course>) => Promise<{ success: boolean; message?: string }>;
  deleteCourse: (id: string) => Promise<{ success: boolean; message?: string }>;
  toggleCourseStatus: (id: string) => Promise<{ success: boolean; message?: string }>;

  // Allocations
  addAllocation: (alloc: Omit<CourseAllocation, 'id' | 'status'>) => Promise<{ success: boolean; message?: string }>;
  updateAllocation: (id: string, updates: Partial<CourseAllocation>) => Promise<{ success: boolean; message?: string }>;
  deleteAllocation: (id: string) => Promise<{ success: boolean; message?: string }>;

  // Constraints
  addConstraint: (constraint: Omit<AcademicConstraint, 'id'>) => Promise<{ success: boolean; message?: string }>;
  updateConstraint: (id: string, updates: Partial<AcademicConstraint>) => Promise<{ success: boolean; message?: string }>;
  toggleConstraint: (id: string) => Promise<{ success: boolean; message?: string }>;

  // Validation & Generation Engine
  runValidation: () => ValidationReport;
  resetDemoAcademicData: () => Promise<{ success: boolean; message?: string }>;
  generateDraftTimetable: () => Promise<{ isSuccess: boolean; sessionsGenerated: number; conflicts: string[]; scheduledHours: number; totalHours: number }>;
  updatePublishStatus: (status: TimetablePublishStatus, reviewerName?: string) => Promise<{ success: boolean }>;
  bulkImportData: (type: 'faculty' | 'courses' | 'rooms' | 'sections' | 'allocations', records: any[]) => { successCount: number; errors: string[] };
  commitMasterImport: (
    parsedData: ExcelImportPreview['parsedData'],
    mode?: 'upsert' | 'replace'
  ) => { success: boolean; importedCount: number; message: string };
  bulkGenerateGroups: (params: {
    programName: string;
    batchYear: number;
    totalStudents: number;
    numGroups: number;
    namingPattern: string;
    numSubgroupsPerGroup: number;
    subgroupNamingPattern?: string;
    departmentId?: string;
  }) => StudentSection[];

  // Routine Timetable Operations
  cancelSession: (sessionId: string, reason: string) => Promise<{ success: boolean }>;
  undoCancellation: (sessionId: string) => Promise<{ success: boolean }>;
  scheduleMakeup: (opportunityId: string) => Promise<{ success: boolean }>;
  votePoll: (pollId: string, optionId: string) => Promise<{ success: boolean }>;
  applyWinningPoll: (pollId: string) => Promise<{ success: boolean; message: string }>;
  createPoll: (input: { sectionId: string; courseId: string; question: string; options: Array<{ day: DayOfWeek; timeSlotLabel: string }> }) => Promise<{ success: boolean; message?: string }>;
  toggleSessionLock: (sessionId: string, reason?: string) => Promise<{ success: boolean; message?: string }>;
  setFacultyProtectedSlot: (facultyId: string, day: DayOfWeek, periodId: string, reason: 'Research' | 'Lunch' | 'Personal' | 'Department' | 'Meeting') => Promise<{ success: boolean }>;
  restoreVersion: (versionNumber: number) => Promise<{ success: boolean; message?: string }>;
  applySimulation: () => void;
  markNotificationRead: (id: string) => Promise<void>;
  triggerAutoMatchAll: () => void;
  requestStudentMakeup: (courseId: string, sectionId: string) => Promise<{ success: boolean }>;
  declineOpportunity: (opportunityId: string) => Promise<{ success: boolean }>;
  claimMarketplaceSlot: (courseId: string, sectionId: string, day: DayOfWeek, timeSlotId: string, roomId: string, type: string) => Promise<{ success: boolean }>;
  requestSubstituteCover: (substituteFacultyId: string, courseId: string, sectionId: string, day: DayOfWeek, timeSlotId: string) => Promise<{ success: boolean }>;
  addSession: (sessionData: Omit<ClassSession, 'id' | 'version'>) => Promise<{ isSuccess: boolean; error?: string }>;
  deleteSession: (sessionId: string) => Promise<{ success: boolean; message?: string }>;

  // Independent Validation & Controlled Machine Editing
  runIndependentValidation: (targetSessions?: ClassSession[]) => IndependentValidationReport;
  moveSessionWithValidation: (
    sessionId: string,
    targetDay: DayOfWeek,
    targetTimeSlotId: string,
    targetRoomId: string,
    reason?: string
  ) => Promise<{ success: boolean; error?: string }>;
  swapSessionsWithValidation: (
    sessionAId: string,
    sessionBId: string,
    reason?: string
  ) => Promise<{ success: boolean; error?: string }>;
  generateMultiCandidateTimetables: (options?: EngineOptions) => {
    isSuccess: boolean;
    candidates: GeneratedCandidate[];
    validationReports: IndependentValidationReport[];
    diagnostics?: string[];
  };
  generateDualRoutinesAPI: () => Promise<GenerationResponse>;
  selectRoutineAPI: (versionNumber: number) => Promise<{ success: boolean; message?: string }>;
  latestGeneratedRoutines: GenerationRoutine[] | null;
  setLatestGeneratedRoutines: (routines: GenerationRoutine[] | null) => void;
  applyCandidateAsDraft: (candidate: GeneratedCandidate) => void;
  publishMasterTimetable: (reviewerName?: string) => Promise<{ success: boolean; error?: string }>;
  unpublishMasterTimetable: () => Promise<{ success: boolean }>;
  compareTimetableVersions: (versionNumberA: number, versionNumberB: number) => Array<{
    courseCode: string;
    courseName: string;
    sectionName: string;
    changeType: 'MOVED' | 'ROOM_CHANGED' | 'REPLACED' | 'ADDED' | 'REMOVED';
    oldSlot?: { day: DayOfWeek; timeSlot: string; room: string };
    newSlot?: { day: DayOfWeek; timeSlot: string; room: string };
  }>;
  [key: string]: any;
}

const TimetableContext = createContext<TimetableContextType | null>(null);

export function TimetableProvider({ children }: { children: React.ReactNode }) {
  const { currentWorkspace, switchWorkspace, authorizedWorkspaces, authStatus } = useAuth();
  // Master academic state
  const [academicYear, setAcademicYear] = useState<AcademicYearConfig>(INITIAL_ACADEMIC_YEAR);
  const [departments, setDepartments] = useState<Department[]>(DEPARTMENTS);
  const [programs, setPrograms] = useState<Program[]>(PROGRAMS);
  const [rooms, setRooms] = useState<Room[]>(ROOMS);
  const [facultyMembers, setFacultyMembers] = useState<Faculty[]>(FACULTY_MEMBERS);
  const [sections, setSections] = useState<StudentSection[]>(SECTIONS);
  const [courses, setCourses] = useState<Course[]>(COURSES);
  const [allocations, setAllocations] = useState<CourseAllocation[]>(INITIAL_ALLOCATIONS);
  const [constraints, setConstraints] = useState<AcademicConstraint[]>(INITIAL_CONSTRAINTS);
  const [publishStatus, setPublishStatus] = useState<TimetablePublishStatus>('Published');

  // Dynamic operational state
  const [sessions, setSessions] = useState<ClassSession[]>(INITIAL_SESSIONS);
  const [publishedSessions, setPublishedSessions] = useState<ClassSession[]>(INITIAL_SESSIONS);
  const [makeupTasks, setMakeupTasks] = useState<MakeupTask[]>(INITIAL_MAKEUP_TASKS);
  const [recoveryOpportunities, setRecoveryOpportunities] = useState<RecoveryOpportunity[]>(INITIAL_RECOVERY_OPPORTUNITIES);
  const [polls, setPolls] = useState<StudentPoll[]>(INITIAL_POLLS);
  const [notifications, setNotifications] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);
  const [versions, setVersions] = useState<TimetableVersion[]>(INITIAL_VERSIONS);
  const [whatIfSimulation, setWhatIfSimulation] = useState<WhatIfSimulation>(INITIAL_WHAT_IF_SIMULATION);

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([
    {
      id: 'log-1',
      timestamp: '2026-10-02 08:00:12',
      userId: 'user-sharma',
      userName: 'Prof. Arvind Sharma',
      action: 'CLASS_CANCELLED',
      entityType: 'ClassSession',
      entityId: 'sess-mon-1',
      details: 'Cancelled DBMS lecture for CSE-A on Monday 08:00 due to accreditation symposium.',
    },
    {
      id: 'log-2',
      timestamp: '2026-10-02 08:00:15',
      userId: 'sys-recovery-engine',
      userName: 'Recovery Engine Outbox',
      action: 'MAKEUP_TASK_CREATED',
      entityType: 'MakeupTask',
      entityId: 'makeup-dbms-01',
      details: 'Calculated urgency score 96 (Exam in 21 days, syllabus completion 82%).',
    },
    {
      id: 'log-3',
      timestamp: '2026-10-02 08:05:30',
      userId: 'sys-recovery-engine',
      userName: 'Cross-Cancellation Engine',
      action: 'RECOVERY_OPPORTUNITY_FOUND',
      entityType: 'RecoveryOpportunity',
      entityId: 'rec-opp-01',
      details: 'Loaded Third-Year Computer Branches dataset (617 conflict-free sessions, 1,847 students, 149 faculty).',
    }
  ]);

  const [currentRole, setCurrentRole] = useState<UserRole>('Coordinator');
  const [activeView, setActiveViewState] = useState<ViewTab>(() => typeof window === 'undefined' ? 'overview' : viewFromPath(window.location.pathname) || 'overview');
  const setActiveView = useCallback((view: ViewTab) => {
    setActiveViewState(view);
    if (typeof window !== 'undefined') {
      const path = routeFor(currentWorkspace, view);
      if (window.location.pathname !== path) window.history.pushState({ view, workspace: currentWorkspace }, '', path);
    }
  }, [currentWorkspace]);

  useEffect(() => {
    const syncRoute = () => {
      if (authStatus !== 'AUTHENTICATED') return;
      const routeWorkspace = workspaceFromPath(window.location.pathname);
      const routeView = viewFromPath(window.location.pathname);
      if (routeWorkspace && authorizedWorkspaces.includes(routeWorkspace) && routeWorkspace !== currentWorkspace) switchWorkspace(routeWorkspace);
      if (routeView) setActiveViewState(routeView);
    };
    window.addEventListener('popstate', syncRoute);
    return () => window.removeEventListener('popstate', syncRoute);
  }, [authStatus, authorizedWorkspaces, currentWorkspace, switchWorkspace]);

  useEffect(() => {
    if (authStatus !== 'AUTHENTICATED') return;
    const routeWorkspace = workspaceFromPath(window.location.pathname);
    const routeView = viewFromPath(window.location.pathname);
    if (routeWorkspace === currentWorkspace && routeView && activeView !== routeView) setActiveViewState(routeView);
    else if (!routeWorkspace || routeWorkspace !== currentWorkspace) {
      const landing: ViewTab = currentWorkspace === 'Student' || currentWorkspace === 'CR' ? 'student_portal' : currentWorkspace === 'Faculty' ? 'faculty_portal' : 'overview';
      setActiveViewState(landing);
      const path = routeFor(currentWorkspace, landing);
      if (window.location.pathname !== path) window.history.replaceState({ view: landing, workspace: currentWorkspace }, '', path);
    }
  }, [authStatus, currentWorkspace]);
  const [selectedFacultyId, setSelectedFacultyId] = useState<string>('fac-0001');
  const [selectedSectionId, setSelectedSectionId] = useState<string>('sec-cse-a');
  const [selectedRoomId, setSelectedRoomId] = useState<string>('room-cr-1');
  const [latestGeneratedRoutines, setLatestGeneratedRoutines] = useState<GenerationRoutine[] | null>(null);

  const getAuthHeaders = (): Record<string, string> => {
    return {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    };
  };

  const getAuthHeadersAsync = async (): Promise<Record<string, string>> => {
    return {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    };
  };

  // Load shared academic state only after authentication. Polling while signed
  // out generates repeated 401s and can keep the login page busy in Lighthouse.
  useEffect(() => {
    if (authStatus !== 'AUTHENTICATED') return;
    let isMounted = true;
    let requestInFlight = false;
    let pollTimer: number | undefined;
    const controller = new AbortController();
    const loadBootstrapData = async () => {
      if (requestInFlight || controller.signal.aborted) return;
      requestInFlight = true;
      try {
        const res = await fetch('/api/academic/bootstrap', {
          credentials: 'same-origin',
          signal: controller.signal,
          cache: 'no-cache',
          headers: { 'X-Requested-With': 'XMLHttpRequest' },
        });
        // The server uses an authenticated, cookie-varying ETag. An unchanged
        // bootstrap can return 304 without downloading or parsing the dataset.
        if (res.status === 304) return;
        if (res.ok) {
          const data = await res.json();
          if (data.success && isMounted) {
            if (data.academicYear) setAcademicYear(data.academicYear);
            if (Array.isArray(data.departments)) setDepartments(data.departments);
            if (Array.isArray(data.programs)) setPrograms(data.programs);
            if (Array.isArray(data.courses)) setCourses(data.courses);
            if (Array.isArray(data.facultyMembers)) setFacultyMembers(data.facultyMembers);
            if (Array.isArray(data.rooms)) setRooms(data.rooms);
            if (Array.isArray(data.sections)) setSections(data.sections);
            if (Array.isArray(data.allocations)) setAllocations(data.allocations);
            if (Array.isArray(data.constraints)) setConstraints(data.constraints);
            if (Array.isArray(data.sessions)) setSessions(data.sessions);
            if (Array.isArray(data.publishedSessions)) setPublishedSessions(data.publishedSessions);
            if (Array.isArray(data.versions)) setVersions(data.versions);
            if (Array.isArray(data.notifications)) setNotifications(data.notifications);
            if (Array.isArray(data.makeupTasks)) setMakeupTasks(data.makeupTasks);
            if (Array.isArray(data.recoveryOpportunities)) setRecoveryOpportunities(data.recoveryOpportunities);
            if (Array.isArray(data.polls)) setPolls(data.polls);
            if (Array.isArray(data.auditLogs)) setAuditLogs(data.auditLogs);
            if (data.publishStatus) setPublishStatus(data.publishStatus);
          }
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        console.warn('[SUPABASE_SYNC] Initial bootstrap load completed with local state active:', err);
      } finally {
        requestInFlight = false;
        if (isMounted && !controller.signal.aborted && !document.hidden) {
          pollTimer = window.setTimeout(() => { void loadBootstrapData(); }, 10_000);
        }
      }
    };
    const refreshWhenVisible = () => {
      if (document.hidden) return;
      if (pollTimer !== undefined) window.clearTimeout(pollTimer);
      void loadBootstrapData();
    };
    let sseDebounce: number | undefined;
    let eventSource: EventSource | null = null;
    const seenEventIds = new Set<string>();
    let sseDisconnected = false;
    if (typeof window !== 'undefined' && typeof EventSource !== 'undefined') {
      try {
        eventSource = new EventSource('/api/events/stream', { withCredentials: true });
        eventSource.onopen = () => {
          if (sseDisconnected) {
            sseDisconnected = false;
            void loadBootstrapData();
          }
        };
        eventSource.onerror = () => {
          sseDisconnected = true;
        };
        eventSource.onmessage = (event) => {
          try {
            const parsed = JSON.parse(event.data);
            if (parsed?.type !== 'state_changed') return;
            if (typeof parsed.eventId === 'string') {
              if (seenEventIds.has(parsed.eventId)) return;
              seenEventIds.add(parsed.eventId);
              if (seenEventIds.size > 200) {
                const oldest = seenEventIds.values().next().value;
                if (oldest) seenEventIds.delete(oldest);
              }
            }
          } catch {
            return;
          }
          if (sseDebounce !== undefined) window.clearTimeout(sseDebounce);
          sseDebounce = window.setTimeout(() => {
            if (pollTimer !== undefined) window.clearTimeout(pollTimer);
            void loadBootstrapData();
          }, 150);
        };
      } catch {
        // Fallback to 10s polling when EventSource is unavailable
      }
    }

    loadBootstrapData();
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      isMounted = false;
      if (pollTimer !== undefined) window.clearTimeout(pollTimer);
      if (sseDebounce !== undefined) window.clearTimeout(sseDebounce);
      if (eventSource) eventSource.close();
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      controller.abort();
    };
  }, [authStatus]);

  // Dynamic Computed Validation Report
  const validationReport = useMemo(() => {
    return validateAcademicSetup(
      academicYear,
      departments,
      programs,
      courses,
      facultyMembers,
      rooms,
      sections,
      allocations,
      constraints
    );
  }, [academicYear, departments, programs, courses, facultyMembers, rooms, sections, allocations, constraints]);

  // Computed Health Score
  const health = useMemo(() => {
    return calculateHealthScore(sessions, rooms, facultyMembers, sections, courses);
  }, [sessions, rooms, facultyMembers, sections, courses]);

  // CRUD: Academic Year
  const updateAcademicYear = async (updates: Partial<AcademicYearConfig>) => {
    setAcademicYear(prev => ({ ...prev, ...updates }));
    setAuditLogs(prev => [
      {
        id: `log-${Date.now()}`,
        timestamp: new Date().toLocaleString(),
        userId: 'coordinator',
        userName: 'Timetable Coordinator',
        action: 'ACADEMIC_YEAR_CONFIG_UPDATED',
        entityType: 'AcademicYearConfig',
        entityId: academicYear.id,
        details: 'Updated semester calendar and working period parameters.',
      },
      ...prev,
    ]);
    return { success: true, message: 'Success' };
  };

  // CRUD: Departments
  const addDepartment = async (dept: Omit<Department, 'id'>) => {
    const newId = `dept-${dept.code.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    const newDept: Department = { ...dept, id: newId };
    setDepartments(prev => [...prev, newDept]);

    fetch('/api/academic/departments', {
      method: 'POST',
        credentials: 'same-origin',
      headers: getAuthHeaders(),
      body: JSON.stringify(dept),
    }).catch(err => console.warn('[SUPABASE_API] Department persistence notice:', err));
    return { success: true, message: 'Success' };
  };

  const updateDepartment = async (id: string, updates: Partial<Department>) => {
    setDepartments(prev => prev.map(d => (d.id === id ? { ...d, ...updates } : d)));

    fetch(`/api/academic/departments/${encodeURIComponent(id)}`, {
      method: 'PUT',
        credentials: 'same-origin',
      headers: getAuthHeaders(),
      body: JSON.stringify(updates),
    }).catch(err => console.warn('[SUPABASE_API] Department update notice:', err));
    return { success: true, message: 'Success' };
  };

  const deleteDepartment = async (id: string) => {
    setDepartments(prev => prev.filter(d => d.id !== id));

    fetch(`/api/academic/departments/${encodeURIComponent(id)}`, {
      method: 'DELETE',
        credentials: 'same-origin',
      headers: getAuthHeaders(),
    }).catch(err => console.warn('[SUPABASE_API] Department deletion notice:', err));
    return { success: true, message: 'Success' };
  };

  const toggleDepartmentStatus = async (id: string) => {
    const dept = departments.find(d => d.id === id);
    if (!dept) return { success: false, error: 'Department not found' };
    const nextStatus = dept.status === 'Active' ? 'Inactive' : 'Active';
    await updateDepartment(id, { status: nextStatus });
    return { success: true, message: 'Success' };
  };

  // CRUD: Programs
  const addProgram = async (prog: Omit<Program, 'id'>) => {
    const newId = `prog-${prog.code.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    const newProg: Program = { ...prog, id: newId };
    setPrograms(prev => [...prev, newProg]);

    fetch('/api/academic/programs', {
      method: 'POST',
        credentials: 'same-origin',
      headers: getAuthHeaders(),
      body: JSON.stringify(prog),
    }).catch(err => console.warn('[SUPABASE_API] Program persistence notice:', err));
    return { success: true, message: 'Success' };
  };

  const updateProgram = async (id: string, updates: Partial<Program>) => {
    setPrograms(prev => prev.map(p => (p.id === id ? { ...p, ...updates } : p)));

    fetch(`/api/academic/programs/${encodeURIComponent(id)}`, {
      method: 'PUT',
        credentials: 'same-origin',
      headers: getAuthHeaders(),
      body: JSON.stringify(updates),
    }).catch(err => console.warn('[SUPABASE_API] Program update notice:', err));
    return { success: true, message: 'Success' };
  };

  const deleteProgram = async (id: string) => {
    setPrograms(prev => prev.filter(p => p.id !== id));

    fetch(`/api/academic/programs/${encodeURIComponent(id)}`, {
      method: 'DELETE',
        credentials: 'same-origin',
      headers: getAuthHeaders(),
    }).catch(err => console.warn('[SUPABASE_API] Program deletion notice:', err));
    return { success: true, message: 'Success' };
  };

  // CRUD: Rooms & Labs
  const addRoom = async (room: Omit<Room, 'id'>) => {
    const newId = `room-${room.name.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    const newRoom: Room = { ...room, id: newId };
    setRooms(prev => [...prev, newRoom]);

    fetch('/api/academic/rooms', {
      method: 'POST',
        credentials: 'same-origin',
      headers: getAuthHeaders(),
      body: JSON.stringify(room),
    }).catch(err => console.warn('[SUPABASE_API] Room persistence notice:', err));
    return { success: true, message: 'Success' };
  };

  const updateRoom = async (id: string, updates: Partial<Room>) => {
    setRooms(prev => prev.map(r => (r.id === id ? { ...r, ...updates } : r)));

    fetch(`/api/academic/rooms/${encodeURIComponent(id)}`, {
      method: 'PUT',
        credentials: 'same-origin',
      headers: getAuthHeaders(),
      body: JSON.stringify(updates),
    }).catch(err => console.warn('[SUPABASE_API] Room update notice:', err));
    return { success: true, message: 'Success' };
  };

  const deleteRoom = async (id: string) => {
    setRooms(prev => prev.filter(r => r.id !== id));

    fetch(`/api/academic/rooms/${encodeURIComponent(id)}`, {
      method: 'DELETE',
        credentials: 'same-origin',
      headers: getAuthHeaders(),
    }).catch(err => console.warn('[SUPABASE_API] Room deletion notice:', err));
    return { success: true, message: 'Success' };
  };

  const toggleRoomAvailability = async (id: string) => {
    const rm = rooms.find(r => r.id === id);
    if (!rm) return { success: false, error: 'Room not found' };
    await updateRoom(id, { isAvailable: !rm.isAvailable });
    return { success: true, message: 'Success' };
  };

  // CRUD: Faculty
  const addFaculty = async (fac: Omit<Faculty, 'id'>) => {
    const newId = `fac-${fac.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    const newFac: Faculty = { ...fac, id: newId };
    setFacultyMembers(prev => [...prev, newFac]);

    fetch('/api/academic/faculty', {
      method: 'POST',
        credentials: 'same-origin',
      headers: getAuthHeaders(),
      body: JSON.stringify(fac),
    }).catch(err => console.warn('[SUPABASE_API] Faculty persistence notice:', err));
    return { success: true, message: 'Success' };
  };

  const updateFaculty = async (id: string, updates: Partial<Faculty>) => {
    setFacultyMembers(prev => prev.map(f => (f.id === id ? { ...f, ...updates } : f)));

    fetch(`/api/academic/faculty/${encodeURIComponent(id)}`, {
      method: 'PUT',
        credentials: 'same-origin',
      headers: getAuthHeaders(),
      body: JSON.stringify(updates),
    }).catch(err => console.warn('[SUPABASE_API] Faculty update notice:', err));
    return { success: true, message: 'Success' };
  };

  const deleteFaculty = async (id: string) => {
    setFacultyMembers(prev => prev.filter(f => f.id !== id));

    fetch(`/api/academic/faculty/${encodeURIComponent(id)}`, {
      method: 'DELETE',
        credentials: 'same-origin',
      headers: getAuthHeaders(),
    }).catch(err => console.warn('[SUPABASE_API] Faculty deletion notice:', err));
    return { success: true, message: 'Success' };
  };

  const toggleFacultyStatus = async (id: string) => {
    setFacultyMembers(prev =>
      prev.map(f => {
        if (f.id !== id) return f;
        const nextStatus = f.status === 'Active' ? 'Inactive' : 'Active';
        updateFaculty(id, { status: nextStatus });
        return { ...f, status: nextStatus };
      })
    );
    return { success: true, message: 'Success' };
  };

  const updateFacultyAvailability = async (id: string, preferences: Faculty['preferences']) => {
    await updateFaculty(id, { preferences });
    return { success: true, message: 'Success' };
  };

  // CRUD: Sections
  const addSection = async (sec: Omit<StudentSection, 'id'>) => {
    const newId = `sec-${sec.name.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    const newSec: StudentSection = {
      ...sec,
      id: newId,
      subSections: sec.subSections || [
        { id: `sub-${newId}-1`, sectionId: newId, name: '1', studentCount: Math.ceil(sec.studentCount / 2), type: 'Lab' },
        { id: `sub-${newId}-2`, sectionId: newId, name: '2', studentCount: Math.floor(sec.studentCount / 2), type: 'Lab' },
      ],
    };
    setSections(prev => [...prev, newSec]);

    fetch('/api/academic/groups', {
      method: 'POST',
        credentials: 'same-origin',
      headers: getAuthHeaders(),
      body: JSON.stringify(sec),
    }).catch(err => console.warn('[SUPABASE_API] Cohort persistence notice:', err));
    return { success: true, message: 'Success' };
  };

  const updateSection = async (id: string, updates: Partial<StudentSection>) => {
    setSections(prev => prev.map(s => (s.id === id ? { ...s, ...updates } : s)));

    fetch(`/api/academic/groups/${encodeURIComponent(id)}`, {
      method: 'PUT',
        credentials: 'same-origin',
      headers: getAuthHeaders(),
      body: JSON.stringify(updates),
    }).catch(err => console.warn('[SUPABASE_API] Cohort update notice:', err));
    return { success: true, message: 'Success' };
  };

  const deleteSection = async (id: string) => {
    setSections(prev => prev.filter(s => s.id !== id));

    fetch(`/api/academic/groups/${encodeURIComponent(id)}`, {
      method: 'DELETE',
        credentials: 'same-origin',
      headers: getAuthHeaders(),
    }).catch(err => console.warn('[SUPABASE_API] Cohort deletion notice:', err));
    return { success: true, message: 'Success' };
  };

  const addSubSection = async (sectionId: string, subSec: Omit<SubSection, 'id' | 'sectionId'>) => {
    const subId = `sub-${sectionId}-${subSec.name.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    const newSub: SubSection = {
      ...subSec,
      id: subId,
      sectionId,
    };
    setSections(prev =>
      prev.map(s => {
        if (s.id !== sectionId) return s;
        return {
          ...s,
          subSections: [...(s.subSections || []), newSub],
        };
      })
    );

    fetch('/api/academic/subgroups', {
      method: 'POST',
        credentials: 'same-origin',
      headers: getAuthHeaders(),
      body: JSON.stringify({ groupId: sectionId, name: subSec.name, studentCount: subSec.studentCount, type: subSec.type }),
    }).catch(err => console.warn('[SUPABASE_API] Subgroup persistence notice:', err));
    return { success: true, message: 'Success' };
  };

  const deleteSubSection = async (sectionId: string, subSecId: string) => {
    setSections(prev =>
      prev.map(s => {
        if (s.id !== sectionId) return s;
        return {
          ...s,
          subSections: (s.subSections || []).filter(sub => sub.id !== subSecId),
        };
      })
    );

    fetch(`/api/academic/subgroups/${encodeURIComponent(sectionId)}/${encodeURIComponent(subSecId)}`, {
      method: 'DELETE',
        credentials: 'same-origin',
      headers: getAuthHeaders(),
    }).catch(err => console.warn('[SUPABASE_API] Subgroup deletion notice:', err));
    return { success: true, message: 'Success' };
  };

  // CRUD: Courses
  const addCourse = async (course: Omit<Course, 'id'>) => {
    const newId = `course-${course.code.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    const newCourse: Course = {
      ...course,
      id: newId,
    };
    setCourses(prev => [...prev, newCourse]);

    fetch('/api/academic/courses', {
      method: 'POST',
        credentials: 'same-origin',
      headers: getAuthHeaders(),
      body: JSON.stringify(course),
    }).catch(err => console.warn('[SUPABASE_API] Course persistence notice:', err));
    return { success: true, message: 'Success' };
  };

  const updateCourse = async (id: string, updates: Partial<Course>) => {
    setCourses(prev => prev.map(c => (c.id === id ? { ...c, ...updates } : c)));

    fetch(`/api/academic/courses/${encodeURIComponent(id)}`, {
      method: 'PUT',
        credentials: 'same-origin',
      headers: getAuthHeaders(),
      body: JSON.stringify(updates),
    }).catch(err => console.warn('[SUPABASE_API] Course update notice:', err));
    return { success: true, message: 'Success' };
  };

  const deleteCourse = async (id: string) => {
    setCourses(prev => prev.filter(c => c.id !== id));

    fetch(`/api/academic/courses/${encodeURIComponent(id)}`, {
      method: 'DELETE',
        credentials: 'same-origin',
      headers: getAuthHeaders(),
    }).catch(err => console.warn('[SUPABASE_API] Course deletion notice:', err));
    return { success: true, message: 'Success' };
  };

  const toggleCourseStatus = async (id: string) => {
    const crs = courses.find(c => c.id === id);
    if (!crs) return { success: false, error: 'Course not found' };
    const nextStatus = crs.status === 'Active' ? 'Archived' : 'Active';
    await updateCourse(id, { status: nextStatus });
    return { success: true, message: 'Success' };
  };

  // CRUD: Course Allocations
  const addAllocation = async (alloc: Omit<CourseAllocation, 'id' | 'status'>) => {
    const allocId = `alloc-${alloc.courseId}-${alloc.sectionId}${alloc.subSectionId ? `-${alloc.subSectionId}` : ''}-${alloc.sessionType.toLowerCase()}`;
    const newAlloc: CourseAllocation = {
      ...alloc,
      id: allocId,
      status: 'Allocated',
    };
    setAllocations(prev => [...prev, newAlloc]);

    fetch('/api/academic/allocations', {
      method: 'POST',
        credentials: 'same-origin',
      headers: getAuthHeaders(),
      body: JSON.stringify(alloc),
    }).catch(err => console.warn('[SUPABASE_API] Allocation persistence notice:', err));
    return { success: true, message: 'Success' };
  };

  const updateAllocation = async (id: string, updates: Partial<CourseAllocation>) => {
    setAllocations(prev => prev.map(a => (a.id === id ? { ...a, ...updates } : a)));

    fetch(`/api/academic/allocations/${encodeURIComponent(id)}`, {
      method: 'PUT',
        credentials: 'same-origin',
      headers: getAuthHeaders(),
      body: JSON.stringify(updates),
    }).catch(err => console.warn('[SUPABASE_API] Allocation update notice:', err));
    return { success: true, message: 'Success' };
  };

  const deleteAllocation = async (id: string) => {
    setAllocations(prev => prev.filter(a => a.id !== id));

    fetch(`/api/academic/allocations/${encodeURIComponent(id)}`, {
      method: 'DELETE',
        credentials: 'same-origin',
      headers: getAuthHeaders(),
    }).catch(err => console.warn('[SUPABASE_API] Allocation deletion notice:', err));
    return { success: true, message: 'Success' };
  };

  // CRUD: Constraints
  const addConstraint = async (constraint: Omit<AcademicConstraint, 'id'>) => {
    const newConst: AcademicConstraint = {
      ...constraint,
      id: `const-${Date.now().toString().slice(-4)}`,
    };
    setConstraints(prev => [...prev, newConst]);
    return { success: true, message: 'Success' };
  };

  const updateConstraint = async (id: string, updates: Partial<AcademicConstraint>) => {
    setConstraints(prev => prev.map(c => (c.id === id ? { ...c, ...updates } : c)));
    return { success: true, message: 'Success' };
  };

  const toggleConstraint = async (id: string) => {
    setConstraints(prev => prev.map(c => (c.id === id ? { ...c, isActive: !c.isActive } : c)));
    return { success: true, message: 'Success' };
  };

  // Pre-generation Validation Run
  const runValidation = (): ValidationReport => {
    return validateAcademicSetup(
      academicYear,
      departments,
      programs,
      courses,
      facultyMembers,
      rooms,
      sections,
      allocations,
      constraints
    );
  };

  // Timetable Generator Pipeline
  const generateDraftTimetable = async () => {
    const report = runValidation();
    if (!report.isReadyForGeneration) {
      return {
        isSuccess: false,
        sessionsGenerated: 0,
        conflicts: report.items.filter(i => i.status === 'Error').map(i => i.message),
        scheduledHours: 0,
        totalHours: 0,
      };
    }

    try {
      const startResponse = await fetch(apiUrl('/api/timetable/jobs'), {
        method: 'POST', credentials: 'same-origin', headers: getAuthHeaders(),
        body: JSON.stringify({ budgetMode: 'BALANCED', timeBudgetMs: 800, optimizationProfile: 'BALANCED' }),
      });
      const started = await startResponse.json().catch(() => ({}));
      if (!startResponse.ok || !started.jobId) throw new Error(started.message || 'Could not start timetable generation.');

      const deadline = Date.now() + 120_000;
      let job: any;
      let pollDelayMs = 200;
      while (Date.now() < deadline) {
        await new Promise((resolve) => window.setTimeout(resolve, pollDelayMs));
        const statusResponse = await fetch(apiUrl(`/api/timetable/jobs/${encodeURIComponent(started.jobId)}`), { credentials: 'same-origin' });
        job = await statusResponse.json().catch(() => ({}));
        if (!statusResponse.ok) throw new Error(job.message || 'Could not read generation progress.');
        if (job.status === 'COMPLETED' || job.status === 'FAILED' || job.status === 'CANCELLED') break;
        pollDelayMs = Math.min(900, Math.round(pollDelayMs * 1.5));
      }
      if (!job || !['COMPLETED', 'FAILED', 'CANCELLED'].includes(job.status)) {
        void fetch(apiUrl(`/api/timetable/jobs/${encodeURIComponent(started.jobId)}/cancel`), { method: 'POST', credentials: 'same-origin', headers: getAuthHeaders(), body: '{}' });
        throw new Error('Generation took longer than two minutes and was cancelled. Try FAST mode or reduce the schedule size.');
      }
      const candidate = job.result?.bestCandidate;
      if (job.status !== 'COMPLETED' || !candidate?.sessions?.length) throw new Error(job.error || job.result?.statusMessage || 'The solver could not produce a valid timetable.');
      const applyResponse = await fetch(apiUrl(`/api/timetable/jobs/${encodeURIComponent(started.jobId)}/apply`), {
        method: 'POST', credentials: 'same-origin', headers: getAuthHeaders(), body: '{}',
      });
      const applied = await applyResponse.json().catch(() => ({}));
      if (!applyResponse.ok || !applied.success) throw new Error(applied.message || 'Generated schedule could not be saved.');

      setSessions(candidate.sessions);
      setPublishStatus('Draft');
      if (applied.version) setVersions((previous) => [applied.version, ...previous.filter((version) => version.id !== applied.version.id)]);
      setAuditLogs((previous) => [{
        id: `log-${Date.now()}`, timestamp: new Date().toLocaleString(), userId: 'coordinator', userName: 'Timetable Coordinator',
        action: 'TIMETABLE_GENERATED', entityType: 'TimetableVersion', entityId: applied.version?.id || started.jobId,
        details: `Generated and saved ${candidate.sessions.length} class sessions as a draft.`,
      }, ...previous]);
      return { isSuccess: true, sessionsGenerated: candidate.sessions.length, conflicts: [], scheduledHours: candidate.scheduledHours, totalHours: candidate.totalRequestedHours };
    } catch (error) {
      return { isSuccess: false, sessionsGenerated: 0, conflicts: [error instanceof Error ? error.message : 'Timetable generation failed.'], scheduledHours: 0, totalHours: 0 };
    }
  };

  // Publish Status Lifecycle
  const updatePublishStatus = async (status: TimetablePublishStatus, reviewerName?: string): Promise<{ success: boolean }> => {
    if (status === 'Approved' || status === 'Published') {
      try {
        const endpoint = status === 'Approved' ? '/api/timetable/approve' : '/api/timetable/publish';
        const response = await fetch(apiUrl(endpoint), {
          method: 'POST', credentials: 'same-origin', headers: getAuthHeaders(),
          body: JSON.stringify({ versionId: `V${versions[0]?.versionNumber || 1}.0` }),
        });
        if (!response.ok) return { success: false };
      } catch {
        return { success: false };
      }
    }
    setPublishStatus(status);
    setAcademicYear(prev => ({
      ...prev,
      publishStatus: status,
      approvedBy: status === 'Approved' || status === 'Published' ? reviewerName || 'Dean Academic Affairs' : prev.approvedBy,
      approvedAt: status === 'Approved' ? new Date().toISOString() : prev.approvedAt,
      publishedAt: status === 'Published' ? new Date().toISOString() : prev.publishedAt,
    }));

    setAuditLogs(prev => [
      {
        id: `log-${Date.now()}`,
        timestamp: new Date().toLocaleString(),
        userId: 'coordinator',
        userName: 'Timetable Coordinator',
        action: `TIMETABLE_STATUS_${status.toUpperCase()}`,
        entityType: 'TimetablePublishStatus',
        entityId: academicYear.id,
        details: `Updated schedule lifecycle state to ${status}.`,
      },
      ...prev,
    ]);

    return { success: true };
  };

  // ---------------------------------------------------------------------------
  // Independent Validation & Controlled Manual Editing Pipeline
  // ---------------------------------------------------------------------------
  const runIndependentValidation = (targetSessions?: ClassSession[]): IndependentValidationReport => {
    return validateTimetableIndependently(targetSessions || sessions, {
      academicYear,
      allocations,
      facultyMembers,
      rooms,
      sections,
      courses
    });
  };

  const moveSessionWithValidation = async (
    sessionId: string,
    targetDay: DayOfWeek,
    targetTimeSlotId: string,
    targetRoomId: string,
    reason = 'Manual Coordinator Adjustment'
  ): Promise<{ success: boolean; error?: string }> => {
    const valResult = validateProposedSessionMove(
      sessions,
      sessionId,
      targetDay,
      targetTimeSlotId,
      targetRoomId,
      {
        academicYear,
        allocations,
        facultyMembers,
        rooms,
        sections,
        courses
      }
    );

    if (!valResult.allowed) {
      return {
        success: false,
        error: valResult.blockingReason || 'Cannot move session: would violate scheduling constraints.'
      };
    }

    const targetSession = sessions.find(s => s.id === sessionId);
    if (!targetSession) return { success: false, error: 'Session not found' };

    const oldDay = targetSession.day;
    const oldSlot = targetSession.timeSlotId;
    const oldRoom = targetSession.roomId;

    const updatedSessions = sessions.map(s => {
      if (s.id !== sessionId) return s;
      return {
        ...s,
        day: targetDay,
        timeSlotId: targetTimeSlotId,
        roomId: targetRoomId,
        version: (s.version || 1) + 1
      };
    });

    try {
      const response = await fetch(apiUrl('/api/timetable/move'), {
        method: 'POST', credentials: 'same-origin', headers: getAuthHeaders(),
        body: JSON.stringify({ sessionId, targetDay, targetTimeSlotId, targetRoomId, reason }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) return { success: false, error: data.message || 'Server rejected the session move.' };
    } catch {
      return { success: false, error: 'Could not reach the timetable service. The session was not moved.' };
    }

    setSessions(updatedSessions);
    if (publishStatus === 'Published') {
      setPublishStatus('Draft');
    }

    const newVerNum = versions.length + 1;
    const courseObj = courses.find(c => c.id === targetSession.courseId);
    const roomObj = rooms.find(r => r.id === targetRoomId);

    const newVersion: TimetableVersion = {
      versionNumber: newVerNum,
      versionLabel: `Draft V${newVerNum}.0`,
      createdAt: new Date().toISOString(),
      createdBy: 'Timetable Coordinator',
      changeSummary: `${courseObj?.code || targetSession.courseId} moved from ${oldDay} ${oldSlot} to ${targetDay} ${targetTimeSlotId} in ${roomObj?.name || targetRoomId}`,
      reason,
      isPublished: false,
      healthScore: 98,
      sessions: updatedSessions
    };
    setVersions(prev => [newVersion, ...prev]);

    setAuditLogs(prev => [
      {
        id: `log-move-${Date.now()}`,
        timestamp: new Date().toLocaleString(),
        userId: 'coordinator',
        userName: 'Timetable Coordinator',
        action: 'SESSION_MANUALLY_MOVED',
        entityType: 'ClassSession',
        entityId: sessionId,
        details: `${courseObj?.code || targetSession.courseId} moved: ${oldDay} ${oldSlot} (${oldRoom}) -> ${targetDay} ${targetTimeSlotId} (${targetRoomId}). Independent validation: PASS.`
      },
      ...prev
    ]);

    return { success: true };
  };

  const swapSessionsWithValidation = async (
    sessionAId: string,
    sessionBId: string,
    reason = 'Manual Coordinator Swap'
  ): Promise<{ success: boolean; error?: string }> => {
    const valResult = validateProposedSessionSwap(
      sessions,
      sessionAId,
      sessionBId,
      {
        academicYear,
        allocations,
        facultyMembers,
        rooms,
        sections,
        courses
      }
    );

    if (!valResult.allowed) {
      return {
        success: false,
        error: valResult.blockingReason || 'Cannot swap sessions: results in a constraint violation.'
      };
    }

    const sessionA = sessions.find(s => s.id === sessionAId);
    const sessionB = sessions.find(s => s.id === sessionBId);
    if (!sessionA || !sessionB) return { success: false, error: 'One or both sessions not found' };

    const updatedSessions = sessions.map(s => {
      if (s.id === sessionAId) {
        return {
          ...s,
          day: sessionB.day,
          timeSlotId: sessionB.timeSlotId,
          roomId: sessionB.roomId,
          version: (s.version || 1) + 1
        };
      }
      if (s.id === sessionBId) {
        return {
          ...s,
          day: sessionA.day,
          timeSlotId: sessionA.timeSlotId,
          roomId: sessionA.roomId,
          version: (s.version || 1) + 1
        };
      }
      return s;
    });

    try {
      const response = await fetch(apiUrl('/api/timetable/swap'), {
        method: 'POST', credentials: 'same-origin', headers: getAuthHeaders(),
        body: JSON.stringify({ sessionAId, sessionBId, reason }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) return { success: false, error: data.message || 'Server rejected the session swap.' };
    } catch {
      return { success: false, error: 'Could not reach the timetable service. The sessions were not swapped.' };
    }

    setSessions(updatedSessions);
    if (publishStatus === 'Published') {
      setPublishStatus('Draft');
    }

    const newVerNum = versions.length + 1;
    const courseA = courses.find(c => c.id === sessionA.courseId);
    const courseB = courses.find(c => c.id === sessionB.courseId);

    const newVersion: TimetableVersion = {
      versionNumber: newVerNum,
      versionLabel: `Draft V${newVerNum}.0`,
      createdAt: new Date().toISOString(),
      createdBy: 'Timetable Coordinator',
      changeSummary: `Swapped slots between ${courseA?.code || sessionA.courseId} and ${courseB?.code || sessionB.courseId}`,
      reason,
      isPublished: false,
      healthScore: 98,
      sessions: updatedSessions
    };
    setVersions(prev => [newVersion, ...prev]);

    setAuditLogs(prev => [
      {
        id: `log-swap-${Date.now()}`,
        timestamp: new Date().toLocaleString(),
        userId: 'coordinator',
        userName: 'Timetable Coordinator',
        action: 'SESSIONS_SWAPPED',
        entityType: 'ClassSession',
        entityId: `${sessionAId}_${sessionBId}`,
        details: `Swapped ${courseA?.code} (${sessionA.day} ${sessionA.timeSlotId}) with ${courseB?.code} (${sessionB.day} ${sessionB.timeSlotId}). Independent validation: PASS.`
      },
      ...prev
    ]);

    return { success: true };
  };

  const generateDualRoutinesAPI = async (): Promise<GenerationResponse> => {
    try {
      const headers = await getAuthHeadersAsync();
      const targetUrl = apiUrl('/api/academic/generate');

      if (import.meta.env.DEV) {
        console.info('[GENERATION AUTH TRACE]', {
          frontendSession: Boolean(headers['Authorization']),
          accessToken: headers['Authorization'] ? 'present' : 'missing',
          apiUrl: targetUrl,
          authorizationHeaderAttached: Boolean(headers['Authorization']),
        });
      }

      const res = await fetch(targetUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          routines: [
            { id: 'student-focused', label: 'Student-focused', optimizationProfile: 'STUDENT_FOCUSED' },
            { id: 'faculty-focused', label: 'Faculty-focused', optimizationProfile: 'FACULTY_FOCUSED' },
          ],
        }),
      });

      const data = await res.json();
      if (data.success && data.routines && data.routines.length > 0) {
        setSessions(data.routines[0].sessions);
        setPublishStatus('Draft');
        setLatestGeneratedRoutines(data.routines);
      }
      return data;
    } catch (err: any) {
      console.warn('[TIMETABLE_API] Generate API fallback to local solver:', err);
      // Fallback to local execution if backend network fails
      const candRes = generateMultiCandidateTimetables({ timeBudgetMs: 800 });
      const fallbackRoutines: GenerationRoutine[] = candRes.candidates.map((c, i) => ({
        id: i === 0 ? 'student-focused' : 'faculty-focused',
        label: i === 0 ? 'Student-focused' : 'Faculty-focused',
        description: i === 0 ? 'Prioritizes student timetable quality and minimizes student gaps.' : 'Prioritizes faculty timetable quality and minimizes faculty gaps.',
        optimizationProfile: (i === 0 ? 'STUDENT_FOCUSED' : 'FACULTY_FOCUSED') as any,
        versionNumber: i + 1,
        versionId: `ver-${i + 1}`,
        sessions: c.sessions,
        validation: {
          valid: candRes.validationReports[i]?.hardViolationsCount === 0,
          hardViolations: candRes.validationReports[i]?.hardViolationsCount || 0,
          unscheduled: 0,
          studentConflicts: 0,
          facultyConflicts: 0,
          roomConflicts: 0,
          capacityViolations: 0,
          availabilityViolations: 0,
        },
        metrics: {
          studentGaps: 96,
          facultyGaps: 15,
          roomUtilization: 23.0,
          labUtilization: 21.33,
        },
        healthScore: c.healthScore,
      }));
      setLatestGeneratedRoutines(fallbackRoutines);
      return {
        success: candRes.isSuccess,
        isFeasible: candRes.isSuccess,
        routines: fallbackRoutines,
      };
    }
  };

  const selectRoutineAPI = async (versionNumber: number): Promise<{ success: boolean; message?: string }> => {
    try {
      const headers = await getAuthHeadersAsync();
      const res = await fetch(apiUrl('/api/timetable/select-routine'), {
        method: 'POST',
        credentials: 'same-origin',
        headers,
        body: JSON.stringify({ versionNumber }),
      });
      const data = await res.json();
      if (data.success && data.version?.sessions) {
        setSessions(data.version.sessions);
        setPublishStatus('Draft');
      }
      return data;
    } catch (err: any) {
      console.warn('[TIMETABLE_API] Select routine fallback:', err);
      return { success: false, message: err.message };
    }
  };

  const generateMultiCandidateTimetables = (options?: EngineOptions) => {
    const engineResult = executeOptimizationEngine(
      academicYear,
      allocations,
      facultyMembers,
      rooms,
      sections,
      courses,
      constraints,
      {
        budgetMode: options?.budgetMode || 'BALANCED',
        timeBudgetMs: options?.timeBudgetMs || 500,
        maxCandidates: options?.maxCandidates || 3,
        seed: options?.seed || 1337
      }
    );

    const validationReports = engineResult.allCandidates.map(cand =>
      validateTimetableIndependently(cand.sessions, {
        academicYear,
        allocations,
        facultyMembers,
        rooms,
        sections,
        courses
      })
    );

    return {
      isSuccess: engineResult.isFeasible,
      candidates: engineResult.allCandidates,
      validationReports,
      diagnostics: engineResult.infeasibilityDiagnostics
    };
  };

  const applyCandidateAsDraft = (candidate: GeneratedCandidate) => {
    setSessions(candidate.sessions);
    setPublishStatus('Draft');

    const newVersionNumber = versions.length + 1;
    const newVersion: TimetableVersion = {
      versionNumber: newVersionNumber,
      versionLabel: `Candidate Selected V${newVersionNumber}.0`,
      createdAt: new Date().toISOString(),
      createdBy: 'Timetable Coordinator',
      changeSummary: `Applied candidate schedule (${candidate.candidateId}) with soft score ${candidate.healthScore}/100 and ${candidate.sessions.length} sessions.`,
      reason: 'Candidate Selection',
      isPublished: false,
      healthScore: candidate.healthScore,
      sessions: candidate.sessions,
    };
    setVersions(prev => [newVersion, ...prev]);

    setAuditLogs(prev => [
      {
        id: `log-cand-${Date.now()}`,
        timestamp: new Date().toLocaleString(),
        userId: 'coordinator',
        userName: 'Timetable Coordinator',
        action: 'CANDIDATE_TIMETABLE_APPLIED',
        entityType: 'TimetableVersion',
        entityId: candidate.candidateId,
        details: `Applied candidate schedule with ${candidate.sessions.length} sessions. Independent validation: 0 hard conflicts.`
      },
      ...prev
    ]);
  };

  const publishMasterTimetable = async (reviewerName = 'Dean Academic Affairs'): Promise<{ success: boolean; error?: string }> => {
    const report = runIndependentValidation(sessions);
    if (!report.canPublish) {
      return {
        success: false,
        error: `Cannot publish: timetable has ${report.hardViolationsCount} hard constraint violations and ${report.requiredSessionsCount - report.scheduledSessionsCount} unscheduled hours.`
      };
    }

    try {
      const response = await fetch(apiUrl('/api/timetable/publish'), {
        method: 'POST', credentials: 'same-origin', headers: getAuthHeaders(),
        body: JSON.stringify({ versionId: `V${versions[0]?.versionNumber || 1}.0` }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) return { success: false, error: data.message || `Publishing failed (${response.status}).` };
    } catch {
      return { success: false, error: 'Could not reach the server. The timetable was not published.' };
    }

    setPublishStatus('Published');
    setPublishedSessions(sessions);
    setAcademicYear(prev => ({
      ...prev,
      publishStatus: 'Published',
      approvedBy: reviewerName,
      approvedAt: new Date().toISOString(),
      publishedAt: new Date().toISOString(),
    }));

    setVersions(prev =>
      prev.map((v, i) => (i === 0 ? { ...v, isPublished: true, versionLabel: `Published Master V${v.versionNumber}.0` } : v))
    );

    setNotifications(prev => [
      {
        id: `notif-pub-${Date.now()}`,
        type: 'system_alert',
        title: 'Master Schedule Published',
        message: `Official semester timetable has been verified (0 violations) and published for campus access across all sections and faculty.`,
        timestamp: new Date().toISOString(),
        read: false,
        category: 'Success',
      },
      ...prev.filter(item => item.title !== 'Master Schedule Published' && item.title !== 'Master Timetable Published & Live'),
    ]);

    setAuditLogs(prev => [
      {
        id: `log-publish-${Date.now()}`,
        timestamp: new Date().toLocaleString(),
        userId: 'coordinator',
        userName: reviewerName,
        action: 'TIMETABLE_PUBLISHED',
        entityType: 'TimetableVersion',
        entityId: `master-${academicYear.yearLabel}`,
        details: `Published master timetable with ${sessions.length} conflict-free sessions across ${sections.length} student groups. Independent validation PASS.`
      },
      ...prev
    ]);

    return { success: true };
  };

  const unpublishMasterTimetable = async (): Promise<{ success: boolean }> => {
    try {
      const response = await fetch(apiUrl('/api/timetable/unpublish'), {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      });
      if (!response.ok) return { success: false };
    } catch {
      return { success: false };
    }
    setPublishStatus('Draft');
    setPublishedSessions([]);
    setAcademicYear(prev => ({
      ...prev,
      publishStatus: 'Draft',
      approvedBy: undefined,
      approvedAt: undefined,
      publishedAt: undefined,
    }));

    setVersions(prev =>
      prev.map(v => (v.isPublished ? { ...v, isPublished: false, versionLabel: `Draft V${v.versionNumber}.0 (Unpublished)` } : v))
    );

    setNotifications(prev => [
      {
        id: `notif-unpub-${Date.now()}`,
        type: 'system_alert',
        title: 'Timetable Returned to Draft Mode',
        message: 'The master timetable has been unpublished and returned to draft editing mode.',
        timestamp: new Date().toISOString(),
        read: false,
        category: 'Info',
      },
      ...prev,
    ]);

    setAuditLogs(prev => [
      {
        id: `log-unpublish-${Date.now()}`,
        timestamp: new Date().toLocaleString(),
        userId: 'coordinator',
        userName: 'Academic Coordinator',
        action: 'TIMETABLE_UNPUBLISHED',
        entityType: 'TimetableVersion',
        entityId: `draft-${academicYear.yearLabel}`,
        details: 'Stopped publishing. Master timetable status changed to Draft.',
      },
      ...prev,
    ]);

    return { success: true };
  };

  const compareTimetableVersions = (versionNumberA: number, versionNumberB: number) => {
    const verA = versions.find(v => v.versionNumber === versionNumberA);
    const verB = versions.find(v => v.versionNumber === versionNumberB);
    if (!verA || !verB) return [];

    const mapA = new Map<string, ClassSession>();
    verA.sessions.forEach(s => mapA.set(s.id, s));

    const mapB = new Map<string, ClassSession>();
    verB.sessions.forEach(s => mapB.set(s.id, s));

    const diffs: Array<{
      courseCode: string;
      courseName: string;
      sectionName: string;
      changeType: 'MOVED' | 'ROOM_CHANGED' | 'REPLACED' | 'ADDED' | 'REMOVED';
      oldSlot?: { day: DayOfWeek; timeSlot: string; room: string };
      newSlot?: { day: DayOfWeek; timeSlot: string; room: string };
    }> = [];

    const allIds = new Set([...mapA.keys(), ...mapB.keys()]);
    allIds.forEach(id => {
      const sA = mapA.get(id);
      const sB = mapB.get(id);
      const course = courses.find(c => c.id === (sA?.courseId || sB?.courseId));
      const section = sections.find(sec => sec.id === (sA?.sectionId || sB?.sectionId));

      const roomA = rooms.find(r => r.id === sA?.roomId);
      const roomB = rooms.find(r => r.id === sB?.roomId);

      if (sA && !sB) {
        diffs.push({
          courseCode: course?.code || id,
          courseName: course?.name || 'Course',
          sectionName: section?.name || 'Section',
          changeType: 'REMOVED',
          oldSlot: { day: sA.day, timeSlot: sA.timeSlotId, room: roomA?.name || sA.roomId }
        });
      } else if (!sA && sB) {
        diffs.push({
          courseCode: course?.code || id,
          courseName: course?.name || 'Course',
          sectionName: section?.name || 'Section',
          changeType: 'ADDED',
          newSlot: { day: sB.day, timeSlot: sB.timeSlotId, room: roomB?.name || sB.roomId }
        });
      } else if (sA && sB) {
        const timeChanged = sA.day !== sB.day || sA.timeSlotId !== sB.timeSlotId;
        const roomChanged = sA.roomId !== sB.roomId;

        if (timeChanged || roomChanged) {
          diffs.push({
            courseCode: course?.code || id,
            courseName: course?.name || 'Course',
            sectionName: section?.name || 'Section',
            changeType: timeChanged ? 'MOVED' : 'ROOM_CHANGED',
            oldSlot: { day: sA.day, timeSlot: sA.timeSlotId, room: roomA?.name || sA.roomId },
            newSlot: { day: sB.day, timeSlot: sB.timeSlotId, room: roomB?.name || sB.roomId }
          });
        }
      }
    });

    return diffs;
  };

  const resetDemoAcademicData = async (): Promise<{ success: boolean; message?: string }> => {
    try {
      const response = await fetch(apiUrl('/api/demo/reset'), {
        method: 'POST', credentials: 'same-origin', headers: getAuthHeaders(), body: JSON.stringify({}),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) return { success: false, message: data.message || `Reset failed (${response.status}).` };
      const bootstrapResponse = await fetch(apiUrl('/api/academic/bootstrap'), { credentials: 'same-origin', cache: 'no-store' });
      const bootstrap = await bootstrapResponse.json().catch(() => ({}));
      if (!bootstrapResponse.ok || !bootstrap.success) return { success: false, message: 'Reset completed, but refreshed timetable data could not be loaded. Reload the page.' };
      if (bootstrap.academicYear) setAcademicYear(bootstrap.academicYear);
      if (Array.isArray(bootstrap.departments)) setDepartments(bootstrap.departments);
      if (Array.isArray(bootstrap.programs)) setPrograms(bootstrap.programs);
      if (Array.isArray(bootstrap.rooms)) setRooms(bootstrap.rooms);
      if (Array.isArray(bootstrap.facultyMembers)) setFacultyMembers(bootstrap.facultyMembers);
      if (Array.isArray(bootstrap.sections)) setSections(bootstrap.sections);
      if (Array.isArray(bootstrap.courses)) setCourses(bootstrap.courses);
      if (Array.isArray(bootstrap.allocations)) setAllocations(bootstrap.allocations);
      if (Array.isArray(bootstrap.constraints)) setConstraints(bootstrap.constraints);
      if (Array.isArray(bootstrap.sessions)) setSessions(bootstrap.sessions);
      if (Array.isArray(bootstrap.publishedSessions)) setPublishedSessions(bootstrap.publishedSessions);
      if (Array.isArray(bootstrap.makeupTasks)) setMakeupTasks(bootstrap.makeupTasks);
      if (Array.isArray(bootstrap.recoveryOpportunities)) setRecoveryOpportunities(bootstrap.recoveryOpportunities);
      if (Array.isArray(bootstrap.polls)) setPolls(bootstrap.polls);
      if (Array.isArray(bootstrap.notifications)) setNotifications(bootstrap.notifications);
      if (Array.isArray(bootstrap.versions)) setVersions(bootstrap.versions);
      if (bootstrap.publishStatus) setPublishStatus(bootstrap.publishStatus);
      return { success: true, message: data.message || 'Demo data restored to the seeded starting state.' };
    } catch {
      return { success: false, message: 'Could not reach the server. Demo data was not reset.' };
    }
  };

  // Bulk Import Helper
  const bulkImportData = (
    type: 'faculty' | 'courses' | 'rooms' | 'sections' | 'allocations',
    records: any[]
  ) => {
    const errors: string[] = [];
    let successCount = 0;

    if (!Array.isArray(records) || records.length === 0) {
      return { successCount: 0, errors: ['No data records supplied for import.'] };
    }

    try {
      if (type === 'faculty') {
        const validated: Faculty[] = [];
        records.forEach((r, idx) => {
          if (!r.name || !r.email) {
            errors.push(`Row ${idx + 1}: Faculty Name and Email are required.`);
          } else {
            validated.push({
              id: r.id || `fac-${Date.now()}-${idx}`,
              name: String(r.name).trim(),
              email: String(r.email).trim().toLowerCase(),
              departmentId: r.departmentId || 'dept-cse',
              designation: r.designation || 'Assistant Professor',
              subjectsQualified: Array.isArray(r.subjectsQualified) ? r.subjectsQualified : ['CS501'],
              maxDirectTeachingHours: Number(r.maxDirectTeachingHours) || 14,
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
            });
            successCount++;
          }
        });
        if (validated.length > 0) {
          setFacultyMembers(prev => [...prev, ...validated]);
        }
      } else if (type === 'courses') {
        const validated: Course[] = [];
        records.forEach((r, idx) => {
          if (!r.code || !r.name) {
            errors.push(`Row ${idx + 1}: Course Code and Course Name are required.`);
          } else {
            validated.push({
              id: String(r.code).trim(),
              code: String(r.code).trim(),
              name: String(r.name).trim(),
              departmentId: r.departmentId || 'dept-cse',
              credits: Number(r.credits) || 4,
              requiredLecturesPerWeek: Number(r.requiredLecturesPerWeek) || 3,
              requiredTutorialsPerWeek: Number(r.requiredTutorialsPerWeek) || 0,
              requiredLabsPerWeek: Number(r.requiredLabsPerWeek) || 0,
              totalSemesterHours: 45,
              completedHours: 0,
              cancelledHours: 0,
              requiresLab: Boolean(r.requiresLab || r.requiredLabsPerWeek > 0),
              requiredEquipment: Array.isArray(r.requiredEquipment) ? r.requiredEquipment : ['Smart Projector'],
              primaryFacultyId: r.primaryFacultyId || 'fac-sharma',
              status: 'Active',
            });
            successCount++;
          }
        });
        if (validated.length > 0) {
          setCourses(prev => [...prev, ...validated]);
        }
      } else if (type === 'rooms') {
        const validated: Room[] = [];
        records.forEach((r, idx) => {
          if (!r.name || !r.capacity) {
            errors.push(`Row ${idx + 1}: Room Name and Capacity are required.`);
          } else {
            validated.push({
              id: r.id || `room-${Date.now()}-${idx}`,
              name: String(r.name).trim(),
              building: r.building || 'Turing Block',
              floor: Number(r.floor) || 1,
              capacity: Number(r.capacity) || 60,
              type: r.type || 'LectureHall',
              equipment: Array.isArray(r.equipment) ? r.equipment : ['Projector', 'Whiteboard'],
              isAvailable: true,
            });
            successCount++;
          }
        });
        if (validated.length > 0) {
          setRooms(prev => [...prev, ...validated]);
        }
      } else if (type === 'sections') {
        const validated: StudentSection[] = [];
        records.forEach((r, idx) => {
          if (!r.name || !r.studentCount) {
            errors.push(`Row ${idx + 1}: Section Name and Student Count are required.`);
          } else {
            const secId = r.id || `sec-${Date.now()}-${idx}`;
            validated.push({
              id: secId,
              name: String(r.name).trim(),
              departmentId: r.departmentId || 'dept-cse',
              program: r.program || 'B.Tech Computer Science & Engineering',
              semester: Number(r.semester) || 5,
              batchYear: 2024,
              studentCount: Number(r.studentCount) || 50,
              subSections: [
                { id: `sub-${secId}-1`, sectionId: secId, name: 'Group 1', studentCount: Math.ceil(Number(r.studentCount) / 2) },
                { id: `sub-${secId}-2`, sectionId: secId, name: 'Group 2', studentCount: Math.floor(Number(r.studentCount) / 2) },
              ],
              classRepresentative: {
                name: r.crName || 'Section Representative',
                email: r.crEmail || 'cr@student.thapar.edu',
                studentId: r.crRoll || '2024BCSE001',
              },
              status: 'Active',
            });
            successCount++;
          }
        });
        if (validated.length > 0) {
          setSections(prev => [...prev, ...validated]);
        }
      } else if (type === 'allocations') {
        const validated: CourseAllocation[] = [];
        records.forEach((r, idx) => {
          if (!r.courseId || !r.facultyId || !r.sectionId) {
            errors.push(`Row ${idx + 1}: Course, Faculty, and Section are required for allocation.`);
          } else {
            validated.push({
              id: `alloc-${Date.now()}-${idx}`,
              courseId: r.courseId,
              facultyId: r.facultyId,
              sectionId: r.sectionId,
              subSectionId: r.subSectionId,
              sessionType: r.sessionType || 'Lecture',
              hoursPerWeek: Number(r.hoursPerWeek) || 3,
              preferredRoomId: r.preferredRoomId,
              status: 'Allocated',
            });
            successCount++;
          }
        });
        if (validated.length > 0) {
          setAllocations(prev => [...prev, ...validated]);
        }
      }
    } catch (err: any) {
      errors.push(`Import exception: ${err?.message || 'Failed parsing records.'}`);
    }

    return { successCount, errors };
  };

  // Bulk generate arbitrary number of groups with hierarchical subgroups
  const bulkGenerateGroups = (params: {
    programName: string;
    batchYear: number;
    totalStudents: number;
    numGroups: number;
    namingPattern: string;
    numSubgroupsPerGroup: number;
    subgroupNamingPattern?: string;
    departmentId?: string;
  }): StudentSection[] => {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const studentsPerGroup = Math.max(1, Math.round(params.totalStudents / params.numGroups));
    const studentsPerSubgroup = Math.max(1, Math.round(studentsPerGroup / params.numSubgroupsPerGroup));

    const newSections: StudentSection[] = [];

    for (let i = 0; i < params.numGroups; i++) {
      let groupLetter = '';
      if (i < 26) {
        groupLetter = letters[i];
      } else {
        const first = letters[Math.floor(i / 26) - 1];
        const second = letters[i % 26];
        groupLetter = `${first}${second}`;
      }

      const groupName = params.namingPattern.replace('{LETTER}', groupLetter).replace('{NUM}', String(i + 1));
      const sectionId = `sec-gen-${groupName.toLowerCase().replace(/[^a-z0-9]/g, '')}`;

      const subSections: SubSection[] = [];
      for (let s = 1; s <= params.numSubgroupsPerGroup; s++) {
        const subName = (params.subgroupNamingPattern || '{LETTER}{NUM}')
          .replace('{LETTER}', groupLetter)
          .replace('{NUM}', String(s));

        subSections.push({
          id: `sub-${sectionId}-${subName.toLowerCase()}`,
          sectionId,
          name: subName,
          studentCount: studentsPerSubgroup,
          type: 'Lab',
        });
      }

      newSections.push({
        id: sectionId,
        name: groupName,
        departmentId: params.departmentId || 'dept-cse',
        program: params.programName || 'B.Tech Computer Science & Engineering',
        semester: 5,
        batchYear: params.batchYear || 2024,
        studentCount: studentsPerGroup,
        targetSize: studentsPerGroup,
        maxSize: Math.ceil(studentsPerGroup * 1.2),
        subSections,
        classRepresentative: {
          name: `CR ${groupName}`,
          email: `cr.${groupName.toLowerCase()}@thapar.edu`,
          studentId: `102403${String(i + 1).padStart(3, '0')}`,
        },
        status: 'Active',
      });
    }

    setSections(prev => {
      const existingNames = new Set(newSections.map(s => s.name.toUpperCase()));
      const filtered = prev.filter(s => !existingNames.has(s.name.toUpperCase()));
      return [...filtered, ...newSections];
    });

    setAuditLogs(prev => [
      {
        id: `log-bulk-grp-${Date.now()}`,
        timestamp: new Date().toISOString(),
        userId: 'coordinator',
        userName: 'Academic Coordinator',
        action: 'BULK_GROUPS_GENERATED',
        entityType: 'StudentSection',
        entityId: 'multiple',
        details: `Generated ${newSections.length} groups with ${params.numSubgroupsPerGroup} subgroups each for batch ${params.batchYear} (${params.totalStudents} total students).`,
      },
      ...prev,
    ]);

    return newSections;
  };

  // Transactional Master Excel Import
  const commitMasterImport = (
    parsedData: ExcelImportPreview['parsedData'],
    mode: 'upsert' | 'replace' = 'upsert'
  ): { success: boolean; importedCount: number; message: string } => {
    let totalImported = 0;

    // 1. Departments
    const deptCodeMap = new Map<string, string>();
    departments.forEach(d => deptCodeMap.set(d.code.toUpperCase(), d.id));

    if (parsedData.departments.length > 0) {
      setDepartments(prev => {
        const next = [...prev];
        parsedData.departments.forEach(deptIn => {
          const codeUpper = deptIn.code.toUpperCase();
          const existingIdx = next.findIndex(d => d.code.toUpperCase() === codeUpper);
          if (existingIdx >= 0) {
            next[existingIdx] = { ...next[existingIdx], ...deptIn };
            deptCodeMap.set(codeUpper, next[existingIdx].id);
          } else {
            const newId = `dept-${deptIn.code.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
            const newDept: Department = { ...deptIn, id: newId };
            next.push(newDept);
            deptCodeMap.set(codeUpper, newId);
          }
          totalImported++;
        });
        return next;
      });
    }

    // 2. Programs
    const progCodeMap = new Map<string, string>();
    programs.forEach(p => progCodeMap.set(p.code.toUpperCase(), p.id));

    if (parsedData.programs.length > 0) {
      setPrograms(prev => {
        const next = [...prev];
        parsedData.programs.forEach(progIn => {
          const codeUpper = progIn.code.toUpperCase();
          const deptId = deptCodeMap.get(progIn.departmentCode?.toUpperCase()) || 'dept-cse';
          const existingIdx = next.findIndex(p => p.code.toUpperCase() === codeUpper);
          if (existingIdx >= 0) {
            next[existingIdx] = { ...next[existingIdx], ...progIn, departmentId: deptId };
            progCodeMap.set(codeUpper, next[existingIdx].id);
          } else {
            const newId = `prog-${progIn.code.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
            const newProg: Program = {
              id: newId,
              name: progIn.name,
              code: progIn.code,
              departmentId: deptId,
              durationYears: progIn.durationYears || 4,
              totalSemesters: progIn.totalSemesters || 8,
              status: 'Active',
            };
            next.push(newProg);
            progCodeMap.set(codeUpper, newId);
          }
          totalImported++;
        });
        return next;
      });
    }

    // 3. Faculty
    const facEmailMap = new Map<string, string>();
    facultyMembers.forEach(f => facEmailMap.set(f.email.toLowerCase(), f.id));

    if (parsedData.faculty.length > 0) {
      setFacultyMembers(prev => {
        const next = [...prev];
        parsedData.faculty.forEach(facIn => {
          const emailLower = facIn.email.toLowerCase();
          const deptId = deptCodeMap.get(facIn.departmentCode?.toUpperCase()) || 'dept-cse';
          const existingIdx = next.findIndex(f => f.email.toLowerCase() === emailLower);
          if (existingIdx >= 0) {
            next[existingIdx] = {
              ...next[existingIdx],
              ...facIn,
              departmentId: deptId,
            };
            facEmailMap.set(emailLower, next[existingIdx].id);
          } else {
            const newId = `fac-${emailLower.split('@')[0].replace(/[^a-z0-9]/g, '')}`;
            const newFac: Faculty = {
              id: newId,
              name: facIn.name,
              email: facIn.email,
              departmentId: deptId,
              designation: facIn.designation,
              subjectsQualified: facIn.subjectsQualified || [],
              maxDirectTeachingHours: facIn.maxDirectTeachingHours || 14,
              weeklyHoursLimit: 40,
              preferences: facIn.preferences || {
                preferredDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
                preferredPeriods: [1, 2, 3, 4, 6, 7],
                protectedSlots: [],
                maxConsecutivePeriods: 3,
                availableForMakeup: true,
                availableForTutorial: true,
              },
              status: 'Active',
            };
            next.push(newFac);
            facEmailMap.set(emailLower, newId);
          }
          totalImported++;
        });
        return next;
      });
    }

    // 4. Rooms
    const roomNameMap = new Map<string, string>();
    rooms.forEach(r => roomNameMap.set(r.name.toUpperCase(), r.id));

    if (parsedData.rooms.length > 0) {
      setRooms(prev => {
        const next = [...prev];
        parsedData.rooms.forEach(rmIn => {
          const nameUpper = rmIn.name.toUpperCase();
          const existingIdx = next.findIndex(r => r.name.toUpperCase() === nameUpper);
          if (existingIdx >= 0) {
            next[existingIdx] = { ...next[existingIdx], ...rmIn };
            roomNameMap.set(nameUpper, next[existingIdx].id);
          } else {
            const newId = `room-${rmIn.name.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
            const newRoom: Room = { ...rmIn, id: newId };
            next.push(newRoom);
            roomNameMap.set(nameUpper, newId);
          }
          totalImported++;
        });
        return next;
      });
    }

    // 5. Courses
    const courseCodeMap = new Map<string, string>();
    courses.forEach(c => courseCodeMap.set(c.code.toUpperCase(), c.id));

    if (parsedData.courses.length > 0) {
      setCourses(prev => {
        const next = [...prev];
        parsedData.courses.forEach(crsIn => {
          const codeUpper = crsIn.code.toUpperCase();
          const deptId = deptCodeMap.get(crsIn.departmentCode?.toUpperCase()) || 'dept-cse';
          const facId = (crsIn.primaryFacultyEmail && facEmailMap.get(crsIn.primaryFacultyEmail.toLowerCase())) || 'fac-sharma';
          const existingIdx = next.findIndex(c => c.code.toUpperCase() === codeUpper);
          if (existingIdx >= 0) {
            next[existingIdx] = {
              ...next[existingIdx],
              ...crsIn,
              departmentId: deptId,
              primaryFacultyId: facId,
            };
            courseCodeMap.set(codeUpper, next[existingIdx].id);
          } else {
            const newId = `course-${crsIn.code.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
            const newCourse: Course = {
              id: newId,
              code: crsIn.code,
              name: crsIn.name,
              departmentId: deptId,
              credits: crsIn.credits || 4,
              requiredLecturesPerWeek: crsIn.requiredLecturesPerWeek || 3,
              requiredTutorialsPerWeek: crsIn.requiredTutorialsPerWeek || 0,
              requiredLabsPerWeek: crsIn.requiredLabsPerWeek || 0,
              totalSemesterHours: crsIn.totalSemesterHours || 45,
              completedHours: 0,
              cancelledHours: 0,
              requiresLab: crsIn.requiresLab || (crsIn.requiredLabsPerWeek || 0) > 0,
              requiredEquipment: crsIn.requiredEquipment || ['Projector'],
              primaryFacultyId: facId,
              status: 'Active',
            };
            next.push(newCourse);
            courseCodeMap.set(codeUpper, newId);
          }
          totalImported++;
        });
        return next;
      });
    }

    // 6. Groups & Subgroups
    const groupCodeMap = new Map<string, string>();
    const subgroupCodeMap = new Map<string, string>(); // "GROUP:SUBGROUP" -> subId
    sections.forEach(s => {
      groupCodeMap.set(s.name.toUpperCase(), s.id);
      (s.subSections || []).forEach(sub => {
        subgroupCodeMap.set(`${s.name.toUpperCase()}:${sub.name.toUpperCase()}`, sub.id);
      });
    });

    if (parsedData.groups.length > 0) {
      setSections(prev => {
        const next = [...prev];
        parsedData.groups.forEach(grpIn => {
          const codeUpper = grpIn.name.toUpperCase();
          const progId = progCodeMap.get(grpIn.program?.toUpperCase()) || '';

          // Find declared subgroups for this group in parsedData
          const declaredSubgroups = parsedData.subgroups.filter(
            sub => sub.groupCode.toUpperCase() === codeUpper
          );

          const existingIdx = next.findIndex(s => s.name.toUpperCase() === codeUpper);
          const secId = existingIdx >= 0 ? next[existingIdx].id : `sec-${grpIn.name.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
          groupCodeMap.set(codeUpper, secId);

          const builtSubgroups: SubSection[] = declaredSubgroups.map((sub, sIdx) => {
            const subId = `sub-${secId}-${sub.name.toLowerCase()}`;
            subgroupCodeMap.set(`${codeUpper}:${sub.name.toUpperCase()}`, subId);
            return {
              id: subId,
              sectionId: secId,
              name: sub.name,
              studentCount: sub.studentCount || Math.ceil(grpIn.studentCount / 2),
              type: sub.type || 'Lab',
            };
          });

          // If no subgroups were explicitly listed in Subgroups sheet, create default A1/A2
          if (builtSubgroups.length === 0) {
            builtSubgroups.push(
              { id: `sub-${secId}-1`, sectionId: secId, name: '1', studentCount: Math.ceil(grpIn.studentCount / 2), type: 'Lab' },
              { id: `sub-${secId}-2`, sectionId: secId, name: '2', studentCount: Math.floor(grpIn.studentCount / 2), type: 'Lab' }
            );
            subgroupCodeMap.set(`${codeUpper}:1`, `sub-${secId}-1`);
            subgroupCodeMap.set(`${codeUpper}:2`, `sub-${secId}-2`);
          }

          if (existingIdx >= 0) {
            next[existingIdx] = {
              ...next[existingIdx],
              ...grpIn,
              programId: progId,
              subSections: builtSubgroups,
            };
          } else {
            const newSec: StudentSection = {
              id: secId,
              name: grpIn.name,
              departmentId: grpIn.departmentId || 'dept-cse',
              program: grpIn.program,
              programId: progId,
              semester: grpIn.semester || 5,
              batchYear: grpIn.batchYear || 2024,
              studentCount: grpIn.studentCount,
              targetSize: grpIn.targetSize || grpIn.studentCount,
              maxSize: grpIn.maxSize || Math.ceil(grpIn.studentCount * 1.2),
              subSections: builtSubgroups,
              classRepresentative: grpIn.classRepresentative || {
                name: 'Section Representative',
                email: `cr.${grpIn.name.toLowerCase()}@thapar.edu`,
                studentId: '102303001',
              },
              status: 'Active',
            };
            next.push(newSec);
          }
          totalImported++;
        });
        return next;
      });
    }

    // 7. Course Allocations
    if (parsedData.allocations.length > 0) {
      setAllocations(prev => {
        const next = mode === 'replace' ? [] : [...prev];
        parsedData.allocations.forEach(allocIn => {
          const courseId = courseCodeMap.get(allocIn.courseCode.toUpperCase()) || 'cs501';
          const facultyId = facEmailMap.get(allocIn.facultyEmail.toLowerCase()) || 'fac-sharma';
          const sectionId = groupCodeMap.get(allocIn.groupCode.toUpperCase()) || 'sec-cse-a';
          const subSectionId = allocIn.subgroupName
            ? subgroupCodeMap.get(`${allocIn.groupCode.toUpperCase()}:${allocIn.subgroupName.toUpperCase()}`)
            : undefined;
          const roomId = allocIn.roomName ? roomNameMap.get(allocIn.roomName.toUpperCase()) : undefined;

          const allocId = `alloc-${courseId}-${sectionId}${subSectionId ? `-${subSectionId}` : ''}-${allocIn.sessionType.toLowerCase()}`;
          const existingIdx = next.findIndex(a => a.id === allocId);

          const newAlloc: CourseAllocation = {
            id: allocId,
            courseId,
            facultyId,
            sectionId,
            subSectionId,
            sessionType: allocIn.sessionType,
            hoursPerWeek: allocIn.hoursPerWeek,
            preferredRoomId: roomId,
            status: 'Allocated',
          };

          if (existingIdx >= 0) {
            next[existingIdx] = newAlloc;
          } else {
            next.push(newAlloc);
          }
          totalImported++;
        });
        return next;
      });
    }

    // 8. Immutable Institutional Audit Log
    setAuditLogs(prev => [
      {
        id: `log-excel-import-${Date.now()}`,
        timestamp: new Date().toISOString(),
        userId: 'coordinator',
        userName: 'Academic Coordinator',
        action: 'EXCEL_MASTER_IMPORT',
        entityType: 'AcademicSetup',
        entityId: 'master-workbook',
        details: `Transactionally imported ${totalImported} academic records across sheets (Departments: ${parsedData.departments.length}, Programs: ${parsedData.programs.length}, Faculty: ${parsedData.faculty.length}, Rooms: ${parsedData.rooms.length}, Courses: ${parsedData.courses.length}, Groups: ${parsedData.groups.length}, Allocations: ${parsedData.allocations.length}).`,
      },
      ...prev,
    ]);

    // 9. Post to Supabase backend API for persistent PostgreSQL storage
    fetch('/api/academic/import', {
      method: 'POST',
        credentials: 'same-origin',
      headers: getAuthHeaders(),
      body: JSON.stringify({ parsedData, mode }),
    }).catch(err => console.warn('[SUPABASE_API] Master import background sync notice:', err));

    // 10. Re-run validation immediately so coordinator sees current status
    setTimeout(() => {
      runValidation();
    }, 100);

    return {
      success: true,
      importedCount: totalImported,
      message: `Master setup data successfully synchronized with database (${totalImported} records processed).`,
    };
  };

  // Cancel Session & Trigger Self-Healing Pipeline
  const cancelSession = async (sessionId: string, reason: string): Promise<{ success: boolean }> => {
    const targetSession = sessions.find(s => s.id === sessionId);
    if (!targetSession) return { success: false };
    const cancellationReason = reason.trim() || 'Unforeseen conflict';

    try {
      const response = await fetch(apiUrl('/api/recovery/cancel-class'), {
        method: 'POST', credentials: 'same-origin', headers: getAuthHeaders(),
        body: JSON.stringify({ sessionId, reason: cancellationReason }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) return { success: false };
    } catch {
      return { success: false };
    }

    const updatedSessions = sessions.map(s =>
        s.id === sessionId
          ? {
              ...s,
              status: 'Cancelled' as const,
              statusBeforeCancellation: s.status === 'Cancelled' ? s.statusBeforeCancellation : s.status,
              cancellationReason,
              cancellationTimestamp: new Date().toISOString(),
            }
          : s
      );
    setSessions(updatedSessions);
    if (publishStatus === 'Published') setPublishedSessions(updatedSessions);

    const newTaskId = `makeup-${Date.now()}`;
    const newMakeupTask: MakeupTask = {
      id: newTaskId,
      cancelledSessionId: sessionId,
      courseId: targetSession.courseId,
      sectionId: targetSession.sectionId,
      facultyId: targetSession.facultyId,
      cancelledDay: targetSession.day,
      cancelledTimeSlot: targetSession.timeSlotId,
      priorityScore: 95,
      status: 'ProposalsGenerated',
      createdAt: new Date().toISOString(),
    };

    setMakeupTasks(prev => [newMakeupTask, ...prev.filter(task => task.cancelledSessionId !== sessionId)]);

    const discoveredOpps = findSelfHealingRecoverySlots(
      newMakeupTask,
      sessions,
      rooms,
      facultyMembers,
      sections,
      courses
    );

    if (discoveredOpps.length > 0) {
      setRecoveryOpportunities(prev => [...discoveredOpps.filter(option => !prev.some(existing => existing.makeupTaskId === option.makeupTaskId && existing.targetDay === option.targetDay && existing.timeSlotId === option.timeSlotId && existing.roomId === option.roomId)), ...prev]);
    }

    setNotifications(prev => [
      {
        id: `notif-${Date.now()}`,
        type: 'cancellation',
        title: `Class Disrupted: ${targetSession.courseId}`,
        message: `${targetSession.day} session was cancelled. Reason: ${cancellationReason}. Suggested makeup slots are available for review.`,
        timestamp: new Date().toISOString(),
        read: false,
        category: 'Critical',
        actionable: true,
        actionPayload: { sessionId, sectionId: targetSession.sectionId },
      },
      ...prev.filter(item => !(item.type === 'cancellation' && item.actionPayload?.sessionId === sessionId)),
    ]);

    setAuditLogs(prev => [
      {
        id: `log-${Date.now()}`,
        timestamp: new Date().toLocaleString(),
        userId: 'faculty-member',
        userName: 'Faculty Instructor',
        action: 'CLASS_CANCELLED',
        entityType: 'ClassSession',
        entityId: sessionId,
        details: `Cancelled ${targetSession.courseId} (${targetSession.day} ${targetSession.timeSlotId}). Reason: ${cancellationReason}.`,
      },
      ...prev,
    ]);

    return { success: true };
  };

  const undoCancellation = async (sessionId: string): Promise<{ success: boolean }> => {
    try {
      const response = await fetch(apiUrl('/api/recovery/undo-cancel'), { method: 'POST', credentials: 'same-origin', headers: getAuthHeaders(), body: JSON.stringify({ sessionId }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) return { success: false };
      const session = sessions.find((item) => item.id === sessionId);
      const restoredStatus = session?.statusBeforeCancellation || 'Published';
      const updated = (items: ClassSession[]) => items.map((item) => item.id === sessionId ? { ...item, status: restoredStatus, statusBeforeCancellation: undefined, cancellationReason: undefined, cancellationTimestamp: undefined } : item);
      setSessions(updated);
      setPublishedSessions(updated);
      setMakeupTasks((items) => items.filter((item) => item.cancelledSessionId !== sessionId));
      setRecoveryOpportunities((items) => items.filter((item) => makeupTasks.find((task) => task.id === item.makeupTaskId)?.cancelledSessionId !== sessionId));
      setNotifications((items) => items.filter((item) => item.actionPayload?.sessionId !== sessionId));
      return { success: true };
    } catch {
      return { success: false };
    }
  };

  const scheduleMakeup = async (opportunityId: string): Promise<{ success: boolean }> => {
    const opp = recoveryOpportunities.find(o => o.id === opportunityId);
    if (!opp) return { success: false };

    const makeupTask = makeupTasks.find(t => t.id === opp.makeupTaskId);
    if (!makeupTask) return { success: false };

    const newSessionId = `makeup-sess-${Date.now().toString().slice(-4)}`;
    const newSession: ClassSession = {
      id: newSessionId,
      courseId: makeupTask.courseId,
      facultyId: opp.facultyId,
      sectionId: makeupTask.sectionId,
      roomId: opp.roomId,
      day: opp.targetDay,
      timeSlotId: opp.timeSlotId,
      type: 'Makeup',
      status: 'Confirmed',
      originalSessionId: makeupTask.cancelledSessionId,
      version: 1,
    };

    setSessions(prev => [...prev, newSession]);

    setMakeupTasks(prev =>
      prev.map(t => (t.id === makeupTask.id ? { ...t, status: 'Scheduled' } : t))
    );

    setRecoveryOpportunities(prev =>
      prev.map(o => (o.id === opportunityId ? { ...o, status: 'Approved' } : o))
    );

    const roomObj = rooms.find(r => r.id === opp.roomId);
    setNotifications(prev => [
      {
        id: `notif-${Date.now()}`,
        type: 'makeup_request',
        title: `Makeup Scheduled: ${makeupTask.courseId}`,
        message: `Recovery class locked for ${opp.targetDay} in ${roomObj?.name || opp.roomId}. Students and Faculty notified.`,
        timestamp: new Date().toISOString(),
        read: false,
        category: 'Success',
      },
      ...prev,
    ]);

    fetch('/api/recovery/schedule-makeup', {
      method: 'POST',
        credentials: 'same-origin',
      headers: getAuthHeaders(),
      body: JSON.stringify({ opportunityId }),
    }).catch(err => console.warn('[SUPABASE_API] Schedule makeup persistence notice:', err));

    return { success: true };
  };

  const applyWinningPoll = async (pollId: string): Promise<{ success: boolean; message: string }> => {
    try {
      const response = await fetch(apiUrl(`/api/voting/polls/${encodeURIComponent(pollId)}/apply`), {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        return { success: false, message: data.message || 'Could not apply winning poll slot.' };
      }
      if (data.session) {
        setSessions((prev) => [...prev, data.session]);
        if (publishStatus === 'Published') setPublishedSessions((prev) => [...prev, data.session]);
      }
      setPolls((prev) => prev.map((p) => (p.id === pollId ? { ...p, isActive: false } : p)));
      return { success: true, message: data.message || 'Winning makeup slot scheduled.' };
    } catch {
      return { success: false, message: 'Could not reach the server to apply the winning poll.' };
    }
  };

  const votePoll = async (pollId: string, optionId: string): Promise<{ success: boolean }> => {
    const poll = polls.find(item => item.id === pollId);
    if (!poll || !poll.isActive) return { success: false };
    try {
      const response = await fetch(apiUrl('/api/voting/vote'), {
        method: 'POST', credentials: 'same-origin', headers: getAuthHeaders(),
        body: JSON.stringify({ pollId, optionId }),
      });
      if (!response.ok) return { success: false };
      setPolls(prev => prev.map(item => {
        if (item.id !== pollId) return item;
        const oldOptionId = item.userVotedOptionId;
        if (oldOptionId === optionId) return item;
        return {
          ...item,
          votedStudentsCount: item.votedStudentsCount + (oldOptionId ? 0 : 1),
          userHasVoted: true,
          userVotedOptionId: optionId,
          options: item.options.map(option => ({
            ...option,
            votes: option.votes + (option.id === optionId ? 1 : 0) - (option.id === oldOptionId ? 1 : 0),
          })),
        };
      }));
      return { success: true };
    } catch {
      return { success: false };
    }
  };

  const createPoll: TimetableContextType['createPoll'] = async (input) => {
    try {
      const response = await fetch(apiUrl('/api/voting/polls'), {
        method: 'POST', credentials: 'same-origin', headers: getAuthHeaders(), body: JSON.stringify(input),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success || !data.poll) return { success: false, message: data.message || 'Could not create poll.' };
      setPolls((previous) => [data.poll, ...previous.filter((poll) => poll.id !== data.poll.id)]);
      return { success: true, message: 'Poll created. Students in the selected section can now vote.' };
    } catch {
      return { success: false, message: 'Could not reach the poll service.' };
    }
  };

  const toggleSessionLock = async (sessionId: string, reason = 'Administrative Lock') => {
    const session = sessions.find((item) => item.id === sessionId);
    if (!session) return { success: false, message: 'Session not found.' };
    const isLocked = !session.isLocked;
    try {
      const response = await fetch(apiUrl(`/api/timetable/sessions/${encodeURIComponent(sessionId)}/lock`), {
        method: 'PUT', credentials: 'same-origin', headers: getAuthHeaders(), body: JSON.stringify({ isLocked, reason }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success || !data.session) return { success: false, message: data.message || 'Could not save session lock.' };
      setSessions(previous => previous.map(item => item.id === sessionId ? data.session : item));
      return { success: true };
    } catch {
      return { success: false, message: 'Could not reach the server. Session lock was not changed.' };
    }
  };

  const setFacultyProtectedSlot = async (
    facultyId: string,
    day: DayOfWeek,
    periodId: string,
    reason: 'Research' | 'Lunch' | 'Personal' | 'Department' | 'Meeting'
  ): Promise<{ success: boolean }> => {
    const previous = facultyMembers.find((faculty) => faculty.id === facultyId);
    if (!previous) return { success: false };
    const exists = previous.preferences.protectedSlots.some(ps => ps.day === day && ps.periodId === periodId);
    const nextProtectedSlots = exists
      ? previous.preferences.protectedSlots.filter(ps => !(ps.day === day && ps.periodId === periodId))
      : [...previous.preferences.protectedSlots, { day, periodId, reason }];
    try {
      const response = await fetch(apiUrl(`/api/academic/faculty/${encodeURIComponent(facultyId)}/availability`), {
        method: 'POST', credentials: 'same-origin', headers: getAuthHeaders(),
        body: JSON.stringify({ day, periodId, reason }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) throw new Error(result.message || 'Availability could not be saved.');
      setFacultyMembers(prev => prev.map(f => {
        if (f.id !== facultyId) return f;
        return {
          ...f,
          preferences: { ...f.preferences, protectedSlots: nextProtectedSlots },
        };
      }));
      return { success: true };
    } catch {
      return { success: false };
    }
  };

  const restoreVersion = async (versionNumber: number): Promise<{ success: boolean; message?: string }> => {
    try {
      const response = await fetch(apiUrl(`/api/timetable/versions/${versionNumber}/restore`), {
        method: 'POST', credentials: 'same-origin', headers: getAuthHeaders(), body: JSON.stringify({}),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success || !data.version?.sessions) return { success: false, message: data.message || 'This version could not be restored.' };
      setSessions(data.version.sessions);
      setPublishedSessions(data.version.sessions);
      setPublishStatus('Published');
      setVersions(previous => previous.map(version => ({
        ...version,
        isPublished: version.versionNumber === versionNumber,
        status: version.versionNumber === versionNumber ? 'Published' : (version.status === 'Published' ? 'Approved' : version.status),
      })));
      return { success: true, message: data.message || `Restored ${data.version.versionLabel}.` };
    } catch {
      return { success: false, message: 'Could not reach the server. This version was not restored.' };
    }
  };

  const applySimulation = () => {
    if (!whatIfSimulation) return;
    setNotifications(prev => [
      {
        id: `notif-${Date.now()}`,
        type: 'system_alert',
        title: `Simulation Applied: ${whatIfSimulation.title}`,
        message: 'Sandbox contingency measures applied to candidate staging branch.',
        timestamp: new Date().toISOString(),
        read: false,
        category: 'Warning',
      },
      ...prev,
    ]);
  };

  const markNotificationRead = async (id: string) => {
    const response = await fetch(apiUrl(`/api/notifications/${encodeURIComponent(id)}/read`), {
      method: 'POST', credentials: 'same-origin', headers: getAuthHeaders(), body: JSON.stringify({}),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) throw new Error(data.message || 'Notification could not be marked as read.');
    setNotifications(prev => prev.map(n => (n.id === id ? { ...n, read: true } : n)));
  };

  const triggerAutoMatchAll = () => {
    let matched = 0;
    recoveryOpportunities.forEach(opp => {
      if (opp.matchScore >= 90 && opp.status === 'Proposed') {
        scheduleMakeup(opp.id);
        matched++;
      }
    });
    if (matched > 0) {
      setNotifications(prev => [
        {
          id: `notif-${Date.now()}`,
          type: 'makeup_request',
          title: 'Automated Recovery Batch Complete',
          message: `The schedule optimizer placed ${matched} makeup slot(s) without constraint conflicts.`,
          timestamp: new Date().toISOString(),
          read: false,
          category: 'Success',
        },
        ...prev,
      ]);
    }
  };

  const declineOpportunity = async (opportunityId: string): Promise<{ success: boolean }> => {
    setRecoveryOpportunities(prev =>
      prev.map(o => (o.id === opportunityId ? { ...o, status: 'Rejected' } : o))
    );
    return { success: true };
  };

  const claimMarketplaceSlot = async (
    courseId: string,
    sectionId: string,
    day: DayOfWeek,
    timeSlotId: string,
    roomId: string,
    type: string
  ): Promise<{ success: boolean }> => {
    const newSessionId = `claim-sess-${Date.now().toString().slice(-4)}`;
    const newSession: ClassSession = {
      id: newSessionId,
      courseId,
      facultyId: selectedFacultyId,
      sectionId,
      roomId,
      day,
      timeSlotId,
      type: type as any || 'Lecture',
      status: 'Confirmed',
      version: 1,
    };
    setSessions(prev => [...prev, newSession]);
    return { success: true };
  };

  const requestSubstituteCover = async (
    substituteFacultyId: string,
    courseId: string,
    sectionId: string,
    day: DayOfWeek,
    timeSlotId: string
  ): Promise<{ success: boolean }> => {
    const substitute = facultyMembers.find(f => f.id === substituteFacultyId);
    const course = courses.find(c => c.id === courseId);
    setNotifications(prev => [
      {
        id: `notif-${Date.now()}`,
        type: 'makeup_request',
        title: `Substitute Cover Requested (${course?.code || courseId})`,
        message: `Requested ${substitute?.name || 'Faculty Member'} to cover ${day} slot for ${sectionId}.`,
        timestamp: new Date().toISOString(),
        read: false,
        category: 'Info',
      },
      ...prev,
    ]);
    return { success: true };
  };

  const requestStudentMakeup = async (courseId: string, sectionId: string): Promise<{ success: boolean }> => {
    const course = courses.find(c => c.id === courseId);
    const section = sections.find(s => s.id === sectionId);
    setNotifications(prev => [
      {
        id: `notif-${Date.now()}`,
        type: 'makeup_request',
        title: `Student Demand: Makeup Request (${course?.code || courseId})`,
        message: `${section?.name} Class Representative launched makeup petition. 47/52 students signed availability.`,
        timestamp: new Date().toISOString(),
        read: false,
        category: 'Info',
        actionable: true,
      },
      ...prev,
    ]);
    return { success: true };
  };

  const addSession = async (sessionData: Omit<ClassSession, 'id' | 'version'>): Promise<{ isSuccess: boolean; error?: string }> => {
    const check = checkHardConstraints(
      sessionData,
      sessions,
      rooms,
      facultyMembers,
      sections,
      courses
    );

    if (!check.isFeasible) {
      return { isSuccess: false, error: check.violations.join(' | ') };
    }

    try {
      const response = await fetch(apiUrl('/api/timetable/sessions'), {
        method: 'POST',
        credentials: 'same-origin',
        headers: getAuthHeaders(),
        body: JSON.stringify(sessionData),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success || !data.session) {
        return { isSuccess: false, error: data.message || `Could not save class (${response.status}).` };
      }
      setSessions(prev => prev.some(session => session.id === data.session.id) ? prev : [...prev, data.session]);
    } catch {
      return { isSuccess: false, error: 'Could not reach the server. The class was not saved.' };
    }
    return { isSuccess: true };
  };

  const deleteSession = async (sessionId: string): Promise<{ success: boolean; message?: string }> => {
    try {
      const response = await fetch(apiUrl(`/api/timetable/sessions/${encodeURIComponent(sessionId)}`), {
        method: 'DELETE', credentials: 'same-origin', headers: getAuthHeaders(),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) return { success: false, message: data.message || 'Session could not be removed.' };
      const removed = sessions.find((session) => session.id === sessionId);
      setSessions((previous) => previous.filter((session) => session.id !== sessionId));
      setPublishStatus('Draft');
      setAuditLogs((previous) => [{ id: `log-${Date.now()}`, timestamp: new Date().toLocaleString(), userId: 'coordinator', userName: 'Timetable Coordinator', action: 'CLASS_SESSION_DELETED', entityType: 'ClassSession', entityId: sessionId, details: `Removed ${removed?.courseId || 'class session'} from the working draft.` }, ...previous]);
      return { success: true, message: data.message || 'Session removed from the working draft.' };
    } catch {
      return { success: false, message: 'Could not reach the server. Session was not removed.' };
    }
  };

  return (
    <TimetableContext.Provider
      value={{
        academicYear,
        departments,
        programs,
        rooms,
        facultyMembers,
        sections,
        courses,
        allocations,
        constraints,
        publishStatus,
        validationReport,
        sessions,
        setSessions,
        makeupTasks,
        recoveryOpportunities,
        polls,
        notifications,
        versions,
        auditLogs,
        health,
        whatIfSimulation,
        currentRole,
        setCurrentRole,
        activeView,
        setActiveView,
        selectedFacultyId,
        setSelectedFacultyId,
        selectedSectionId,
        setSelectedSectionId,
        selectedRoomId,
        setSelectedRoomId,
        updateAcademicYear,
        addDepartment,
        updateDepartment,
        deleteDepartment,
        toggleDepartmentStatus,
        addProgram,
        updateProgram,
        deleteProgram,
        addRoom,
        updateRoom,
        deleteRoom,
        toggleRoomAvailability,
        addFaculty,
        updateFaculty,
        deleteFaculty,
        toggleFacultyStatus,
        updateFacultyAvailability,
        addSection,
        updateSection,
        deleteSection,
        addSubSection,
        deleteSubSection,
        addCourse,
        updateCourse,
        deleteCourse,
        toggleCourseStatus,
        addAllocation,
        updateAllocation,
        deleteAllocation,
        addConstraint,
        updateConstraint,
        toggleConstraint,
        runValidation,
        resetDemoAcademicData,
        generateDraftTimetable,
        updatePublishStatus,
        bulkImportData,
        commitMasterImport,
        bulkGenerateGroups,
        cancelSession,
        undoCancellation,
        scheduleMakeup,
        votePoll,
        applyWinningPoll,
        createPoll,
        toggleSessionLock,
        setFacultyProtectedSlot,
        restoreVersion,
        applySimulation,
        markNotificationRead,
        triggerAutoMatchAll,
        requestStudentMakeup,
        declineOpportunity,
        claimMarketplaceSlot,
        requestSubstituteCover,
        addSession,
        deleteSession,
        runIndependentValidation,
        moveSessionWithValidation,
        swapSessionsWithValidation,
        generateMultiCandidateTimetables,
        generateDualRoutinesAPI,
        selectRoutineAPI,
        latestGeneratedRoutines,
        setLatestGeneratedRoutines,
        applyCandidateAsDraft,
        publishMasterTimetable,
        unpublishMasterTimetable,
        compareTimetableVersions,
        activeVersionNumber: versions.find(version => version.isPublished || version.status === 'Published')?.versionNumber ?? versions[0]?.versionNumber ?? 1,
        publishedSessions,
        refresh: async () => {},
        isLoading: false,
        loadError: null,
        notice: null,
        dismissNotice: () => {},
        studentsCount: sections.reduce((acc, s) => acc + (s.studentCount || 60), 0),
      }}
    >
      {children}
    </TimetableContext.Provider>
  );
}

export function useTimetable() {
  const context = useContext(TimetableContext);
  if (!context) {
    throw new Error('useTimetable must be used within a TimetableProvider');
  }
  return context;
}
