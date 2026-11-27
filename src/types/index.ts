export type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday';

export interface TimeSlot {
  id: string;
  periodNumber: number;
  startTime: string; // e.g. "08:00"
  endTime: string;   // e.g. "09:00"
  label: string;     // e.g. "08:00 - 09:00"
  isBreak?: boolean;
  isLunch?: boolean;
}

export type SessionType = 'Lecture' | 'Lab' | 'Tutorial' | 'Practical' | 'Elective' | 'Makeup' | 'Seminar';

export type SessionStatus = 'Planned' | 'Confirmed' | 'Published' | 'Cancelled' | 'Rescheduled' | 'Completed';

export type TimetablePublishStatus = 'Draft' | 'Review' | 'Approved' | 'Published';

export interface AcademicYearConfig {
  id: string;
  yearLabel: string; // e.g. "2026 - 2027"
  semesterType: 'Odd (Autumn)' | 'Even (Spring)' | 'Summer';
  semesterNumber: number; // e.g. 5
  workingDays: DayOfWeek[];
  timeSlots: TimeSlot[];
  lunchPeriodId: string;
  publishStatus: TimetablePublishStatus;
  approvedBy?: string;
  approvedAt?: string;
  publishedAt?: string;
  buildingTravelMinutes?: Record<string, Record<string, number>>;
}

export interface Department {
  id: string;
  name: string;
  code: string; // e.g. "CSED", "ECED", "SMAT"
  hodName: string;
  contactEmail: string;
  status: 'Active' | 'Inactive';
}

export interface Program {
  id: string;
  name: string;
  code: string; // e.g. "BTECH-CSE", "BTECH-ECE"
  departmentId: string;
  durationYears: number;
  totalSemesters: number;
  status: 'Active' | 'Inactive';
}

export interface Room {
  id: string;
  name: string;
  building: string;
  floor: number;
  capacity: number;
  type: 'LectureHall' | 'ComputerLab' | 'HardwareLab' | 'SeminarRoom' | 'TutorialRoom';
  equipment: string[];
  isAvailable: boolean;
  departmentId?: string;
  maintenanceNote?: string;
}

export interface FacultyPreference {
  preferredDays: DayOfWeek[];
  preferredPeriods: number[]; // period numbers
  protectedSlots: { day: DayOfWeek; periodId: string; reason: 'Research' | 'Lunch' | 'Personal' | 'Department' | 'Meeting' }[];
  maxConsecutivePeriods: number;
  availableForMakeup: boolean;
  availableForTutorial: boolean;
}

export interface Faculty {
  id: string;
  name: string;
  employeeId?: string;
  email: string;
  departmentId: string;
  designation: 'Professor' | 'Associate Professor' | 'Assistant Professor' | 'Visiting Faculty';
  subjectsQualified: string[];
  maxDirectTeachingHours: number; // e.g. 14 for Assoc/Prof, 16 for Asst Prof per UGC
  weeklyHoursLimit: number;       // 40 hours standard
  preferences: FacultyPreference;
  avatarUrl?: string;
  status?: 'Active' | 'OnLeave' | 'Inactive';
}

export interface Course {
  id: string;
  code: string;
  name: string;
  departmentId: string;
  programId?: string;
  semester?: number;
  credits: number;
  requiredLecturesPerWeek: number;
  requiredTutorialsPerWeek: number;
  requiredLabsPerWeek: number;
  totalSemesterHours: number;
  completedHours: number;
  cancelledHours: number;
  requiresLab: boolean;
  requiredEquipment: string[];
  primaryFacultyId: string;
  status?: 'Active' | 'Archived';
}

export interface SubSection {
  id: string;
  sectionId: string;
  name: string; // e.g. "A1", "A2"
  studentCount: number;
  type?: 'Lab' | 'Tutorial' | 'Practical' | 'General';
}

export interface StudentSection {
  id: string;
  name: string; // e.g. "CSE-A", "CSE-B", "ECE-A"
  departmentId: string;
  program: string; // e.g. "B.Tech Computer Science"
  programId?: string;
  semester: number;
  batchYear: number;
  studentCount: number;
  targetSize?: number;
  maxSize?: number;
  subSections?: SubSection[];
  classRepresentative: {
    name: string;
    email: string;
    studentId: string;
  };
  homeRoomId?: string;
  status?: 'Active' | 'Inactive';
}

export interface CourseAllocation {
  id: string;
  courseId: string;
  facultyId: string;
  sectionId: string;
  subSectionId?: string;
  sessionType: SessionType;
  hoursPerWeek: number;
  durationPeriods?: number; // 1 for Lecture/Tutorial, 2 or 3 for Lab blocks
  preferredRoomId?: string;
  electiveGroupId?: string;
  isPinned?: boolean;
  pinnedDay?: DayOfWeek;
  pinnedTimeSlotId?: string;
  pinnedRoomId?: string;
  status: 'Allocated' | 'Pending' | 'Conflict';
}

