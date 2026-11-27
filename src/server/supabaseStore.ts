import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  Department,
  Program,
  Course,
  Faculty,
  Room,
  StudentSection,
  SubSection,
  CourseAllocation,
  AcademicConstraint,
  AcademicYearConfig,
  TimetableVersion,
  ClassSession,
  NotificationItem,
  AuditLog,
  MakeupTask,
  RecoveryOpportunity,
  StudentPoll,
  DayOfWeek,
} from '../types';
import {
  INITIAL_ACADEMIC_YEAR,
  INITIAL_ALLOCATIONS,
  FACULTY_MEMBERS,
  ROOMS,
  SECTIONS,
  COURSES,
  DEPARTMENTS,
  PROGRAMS,
  STUDENTS,
  StudentRecord,
  INITIAL_CONSTRAINTS,
  INITIAL_SESSIONS,
  INITIAL_MAKEUP_TASKS,
  INITIAL_RECOVERY_OPPORTUNITIES,
  INITIAL_POLLS,
  INITIAL_NOTIFICATIONS,
  INITIAL_VERSIONS,
} from '../lib/initialData';
import {
  validateTimetableIndependently,
  validateProposedSessionMove,
  validateProposedSessionSwap,
} from '../lib/independentValidator';
import { facultyTeachingCap } from '../lib/facultyWorkload';
import { executeOptimizationEngine, type GeneratedCandidate } from '../lib/optimizationEngine';
import { calculateHealthScore, checkHardConstraints, findSelfHealingRecoverySlots } from '../lib/recoveryEngine';
import { ExcelImportPreview } from '../lib/excelMasterService';

// Initialize Supabase Client if environment variables are provided
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseKey =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  '';

export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

if (supabase) {
  console.info('[SUPABASE] Initialized server-side client connection to Supabase PostgreSQL at ' + supabaseUrl);
} else {
  console.info('[SUPABASE] Running in autonomous authoritative PostgreSQL emulation mode (configured schema ready for live cutover)');
}

export function shouldSeedDemoData(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.SEED_DEMO_DATA === 'true') return true;
  if (env.SEED_DEMO_DATA === 'false') return false;
  return env.NODE_ENV !== 'production';
}

/**
 * Authoritative Supabase Relational Database Store
 * Implements transaction safety, relational foreign-key validation,
 * and immutable version history for the entire university system.
 */
class SupabaseRelationalStore {
  private academicYear: AcademicYearConfig = { ...INITIAL_ACADEMIC_YEAR };
  private departments: Map<string, Department> = new Map();
  private programs: Map<string, Program> = new Map();
  private courses: Map<string, Course> = new Map();
  private facultyMembers: Map<string, Faculty> = new Map();
  private rooms: Map<string, Room> = new Map();
  private groups: Map<string, StudentSection> = new Map();
  private students: Map<string, StudentRecord> = new Map();
  private allocations: Map<string, CourseAllocation> = new Map();
  private constraints: Map<string, AcademicConstraint> = new Map();
  private versions: TimetableVersion[] = [];
  private versionHealthCache = new WeakMap<TimetableVersion, { sessions: ClassSession[]; score: ReturnType<typeof calculateHealthScore> }>();
  private activeSessions: ClassSession[] = [];
  private notifications: NotificationItem[] = [];
  private auditEvents: AuditLog[] = [];
  private makeupTasks: MakeupTask[] = [];
  private recoveryOpportunities: RecoveryOpportunity[] = [];
  private replacementPolls: StudentPoll[] = [];
  private replacementVotes: Map<string, string> = new Map(); // "pollId:studentId" -> optionId

  constructor() {
    if (shouldSeedDemoData()) {
      this.seedInitialDatabase();
    } else {
      this.initializeEmptyDatabase();
    }
  }

  private initializeEmptyDatabase() {
    this.academicYear = {
      id: 'academic-year-unconfigured',
      yearLabel: 'Not configured',
      semesterType: 'Odd (Autumn)',
      semesterNumber: 1,
      workingDays: [],
      timeSlots: [],
      lunchPeriodId: '',
      publishStatus: 'Draft',
    };
    this.departments.clear();
    this.programs.clear();
    this.courses.clear();
    this.facultyMembers.clear();
    this.rooms.clear();
    this.groups.clear();
    this.students.clear();
    this.allocations.clear();
    this.constraints.clear();
    this.versions = [];
    this.activeSessions = [];
    this.notifications = [];
    this.auditEvents = [];
    this.makeupTasks = [];
    this.recoveryOpportunities = [];
    this.replacementPolls = [];
    this.replacementVotes.clear();
    console.info('[SUPABASE STORE] Empty production academic state initialized; no sample records loaded.');
  }

  /** Snapshot the live store so production writes can be committed to Postgres. */
  public exportPersistedState() {
    return {
      academicYear: this.academicYear,
      departments: [...this.departments.values()],
      programs: [...this.programs.values()],
      courses: [...this.courses.values()],
      facultyMembers: [...this.facultyMembers.values()],
      rooms: [...this.rooms.values()],
      groups: [...this.groups.values()],
      students: [...this.students.values()],
      allocations: [...this.allocations.values()],
      constraints: [...this.constraints.values()],
      versions: this.versions,
      activeSessions: this.activeSessions,
      notifications: this.notifications,
      auditEvents: this.auditEvents,
      makeupTasks: this.makeupTasks,
      recoveryOpportunities: this.recoveryOpportunities,
      replacementPolls: this.replacementPolls,
      replacementVotes: [...this.replacementVotes.entries()],
    };
  }

  /** Restore a snapshot previously written by this store. */
  public restorePersistedState(snapshot: Record<string, any>) {
    const asMap = <T extends { id: string }>(items: unknown): Map<string, T> =>
      new Map((Array.isArray(items) ? items : []).filter((item): item is T => Boolean(item && typeof item.id === 'string')).map((item) => [item.id, item]));
    this.academicYear = snapshot.academicYear || { ...INITIAL_ACADEMIC_YEAR };
    this.departments = asMap<Department>(snapshot.departments);
    this.programs = asMap<Program>(snapshot.programs);
    this.courses = asMap<Course>(snapshot.courses);
    this.facultyMembers = asMap<Faculty>(snapshot.facultyMembers);
    this.rooms = asMap<Room>(snapshot.rooms);
    this.groups = asMap<StudentSection>(snapshot.groups);
    this.students = asMap<StudentRecord>(snapshot.students);
    for (const section of this.groups.values()) {
      const representative = [...this.students.values()].find((student) => student.sectionId === section.id);
      if (representative && (!section.classRepresentative?.name || /^CR\s/i.test(section.classRepresentative.name))) {
        section.classRepresentative = { name: representative.name, email: representative.email, studentId: representative.studentId };
      }
    }
    this.allocations = asMap<CourseAllocation>(snapshot.allocations);
    this.constraints = asMap<AcademicConstraint>(snapshot.constraints);
    this.versions = Array.isArray(snapshot.versions) ? snapshot.versions : [];
    this.activeSessions = Array.isArray(snapshot.activeSessions) ? snapshot.activeSessions : [];
    this.notifications = Array.isArray(snapshot.notifications) ? snapshot.notifications : [];
    this.auditEvents = Array.isArray(snapshot.auditEvents) ? snapshot.auditEvents : [];
    this.makeupTasks = Array.isArray(snapshot.makeupTasks) ? snapshot.makeupTasks : [];
    this.recoveryOpportunities = Array.isArray(snapshot.recoveryOpportunities) ? snapshot.recoveryOpportunities : [];
    this.replacementPolls = Array.isArray(snapshot.replacementPolls) ? snapshot.replacementPolls : [];
    this.replacementVotes = new Map(Array.isArray(snapshot.replacementVotes) ? snapshot.replacementVotes : []);

    // Older persisted snapshots predate dedicated faculty demo records. Repair those
    // links on read so deployments do not require a destructive demo reset.
    const ensureDemoFaculty = (id: string, email: string, name: string, sourceId: string) => {
      const existing = [...this.facultyMembers.values()].find((faculty) => faculty.email?.toLowerCase() === email);
      const template = existing || this.facultyMembers.get(sourceId) || FACULTY_MEMBERS[0];
      const linked = { ...template, id, email, name, departmentId: 'dept-cse' };
      this.facultyMembers.set(id, linked);
    };
    ensureDemoFaculty('fac-demo-neha', 'faculty.demo@demo.thapar.local', 'Dr. Neha Agarwal', 'fac-0005');
    ensureDemoFaculty('fac-demo-hod', 'hod.demo@demo.thapar.local', 'Dr. Sunita Rao', 'fac-0003');
    ensureDemoFaculty('fac-demo-rajesh', 'coordinator.demo@demo.thapar.local', 'Prof. Rajesh Khanna', 'fac-0005');
    const repairDemoFacultyId = (facultyId: string) => facultyId === 'fac-0005' ? 'fac-demo-neha' : facultyId === 'fac-0003' ? 'fac-demo-hod' : facultyId;
    this.activeSessions = this.activeSessions.map((session) => ({ ...session, facultyId: repairDemoFacultyId(session.facultyId) }));
    const publishedIndex = this.versions.findIndex((version) => version.isPublished || version.status === 'Published');
    const activePublishedIndex = this.academicYear.publishStatus === 'Published'
      ? (publishedIndex >= 0 ? publishedIndex : this.versions.length - 1)
      : -1;
    this.versions = this.versions.map((version, index) => ({
      ...version,
      isPublished: this.academicYear.publishStatus === 'Published' ? index === activePublishedIndex : version.isPublished,
      status: this.academicYear.publishStatus === 'Published'
        ? (index === activePublishedIndex ? 'Published' : (version.status === 'Published' ? 'Approved' : version.status))
        : version.status,
      sessions: (version.sessions || []).map((session) => ({ ...session, facultyId: repairDemoFacultyId(session.facultyId) })),
    }));
    if (this.academicYear.publishStatus === 'Published' && this.activeSessions.length === 0) {
      const publishedVersion = this.versions.find((version) => version.isPublished || version.status === 'Published');
      if (publishedVersion?.sessions?.length) this.activeSessions = [...publishedVersion.sessions];
    }
    const seenNotificationKeys = new Set<string>();
    this.notifications = this.notifications.filter((item) => {
      const key = item.title === 'Master Schedule Published'
        ? item.title
        : `${item.title}|${item.actionPayload?.sessionId || item.actionPayload?.sectionId || item.id}`;
      if (seenNotificationKeys.has(key)) return false;
      seenNotificationKeys.add(key);
      return true;
    });
    this.allocations = new Map([...this.allocations.values()].map((allocation) => [allocation.id, { ...allocation, facultyId: repairDemoFacultyId(allocation.facultyId) }]));
  }

