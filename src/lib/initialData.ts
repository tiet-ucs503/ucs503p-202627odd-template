import {
  AcademicYearConfig,
  TimeSlot,
  Department,
  Program,
  Course,
  Faculty,
  Room,
  StudentSection,
  CourseAllocation,
  AcademicConstraint,
  ClassSession,
  TimetableVersion,
  MakeupTask,
  RecoveryOpportunity,
  StudentPoll,
  NotificationItem,
  WhatIfSimulation,
} from '../types';
import thirdYearDataset from '../server/thirdYearDataset.json';

export interface StudentRecord {
  id: string;
  rollNumber: string;
  name: string;
  email: string;
  department: string;
  departmentId?: string;
  programId?: string;
  semester: number;
  sectionId: string;
  batch: string;
  elective?: string;
  secondElective?: string;
}

const ds = thirdYearDataset as unknown as {
  academicYear: AcademicYearConfig;
  departments: Department[];
  programs: Program[];
  courses: Course[];
  facultyMembers: Faculty[];
  rooms: Room[];
  sections: StudentSection[];
  students: StudentRecord[];
  allocations: CourseAllocation[];
  sessions: ClassSession[];
};

export const TIME_SLOTS: TimeSlot[] = ds.academicYear.timeSlots;
export const INITIAL_ACADEMIC_YEAR: AcademicYearConfig = ds.academicYear;
export const DEPARTMENTS: Department[] = ds.departments;
export const PROGRAMS: Program[] = ds.programs;
export const FACULTY_MEMBERS: Faculty[] = ds.facultyMembers;
export const ROOMS: Room[] = ds.rooms;
export const SECTIONS: StudentSection[] = ds.sections;
export const STUDENTS: StudentRecord[] = ds.students;
export const COURSES: Course[] = ds.courses;
export const INITIAL_ALLOCATIONS: CourseAllocation[] = ds.allocations;

export const INITIAL_CONSTRAINTS: AcademicConstraint[] = [
  { id: 'const-1', code: 'NO_TEACHER_COLLISION', name: 'Faculty Double Booking Prohibition', type: 'Hard', description: 'No instructor may teach 2+ sessions concurrently.', isActive: true },
  { id: 'const-2', code: 'NO_ROOM_COLLISION', name: 'Facility Double Booking Prohibition', type: 'Hard', description: 'No classroom or lab may host 2+ sessions concurrently.', isActive: true },
  { id: 'const-3', code: 'NO_STUDENT_COLLISION', name: 'Cohort Collision Prohibition', type: 'Hard', description: 'No student section or subgroup may be assigned overlapping classes.', isActive: true },
  { id: 'const-4', code: 'CAPACITY_COMPLIANCE', name: 'Seating Capacity Enforcement', type: 'Hard', description: 'Room capacity must meet or exceed cohort size (30 practical / 250 lecture).', isActive: true },
  { id: 'const-5', code: 'PERIOD_BOUNDARY', name: 'Institutional Period Timing (08:00–19:40)', type: 'Hard', description: 'All classes follow the 14 fifty-minute periods from 08:00 to 19:40, Monday to Friday.', isActive: true },
];

export const INITIAL_SESSIONS: ClassSession[] = ds.sessions;

export const INITIAL_VERSIONS: TimetableVersion[] = [
  {
    id: 'ver-1',
    versionNumber: 1,
    versionLabel: 'V1.0 — Third-Year Computer Branches (Jul–Dec 2026)',
    label: 'V1.0 — Third-Year Computer Branches (Jul–Dec 2026)',
    academicYearId: INITIAL_ACADEMIC_YEAR.id,
    createdAt: INITIAL_ACADEMIC_YEAR.publishedAt || new Date().toISOString(),
    createdBy: 'usr-hod',
    createdById: 'usr-hod',
    createdByName: 'Third-Year Dataset Import',
    status: 'Published',
    isPublished: true,
    reason: 'Published baseline timetable loaded from third_year_computer_synthetic_dataset.xlsx (617 conflict-free sessions).',
    sessionsCount: INITIAL_SESSIONS.length,
    hardViolationsCount: 0,
    healthScore: 98,
    changeSummary: 'Loaded 4 branches, 37 courses, 149 faculty, 60 rooms, 68 subgroups, 1,847 students, and 617 conflict-free sessions.',
    sessions: INITIAL_SESSIONS,
  },
];

export const INITIAL_MAKEUP_TASKS: MakeupTask[] = [];
export const INITIAL_RECOVERY_OPPORTUNITIES: RecoveryOpportunity[] = [];
export const INITIAL_POLLS: StudentPoll[] = [];
export const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'notif-third-year-loaded',
    recipientRole: 'HOD',
    title: 'Third-Year Computer Dataset Active',
    message: 'Dataset THIRD-YEAR-COMPUTER-2026 (1,847 students, 149 faculty, 68 subgroups, 37 courses, 60 rooms, 617 sessions) loaded cleanly.',
    type: 'timetable_published',
    timestamp: INITIAL_ACADEMIC_YEAR.publishedAt || new Date().toISOString(),
    read: false,
    category: 'Info',
  },
];

export const INITIAL_WHAT_IF_SIMULATION: WhatIfSimulation = {
  id: 'sim-baseline',
  title: 'Baseline Operational Model (Third-Year Computer Branches)',
  scenarioType: 'FacultyOnLeave',
  parameters: {},
  impact: {
    affectedClassesCount: 0,
    requiredRoomChanges: 0,
    newHardConflicts: 0,
    stabilityScore: 100,
    projectedHealthScore: 98,
    affectedFacultyNames: [],
    affectedSectionNames: [],
  },
  suggestedActions: [],
};