export interface AcademicConstraint {
  id: string;
  code?: string;
  name: string;
  type: 'Hard' | 'Soft';
  category?: 'Faculty' | 'Room' | 'Section' | 'Workload' | 'TimeSlot';
  description: string;
  isActive: boolean;
  parameterValue?: string | number;
}

export interface ValidationItem {
  id: string;
  title: string;
  category: string;
  status: 'Passed' | 'Warning' | 'Error';
  message: string;
  fixTab?: string;
}

export interface ValidationReport {
  isReadyForGeneration: boolean;
  passedCount: number;
  warningCount: number;
  errorCount: number;
  hardViolationsCount?: number;
  items: ValidationItem[];
}

export interface ClassSession {
  id: string;
  allocationId?: string;
  courseId: string;
  facultyId: string;
  sectionId: string;
  subSectionId?: string;
  roomId: string;
  day: DayOfWeek;
  timeSlotId: string;
  durationPeriods?: number; // Number of periods spanned (default 1)
  type: SessionType;
  status: SessionStatus;
  isLocked?: boolean;
  lockReason?: string;
  isPinned?: boolean;
  electiveGroupId?: string;
  cancellationReason?: string;
  cancellationTimestamp?: string;
  statusBeforeCancellation?: SessionStatus;
  originalSessionId?: string; // If this is a rescheduled makeup
  version: number;
}

export interface TimetableLock {
  id: string;
  entityType: 'Faculty' | 'Class' | 'Room' | 'TimeSlot' | 'Department';
  entityId: string;
  lockedBy: string;
  lockedAt: string;
  reason: string;
}

export interface TimetableVersion {
  id?: string;
  versionNumber: number;
  versionLabel: string; // e.g. "Master V1.0", "Candidate V1.1"
  label?: string;
  academicYearId?: string;
  createdAt: string;
  createdBy: string;
  createdById?: string;
  createdByName?: string;
  status?: string;
  changeSummary: string;
  reason: string;
  isPublished: boolean;
  healthScore: number;
  sessionsCount?: number;
  hardViolationsCount?: number;
  sessions: ClassSession[];
}

export interface MakeupTask {
  id: string;
  cancelledSessionId: string;
  courseId: string;
  sectionId: string;
  facultyId: string;
  cancelledDay: DayOfWeek;
  cancelledTimeSlot: string;
  priorityScore: number; // 0 - 100 based on syllabus delay, exams, credit weight
  status: 'Pending' | 'ProposalsGenerated' | 'AcceptedByFaculty' | 'ApprovedByCoordinator' | 'Scheduled' | 'Dismissed';
  createdAt: string;
}

export interface RecoveryOpportunity {
  id: string;
  makeupTaskId: string;
  targetDay: DayOfWeek;
  timeSlotId: string;
  roomId: string;
  facultyId: string;
  matchScore: number; // 0 - 100 calculated by recovery weighted formula
  factors: {
    teacherAvailability: number;
    studentAvailability: number;
    roomSuitability: number;
    syllabusUrgency: number;
    preferenceScore: number;
    stabilityImpact: number;
  };
  rationale: string;
  conflictCheckPassed: boolean;
  status: 'Proposed' | 'Accepted' | 'Rejected' | 'Approved';
}

export interface StudentPoll {
  id: string;
  makeupTaskId: string;
  courseId: string;
  sectionId: string;
  question: string;
  options: {
    id: string;
    day: DayOfWeek;
    timeSlotLabel: string;
    votes: number;
    isSystemRecommended: boolean;
  }[];
  totalEligibleStudents: number;
  votedStudentsCount: number;
  userHasVoted?: boolean;
  userVotedOptionId?: string;
  isActive: boolean;
  expiresAt: string;
}

export interface NotificationItem {
  id: string;
  recipientRole?: string;
  type: 'cancellation' | 'room_change' | 'makeup_request' | 'approval_needed' | 'poll_created' | 'system_alert' | 'timetable_published';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  category?: 'Critical' | 'Warning' | 'Info' | 'Success';
  actionable?: boolean;
  actionPayload?: any;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: string;
  entityType: string;
  entityId: string;
  details: string;
  previousValue?: string;
  newValue?: string;
}

export interface SystemHealthMetrics {
  overallScore: number;
  hardConstraintViolations: number;
  facultyBalanceScore: number;
  studentBalanceScore: number;
  roomUtilizationRate: number;
  facultyPreferencesSatisfaction: number;
  scheduleStabilityScore: number;
  syllabusAlignmentScore: number;
}

export interface FreezeWindowPolicy {
  emergencyThresholdHours: number; // < 24 hrs
  approvalRequiredThresholdHours: number; // 24 - 72 hrs
  flexibleThresholdDays: number; // > 7 days
}

export interface RegulatoryProfile {
  name: string; // e.g. "UGC 2026 Academic Regulations"
  workingDaysPerWeek: number; // 5 or 6
  maxWeeklyTeachingAssocProf: number; // 14
  maxWeeklyTeachingAsstProf: number; // 16
  minWeeklyInstitutionalHours: number; // 40
  lunchProtectionEnforced: boolean;
  maxConsecutiveHoursAllowed: number; // 3
}