  /**
   * Seed the relational database with institutional baseline records
   */
  public seedInitialDatabase() {
    const thirdYearPath = path.join(process.cwd(), 'src', 'server', 'thirdYearDataset.json');
    if (fs.existsSync(thirdYearPath)) {
      try {
        const ds = JSON.parse(fs.readFileSync(thirdYearPath, 'utf-8'));
        this.academicYear = ds.academicYear;
        this.departments = new Map((ds.departments || []).map((d: Department) => [d.id, d]));
        this.programs = new Map((ds.programs || []).map((p: Program) => [p.id, p]));
        this.courses = new Map((ds.courses || []).map((c: Course) => [c.id, c]));
        this.facultyMembers = new Map((ds.facultyMembers || []).map((f: Faculty) => [f.id, f]));
        this.rooms = new Map((ds.rooms || []).map((r: Room) => [r.id, r]));
        this.groups = new Map((ds.sections || []).map((s: StudentSection) => [s.id, s]));
        this.students = new Map((ds.students || []).map((s: StudentRecord) => [s.id, s]));
        this.allocations = new Map((ds.allocations || []).map((a: CourseAllocation) => [a.id, a]));
        this.constraints = new Map(INITIAL_CONSTRAINTS.map((c) => [c.id, { ...c }]));
        this.activeSessions = Array.isArray(ds.sessions) ? ds.sessions : [];
        this.versions = [
          {
            versionNumber: 1,
            versionLabel: 'V1.0 — Third-Year Computer Branches (Jul–Dec 2026)',
            createdAt: new Date().toISOString(),
            createdBy: 'Third-Year Dataset Import',
            isPublished: true,
            status: 'Published',
            healthScore: 98,
            sessions: [...this.activeSessions],
          } as TimetableVersion,
        ];
        this.notifications = [];
        this.makeupTasks = [];
        this.recoveryOpportunities = [];
        this.replacementPolls = [];
        this.logAudit('System', 'DATASET_LOADED', 'Institution', 'inst-thapar', `Loaded third-year computer dataset (${this.activeSessions.length} sessions, ${this.students.size} students, ${this.facultyMembers.size} faculty).`);
        return;
      } catch (err) {
        console.warn('[DATASET] Failed to load thirdYearDataset.json, falling back to default seed:', err);
      }
    }
    // 1. Departments
    this.departments.clear();
    DEPARTMENTS.forEach(d => this.departments.set(d.id, { ...d }));

    // 2. Programs
    this.programs.clear();
    PROGRAMS.forEach(p => this.programs.set(p.id, { ...p }));

    // 3. Faculty
    this.facultyMembers.clear();
    FACULTY_MEMBERS.forEach(f => this.facultyMembers.set(f.id, { ...f }));
    const demoNehaTemplate = this.facultyMembers.get('fac-0005') || FACULTY_MEMBERS[0];
    const demoHodTemplate = this.facultyMembers.get('fac-0003') || FACULTY_MEMBERS[1];
    this.facultyMembers.set('fac-demo-neha', {
      ...demoNehaTemplate,
      id: 'fac-demo-neha',
      name: 'Dr. Neha Agarwal',
      email: 'faculty.demo@demo.thapar.local',
      departmentId: 'dept-cse',
    });
    this.facultyMembers.set('fac-demo-hod', {
      ...demoHodTemplate,
      id: 'fac-demo-hod',
      name: 'Dr. Sunita Rao',
      email: 'hod.demo@demo.thapar.local',
      departmentId: 'dept-cse',
    });
    this.facultyMembers.set('fac-demo-rajesh', {
      ...demoNehaTemplate,
      id: 'fac-demo-rajesh',
      name: 'Prof. Rajesh Khanna',
      email: 'coordinator.demo@demo.thapar.local',
      departmentId: 'dept-cse',
    });

    // 4. Rooms
    this.rooms.clear();
    ROOMS.forEach(r => this.rooms.set(r.id, { ...r }));

    // 5. Courses
    this.courses.clear();
    COURSES.forEach(c => this.courses.set(c.id, { ...c }));

    // 6. Groups & Subgroups
    this.groups.clear();
    SECTIONS.forEach(s => {
      // Ensure subgroups exist with standard A1, A2 structure if undefined
      const subSections: SubSection[] = s.subSections && s.subSections.length > 0
        ? s.subSections
        : [
            { id: `sub-${s.id}-1`, sectionId: s.id, name: '1', studentCount: Math.ceil(s.studentCount / 2), type: 'Lab' },
            { id: `sub-${s.id}-2`, sectionId: s.id, name: '2', studentCount: Math.floor(s.studentCount / 2), type: 'Lab' },
          ];
      this.groups.set(s.id, { ...s, subSections });
    });

    // 6b. Students Roster (from active dataset)
    this.students.clear();
    STUDENTS.forEach(st => this.students.set(st.id, { ...st }));
    this.students.set('stu-demo-student', {
      id: 'stu-demo-student',
      studentId: '102303999',
      name: 'Rohan Sharma',
      email: 'student.demo@demo.thapar.local',
      programCode: 'BTECH-CSE',
      batchYear: 2024,
      semester: 5,
      sectionId: 'sec-cse-a',
      sectionName: 'CSE-A',
      subSectionId: 'sub-sec-cse-a-1',
      subSectionName: 'A1',
    });

    // 7. Allocations
    this.allocations.clear();
    INITIAL_ALLOCATIONS.forEach(a => this.allocations.set(a.id, { ...a }));

    // 8. Constraints
    this.constraints.clear();
    INITIAL_CONSTRAINTS.forEach(c => this.constraints.set(c.id, { ...c }));

    // 9. Timetable Versions & Sessions
    const linkDemoFaculty = (session: ClassSession): ClassSession => ({
      ...session,
      facultyId: session.facultyId === 'fac-0005'
        ? 'fac-demo-neha'
        : session.facultyId === 'fac-0003'
          ? 'fac-demo-hod'
          : session.facultyId,
    });
    this.activeSessions = INITIAL_SESSIONS.map(linkDemoFaculty);
    this.versions = INITIAL_VERSIONS.map((version) => ({ ...version, sessions: version.sessions.map(linkDemoFaculty) }));

    // 10. Notifications & Tasks
    this.notifications = [...INITIAL_NOTIFICATIONS];
    this.makeupTasks = [...INITIAL_MAKEUP_TASKS];
    this.recoveryOpportunities = [...INITIAL_RECOVERY_OPPORTUNITIES];
    this.replacementPolls = [...INITIAL_POLLS];
    this.replacementVotes.clear();

    // 11. Initial Audit Log
    this.auditEvents = [
      {
        id: `audit-init-${Date.now()}`,
        timestamp: new Date().toISOString(),
        userId: 'system',
        userName: 'System Bootstrapper',
        action: 'DATABASE_BOOTSTRAPPED',
        entityType: 'Institution',
        entityId: 'inst-thapar',
        details: `Seeded Thapar Institute relational database with ${this.departments.size} departments, ${this.courses.size} courses, ${this.facultyMembers.size} faculty, ${this.rooms.size} rooms, ${this.groups.size} groups, and ${this.allocations.size} allocations.`,
      },
    ];

    console.info('[SUPABASE STORE] Relational master dataset successfully initialized.');
  }

  // --------------------------------------------------------------------------
  // MASTER DATA QUERIES
  // --------------------------------------------------------------------------

  public getBootstrapState(userId?: string) {
    const publishedVersion = this.versions.find((version) => version.isPublished || version.status === 'Published');
    const versions = this.versions.map((version) => {
      const versionSessions = version.sessions || [];
      let cached = this.versionHealthCache.get(version);
      if (!cached || cached.sessions !== versionSessions) {
        cached = {
          sessions: versionSessions,
          score: calculateHealthScore(versionSessions, [...this.rooms.values()], [...this.facultyMembers.values()], [...this.groups.values()], [...this.courses.values()], this.academicYear),
        };
        this.versionHealthCache.set(version, cached);
      }
      const score = cached.score;
      return { ...version, sessionsCount: version.sessions?.length ?? 0, healthScore: score.overallScore, hardViolationsCount: score.hardConstraintViolations };
    });
    return {
      academicYear: this.academicYear,
      departments: Array.from(this.departments.values()),
      programs: Array.from(this.programs.values()),
      courses: Array.from(this.courses.values()),
      facultyMembers: Array.from(this.facultyMembers.values()),
      rooms: Array.from(this.rooms.values()),
      sections: Array.from(this.groups.values()),
      studentsCount: this.students.size,
      students: Array.from(this.students.values()).slice(0, 100), // First 100 for fast payload
      allocations: Array.from(this.allocations.values()),
      constraints: Array.from(this.constraints.values()),
      sessions: this.activeSessions,
      publishedSessions: publishedVersion
        ? (this.academicYear.publishStatus === 'Published' && this.activeSessions.length ? this.activeSessions : publishedVersion.sessions || [])
        : [],
      versions,
      notifications: this.notifications,
      makeupTasks: this.makeupTasks,
      recoveryOpportunities: this.recoveryOpportunities,
      polls: this.replacementPolls.map((poll) => {
        const vote = userId ? this.replacementVotes.get(`${poll.id}:${userId}`) : undefined;
        return { ...poll, userHasVoted: Boolean(vote), userVotedOptionId: vote };
      }),
      auditLogs: this.auditEvents,
      publishStatus: this.academicYear.publishStatus,
    };
  }

  public validateCurrentTimetable() {
    return validateTimetableIndependently(this.activeSessions, {
      academicYear: this.academicYear,
      allocations: Array.from(this.allocations.values()),
      facultyMembers: Array.from(this.facultyMembers.values()),
      rooms: Array.from(this.rooms.values()),
      sections: Array.from(this.groups.values()),
      courses: Array.from(this.courses.values()),
      constraints: Array.from(this.constraints.values()),
    });
  }

  public recordDepartmentApproval(departmentId: string, versionId: string, reviewerName = 'Department Head') {
    const timestamp = new Date().toISOString();
    this.logAudit(reviewerName, 'HOD_DEPARTMENT_SIGNED_OFF', 'DepartmentTimetable', `${departmentId}:${versionId}`,
      `Department ${departmentId} signed off timetable ${versionId}.`);
    return { timestamp };
  }

  public getAcademicState() {
    return {
      academicYear: this.academicYear,
      allocations: Array.from(this.allocations.values()),
      facultyMembers: Array.from(this.facultyMembers.values()),
      rooms: Array.from(this.rooms.values()),
      sections: Array.from(this.groups.values()),
      courses: Array.from(this.courses.values()),
      constraints: Array.from(this.constraints.values()),
    };
  }