export interface WhatIfSimulation {
  id: string;
  title: string;
  scenarioType: 'RoomUnavailable' | 'FacultyOnLeave' | 'BatchSplit' | 'MandatoryHoliday';
  parameters: {
    targetEntityId?: string;
    startDate?: string;
    endDate?: string;
    affectedDay?: DayOfWeek;
  };
  impact: {
    affectedClassesCount: number;
    requiredRoomChanges: number;
    newHardConflicts: number;
    stabilityScore: number;
    projectedHealthScore: number;
    affectedFacultyNames: string[];
    affectedSectionNames: string[];
  };
  suggestedActions: string[];
}

// ----------------------------------------------------
// Production Institutional Auth & RBAC Architecture
// (auth.users, auth.memberships, auth.role_assignments)
// ----------------------------------------------------

export interface Institution {
  id: string;
  name: string;
  code: string;
  domain: string; // e.g. "apex.edu.in"
  status: 'ACTIVE' | 'SUSPENDED';
  location: string;
  establishedYear: number;
}

export type WorkspaceType = 'Student' | 'CR' | 'Faculty' | 'Coordinator' | 'HOD' | 'Admin';

export type RoleCode =
  | 'SUPER_ADMIN'
  | 'COLLEGE_ADMIN'
  | 'COORDINATOR'
  | 'HOD'
  | 'FACULTY'
  | 'CLASS_REPRESENTATIVE'
  | 'STUDENT';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  passwordHash?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'LOCKED';
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string;
  avatarUrl?: string;
  phone?: string;
  department?: string;
  officeLocation?: string;
  officeHours?: string;
  rollNumber?: string;
  sectionId?: string;
  subSectionId?: string;
  crSectionId?: string;
  facultyId?: string;
  batch?: string;
  specialization?: string;
  twoFactorEnabled?: boolean;
  ssoProvider?: string;
  ipAddress?: string;
  authorizedWorkspaces?: WorkspaceType[];
  isDemoUser?: boolean;
  notificationPreferences?: Record<string, boolean>;
  hasPassword?: boolean;
  roleCode?: RoleCode | string;
  roleName?: string;
}

export interface Role {
  id: string;
  code: 'SUPER_ADMIN' | 'COLLEGE_ADMIN' | 'COORDINATOR' | 'HOD' | 'FACULTY' | 'CLASS_REPRESENTATIVE' | 'STUDENT';
  name: string;
  description: string;
}

export interface Permission {
  id: string;
  code: string;
  name: string;
  module: 'TIMETABLE' | 'RECOVERY' | 'FACULTY' | 'STUDENT' | 'AUTH' | 'POLICY' | 'AUDIT';
  description: string;
}

export interface Membership {
  id: string;
  userId: string;
  institutionId: string;
  roleId: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'REVOKED';
  createdAt: string;
  updatedAt: string;
  assignedBy: string;
}

export interface RoleAssignment {
  id: string;
  institutionId: string;
  email: string;
  roleId: string;
  status: 'PRE_AUTHORIZED' | 'CLAIMED' | 'EXPIRED';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Invitation {
  id: string;
  institutionId: string;
  email: string;
  roleId: string;
  token: string;
  status: 'PENDING' | 'ACCEPTED' | 'REVOKED';
  expiresAt: string;
  invitedBy: string;
}

export interface AuthSession {
  id: string;
  userId: string;
  institutionId: string;
  roleId: string;
  token: string;
  createdAt: string;
  expiresAt: string;
  lastActiveAt: string;
  isRevoked: boolean;
}

export interface PasswordResetToken {
  id: string;
  email: string;
  tokenHash: string;
  token: string;
  expiresAt: string;
  isUsed: boolean;
  createdAt: string;
}

export type OptimizationProfile = 'STUDENT_FOCUSED' | 'FACULTY_FOCUSED' | 'BALANCED';

export interface RoutineValidation {
  valid: boolean;
  hardViolations: number;
  unscheduled: number;
  studentConflicts: number;
  facultyConflicts: number;
  roomConflicts: number;
  capacityViolations: number;
  availabilityViolations: number;
  blockingReasons?: string[];
}

export interface RoutineMetrics {
  studentGaps: number;
  facultyGaps: number;
  roomUtilization: number;
  labUtilization: number;
  sameCourseSameDayCount?: number;
  sameCourseConsecutiveCount?: number;
  avgStudentDailyLoad?: number;
  maxStudentDailyLoad?: number;
  avgFacultyDailyLoad?: number;
  maxFacultyDailyLoad?: number;
  courseDistributionQualityRate?: number;
}

export interface GenerationRoutine {
  id: string;
  label: string;
  description?: string;
  optimizationProfile: OptimizationProfile;
  versionId?: string;
  versionNumber?: number;
  sessions: ClassSession[];
  validation: RoutineValidation;
  metrics: RoutineMetrics;
  healthScore: number;
}

export interface GenerationResponse {
  success: boolean;
  isFeasible: boolean;
  routines: GenerationRoutine[];
  message?: string;
  infeasibilityDiagnostics?: string[];
  sessionsGenerated?: number;
  timestamp?: string;
  error?: string;
}