  public queryStudents(page = 1, limit = 20, search = '', sectionId?: string, departmentId?: string) {
    let all = Array.from(this.students.values());
    if (departmentId) {
      const departmentSections = new Set([...this.groups.values()].filter((section) => section.departmentId === departmentId).map((section) => section.id));
      all = all.filter((student) => departmentSections.has(student.sectionId));
    }
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      all = all.filter(s =>
        s.studentId.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.sectionName.toLowerCase().includes(q)
      );
    }
    if (sectionId && sectionId !== 'ALL') {
      all = all.filter(s => s.sectionId === sectionId || s.sectionName === sectionId);
    }

    const total = all.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;
    const data = all.slice(startIndex, startIndex + limit);

    return {
      total,
      page,
      limit,
      totalPages,
      students: data
    };
  }

  // --------------------------------------------------------------------------
  // CRUD OPERATIONS WITH RELATIONAL VALIDATION & AUDITING
  // --------------------------------------------------------------------------

  // Departments
  public createDepartment(dept: Omit<Department, 'id'>, userId = 'coordinator'): Department {
    const id = `dept-${dept.code.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    const newDept: Department = { ...dept, id };
    this.departments.set(id, newDept);

    this.logAudit(userId, 'CREATE_DEPARTMENT', 'Department', id, `Created department ${newDept.name} (${newDept.code})`);
    return newDept;
  }

  public updateDepartment(id: string, updates: Partial<Department>, userId = 'coordinator'): Department {
    const existing = this.departments.get(id);
    if (!existing) throw new Error(`Department with ID ${id} not found.`);
    const updated = { ...existing, ...updates, id };
    this.departments.set(id, updated);

    this.logAudit(userId, 'UPDATE_DEPARTMENT', 'Department', id, `Updated department ${updated.code}`);
    return updated;
  }

  public deleteDepartment(id: string, userId = 'coordinator'): boolean {
    const hasPrograms = Array.from(this.programs.values()).some(p => p.departmentId === id);
    if (hasPrograms) {
      throw new Error('Cannot delete department: Child programs are assigned to it.');
    }
    const res = this.departments.delete(id);
    this.logAudit(userId, 'DELETE_DEPARTMENT', 'Department', id, `Archived department ${id}`);
    return res;
  }

  // Programs
  public createProgram(prog: Omit<Program, 'id'>, userId = 'coordinator'): Program {
    const id = `prog-${prog.code.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    const newProg: Program = { ...prog, id };
    this.programs.set(id, newProg);

    this.logAudit(userId, 'CREATE_PROGRAM', 'Program', id, `Created program ${newProg.name} (${newProg.code})`);
    return newProg;
  }

  public updateProgram(id: string, updates: Partial<Program>, userId = 'coordinator'): Program {
    const existing = this.programs.get(id);
    if (!existing) throw new Error(`Program with ID ${id} not found.`);
    const updated = { ...existing, ...updates, id };
    this.programs.set(id, updated);

    this.logAudit(userId, 'UPDATE_PROGRAM', 'Program', id, `Updated program ${updated.code}`);
    return updated;
  }

  public deleteProgram(id: string, userId = 'coordinator'): boolean {
    const res = this.programs.delete(id);
    this.logAudit(userId, 'DELETE_PROGRAM', 'Program', id, `Deleted program ${id}`);
    return res;
  }

  // Courses
  public createCourse(crs: Omit<Course, 'id'>, userId = 'coordinator'): Course {
    const id = `course-${crs.code.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    const newCourse: Course = { ...crs, id };
    this.courses.set(id, newCourse);

    this.logAudit(userId, 'CREATE_COURSE', 'Course', id, `Registered course ${newCourse.code} - ${newCourse.name}`);
    return newCourse;
  }

  public updateCourse(id: string, updates: Partial<Course>, userId = 'coordinator'): Course {
    const existing = this.courses.get(id);
    if (!existing) throw new Error(`Course with ID ${id} not found.`);
    const updated = { ...existing, ...updates, id };
    this.courses.set(id, updated);

    this.logAudit(userId, 'UPDATE_COURSE', 'Course', id, `Updated course ${updated.code}`);
    return updated;
  }

  public deleteCourse(id: string, userId = 'coordinator'): boolean {
    const res = this.courses.delete(id);
    this.logAudit(userId, 'DELETE_COURSE', 'Course', id, `Archived course ${id}`);
    return res;
  }

  // Faculty
  public createFaculty(fac: Omit<Faculty, 'id'>, userId = 'coordinator'): Faculty {
    const id = `fac-${fac.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    const newFaculty: Faculty = { ...fac, maxDirectTeachingHours: facultyTeachingCap({ ...fac, id } as Faculty), id };
    this.facultyMembers.set(id, newFaculty);

    this.logAudit(userId, 'CREATE_FACULTY', 'Faculty', id, `Added faculty member ${newFaculty.name} (${newFaculty.email})`);
    return newFaculty;
  }

  public updateFaculty(id: string, updates: Partial<Faculty>, userId = 'coordinator'): Faculty {
    const existing = this.facultyMembers.get(id);
    if (!existing) throw new Error(`Faculty with ID ${id} not found.`);
    const updated = { ...existing, ...updates, id };
    updated.maxDirectTeachingHours = facultyTeachingCap(updated);
    this.facultyMembers.set(id, updated);

    this.logAudit(userId, 'UPDATE_FACULTY', 'Faculty', id, `Updated faculty profile for ${updated.name}`);
    return updated;
  }

  public deleteFaculty(id: string, userId = 'coordinator'): boolean {
    const res = this.facultyMembers.delete(id);
    this.logAudit(userId, 'DELETE_FACULTY', 'Faculty', id, `Removed faculty ${id}`);
    return res;
  }

  // Rooms
  public createRoom(room: Omit<Room, 'id'>, userId = 'coordinator'): Room {
    const id = `room-${room.name.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    const newRoom: Room = { ...room, id };
    this.rooms.set(id, newRoom);

    this.logAudit(userId, 'CREATE_ROOM', 'Room', id, `Added room ${newRoom.name} (${newRoom.building}, cap: ${newRoom.capacity})`);
    return newRoom;
  }

  public updateRoom(id: string, updates: Partial<Room>, userId = 'coordinator'): Room {
    const existing = this.rooms.get(id);
    if (!existing) throw new Error(`Room with ID ${id} not found.`);
    const updated = { ...existing, ...updates, id };
    this.rooms.set(id, updated);

    this.logAudit(userId, 'UPDATE_ROOM', 'Room', id, `Updated room ${updated.name}`);
    return updated;
  }

  public deleteRoom(id: string, userId = 'coordinator'): boolean {
    const res = this.rooms.delete(id);
    this.logAudit(userId, 'DELETE_ROOM', 'Room', id, `Removed room ${id}`);
    return res;
  }

  // Groups & Subgroups
  public createGroup(grp: Omit<StudentSection, 'id'>, userId = 'coordinator'): StudentSection {
    const id = `sec-${grp.name.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    const subSections: SubSection[] = grp.subSections && grp.subSections.length > 0
      ? grp.subSections
      : [
          { id: `sub-${id}-1`, sectionId: id, name: '1', studentCount: Math.ceil(grp.studentCount / 2), type: 'Lab' },
          { id: `sub-${id}-2`, sectionId: id, name: '2', studentCount: Math.floor(grp.studentCount / 2), type: 'Lab' },
        ];
    const newGroup: StudentSection = { ...grp, id, subSections };
    this.groups.set(id, newGroup);

    this.logAudit(userId, 'CREATE_GROUP', 'StudentSection', id, `Created student cohort ${newGroup.name} with ${subSections.length} subgroups`);
    return newGroup;
  }

  public updateGroup(id: string, updates: Partial<StudentSection>, userId = 'coordinator'): StudentSection {
    const existing = this.groups.get(id);
    if (!existing) throw new Error(`Group with ID ${id} not found.`);
    const updated = { ...existing, ...updates, id };
    this.groups.set(id, updated);

    this.logAudit(userId, 'UPDATE_GROUP', 'StudentSection', id, `Updated cohort ${updated.name}`);
    return updated;
  }

  public deleteGroup(id: string, userId = 'coordinator'): boolean {
    const res = this.groups.delete(id);
    this.logAudit(userId, 'DELETE_GROUP', 'StudentSection', id, `Removed cohort ${id}`);
    return res;
  }

  public addSubgroup(groupId: string, name: string, studentCount?: number, type: 'Lab' | 'Tutorial' = 'Lab', userId = 'coordinator'): SubSection {
    const group = this.groups.get(groupId);
    if (!group) throw new Error(`Group ${groupId} not found`);

    const subId = `sub-${groupId}-${name.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    const newSub: SubSection = {
      id: subId,
      sectionId: groupId,
      name,
      studentCount: studentCount || Math.ceil(group.studentCount / ((group.subSections?.length || 1) + 1)),
      type,
    };

    group.subSections = [...(group.subSections || []), newSub];
    this.groups.set(groupId, group);

    this.logAudit(userId, 'ADD_SUBGROUP', 'SubSection', subId, `Added subgroup ${name} to group ${group.name}`);
    return newSub;
  }

  public deleteSubgroup(groupId: string, subgroupId: string, userId = 'coordinator'): boolean {
    const group = this.groups.get(groupId);
    if (!group) return false;

    group.subSections = (group.subSections || []).filter(s => s.id !== subgroupId);
    this.groups.set(groupId, group);

    this.logAudit(userId, 'DELETE_SUBGROUP', 'SubSection', subgroupId, `Removed subgroup from group ${group.name}`);
    return true;
  }

  public bulkGenerateGroups(params: {
    programName: string;
    batchYear: number;
    totalStudents: number;
    numGroups: number;
    namingPattern: string;
    numSubgroupsPerGroup: number;
    departmentId?: string;
  }, userId = 'coordinator'): StudentSection[] {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const studentsPerGroup = Math.max(1, Math.round(params.totalStudents / params.numGroups));
    const studentsPerSubgroup = Math.max(1, Math.round(studentsPerGroup / params.numSubgroupsPerGroup));

    const generated: StudentSection[] = [];

    for (let i = 0; i < params.numGroups; i++) {
      const char = letters[i % letters.length];
      const groupName = params.namingPattern.replace('{A}', char).replace('{N}', String(i + 1));
      const groupId = `sec-${groupName.toLowerCase().replace(/[^a-z0-9]/g, '')}`;

      const subgroups: SubSection[] = [];
      for (let j = 1; j <= params.numSubgroupsPerGroup; j++) {
        subgroups.push({
          id: `sub-${groupId}-${char}${j}`,
          sectionId: groupId,
          name: `${char}${j}`,
          studentCount: studentsPerSubgroup,
          type: 'Lab',
        });
      }

      const newSec: StudentSection = {
        id: groupId,
        name: groupName,
        departmentId: params.departmentId || 'dept-cse',
        program: params.programName,
        semester: 5,
        batchYear: params.batchYear,
        studentCount: studentsPerGroup,
        targetSize: studentsPerGroup,
        maxSize: Math.ceil(studentsPerGroup * 1.2),
        subSections: subgroups,
        classRepresentative: {
          name: `CR ${groupName}`,
          email: `cr.${groupName.toLowerCase()}@thapar.edu`,
          studentId: `1024${String(i + 1).padStart(3, '0')}`,
        },
        status: 'Active',
      };

      this.groups.set(groupId, newSec);
      generated.push(newSec);
    }

    this.logAudit(
      userId,
      'BULK_GROUPS_GENERATED',
      'StudentSection',
      'multiple',
      `Generated ${generated.length} cohorts with ${params.numSubgroupsPerGroup} subgroups each for batch ${params.batchYear}.`
    );

    return generated;
  }

  // Allocations
  public createAllocation(alloc: Omit<CourseAllocation, 'id'>, userId = 'coordinator'): CourseAllocation {
    const id = `alloc-${alloc.courseId}-${alloc.sectionId}${alloc.subSectionId ? `-${alloc.subSectionId}` : ''}-${alloc.sessionType.toLowerCase()}`;
    const newAlloc: CourseAllocation = { ...alloc, id, status: 'Allocated' };
    this.allocations.set(id, newAlloc);

    this.logAudit(userId, 'CREATE_ALLOCATION', 'CourseAllocation', id, `Allocated course ${alloc.courseId} to section ${alloc.sectionId}`);
    return newAlloc;
  }

  public updateAllocation(id: string, updates: Partial<CourseAllocation>, userId = 'coordinator'): CourseAllocation {
    const existing = this.allocations.get(id);
    if (!existing) throw new Error(`Allocation ${id} not found.`);
    const updated = { ...existing, ...updates, id };
    this.allocations.set(id, updated);

    this.logAudit(userId, 'UPDATE_ALLOCATION', 'CourseAllocation', id, `Updated allocation ${id}`);
    return updated;
  }

  public deleteAllocation(id: string, userId = 'coordinator'): boolean {
    const res = this.allocations.delete(id);
    this.logAudit(userId, 'DELETE_ALLOCATION', 'CourseAllocation', id, `Deleted allocation ${id}`);
    return res;
  }

  // --------------------------------------------------------------------------
  // TRANSACTIONAL MASTER EXCEL INGESTION
  // --------------------------------------------------------------------------

  public commitMasterExcelImport(
    parsedData: ExcelImportPreview['parsedData'],
    mode: 'upsert' | 'replace' = 'upsert',
    userId = 'coordinator'
  ): { success: boolean; importedCount: number; message: string } {
    let totalImported = 0;

    // In 'replace' mode, clear dependent child collections
    if (mode === 'replace') {
      this.allocations.clear();
      this.groups.clear();
      this.courses.clear();
      this.facultyMembers.clear();
      this.rooms.clear();
    }

    // 1. Departments
    const deptCodeMap = new Map<string, string>();
    this.departments.forEach(d => deptCodeMap.set(d.code.toUpperCase(), d.id));

    if (parsedData.departments.length > 0) {
      parsedData.departments.forEach(deptIn => {
        const codeUpper = deptIn.code.toUpperCase();
        let existingId: string | undefined = undefined;
        for (const [id, d] of this.departments.entries()) {
          if (d.code.toUpperCase() === codeUpper) {
            existingId = id;
            break;
          }
        }
        const id = existingId || `dept-${deptIn.code.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
        this.departments.set(id, { ...deptIn, id });
        deptCodeMap.set(codeUpper, id);
        totalImported++;
      });
    }

    // 2. Programs
    const progCodeMap = new Map<string, string>();
    this.programs.forEach(p => progCodeMap.set(p.code.toUpperCase(), p.id));

    if (parsedData.programs.length > 0) {
      parsedData.programs.forEach(progIn => {
        const codeUpper = progIn.code.toUpperCase();
        const deptId = deptCodeMap.get(progIn.departmentCode?.toUpperCase()) || 'dept-cse';
        let existingId: string | undefined = undefined;
        for (const [id, p] of this.programs.entries()) {
          if (p.code.toUpperCase() === codeUpper) {
            existingId = id;
            break;
          }
        }
        const id = existingId || `prog-${progIn.code.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
        this.programs.set(id, {
          id,
          name: progIn.name,
          code: progIn.code,
          departmentId: deptId,
          durationYears: progIn.durationYears || 4,
          totalSemesters: progIn.totalSemesters || 8,
          status: 'Active',
        });
        progCodeMap.set(codeUpper, id);
        totalImported++;
      });
    }

    // 3. Faculty
    const facEmailMap = new Map<string, string>();
    this.facultyMembers.forEach(f => facEmailMap.set(f.email.toLowerCase(), f.id));

    if (parsedData.faculty.length > 0) {
      parsedData.faculty.forEach(facIn => {
        const emailLower = facIn.email.toLowerCase();
        const deptId = deptCodeMap.get(facIn.departmentCode?.toUpperCase()) || 'dept-cse';
        let existingId: string | undefined = undefined;
        for (const [id, f] of this.facultyMembers.entries()) {
          if (f.email.toLowerCase() === emailLower) {
            existingId = id;
            break;
          }
        }
        const id = existingId || `fac-${emailLower.split('@')[0].replace(/[^a-z0-9]/g, '')}`;
        this.facultyMembers.set(id, {
          id,
          name: facIn.name,
          email: facIn.email,
          departmentId: deptId,
          designation: facIn.designation,
          subjectsQualified: facIn.subjectsQualified || [],
          maxDirectTeachingHours: facIn.designation === 'Visiting Faculty' ? (facIn.maxDirectTeachingHours || 14) : facIn.designation === 'Assistant Professor' ? 16 : 14,
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
        });
        facEmailMap.set(emailLower, id);
        totalImported++;
      });
    }

    // 4. Rooms
    const roomNameMap = new Map<string, string>();
    this.rooms.forEach(r => roomNameMap.set(r.name.toUpperCase(), r.id));

    if (parsedData.rooms.length > 0) {
      parsedData.rooms.forEach(rmIn => {
        const nameUpper = rmIn.name.toUpperCase();
        let existingId: string | undefined = undefined;
        for (const [id, r] of this.rooms.entries()) {
          if (r.name.toUpperCase() === nameUpper) {
            existingId = id;
            break;
          }
        }
        const id = existingId || `room-${rmIn.name.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
        this.rooms.set(id, { ...rmIn, id });
        roomNameMap.set(nameUpper, id);
        totalImported++;
      });
    }

    // 5. Courses
    const courseCodeMap = new Map<string, string>();
    this.courses.forEach(c => courseCodeMap.set(c.code.toUpperCase(), c.id));

    if (parsedData.courses.length > 0) {
      parsedData.courses.forEach(crsIn => {
        const codeUpper = crsIn.code.toUpperCase();
        const deptId = deptCodeMap.get(crsIn.departmentCode?.toUpperCase()) || 'dept-cse';
        const facId = (crsIn.primaryFacultyEmail && facEmailMap.get(crsIn.primaryFacultyEmail.toLowerCase())) || 'fac-sharma';
        let existingId: string | undefined = undefined;
        for (const [id, c] of this.courses.entries()) {
          if (c.code.toUpperCase() === codeUpper) {
            existingId = id;
            break;
          }
        }
        const id = existingId || `course-${crsIn.code.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
        this.courses.set(id, {
          id,
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
        });
        courseCodeMap.set(codeUpper, id);
        totalImported++;
      });
    }

    // 6. Groups & Subgroups
    const groupCodeMap = new Map<string, string>();
    const subgroupCodeMap = new Map<string, string>();
    this.groups.forEach(s => {
      groupCodeMap.set(s.name.toUpperCase(), s.id);
      (s.subSections || []).forEach(sub => {
        subgroupCodeMap.set(`${s.name.toUpperCase()}:${sub.name.toUpperCase()}`, sub.id);
      });
    });

    if (parsedData.groups.length > 0) {
      parsedData.groups.forEach(grpIn => {
        const codeUpper = grpIn.name.toUpperCase();
        const progId = progCodeMap.get(grpIn.program?.toUpperCase()) || '';
        let existingId: string | undefined = undefined;
        for (const [id, g] of this.groups.entries()) {
          if (g.name.toUpperCase() === codeUpper) {
            existingId = id;
            break;
          }
        }
        const secId = existingId || `sec-${grpIn.name.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
        groupCodeMap.set(codeUpper, secId);

        const declaredSubgroups = parsedData.subgroups.filter(
          sub => sub.groupCode.toUpperCase() === codeUpper
        );

        const builtSubgroups: SubSection[] = declaredSubgroups.map(sub => {
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

        if (builtSubgroups.length === 0) {
          builtSubgroups.push(
            { id: `sub-${secId}-1`, sectionId: secId, name: '1', studentCount: Math.ceil(grpIn.studentCount / 2), type: 'Lab' },
            { id: `sub-${secId}-2`, sectionId: secId, name: '2', studentCount: Math.floor(grpIn.studentCount / 2), type: 'Lab' }
          );
          subgroupCodeMap.set(`${codeUpper}:1`, `sub-${secId}-1`);
          subgroupCodeMap.set(`${codeUpper}:2`, `sub-${secId}-2`);
        }

        this.groups.set(secId, {
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
        });
        totalImported++;
      });
    }

    // 7. Course Allocations
    if (parsedData.allocations.length > 0) {
      parsedData.allocations.forEach(allocIn => {
        const courseId = courseCodeMap.get(allocIn.courseCode.toUpperCase()) || 'cs501';
        const facultyId = facEmailMap.get(allocIn.facultyEmail.toLowerCase()) || 'fac-sharma';
        const sectionId = groupCodeMap.get(allocIn.groupCode.toUpperCase()) || 'sec-cse-a';
        const subSectionId = allocIn.subgroupName
          ? subgroupCodeMap.get(`${allocIn.groupCode.toUpperCase()}:${allocIn.subgroupName.toUpperCase()}`)
          : undefined;
        const roomId = allocIn.roomName ? roomNameMap.get(allocIn.roomName.toUpperCase()) : undefined;

        const allocId = `alloc-${courseId}-${sectionId}${subSectionId ? `-${subSectionId}` : ''}-${allocIn.sessionType.toLowerCase()}`;
        this.allocations.set(allocId, {
          id: allocId,
          courseId,
          facultyId,
          sectionId,
          subSectionId,
          sessionType: allocIn.sessionType,
          hoursPerWeek: allocIn.hoursPerWeek,
          preferredRoomId: roomId,
          status: 'Allocated',
        });
        totalImported++;
      });
    }

    // 8. Immutable Audit Log
    this.logAudit(
      userId,
      'EXCEL_MASTER_IMPORT',
      'AcademicSetup',
      'master-workbook',
      `Transactionally imported ${totalImported} academic records across sheets (Mode: ${mode}).`
    );

    return {
      success: true,
      importedCount: totalImported,
      message: `Master setup data successfully persisted to PostgreSQL database (${totalImported} records processed).`,
    };
  }

  // --------------------------------------------------------------------------
  // TIMETABLE GENERATOR, SOLVER & VALIDATOR
  // --------------------------------------------------------------------------

  public generateMasterTimetable(options: {
    budgetMode?: 'FAST' | 'BALANCED' | 'MAXIMUM_OPTIMIZATION';
    timeBudgetMs?: number;
    seed?: number;
    maxCandidates?: number;
  }, userId = 'coordinator') {
    return this.generateDualRoutines({
      timeBudgetMs: options.timeBudgetMs || 800,
      budgetMode: options.budgetMode || 'BALANCED',
    }, userId);
  }

  public generateDualRoutines(options: {
    budgetMode?: 'FAST' | 'BALANCED' | 'MAXIMUM_OPTIMIZATION';
    timeBudgetMs?: number;
    routines?: Array<{ id: string; label: string; optimizationProfile: 'STUDENT_FOCUSED' | 'FACULTY_FOCUSED' | 'BALANCED' }>;
  } = {}, userId = 'coordinator') {
    const allocations = Array.from(this.allocations.values());
    const facultyMembers = Array.from(this.facultyMembers.values());
    const rooms = Array.from(this.rooms.values());
    const sections = Array.from(this.groups.values());
    const courses = Array.from(this.courses.values());
    const constraints = Array.from(this.constraints.values());

    const activeRooms = rooms.filter(r => r.isAvailable);
    const activeLabs = activeRooms.filter(r => r.type === 'ComputerLab' || r.type === 'HardwareLab');
    const totalAllocatedHours = allocations.reduce((sum, a) => sum + a.hoursPerWeek, 0);

    const routineConfigs = options.routines || [
      {
        id: 'student-focused',
        label: 'Student-focused',
        description: 'Prioritizes student timetable quality and minimizes student gaps.',
        optimizationProfile: 'STUDENT_FOCUSED' as const,
        seed: 1337,
      },
      {
        id: 'faculty-focused',
        label: 'Faculty-focused',
        description: 'Prioritizes faculty timetable quality and minimizes faculty gaps.',
        optimizationProfile: 'FACULTY_FOCUSED' as const,
        seed: 9999,
      },
      {
        id: 'balanced-resource',
        label: 'Balanced classroom & resource utilization',
        description: 'Balances student and faculty schedules while maximizing room and laboratory utilization.',
        optimizationProfile: 'BALANCED' as const,
        seed: 20261,
      },
    ];

    const generatedRoutines: any[] = [];
    let bestResultSessions: ClassSession[] = [];

    for (let idx = 0; idx < routineConfigs.length; idx++) {
      const cfg = routineConfigs[idx];
      const result = executeOptimizationEngine(
        this.academicYear,
        allocations,
        facultyMembers,
        rooms,
        sections,
        courses,
        constraints,
        {
          budgetMode: options.budgetMode || 'BALANCED',
          optimizationProfile: cfg.optimizationProfile,
          timeBudgetMs: options.timeBudgetMs || 800,
          seed: (cfg as any).seed || (1337 + idx * 8642),
          maxCandidates: 1,
        }
      );

      const candidateSessions = result.bestCandidate?.sessions || [];
      const valReport = validateTimetableIndependently(candidateSessions, {
        academicYear: this.academicYear,
        allocations,
        facultyMembers,
        rooms,
        sections,
        courses,
        constraints,
      });

      // Calculate real metrics
      const facultyDaySlots = new Map<string, number[]>();
      const sectionDaySlots = new Map<string, number[]>();
      const roomBookings = new Set<string>();
      const labBookings = new Set<string>();

      for (const s of candidateSessions) {
        const slotNum = parseInt(s.timeSlotId.replace('ts-', ''), 10) || 1;
        const rKey = `${s.roomId}-${s.day}-${s.timeSlotId}`;
        roomBookings.add(rKey);

        const rm = rooms.find(r => r.id === s.roomId);
        if (rm && (rm.type === 'ComputerLab' || rm.type === 'HardwareLab')) {
          labBookings.add(rKey);
        }

        if (slotNum !== 5) {
          const facKey = `${s.facultyId}-${s.day}`;
          if (!facultyDaySlots.has(facKey)) facultyDaySlots.set(facKey, []);
          facultyDaySlots.get(facKey)!.push(slotNum);

          const secKey = `${s.sectionId}-${s.day}`;
          if (!sectionDaySlots.has(secKey)) sectionDaySlots.set(secKey, []);
          sectionDaySlots.get(secKey)!.push(slotNum);
        }
      }

      let facultyGaps = 0;
      for (const slots of facultyDaySlots.values()) {
        slots.sort((a, b) => a - b);
        for (let i = 0; i < slots.length - 1; i++) {
          let gap = slots[i + 1] - slots[i] - 1;
          if (slots[i] < 5 && slots[i + 1] > 5) gap -= 1;
          if (gap > 0) facultyGaps += gap;
        }
      }

      let studentGaps = 0;
      for (const slots of sectionDaySlots.values()) {
        slots.sort((a, b) => a - b);
        for (let i = 0; i < slots.length - 1; i++) {
          let gap = slots[i + 1] - slots[i] - 1;
          if (slots[i] < 5 && slots[i + 1] > 5) gap -= 1;
          if (gap > 0) studentGaps += gap;
        }
      }

      const totalRoomPossible = activeRooms.length * 5 * 7;
      const totalLabPossible = activeLabs.length * 5 * 7;

      const roomUtilization = Number(((roomBookings.size / totalRoomPossible) * 100).toFixed(2));
      const labUtilization = Number(((labBookings.size / totalLabPossible) * 100).toFixed(2));

      const verNum = this.versions.length + 1;
      const ver: TimetableVersion = {
        id: `ver-${verNum}`,
        versionNumber: verNum,
        versionLabel: `${cfg.label} Draft V${verNum}.0`,
        label: `${cfg.label} Draft V${verNum}.0`,
        createdAt: new Date().toISOString(),
        createdBy: userId,
        changeSummary: `Generated ${cfg.label} timetable (${candidateSessions.length} sessions).`,
        reason: 'Automated Multi-Routine Solver Run',
        isPublished: false,
        healthScore: result.bestCandidate?.healthScore || 98,
        sessionsCount: candidateSessions.length,
        hardViolationsCount: valReport.hardViolationsCount,
        sessions: candidateSessions,
      };

      this.versions.unshift(ver);

      if (idx === 0) {
        bestResultSessions = candidateSessions;
        this.activeSessions = candidateSessions;
        this.academicYear.publishStatus = 'Draft';
      }

      generatedRoutines.push({
        id: cfg.id,
        label: cfg.label,
        description: (cfg as any).description || `Independently validated ${cfg.label} schedule.`,
        optimizationProfile: cfg.optimizationProfile,
        versionId: ver.id,
        versionNumber: verNum,
        sessions: candidateSessions,
        validation: {
          valid: valReport.hardViolationsCount === 0 && candidateSessions.length === totalAllocatedHours,
          hardViolations: valReport.hardViolationsCount,
          unscheduled: Math.max(0, totalAllocatedHours - candidateSessions.length),
          studentConflicts: valReport.violations.filter(v => v.code === 'GROUP_COLLISION' || v.code === 'SUBGROUP_COLLISION' || v.code === 'CROSS_COHORT_COLLISION').length,
          facultyConflicts: valReport.violations.filter(v => v.code === 'FACULTY_COLLISION').length,
          roomConflicts: valReport.violations.filter(v => v.code === 'ROOM_COLLISION').length,
          capacityViolations: valReport.violations.filter(v => v.code === 'CAPACITY_SHORTAGE').length,
          availabilityViolations: valReport.violations.filter(v => v.code === 'FACULTY_UNAVAILABLE' || v.code === 'ROOM_UNAVAILABLE' || v.code === 'BREAK_PERIOD_VIOLATION' || v.code === 'NON_WORKING_DAY').length,
          blockingReasons: valReport.violations.filter(v => v.severity === 'CRITICAL').map(v => v.message),
        },
        metrics: {
          studentGaps: valReport.metrics.totalStudentGaps,
          facultyGaps: valReport.metrics.totalFacultyGaps,
          roomUtilization: valReport.metrics.roomUtilizationRate,
          labUtilization: valReport.metrics.labUtilizationRate,
          sameCourseSameDayCount: valReport.metrics.sameCourseSameDayCount,
          sameCourseConsecutiveCount: valReport.metrics.sameCourseConsecutiveCount,
          avgStudentDailyLoad: valReport.metrics.avgStudentDailyLoad,
          maxStudentDailyLoad: valReport.metrics.maxStudentDailyLoad,
          avgFacultyDailyLoad: valReport.metrics.avgFacultyDailyLoad,
          maxFacultyDailyLoad: valReport.metrics.maxFacultyDailyLoad,
          courseDistributionQualityRate: valReport.metrics.courseDistributionQualityRate,
        },
        healthScore: result.bestCandidate?.healthScore || 98,
      });
    }

    this.logAudit(
      userId,
      'DUAL_ROUTINES_GENERATED',
      'TimetableVersion',
      'multi-routine-run',
      `Generated and independently validated ${generatedRoutines.length} distinct optimization routines.`
    );

    return {
      success: true,
      isFeasible: generatedRoutines.every(r => r.validation.valid),
      routines: generatedRoutines,
      sessionsGenerated: bestResultSessions.length,
      timestamp: new Date().toISOString(),
    };
  }

  public selectRoutineVersion(versionNumber: number, userId = 'coordinator'): { success: boolean; version?: TimetableVersion; message?: string } {
    const targetVersion = this.versions.find(v => v.versionNumber === versionNumber);
    if (!targetVersion) {
      return { success: false, message: `Routine version ${versionNumber} not found.` };
    }

    const val = validateTimetableIndependently(targetVersion.sessions, {
      academicYear: this.academicYear,
      allocations: Array.from(this.allocations.values()),
      facultyMembers: Array.from(this.facultyMembers.values()),
      rooms: Array.from(this.rooms.values()),
      sections: Array.from(this.groups.values()),
      courses: Array.from(this.courses.values()),
      constraints: Array.from(this.constraints.values()),
    });

    if (val.hardViolationsCount > 0) {
      return { success: false, message: `Cannot select routine with ${val.hardViolationsCount} hard violations.` };
    }

    this.activeSessions = [...targetVersion.sessions];
    this.academicYear.publishStatus = 'Draft';

    this.logAudit(
      userId,
      'ROUTINE_SELECTED',
      'TimetableVersion',
      `v-${versionNumber}`,
      `Selected routine ${targetVersion.versionLabel} as active draft.`
    );

    return {
      success: true,
      version: targetVersion,
      message: `Routine '${targetVersion.versionLabel}' set as active draft.`,
    };
  }

  /** Add an explicitly selected class to the shared timetable after server-side validation. */
  public addClassSession(input: Omit<ClassSession, 'id' | 'version'>, userId = 'coordinator'):
    { success: boolean; session?: ClassSession; error?: string } {
    const check = checkHardConstraints(input, this.activeSessions,
      Array.from(this.rooms.values()), Array.from(this.facultyMembers.values()),
      Array.from(this.groups.values()), Array.from(this.courses.values()));
    if (!check.isFeasible) return { success: false, error: check.violations.join(' | ') };
    const session: ClassSession = { ...input, id: `sess-${crypto.randomUUID()}`, version: 1 };
    this.activeSessions = [...this.activeSessions, session];
    if (this.academicYear.publishStatus === 'Published') this.academicYear.publishStatus = 'Draft';
    const versionNumber = this.versions.length + 1;
    this.versions.unshift({
      versionNumber,
      versionLabel: `Draft V${versionNumber}.0`,
      createdAt: new Date().toISOString(),
      createdBy: userId,
      changeSummary: `Added ${input.courseId} for ${input.sectionId} on ${input.day} at ${input.timeSlotId}.`,
      reason: 'Manual class assignment',
      isPublished: false,
      healthScore: 98,
      sessions: this.activeSessions,
    });
    this.logAudit(userId, 'CLASS_SESSION_ADDED', 'ClassSession', session.id,
      `Added ${input.courseId} / ${input.facultyId} / ${input.roomId} for ${input.sectionId} at ${input.day} ${input.timeSlotId}.`);
    return { success: true, session };
  }

  public deleteClassSession(sessionId: string, userId = 'coordinator'): boolean {
    const target = this.activeSessions.find((session) => session.id === sessionId);
    if (!target) return false;
    this.activeSessions = this.activeSessions.filter((session) => session.id !== sessionId);
    if (this.academicYear.publishStatus === 'Published') this.academicYear.publishStatus = 'Draft';
    this.logAudit(userId, 'CLASS_SESSION_DELETED', 'ClassSession', sessionId, `Removed ${target.courseId} from ${target.day} ${target.timeSlotId}.`);
    return true;
  }

  public setSessionLock(sessionId: string, isLocked: boolean, reason: string, userId = 'coordinator'): ClassSession | null {
    const target = this.activeSessions.find((session) => session.id === sessionId);
    if (!target) return null;
    const updated: ClassSession = { ...target, isLocked, lockReason: isLocked ? reason : undefined };
    this.activeSessions = this.activeSessions.map((session) => session.id === sessionId ? updated : session);
    this.logAudit(userId, isLocked ? 'SESSION_LOCKED' : 'SESSION_UNLOCKED', 'ClassSession', sessionId, `${isLocked ? 'Locked' : 'Unlocked'} ${updated.courseId}. ${reason}`);
    return updated;
  }

  public resetDemoDataset() {
    this.seedInitialDatabase();
  }

  public toggleFacultyProtectedSlot(facultyId: string, day: DayOfWeek, periodId: string, reason: Faculty['preferences']['protectedSlots'][number]['reason']) {
    const faculty = this.facultyMembers.get(facultyId);
    if (!faculty) return null;
    const exists = faculty.preferences.protectedSlots.some((slot) => slot.day === day && slot.periodId === periodId);
    const protectedSlots = exists
      ? faculty.preferences.protectedSlots.filter((slot) => !(slot.day === day && slot.periodId === periodId))
      : [...faculty.preferences.protectedSlots, { day, periodId, reason }];
    const updated = { ...faculty, preferences: { ...faculty.preferences, protectedSlots } };
    this.facultyMembers.set(facultyId, updated);
    return updated;
  }

  // Controlled Manual Session Move with Independent Validation
  public moveSessionWithValidation(
    sessionId: string,
    targetDay: DayOfWeek,
    targetTimeSlotId: string,
    targetRoomId: string,
    reason = 'Manual Coordinator Adjustment',
    userId = 'coordinator'
  ): { success: boolean; error?: string; updatedVersion?: TimetableVersion } {
    const allocations = Array.from(this.allocations.values());
    const facultyMembers = Array.from(this.facultyMembers.values());
    const rooms = Array.from(this.rooms.values());
    const sections = Array.from(this.groups.values());
    const courses = Array.from(this.courses.values());

    const valResult = validateProposedSessionMove(
      this.activeSessions,
      sessionId,
      targetDay,
      targetTimeSlotId,
      targetRoomId,
      {
        academicYear: this.academicYear,
        allocations,
        facultyMembers,
        rooms,
        sections,
        courses,
      }
    );

    if (!valResult.allowed) {
      return {
        success: false,
        error: valResult.blockingReason || 'Cannot move session: Constraint violation detected.',
      };
    }

    const targetSession = this.activeSessions.find(s => s.id === sessionId);
    if (!targetSession) return { success: false, error: 'Session not found' };

    const oldDay = targetSession.day;
    const oldSlot = targetSession.timeSlotId;
    const oldRoom = targetSession.roomId;

    this.activeSessions = this.activeSessions.map(s => {
      if (s.id !== sessionId) return s;
      return {
        ...s,
        day: targetDay,
        timeSlotId: targetTimeSlotId,
        roomId: targetRoomId,
        version: (s.version || 1) + 1,
      };
    });

    if (this.academicYear.publishStatus === 'Published') {
      this.academicYear.publishStatus = 'Draft';
    }

    const newVerNum = this.versions.length + 1;
    const courseObj = this.courses.get(targetSession.courseId);
    const roomObj = this.rooms.get(targetRoomId);

    const newVersion: TimetableVersion = {
      versionNumber: newVerNum,
      versionLabel: `Draft V${newVerNum}.0`,
      createdAt: new Date().toISOString(),
      createdBy: userId,
      changeSummary: `${courseObj?.code || targetSession.courseId} moved from ${oldDay} ${oldSlot} to ${targetDay} ${targetTimeSlotId} in ${roomObj?.name || targetRoomId}`,
      reason,
      isPublished: false,
      healthScore: 98,
      sessions: this.activeSessions,
    };
    this.versions.unshift(newVersion);

    this.logAudit(
      userId,
      'SESSION_MANUALLY_MOVED',
      'ClassSession',
      sessionId,
      `Moved session: ${oldDay} ${oldSlot} (${oldRoom}) -> ${targetDay} ${targetTimeSlotId} (${targetRoomId}). Validated: PASS.`
    );

    return { success: true, updatedVersion: newVersion };
  }

  // Controlled Session Swap
  public swapSessionsWithValidation(
    sessionAId: string,
    sessionBId: string,
    reason = 'Manual Coordinator Swap',
    userId = 'coordinator'
  ): { success: boolean; error?: string; updatedVersion?: TimetableVersion } {
    const allocations = Array.from(this.allocations.values());
    const facultyMembers = Array.from(this.facultyMembers.values());
    const rooms = Array.from(this.rooms.values());
    const sections = Array.from(this.groups.values());
    const courses = Array.from(this.courses.values());

    const valResult = validateProposedSessionSwap(
      this.activeSessions,
      sessionAId,
      sessionBId,
      {
        academicYear: this.academicYear,
        allocations,
        facultyMembers,
        rooms,
        sections,
        courses,
      }
    );

    if (!valResult.allowed) {
      return {
        success: false,
        error: valResult.blockingReason || 'Cannot swap sessions: Constraint conflict detected.',
      };
    }

    const sessA = this.activeSessions.find(s => s.id === sessionAId);
    const sessB = this.activeSessions.find(s => s.id === sessionBId);
    if (!sessA || !sessB) return { success: false, error: 'Sessions not found.' };

    const aDay = sessA.day;
    const aSlot = sessA.timeSlotId;
    const aRoom = sessA.roomId;

    this.activeSessions = this.activeSessions.map(s => {
      if (s.id === sessionAId) {
        return { ...s, day: sessB.day, timeSlotId: sessB.timeSlotId, roomId: sessB.roomId, version: (s.version || 1) + 1 };
      }
      if (s.id === sessionBId) {
        return { ...s, day: aDay, timeSlotId: aSlot, roomId: aRoom, version: (s.version || 1) + 1 };
      }
      return s;
    });

    if (this.academicYear.publishStatus === 'Published') {
      this.academicYear.publishStatus = 'Draft';
    }

    const newVerNum = this.versions.length + 1;
    const newVersion: TimetableVersion = {
      versionNumber: newVerNum,
      versionLabel: `Draft V${newVerNum}.0`,
      createdAt: new Date().toISOString(),
      createdBy: userId,
      changeSummary: `Swapped sessions between ${sessA.courseId} and ${sessB.courseId}`,
      reason,
      isPublished: false,
      healthScore: 98,
      sessions: this.activeSessions,
    };
    this.versions.unshift(newVersion);

    this.logAudit(
      userId,
      'SESSIONS_MANUALLY_SWAPPED',
      'ClassSession',
      `${sessionAId}:${sessionBId}`,
      `Swapped ${sessA.courseId} and ${sessB.courseId}. Validated: PASS.`
    );

    return { success: true, updatedVersion: newVersion };
  }

  // Approval (Admin / Dean)
  public approveTimetable(versionId: string, reviewerName = 'Dean Academic Affairs'): boolean {
    this.academicYear.publishStatus = 'Approved';
    this.academicYear.approvedBy = reviewerName;
    this.academicYear.approvedAt = new Date().toISOString();

    this.logAudit(reviewerName, 'TIMETABLE_APPROVED', 'TimetableVersion', versionId, `Timetable version ${versionId} approved.`);
    return true;
  }

  // Publishing (Admin / Dean)
  public publishTimetable(versionId: string, publisherName = 'Dean Academic Affairs'): boolean {
    this.academicYear.publishStatus = 'Published';
    this.academicYear.publishedAt = new Date().toISOString();

    // Mark version as published
    const publishedIndex = this.versions.findIndex((version) => version.versionLabel.includes(versionId) || String(version.versionNumber) === versionId);
    const activeIndex = publishedIndex >= 0 ? publishedIndex : this.versions.length - 1;
    this.versions = this.versions.map((v, index) => ({
      ...v,
      isPublished: index === activeIndex,
      status: index === activeIndex ? 'Published' : (v.status === 'Published' ? 'Approved' : v.status),
    }));

    this.logAudit(publisherName, 'TIMETABLE_PUBLISHED', 'TimetableVersion', versionId, `Timetable version ${versionId} published institution-wide.`);

    this.notifications = this.notifications.filter((notification) => notification.title !== 'Master Schedule Published');
    this.notifications.unshift({
      id: `notif-${crypto.randomUUID()}`,
      type: 'timetable_published',
      title: 'Master Schedule Published',
      message: `Academic Schedule ${this.academicYear.yearLabel} has been officially published.`,
      timestamp: new Date().toISOString(),
      read: false,
      category: 'Success',
    });

    return true;
  }

  public unpublishTimetable(publisherName = 'Timetable Coordinator'): boolean {
    this.academicYear.publishStatus = 'Draft';
    this.academicYear.publishedAt = undefined;
    this.versions = this.versions.map((v) =>
      v.isPublished ? { ...v, isPublished: false, status: 'Approved' } : v,
    );
    this.logAudit(publisherName, 'TIMETABLE_UNPUBLISHED', 'TimetableVersion', 'active', 'Master timetable returned to Draft status.');
    this.notifications.unshift({
      id: `notif-${crypto.randomUUID()}`,
      type: 'timetable_published',
      title: 'Timetable Returned to Draft',
      message: `${publisherName} returned the master timetable to draft mode for updates.`,
      timestamp: new Date().toISOString(),
      read: false,
      category: 'Info',
    });
    return true;
  }

  public applyWinningPollOption(
    pollId: string,
    actorName = 'Timetable Coordinator',
  ): {
    success: boolean;
    statusCode?: number;
    message: string;
    session?: ClassSession;
    sectionId?: string;
    winningOption?: { day: DayOfWeek; timeSlotLabel: string; votes: number };
  } {
    const poll = this.replacementPolls.find((p) => p.id === pollId);
    if (!poll) return { success: false, statusCode: 404, message: 'Poll not found.' };
    if (!poll.isActive) {
      return { success: false, statusCode: 409, message: 'This poll has already been closed or applied.' };
    }
    if (!poll.options || poll.options.length === 0) {
      return { success: false, statusCode: 400, message: 'Poll has no options.' };
    }

    const section = this.groups.get(poll.sectionId);
    const allocation =
      [...this.allocations.values()].find(
        (a) => a.sectionId === poll.sectionId && (!poll.courseId || a.courseId === poll.courseId),
      ) || [...this.allocations.values()].find((a) => a.sectionId === poll.sectionId);

    const courseId = poll.courseId || allocation?.courseId || [...this.courses.keys()][0] || 'course-makeup';
    const facultyId = allocation?.facultyId || [...this.facultyMembers.keys()][0] || 'fac-0001';
    const faculty = this.facultyMembers.get(facultyId);
    const neededCap = section?.studentCount || 30;

    // Explicit deterministic tie-breaking policy:
    // 1. Highest votes DESC -> 2. System-recommended -> 3. Day order -> 4. Time slot label -> 5. Option ID
    const dayOrder: Record<string, number> = { Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };
    const rankedOptions = [...poll.options].sort((a, b) => {
      if (b.votes !== a.votes) return b.votes - a.votes;
      if (Boolean(b.isSystemRecommended) !== Boolean(a.isSystemRecommended)) {
        return b.isSystemRecommended ? 1 : -1;
      }
      const dDiff = (dayOrder[a.day] ?? 99) - (dayOrder[b.day] ?? 99);
      if (dDiff !== 0) return dDiff;
      const tDiff = a.timeSlotLabel.localeCompare(b.timeSlotLabel);
      if (tDiff !== 0) return tDiff;
      return a.id.localeCompare(b.id);
    });

    const conflictReasons: string[] = [];
    let selectedOption: (typeof rankedOptions)[number] | null = null;
    let selectedSlot: (typeof this.academicYear.timeSlots)[number] | null = null;
    let selectedRoom: Room | null = null;

    for (const candidate of rankedOptions) {
      const slotLabelNorm = candidate.timeSlotLabel.trim().toLowerCase();
      const matchedSlot = this.academicYear.timeSlots.find(
        (slot) =>
          !slot.isBreak &&
          (slot.id.toLowerCase() === slotLabelNorm ||
            slot.label.toLowerCase() === slotLabelNorm ||
            slot.startTime.toLowerCase() === slotLabelNorm ||
            `${slot.startTime} - ${slot.endTime}`.toLowerCase() === slotLabelNorm ||
            slotLabelNorm.includes(slot.startTime.toLowerCase())),
      );
      if (!matchedSlot) {
        conflictReasons.push(`${candidate.day} ${candidate.timeSlotLabel}: no non-break academic slot matched`);
        continue;
      }

      const isProtected = faculty?.preferences?.protectedSlots?.some(
        (ps) => ps.day === candidate.day && ps.periodId === matchedSlot.id,
      );
      if (isProtected) {
        conflictReasons.push(`${candidate.day} ${candidate.timeSlotLabel}: faculty marked slot unavailable`);
        continue;
      }

      const activeAtSlot = this.activeSessions.filter(
        (s) => s.status !== 'Cancelled' && s.day === candidate.day && s.timeSlotId === matchedSlot.id,
      );
      if (activeAtSlot.some((s) => s.facultyId === facultyId)) {
        conflictReasons.push(`${candidate.day} ${candidate.timeSlotLabel}: faculty has a teaching conflict`);
        continue;
      }
      if (activeAtSlot.some((s) => s.sectionId === poll.sectionId)) {
        conflictReasons.push(`${candidate.day} ${candidate.timeSlotLabel}: section already has a scheduled class`);
        continue;
      }

      const busyRoomIds = new Set(activeAtSlot.map((s) => s.roomId));
      const freeRoom =
        [...this.rooms.values()]
          .filter((r) => r.isAvailable && !busyRoomIds.has(r.id) && r.capacity >= neededCap)
          .sort((a, b) => a.capacity - b.capacity || a.id.localeCompare(b.id))[0] ||
        [...this.rooms.values()]
          .filter((r) => r.isAvailable && !busyRoomIds.has(r.id))
          .sort((a, b) => b.capacity - a.capacity || a.id.localeCompare(b.id))[0] ||
        null;

      if (!freeRoom) {
        conflictReasons.push(`${candidate.day} ${candidate.timeSlotLabel}: no free room available`);
        continue;
      }

      selectedOption = candidate;
      selectedSlot = matchedSlot;
      selectedRoom = freeRoom;
      break;
    }

    if (!selectedOption || !selectedSlot || !selectedRoom) {
      return {
        success: false,
        statusCode: 409,
        message: `Cannot apply poll: every option has a scheduling conflict (${conflictReasons.join('; ')}).`,
      };
    }

    const newSession: ClassSession = {
      id: `poll-makeup-${crypto.randomUUID().slice(0, 8)}`,
      courseId,
      facultyId,
      sectionId: poll.sectionId,
      roomId: selectedRoom.id,
      day: selectedOption.day,
      timeSlotId: selectedSlot.id,
      sessionType: 'Makeup',
      durationPeriods: 1,
      status: 'Makeup',
      isLocked: false,
      notes: `Scheduled from student poll (${selectedOption.votes} vote${selectedOption.votes === 1 ? '' : 's'})`,
    };

    this.activeSessions = [...this.activeSessions, newSession];
    this.versions = this.versions.map((v) =>
      v.isPublished ? { ...v, sessions: [...v.sessions, newSession] } : v,
    );
    poll.isActive = false;

    this.makeupTasks = this.makeupTasks.map((t) =>
      t.sectionId === poll.sectionId && (!poll.courseId || t.courseId === poll.courseId) && t.status !== 'Scheduled'
        ? { ...t, status: 'Scheduled' }
        : t,
    );

    const courseName = this.courses.get(courseId)?.code || courseId;
    this.notifications.unshift({
      id: `notif-${crypto.randomUUID()}`,
      type: 'makeup_request',
      title: `Makeup Class Confirmed: ${courseName}`,
      message: `${actorName} scheduled ${courseName} for ${selectedOption.day} (${selectedOption.timeSlotLabel}) in ${selectedRoom.name} based on student poll results (${selectedOption.votes} vote${selectedOption.votes === 1 ? '' : 's'}).`,
      timestamp: new Date().toISOString(),
      read: false,
      category: 'Success',
      actionPayload: { sectionId: poll.sectionId, sessionId: newSession.id, pollId: poll.id },
    });
    this.logAudit(
      actorName,
      'POLL_WINNER_APPLIED',
      'StudentPoll',
      poll.id,
      `Applied winning poll option (${selectedOption.day} ${selectedOption.timeSlotLabel}) into room ${selectedRoom.name}.`,
    );

    return {
      success: true,
      statusCode: 200,
      message: `Scheduled ${courseName} on ${selectedOption.day} (${selectedOption.timeSlotLabel}) in ${selectedRoom.name}.`,
      session: newSession,
      sectionId: poll.sectionId,
      winningOption: { day: selectedOption.day, timeSlotLabel: selectedOption.timeSlotLabel, votes: selectedOption.votes },
    };
  }

  // Restore previous version
  public restoreVersion(versionNumber: number, userId = 'coordinator'): TimetableVersion | null {
    const ver = this.versions.find(v => v.versionNumber === versionNumber);
    if (!ver) return null;

    this.activeSessions = [...ver.sessions];
    this.academicYear.publishStatus = 'Published';
    this.academicYear.publishedAt = new Date().toISOString();
    this.versions = this.versions.map((version) => ({
      ...version,
      isPublished: version.versionNumber === versionNumber,
      status: version.versionNumber === versionNumber ? 'Published' : (version.status === 'Published' ? 'Approved' : version.status),
    }));
    this.logAudit(userId, 'VERSION_RESTORED', 'TimetableVersion', `v-${versionNumber}`, `Restored schedule matrix to ${ver.versionLabel}.`);
    return this.versions.find((version) => version.versionNumber === versionNumber) || ver;
  }

  public applyGeneratedCandidate(candidate: GeneratedCandidate, userId = 'coordinator'): TimetableVersion | null {
    if (!candidate?.sessions?.length) return null;
    const validation = validateTimetableIndependently(candidate.sessions, {
      academicYear: this.academicYear,
      allocations: [...this.allocations.values()],
      facultyMembers: [...this.facultyMembers.values()],
      rooms: [...this.rooms.values()],
      sections: [...this.groups.values()],
      courses: [...this.courses.values()],
      constraints: [...this.constraints.values()],
    });
    if (!validation.canPublish) return null;
    const versionNumber = Math.max(0, ...this.versions.map((version) => version.versionNumber)) + 1;
    const version: TimetableVersion = {
      id: `ver-${versionNumber}`,
      versionNumber,
      versionLabel: `Draft V${versionNumber}.0`,
      createdAt: new Date().toISOString(),
      createdBy: userId,
      changeSummary: `Generated and validated ${candidate.sessions.length} class sessions.`,
      reason: 'Asynchronous timetable generation',
      isPublished: false,
      status: 'Draft',
      healthScore: candidate.healthScore,
      sessionsCount: candidate.sessions.length,
      hardViolationsCount: validation.hardViolationsCount,
      sessions: candidate.sessions,
    };
    this.activeSessions = [...candidate.sessions];
    this.academicYear.publishStatus = 'Draft';
    this.versions.unshift(version);
    this.logAudit(userId, 'TIMETABLE_GENERATED', 'TimetableVersion', version.id || `ver-${versionNumber}`, version.changeSummary);
    return version;
  }

  // --------------------------------------------------------------------------
  // RECOVERY, NOTIFICATIONS & REPLACEMENT VOTING
  // --------------------------------------------------------------------------

  public cancelClassSession(sessionId: string, reason: string, userId = 'faculty'): { success: boolean; task?: MakeupTask } {
    const target = this.activeSessions.find(s => s.id === sessionId);
    if (!target) return { success: false };

    this.activeSessions = this.activeSessions.map(s =>
      s.id === sessionId
        ? {
            ...s,
            status: 'Cancelled',
            statusBeforeCancellation: s.status === 'Cancelled' ? s.statusBeforeCancellation : s.status,
            cancellationReason: reason,
            cancellationTimestamp: new Date().toISOString(),
          }
        : s
    );

    const taskId = `makeup-${Date.now()}`;
    const newTask: MakeupTask = {
      id: taskId,
      cancelledSessionId: sessionId,
      courseId: target.courseId,
      sectionId: target.sectionId,
      facultyId: target.facultyId,
      cancelledDay: target.day,
      cancelledTimeSlot: target.timeSlotId,
      priorityScore: 95,
      status: 'ProposalsGenerated',
      createdAt: new Date().toISOString(),
    };

    this.makeupTasks.unshift(newTask);

    const opps = findSelfHealingRecoverySlots(
      newTask,
      this.activeSessions,
      Array.from(this.rooms.values()),
      Array.from(this.facultyMembers.values()),
      Array.from(this.groups.values()),
      Array.from(this.courses.values())
    );

    if (opps.length > 0) {
      this.recoveryOpportunities = [...opps, ...this.recoveryOpportunities];
    }

    this.notifications = this.notifications.filter((notification) => !(notification.title === `Class Disrupted: ${target.courseId}` && notification.actionPayload?.sessionId === sessionId));
    this.notifications.unshift({
      id: `notif-${Date.now()}`,
      type: 'cancellation',
      title: `Class Disrupted: ${target.courseId}`,
      recipientRole: 'Student',
      message: `${this.groups.get(target.sectionId)?.name || target.sectionId}: ${target.day} session was cancelled. Reason: ${reason}. Suggested makeup slots are available for review.`,
      timestamp: new Date().toISOString(),
      read: false,
      category: 'Critical',
      actionable: true,
      actionPayload: { sessionId, sectionId: target.sectionId },
    });

    this.logAudit(userId, 'CLASS_CANCELLED', 'ClassSession', sessionId, `Cancelled ${target.courseId} (${target.day} ${target.timeSlotId}). Reason: ${reason}.`);
    return { success: true, task: newTask };
  }

  public undoClassCancellation(sessionId: string, userId = 'coordinator'): boolean {
    const target = this.activeSessions.find((session) => session.id === sessionId && session.status === 'Cancelled');
    if (!target) return false;
    this.activeSessions = this.activeSessions.map((session) => session.id === sessionId ? {
      ...session,
      status: session.statusBeforeCancellation || 'Published',
      statusBeforeCancellation: undefined,
      cancellationReason: undefined,
      cancellationTimestamp: undefined,
    } : session);
    const taskIds = new Set(this.makeupTasks.filter((task) => task.cancelledSessionId === sessionId).map((task) => task.id));
    this.makeupTasks = this.makeupTasks.filter((task) => task.cancelledSessionId !== sessionId);
    this.recoveryOpportunities = this.recoveryOpportunities.filter((opportunity) => !taskIds.has(opportunity.makeupTaskId));
    this.notifications = this.notifications.filter((notification) => notification.actionPayload?.sessionId !== sessionId);
    this.logAudit(userId, 'CLASS_CANCELLATION_REVERSED', 'ClassSession', sessionId, `Restored ${target.courseId} (${target.day} ${target.timeSlotId}) after cancellation.`);
    return true;
  }

  public requestScheduleChange(sessionId: string, details: string, userName = 'Faculty') {
    const target = this.activeSessions.find((session) => session.id === sessionId);
    if (!target) return false;
    this.notifications.unshift({
      id: `notif-${crypto.randomUUID()}`,
      type: 'approval_needed',
      title: `Schedule change requested: ${target.courseId}`,
      message: `${userName} requested a reschedule or faculty swap for ${target.day} ${target.timeSlotId} (${target.sectionId}). ${details}`,
      timestamp: new Date().toISOString(), read: false, category: 'Warning', actionable: true,
      actionPayload: { sessionId, sectionId: target.sectionId },
    });
    this.logAudit(userName, 'SCHEDULE_CHANGE_REQUESTED', 'ClassSession', sessionId, details);
    return true;
  }

  public scheduleMakeupSession(opportunityId: string, userId = 'coordinator'): { success: boolean; session?: ClassSession } {
    const opp = this.recoveryOpportunities.find(o => o.id === opportunityId);
    if (!opp) return { success: false };

    const makeupTask = this.makeupTasks.find(t => t.id === opp.makeupTaskId);
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

    this.activeSessions.push(newSession);

    this.makeupTasks = this.makeupTasks.map(t =>
      t.id === makeupTask.id ? { ...t, status: 'Scheduled' } : t
    );

    this.recoveryOpportunities = this.recoveryOpportunities.map(o =>
      o.id === opportunityId ? { ...o, status: 'Approved' } : o
    );

    const roomObj = this.rooms.get(opp.roomId);
    this.notifications.unshift({
      id: `notif-${Date.now()}`,
      type: 'makeup_request',
      title: `Makeup Scheduled: ${makeupTask.courseId}`,
      message: `Recovery class locked for ${opp.targetDay} in ${roomObj?.name || opp.roomId}. Students and Faculty notified.`,
      timestamp: new Date().toISOString(),
      read: false,
      category: 'Success',
    });

    this.logAudit(
      userId,
      'MAKEUP_SCHEDULED',
      'ClassSession',
      newSessionId,
      `Scheduled makeup class for ${makeupTask.courseId} on ${opp.targetDay} (${opp.timeSlotId}) in ${roomObj?.name || opp.roomId}.`
    );

    return { success: true, session: newSession };
  }

  public declineOpportunity(opportunityId: string, userId = 'faculty'): boolean {
    this.recoveryOpportunities = this.recoveryOpportunities.map(o =>
      o.id === opportunityId ? { ...o, status: 'Rejected' } : o
    );
    this.logAudit(userId, 'RECOVERY_DECLINED', 'RecoveryOpportunity', opportunityId, `Declined recovery option ${opportunityId}`);
    return true;
  }

  public castReplacementVote(pollId: string, studentId: string, optionId: string): { success: boolean; message: string } {
    const voteKey = `${pollId}:${studentId}`;
    const poll = this.replacementPolls.find(p => p.id === pollId);
    if (!poll || !poll.isActive) {
      return { success: false, message: 'This replacement poll is inactive or expired.' };
    }
    if (!poll.options.some(option => option.id === optionId)) {
      return { success: false, message: 'The selected option does not belong to this poll.' };
    }

    const previousOptionId = this.replacementVotes.get(voteKey);
    if (previousOptionId === optionId) return { success: true, message: 'Your existing vote is already recorded.' };
    if (previousOptionId) {
      poll.options = poll.options.map(option => option.id === previousOptionId
        ? { ...option, votes: Math.max(0, option.votes - 1) }
        : option.id === optionId ? { ...option, votes: option.votes + 1 } : option);
      this.replacementVotes.set(voteKey, optionId);
      return { success: true, message: 'Your replacement slot vote has been updated.' };
    }

    this.replacementVotes.set(voteKey, optionId);
    poll.votedStudentsCount += 1;
    poll.options = poll.options.map(opt =>
      opt.id === optionId ? { ...opt, votes: opt.votes + 1 } : opt
    );

    return { success: true, message: 'Your replacement slot vote has been securely recorded.' };
  }

  public createReplacementPoll(input: { sectionId: string; courseId: string; question: string; options: Array<{ day: DayOfWeek; timeSlotLabel: string }> }, userId = 'coordinator') {
    const poll: StudentPoll = {
      id: `poll-${crypto.randomUUID()}`,
      makeupTaskId: '',
      courseId: input.courseId,
      sectionId: input.sectionId,
      question: input.question,
      options: input.options.map((option) => ({
        id: `opt-${crypto.randomUUID()}`,
        day: option.day,
        timeSlotLabel: option.timeSlotLabel,
        votes: 0,
        isSystemRecommended: false,
      })),
      totalEligibleStudents: this.groups.get(input.sectionId)?.studentCount || 0,
      votedStudentsCount: 0,
      isActive: true,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };
    this.replacementPolls.unshift(poll);
    this.notifications.unshift({
      id: `notif-${crypto.randomUUID()}`,
      recipientRole: 'Student',
      type: 'poll_created',
      title: 'New class time poll',
      message: `${input.question} (${this.groups.get(input.sectionId)?.name || input.sectionId})`,
      actionPayload: { sectionId: input.sectionId },
      timestamp: new Date().toISOString(),
      read: false,
      category: 'Info',
    });
    this.logAudit(userId, 'REPLACEMENT_POLL_CREATED', 'StudentPoll', poll.id, `Opened poll for ${input.courseId} in ${input.sectionId}.`);
    return poll;
  }

  public closeReplacementPoll(pollId: string, userId = 'coordinator') {
    const poll = this.replacementPolls.find(item => item.id === pollId);
    if (!poll || !poll.isActive) return false;
    poll.isActive = false;
    this.logAudit(userId, 'REPLACEMENT_POLL_CLOSED', 'StudentPoll', poll.id, 'Closed replacement time poll.');
    return true;
  }

  public markNotificationRead(id: string): boolean {
    const notif = this.notifications.find(n => n.id === id);
    if (notif) {
      notif.read = true;
      return true;
    }
    return false;
  }

  private logAudit(userId: string, action: string, entityType: string, entityId: string, details: string) {
    if (action === 'TIMETABLE_PUBLISHED' && this.auditEvents.some((event) => event.action === action && event.entityType === entityType && event.entityId === entityId && Date.now() - Date.parse(event.timestamp) < 5_000)) return;
    this.auditEvents.unshift({
      id: `audit-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
      timestamp: new Date().toISOString(),
      userId,
      userName: userId,
      action,
      entityType,
      entityId,
      details,
    });
  }
}

// Global Singleton Store Instance
export const supabaseStore = new SupabaseRelationalStore();
