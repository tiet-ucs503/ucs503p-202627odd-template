import crypto from 'crypto';
import type {
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
import { INITIAL_ACADEMIC_YEAR, INITIAL_CONSTRAINTS, type StudentRecord } from '../lib/initialData';
import { validateTimetableIndependently, validateProposedSessionMove, validateProposedSessionSwap } from '../lib/independentValidator';
import { executeOptimizationEngine, type BudgetMode, type OptimizationProfile } from '../lib/optimizationEngine';
import { findSelfHealingRecoverySlots, calculateHealthScore, checkHardConstraints } from '../lib/recoveryEngine';
import type { ExcelImportPreview } from '../lib/excelMasterService';
import type { Db } from './db';
import { HttpError, ValidationError, SPECS, clean, requireFields } from './validate';
import { buildDemoDataset, DEMO_NOTIFICATIONS, DEMO_AUDIT_EVENTS } from './demoData';
import { STAFF_ROLES, type RoleCode, type RosterMatch } from './auth';

const T = 'intellischedule';
const AUDIT_IN_MEMORY = 500;

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const clone = <V>(v: V): V => structuredClone(v);

type Notification = NotificationItem & { readBy?: string[]; createdAt?: string };
type ParsedImport = ExcelImportPreview['parsedData'];

export interface Viewer {
  id: string;
  name: string;
  email: string;
  roleCode: RoleCode;
  isDemo: boolean;
  profile: Record<string, unknown>;
}

class ConflictError extends HttpError {
  constructor() {
    super(409, 'The timetable data was changed by another server instance. Reload the page and try again.');
  }
}

export class TimetableStore {
  private db!: Db;

  // Academic master data
  private academicYear: AcademicYearConfig = clone(INITIAL_ACADEMIC_YEAR);
  private departments = new Map<string, Department>();
  private programs = new Map<string, Program>();
  private courses = new Map<string, Course>();
  private facultyMembers = new Map<string, Faculty>();
  private rooms = new Map<string, Room>();
  private groups = new Map<string, StudentSection>();
  private students = new Map<string, StudentRecord>();
  private allocations = new Map<string, CourseAllocation>();
  private constraints = new Map<string, AcademicConstraint>();

  // Timetable: the coordinators' working draft, and the snapshot students and faculty see.
  private activeSessions: ClassSession[] = [];
  private activeVersionNumber: number | null = null;
  private publishedSessions: ClassSession[] = [];
  private publishedVersionNumber: number | null = null;
  private versions: TimetableVersion[] = []; // newest first

  // Operations
  private notifications: Notification[] = [];
  private makeupTasks: MakeupTask[] = [];
  private recoveryOpportunities: RecoveryOpportunity[] = [];
  private polls: StudentPoll[] = [];
  private votes = new Map<string, string>(); // `${pollId}:${userId}` -> optionId

  private auditEvents: AuditLog[] = []; // most recent, newest first
  private pendingAudit: AuditLog[] = [];

  // Persistence bookkeeping
  private docVersion = new Map<string, number>();
  private lastWritten = new Map<string, string>();
  private persistedVersions = new Map<number, boolean>(); // versionNumber -> isPublished as stored
  private chain: Promise<unknown> = Promise.resolve();

  // ---------------------------------------------------------------------------
  // Lifecycle & persistence
  // ---------------------------------------------------------------------------

  async init(db: Db, opts: { seedDemoData: boolean }) {
    this.db = db;
    if (await this.load()) return;
    this.constraints = new Map(INITIAL_CONSTRAINTS.map((c) => [c.id, { ...c }]));
    if (opts.seedDemoData) this.seedDemoData();
    else this.logAudit('System', 'DATABASE_INITIALISED', 'Institution', 'inst-thapar', 'Started with an empty academic dataset.');
    await this.persist();
  }

  private seedDemoData() {
    const d = buildDemoDataset();
    d.departments.forEach((x) => this.departments.set(x.id, x));
    d.programs.forEach((x) => this.programs.set(x.id, x));
    d.facultyMembers.forEach((x) => this.facultyMembers.set(x.id, x));
    d.rooms.forEach((x) => this.rooms.set(x.id, x));
    d.sections.forEach((x) => this.groups.set(x.id, x));
    d.students.forEach((x) => this.students.set(x.id, x));
    d.courses.forEach((x) => this.courses.set(x.id, x));
    d.allocations.forEach((x) => this.allocations.set(x.id, x));
    this.notifications = clone(DEMO_NOTIFICATIONS);

    // Baseline timetable so every portal has something to show; published so students see it.
    const result = executeOptimizationEngine(
      this.academicYear, d.allocations, d.facultyMembers, d.rooms, d.sections, d.courses, [...this.constraints.values()],
      { budgetMode: 'FAST', seed: 1337 },
    );
    const sessions = result.bestCandidate?.sessions ?? [];
    this.addVersion({
      label: 'v1.0 (Master Baseline Draft)',
      summary: 'Initial master timetable derived from the sample dataset THIRD-YEAR-COMPUTER-2026.',
      reason: 'Sample dataset',
      sessions,
      createdBy: 'System',
      healthScore: result.bestCandidate?.healthScore ?? 0,
    });
    this.activeSessions = clone(sessions);
    if (sessions.length) this.publishActive('System');
    for (const e of DEMO_AUDIT_EVENTS) this.logAudit(e.userName, e.action, e.entityType, e.entityId, e.details);
    this.logAudit(
      'System', 'DATABASE_BOOTSTRAPPED', 'Institution', 'inst-thapar',
      `Seeded sample data: ${this.departments.size} departments, ${this.courses.size} courses, ${this.facultyMembers.size} faculty, ${this.rooms.size} rooms, ${this.groups.size} groups, ${this.students.size} students, ${this.allocations.size} allocations.`,
    );
  }

  private documents(): Record<string, unknown> {
    return {
      academic: {
        academicYear: this.academicYear,
        departments: [...this.departments.values()],
        programs: [...this.programs.values()],
        courses: [...this.courses.values()],
        facultyMembers: [...this.facultyMembers.values()],
        rooms: [...this.rooms.values()],
        groups: [...this.groups.values()],
        allocations: [...this.allocations.values()],
        constraints: [...this.constraints.values()],
      },
      students: [...this.students.values()],
      timetable: {
        activeSessions: this.activeSessions,
        activeVersionNumber: this.activeVersionNumber,
        publishedSessions: this.publishedSessions,
        publishedVersionNumber: this.publishedVersionNumber,
      },
      operations: {
        notifications: this.notifications,
        makeupTasks: this.makeupTasks,
        recoveryOpportunities: this.recoveryOpportunities,
        polls: this.polls,
        votes: [...this.votes.entries()],
      },
    };
  }

  /** Loads everything from the database. Returns false when the database is empty. */
  private async load(): Promise<boolean> {
    const rows = await this.db.query<{ key: string; data: any; version: number }>(`select key, data, version from ${T}.app_state`);
    if (!rows.some((r) => r.key === 'academic')) return false;
    const doc = Object.fromEntries(rows.map((r) => [r.key, r.data]));
    const byId = <V extends { id: string }>(list: V[] = []) => new Map(list.map((x) => [x.id, x]));

    const a = doc.academic;
    this.academicYear = a.academicYear;
    this.departments = byId(a.departments);
    this.programs = byId(a.programs);
    this.courses = byId(a.courses);
    this.facultyMembers = byId(a.facultyMembers);
    this.rooms = byId(a.rooms);
    this.groups = byId(a.groups);
    this.allocations = byId(a.allocations);
    this.constraints = byId(a.constraints);
    this.students = byId(doc.students ?? []);
    const t = doc.timetable ?? {};
    this.activeSessions = t.activeSessions ?? [];
    this.activeVersionNumber = t.activeVersionNumber ?? null;
    this.publishedSessions = t.publishedSessions ?? [];
    this.publishedVersionNumber = t.publishedVersionNumber ?? null;
    const o = doc.operations ?? {};
    this.notifications = o.notifications ?? [];
    this.makeupTasks = o.makeupTasks ?? [];
    this.recoveryOpportunities = o.recoveryOpportunities ?? [];
    this.polls = o.polls ?? [];
    this.votes = new Map(o.votes ?? []);

    const versionRows = await this.db.query<{ data: TimetableVersion; is_published: boolean }>(
      `select data, is_published from ${T}.timetable_versions order by version_number desc`,
    );
    this.versions = versionRows.map((r) => ({ ...r.data, isPublished: r.is_published }));
    const auditRows = await this.db.query<any>(
      `select id, at, user_name, action, entity_type, entity_id, details from ${T}.audit_log order by at desc limit ${AUDIT_IN_MEMORY}`,
    );
    this.auditEvents = auditRows.map((r) => ({
      id: r.id,
      timestamp: new Date(r.at).toISOString(),
      userId: r.user_name,
      userName: r.user_name,
      action: r.action,
      entityType: r.entity_type,
      entityId: r.entity_id,
      details: r.details,
    }));
    this.pendingAudit = [];

    this.docVersion = new Map(rows.map((r) => [r.key, r.version]));
    const docs = this.documents();
    this.lastWritten = new Map(Object.entries(docs).map(([k, v]) => [k, JSON.stringify(v)]));
    this.persistedVersions = new Map(this.versions.map((v) => [v.versionNumber, v.isPublished]));
    return true;
  }

  /** Writes every changed document in one transaction. Calls are serialised. */
  persist(): Promise<void> {
    const run = this.chain.then(() => this.flush());
    this.chain = run.catch(() => {});
    return run;
  }

  private async flush() {
    const changedDocs = Object.entries(this.documents())
      .map(([key, value]) => [key, JSON.stringify(value)] as const)
      .filter(([key, json]) => this.lastWritten.get(key) !== json);
    const newVersions = this.versions.filter((v) => !this.persistedVersions.has(v.versionNumber));
    const flagChanges = this.versions.filter(
      (v) => this.persistedVersions.has(v.versionNumber) && this.persistedVersions.get(v.versionNumber) !== v.isPublished,
    );
    const audit = [...this.pendingAudit];
    if (!changedDocs.length && !newVersions.length && !flagChanges.length && !audit.length) return;

    const newDocVersions = new Map<string, number>();
    try {
      await this.db.tx(async (q) => {
        for (const [key, json] of changedDocs) {
          const current = this.docVersion.get(key);
          const rows =
            current === undefined
              ? await q<{ version: number }>(
                  `insert into ${T}.app_state (key, data) values ($1, $2::jsonb) on conflict (key) do nothing returning version`,
                  [key, json],
                )
              : await q<{ version: number }>(
                  `update ${T}.app_state set data = $2::jsonb, version = version + 1, updated_at = now()
                    where key = $1 and version = $3 returning version`,
                  [key, json, current],
                );
          if (!rows.length) throw new ConflictError();
          newDocVersions.set(key, rows[0].version);
        }
        for (const v of newVersions) {
          const { isPublished, ...data } = v;
          await q(`insert into ${T}.timetable_versions (version_number, data, is_published, created_at) values ($1, $2, $3, $4)`, [
            v.versionNumber, data, isPublished, v.createdAt,
          ]);
        }
        for (const v of flagChanges) {
          await q(`update ${T}.timetable_versions set is_published = $2 where version_number = $1`, [v.versionNumber, v.isPublished]);
        }
        for (const e of audit) {
          await q(
            `insert into ${T}.audit_log (id, at, user_name, action, entity_type, entity_id, details) values ($1, $2, $3, $4, $5, $6, $7)`,
            [e.id, e.timestamp, e.userName, e.action, e.entityType, e.entityId, e.details],
          );
        }
      });
    } catch (err) {
      if (err instanceof ConflictError) await this.load();
      throw err;
    }

    for (const [key, json] of changedDocs) this.lastWritten.set(key, json);
    for (const [key, version] of newDocVersions) this.docVersion.set(key, version);
    for (const v of [...newVersions, ...flagChanges]) this.persistedVersions.set(v.versionNumber, v.isPublished);
    this.pendingAudit = this.pendingAudit.slice(audit.length);
  }

  // ---------------------------------------------------------------------------
  // Reads
  // ---------------------------------------------------------------------------

  getBootstrapState(viewer: Viewer) {
    const staff = STAFF_ROLES.includes(viewer.roleCode);
    return {
      academicYear: this.academicYear,
      departments: [...this.departments.values()],
      programs: [...this.programs.values()],
      courses: [...this.courses.values()],
      facultyMembers: [...this.facultyMembers.values()],
      rooms: [...this.rooms.values()],
      sections: [...this.groups.values()],
      allocations: [...this.allocations.values()],
      constraints: [...this.constraints.values()],
      studentsCount: this.students.size,
      // Students and faculty see the published timetable; staff work on the draft.
      sessions: staff ? this.activeSessions : this.publishedSessions,
      publishedSessions: this.publishedSessions,
      activeVersionNumber: this.activeVersionNumber,
      publishedVersionNumber: this.publishedVersionNumber,
      versions: this.versions.map(({ sessions, ...v }) => ({ ...v, sessions: [], sessionsCount: v.sessionsCount ?? sessions.length })),
      notifications: this.notifications
        .filter((n) => !n.recipientRole || staff || n.recipientRole === roleKeyOf(viewer.roleCode))
        .map(({ readBy, ...n }) => ({ ...n, read: (readBy ?? []).includes(viewer.id) })),
      makeupTasks: this.makeupTasks,
      recoveryOpportunities: this.recoveryOpportunities,
      polls: this.polls.map((p) => {
        const voted = this.votes.get(`${p.id}:${viewer.id}`);
        return { ...p, userHasVoted: Boolean(voted), userVotedOptionId: voted };
      }),
      auditLogs: staff ? this.auditEvents.slice(0, 200) : [],
      publishStatus: this.academicYear.publishStatus,
      roster: this.rosterContext(viewer),
    };
  }

  getVersion(versionNumber: number): TimetableVersion {
    const v = this.versions.find((x) => x.versionNumber === versionNumber);
    if (!v) throw new HttpError(404, `Version ${versionNumber} not found.`);
    return v;
  }

  getAuditLogs(limit = 200) {
    return this.auditEvents.slice(0, limit);
  }

  queryStudents(page = 1, limit = 20, search = '', sectionId = '') {
    let all = [...this.students.values()];
    const q = search.toLowerCase().trim();
    if (q) {
      all = all.filter(
        (s) => s.studentId.toLowerCase().includes(q) || s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q) || s.sectionName.toLowerCase().includes(q),
      );
    }
    if (sectionId && sectionId !== 'ALL') all = all.filter((s) => s.sectionId === sectionId || s.sectionName === sectionId);
    const total = all.length;
    return { total, page, limit, totalPages: Math.ceil(total / limit) || 1, students: all.slice((page - 1) * limit, page * limit) };
  }

  /** Role for a Google sign-in that is not yet a user, from the imported roster. */
  rosterLookup = (email: string): RosterMatch | null => {
    const fac = [...this.facultyMembers.values()].find((f) => f.email.toLowerCase() === email);
    if (fac) return { roleCode: 'FACULTY', name: fac.name, department: this.departments.get(fac.departmentId)?.name ?? '' };
    const st = [...this.students.values()].find((s) => s.email.toLowerCase() === email);
    if (st) {
      const isCr = this.groups.get(st.sectionId)?.classRepresentative?.email?.toLowerCase() === email;
      return {
        roleCode: isCr ? 'CLASS_REPRESENTATIVE' : 'STUDENT',
        name: st.name,
        department: this.departments.get(this.groups.get(st.sectionId)?.departmentId ?? '')?.name ?? '',
        profile: { rollNumber: st.studentId, sectionId: st.sectionId, batch: String(st.batchYear) },
      };
    }
    return null;
  };

  /** Which faculty record / student section belongs to the signed-in user. */
  rosterContext(viewer: Viewer) {
    const email = viewer.email.toLowerCase();
    const role = viewer.roleCode;
    const linked = viewer.profile.facultyId ? this.facultyMembers.get(String(viewer.profile.facultyId)) : undefined;
    let faculty = linked ?? [...this.facultyMembers.values()].find((f) => f.email.toLowerCase() === email);
    if (!faculty && viewer.isDemo && ['FACULTY', 'COORDINATOR', 'HOD'].includes(role)) faculty = this.facultyMembers.values().next().value;

    let student = [...this.students.values()].find((s) => s.email.toLowerCase() === email);
    const roll = viewer.profile.rollNumber ? String(viewer.profile.rollNumber) : '';
    if (!student && roll) student = [...this.students.values()].find((s) => s.studentId === roll);
    let sectionId = student?.sectionId ?? (viewer.profile.sectionId ? String(viewer.profile.sectionId) : undefined);
    if (!sectionId && viewer.isDemo && (role === 'STUDENT' || role === 'CLASS_REPRESENTATIVE')) {
      student = this.students.values().next().value;
      sectionId = student?.sectionId;
    }
    const crSection = [...this.groups.values()].find((g) => g.classRepresentative?.email?.toLowerCase() === email);
    return {
      facultyId: faculty?.id ?? null,
      sectionId: sectionId && this.groups.has(sectionId) ? sectionId : null,
      subSectionId: student?.subSectionId ?? null,
      rollNumber: student?.studentId ?? (roll || null),
      crSectionId: crSection?.id ?? (role === 'CLASS_REPRESENTATIVE' && sectionId ? sectionId : null),
    };
  }

  // ---------------------------------------------------------------------------
  // Academic configuration
  // ---------------------------------------------------------------------------

  updateAcademicYear(body: unknown, user: string) {
    const b = (body ?? {}) as Record<string, any>;
    const next = { ...this.academicYear };
    if (b.yearLabel !== undefined) next.yearLabel = String(b.yearLabel).trim().slice(0, 50);
    if (b.semesterType !== undefined) {
      if (!['Odd (Autumn)', 'Even (Spring)', 'Summer'].includes(b.semesterType)) throw new ValidationError('Unknown semester type.');
      next.semesterType = b.semesterType;
    }
    if (b.semesterNumber !== undefined) next.semesterNumber = clean<{ n: number }>({ n: b.semesterNumber }, { n: { t: 'number', min: 1, max: 20, int: true } }).n!;
    if (b.workingDays !== undefined) {
      const days: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      if (!Array.isArray(b.workingDays) || !b.workingDays.length || b.workingDays.some((d: string) => !days.includes(d as DayOfWeek))) {
        throw new ValidationError('workingDays must be a non-empty list of weekdays.');
      }
      next.workingDays = days.filter((d) => b.workingDays.includes(d));
    }
    if (b.timeSlots !== undefined) {
      if (!Array.isArray(b.timeSlots) || !b.timeSlots.length || b.timeSlots.length > 16) throw new ValidationError('timeSlots must list 1-16 periods.');
      next.timeSlots = b.timeSlots.map((s: any, i: number) => {
        if (!s?.id || !/^\d{2}:\d{2}$/.test(s.startTime) || !/^\d{2}:\d{2}$/.test(s.endTime) || s.startTime >= s.endTime) {
          throw new ValidationError(`Time slot ${i + 1} needs an id and a valid HH:MM start before its end.`);
        }
        return {
          id: String(s.id),
          periodNumber: Number(s.periodNumber) || i + 1,
          startTime: s.startTime,
          endTime: s.endTime,
          label: String(s.label || `${s.startTime} - ${s.endTime}`),
          isBreak: Boolean(s.isBreak),
          isLunch: Boolean(s.isLunch),
        };
      });
    }
    if (b.lunchPeriodId !== undefined) next.lunchPeriodId = String(b.lunchPeriodId);
    this.academicYear = next;
    this.logAudit(user, 'ACADEMIC_YEAR_UPDATED', 'AcademicYear', next.id, `Updated academic year settings (${next.yearLabel}).`);
    return next;
  }

  // ---------------------------------------------------------------------------
  // CRUD with validation and referential checks
  // ---------------------------------------------------------------------------

  private mustExist<V>(map: Map<string, V>, id: string | undefined, label: string) {
    if (id && !map.has(id)) throw new ValidationError(`${label} '${id}' does not exist.`);
  }

  private checkRefs(x: { departmentId?: string; programId?: string; primaryFacultyId?: string }) {
    if (x.departmentId) this.mustExist(this.departments, x.departmentId, 'Department');
    if (x.programId) this.mustExist(this.programs, x.programId, 'Program');
    if (x.primaryFacultyId) this.mustExist(this.facultyMembers, x.primaryFacultyId, 'Faculty');
  }

  private create<V extends { id: string }>(map: Map<string, V>, id: string, value: V, label: string, user: string, action: string) {
    if (map.has(id)) throw new HttpError(409, `${label} already exists (${id}).`);
    map.set(id, value);
    this.logAudit(user, action, label, id, `Created ${label.toLowerCase()} ${id}.`);
    return value;
  }

  private update<V extends { id: string }>(map: Map<string, V>, id: string, changes: Partial<V>, label: string, user: string, action: string) {
    const existing = map.get(id);
    if (!existing) throw new HttpError(404, `${label} '${id}' not found.`);
    const updated = { ...existing, ...changes, id };
    map.set(id, updated);
    this.logAudit(user, action, label, id, `Updated ${label.toLowerCase()} ${id}.`);
    return updated;
  }

  private remove<V>(map: Map<string, V>, id: string, label: string, user: string, action: string, blockers: [boolean, string][]) {
    if (!map.has(id)) throw new HttpError(404, `${label} '${id}' not found.`);
    const blocked = blockers.find(([b]) => b);
    if (blocked) throw new HttpError(409, `Cannot delete ${label.toLowerCase()}: ${blocked[1]}`);
    map.delete(id);
    this.logAudit(user, action, label, id, `Deleted ${label.toLowerCase()} ${id}.`);
  }

  private allocList() {
    return [...this.allocations.values()];
  }

  createDepartment(body: unknown, user: string) {
    const d = clean<Department>(body, SPECS.department);
    requireFields(d, ['name', 'code']);
    const dept: Department = { hodName: '', contactEmail: '', status: 'Active', ...d, code: d.code!.toUpperCase() } as Department;
    return this.create(this.departments, `dept-${slug(dept.code)}`, { ...dept, id: `dept-${slug(dept.code)}` }, 'Department', user, 'CREATE_DEPARTMENT');
  }
  updateDepartment(id: string, body: unknown, user: string) {
    return this.update(this.departments, id, clean<Department>(body, SPECS.department), 'Department', user, 'UPDATE_DEPARTMENT');
  }
  deleteDepartment(id: string, user: string) {
    const used = (list: Iterable<{ departmentId?: string }>) => [...list].some((x) => x.departmentId === id);
    this.remove(this.departments, id, 'Department', user, 'DELETE_DEPARTMENT', [
      [used(this.programs.values()), 'programs belong to it.'],
      [used(this.courses.values()), 'courses belong to it.'],
      [used(this.facultyMembers.values()), 'faculty belong to it.'],
      [used(this.groups.values()), 'student groups belong to it.'],
    ]);
  }

  createProgram(body: unknown, user: string) {
    const p = clean<Program>(body, SPECS.program);
    requireFields(p, ['name', 'code', 'departmentId']);
    this.checkRefs(p);
    const id = `prog-${slug(p.code!)}`;
    return this.create(this.programs, id, { durationYears: 4, totalSemesters: 8, status: 'Active', ...p, code: p.code!.toUpperCase(), id } as Program, 'Program', user, 'CREATE_PROGRAM');
  }
  updateProgram(id: string, body: unknown, user: string) {
    const p = clean<Program>(body, SPECS.program);
    this.checkRefs(p);
    return this.update(this.programs, id, p, 'Program', user, 'UPDATE_PROGRAM');
  }
  deleteProgram(id: string, user: string) {
    this.remove(this.programs, id, 'Program', user, 'DELETE_PROGRAM', [
      [[...this.groups.values()].some((g) => g.programId === id), 'student groups are enrolled in it.'],
    ]);
  }

  createCourse(body: unknown, user: string) {
    const c = clean<Course>(body, SPECS.course);
    requireFields(c, ['code', 'name', 'departmentId']);
    this.checkRefs(c);
    const id = `course-${slug(c.code!)}`;
    const course: Course = {
      credits: 4,
      requiredLecturesPerWeek: 3,
      requiredTutorialsPerWeek: 0,
      requiredLabsPerWeek: 0,
      totalSemesterHours: 45,
      completedHours: 0,
      cancelledHours: 0,
      requiredEquipment: [],
      primaryFacultyId: '',
      status: 'Active',
      ...c,
      requiresLab: c.requiresLab ?? (c.requiredLabsPerWeek ?? 0) > 0,
      code: c.code!.toUpperCase(),
      id,
    } as Course;
    if ([...this.courses.values()].some((x) => x.code.toUpperCase() === course.code)) throw new HttpError(409, `Course ${course.code} already exists.`);
    return this.create(this.courses, id, course, 'Course', user, 'CREATE_COURSE');
  }
  updateCourse(id: string, body: unknown, user: string) {
    const c = clean<Course>(body, SPECS.course);
    this.checkRefs(c);
    return this.update(this.courses, id, c, 'Course', user, 'UPDATE_COURSE');
  }
  deleteCourse(id: string, user: string) {
    this.remove(this.courses, id, 'Course', user, 'DELETE_COURSE', [
      [this.allocList().some((a) => a.courseId === id), 'it has course allocations. Delete those first.'],
    ]);
  }

  createFaculty(body: unknown, user: string) {
    const f = clean<Faculty>(body, SPECS.faculty);
    requireFields(f, ['name', 'email', 'departmentId']);
    this.checkRefs(f);
    const email = f.email!.toLowerCase();
    if ([...this.facultyMembers.values()].some((x) => x.email.toLowerCase() === email)) throw new HttpError(409, `Faculty with email ${email} already exists.`);
    const id = `fac-${slug(email.split('@')[0])}`;
    return this.create(this.facultyMembers, id, {
      designation: 'Assistant Professor',
      subjectsQualified: [],
      maxDirectTeachingHours: 14,
      weeklyHoursLimit: 40,
      status: 'Active',
      ...f,
      email,
      preferences: normalisePreferences(f.preferences),
      id,
    } as Faculty, 'Faculty', user, 'CREATE_FACULTY');
  }
  updateFaculty(id: string, body: unknown, user: string) {
    const f = clean<Faculty>(body, SPECS.faculty);
    this.checkRefs(f);
    if (f.email) f.email = f.email.toLowerCase();
    if (f.preferences) f.preferences = normalisePreferences(f.preferences);
    return this.update(this.facultyMembers, id, f, 'Faculty', user, 'UPDATE_FACULTY');
  }
  deleteFaculty(id: string, user: string) {
    this.remove(this.facultyMembers, id, 'Faculty', user, 'DELETE_FACULTY', [
      [this.allocList().some((a) => a.facultyId === id), 'they are allocated to courses. Reassign those allocations first.'],
    ]);
    for (const c of this.courses.values()) if (c.primaryFacultyId === id) c.primaryFacultyId = '';
  }

  createRoom(body: unknown, user: string) {
    const r = clean<Room>(body, SPECS.room);
    requireFields(r, ['name', 'capacity']);
    const id = `room-${slug(r.name!)}`;
    return this.create(this.rooms, id, { building: '', floor: 0, type: 'LectureHall', equipment: [], isAvailable: true, ...r, id } as Room, 'Room', user, 'CREATE_ROOM');
  }
  updateRoom(id: string, body: unknown, user: string) {
    return this.update(this.rooms, id, clean<Room>(body, SPECS.room), 'Room', user, 'UPDATE_ROOM');
  }
  deleteRoom(id: string, user: string) {
    this.remove(this.rooms, id, 'Room', user, 'DELETE_ROOM', [
      [this.activeSessions.some((s) => s.roomId === id) || this.publishedSessions.some((s) => s.roomId === id), 'classes are scheduled in it. Regenerate or move them first.'],
      [this.allocList().some((a) => a.preferredRoomId === id), 'allocations prefer it.'],
    ]);
  }

  private buildSubSections(secId: string, studentCount: number, input: unknown): SubSection[] {
    const list = Array.isArray(input) ? input : [];
    if (!list.length) {
      return [
        { id: `sub-${secId}-1`, sectionId: secId, name: '1', studentCount: Math.ceil(studentCount / 2), type: 'Lab' },
        { id: `sub-${secId}-2`, sectionId: secId, name: '2', studentCount: Math.floor(studentCount / 2), type: 'Lab' },
      ];
    }
    return list.map((s: any, i) => {
      const name = String(s?.name ?? i + 1).trim();
      const count = Number(s?.studentCount);
      return {
        id: s?.id ? String(s.id) : `sub-${secId}-${slug(name)}`,
        sectionId: secId,
        name,
        studentCount: Number.isFinite(count) && count > 0 ? Math.round(count) : Math.ceil(studentCount / list.length),
        type: ['Lab', 'Tutorial', 'Practical', 'General'].includes(s?.type) ? s.type : 'Lab',
      };
    });
  }

  createGroup(body: unknown, user: string) {
    const g = clean<StudentSection>(body, SPECS.group);
    requireFields(g, ['name', 'studentCount', 'departmentId']);
    this.checkRefs(g);
    const id = `sec-${slug(g.name!)}`;
    const group: StudentSection = {
      program: '',
      semester: 1,
      batchYear: new Date().getFullYear(),
      targetSize: g.studentCount,
      maxSize: Math.ceil(g.studentCount! * 1.2),
      classRepresentative: { name: '', email: '', studentId: '' },
      status: 'Active',
      ...g,
      subSections: this.buildSubSections(id, g.studentCount!, g.subSections),
      id,
    } as StudentSection;
    return this.create(this.groups, id, group, 'StudentSection', user, 'CREATE_GROUP');
  }
  updateGroup(id: string, body: unknown, user: string) {
    const g = clean<StudentSection>(body, SPECS.group);
    this.checkRefs(g);
    if (g.subSections) {
      const kept = new Set(g.subSections.map((s: any) => s?.id).filter(Boolean));
      const removed = (this.groups.get(id)?.subSections ?? []).filter((s) => !kept.has(s.id));
      if (removed.some((s) => this.allocList().some((a) => a.subSectionId === s.id))) {
        throw new HttpError(409, 'A subgroup you removed still has course allocations.');
      }
      g.subSections = this.buildSubSections(id, g.studentCount ?? this.groups.get(id)?.studentCount ?? 0, g.subSections);
    }
    return this.update(this.groups, id, g, 'StudentSection', user, 'UPDATE_GROUP');
  }
  deleteGroup(id: string, user: string) {
    this.remove(this.groups, id, 'StudentSection', user, 'DELETE_GROUP', [
      [this.allocList().some((a) => a.sectionId === id), 'it has course allocations. Delete those first.'],
      [[...this.students.values()].some((s) => s.sectionId === id), 'students are enrolled in it.'],
    ]);
  }

  addSubgroup(groupId: string, body: unknown, user: string): SubSection {
    const group = this.groups.get(groupId);
    if (!group) throw new HttpError(404, `Group '${groupId}' not found.`);
    const b = (body ?? {}) as Record<string, unknown>;
    const name = String(b.name ?? '').trim();
    if (!name) throw new ValidationError('Subgroup name is required.');
    const sub = this.buildSubSections(groupId, group.studentCount, [{ name, studentCount: b.studentCount, type: b.type }])[0];
    if ((group.subSections ?? []).some((s) => s.id === sub.id)) throw new HttpError(409, `Subgroup ${name} already exists.`);
    group.subSections = [...(group.subSections ?? []), sub];
    this.logAudit(user, 'ADD_SUBGROUP', 'SubSection', sub.id, `Added subgroup ${name} to ${group.name}.`);
    return sub;
  }
  deleteSubgroup(groupId: string, subgroupId: string, user: string) {
    const group = this.groups.get(groupId);
    if (!group || !(group.subSections ?? []).some((s) => s.id === subgroupId)) throw new HttpError(404, 'Subgroup not found.');
    if (this.allocList().some((a) => a.subSectionId === subgroupId)) throw new HttpError(409, 'Cannot delete subgroup: it has course allocations.');
    group.subSections = (group.subSections ?? []).filter((s) => s.id !== subgroupId);
    this.logAudit(user, 'DELETE_SUBGROUP', 'SubSection', subgroupId, `Removed subgroup from ${group.name}.`);
  }

  bulkGenerateGroups(body: unknown, user: string): StudentSection[] {
    const b = clean<any>(body, {
      programName: { t: 'string', max: 200 },
      programId: { t: 'string', max: 100 },
      batchYear: { t: 'number', min: 1950, max: 2100, int: true },
      semester: { t: 'number', min: 1, max: 20, int: true },
      totalStudents: { t: 'number', min: 1, max: 20000, int: true },
      numGroups: { t: 'number', min: 1, max: 52, int: true },
      namingPattern: { t: 'string', max: 50 },
      numSubgroupsPerGroup: { t: 'number', min: 1, max: 10, int: true },
      departmentId: { t: 'string', max: 100 },
    });
    requireFields(b, ['totalStudents', 'numGroups', 'departmentId']);
    this.checkRefs(b);
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const pattern: string = b.namingPattern || 'GROUP-{A}';
    const perGroup = Math.max(1, Math.round(b.totalStudents / b.numGroups));
    const subs = b.numSubgroupsPerGroup ?? 2;
    const generated: StudentSection[] = [];
    for (let i = 0; i < b.numGroups; i++) {
      const char = letters[i % letters.length] + (i >= letters.length ? String(Math.floor(i / letters.length)) : '');
      const name = pattern.replace('{A}', char).replace('{N}', String(i + 1));
      const id = `sec-${slug(name)}`;
      if (this.groups.has(id)) throw new HttpError(409, `Group ${name} already exists; choose another naming pattern.`);
      if (generated.some((g) => g.id === id)) throw new ValidationError('The naming pattern must contain {A} or {N} so each group gets a different name.');
      generated.push({
        id,
        name,
        departmentId: b.departmentId,
        program: b.programName ?? '',
        programId: b.programId,
        semester: b.semester ?? 1,
        batchYear: b.batchYear ?? new Date().getFullYear(),
        studentCount: perGroup,
        targetSize: perGroup,
        maxSize: Math.ceil(perGroup * 1.2),
        subSections: this.buildSubSections(id, perGroup, Array.from({ length: subs }, (_, j) => ({ name: `${char}${j + 1}`, studentCount: Math.round(perGroup / subs) }))),
        classRepresentative: { name: '', email: '', studentId: '' },
        status: 'Active',
      });
    }
    generated.forEach((g) => this.groups.set(g.id, g));
    this.logAudit(user, 'BULK_GROUPS_GENERATED', 'StudentSection', 'multiple', `Generated ${generated.length} groups with ${subs} subgroups each.`);
    return generated;
  }

  private checkAllocation(a: Partial<CourseAllocation>) {
    this.mustExist(this.courses, a.courseId, 'Course');
    this.mustExist(this.facultyMembers, a.facultyId, 'Faculty');
    this.mustExist(this.groups, a.sectionId, 'Group');
    this.mustExist(this.rooms, a.preferredRoomId, 'Room');
    if (a.subSectionId && !(this.groups.get(a.sectionId!)?.subSections ?? []).some((s) => s.id === a.subSectionId)) {
      throw new ValidationError(`Subgroup '${a.subSectionId}' does not belong to group '${a.sectionId}'.`);
    }
    if ((a.sessionType === 'Lab' || a.sessionType === 'Practical') && a.hoursPerWeek && a.hoursPerWeek % 2 !== 0) {
      throw new ValidationError('Labs and practicals are scheduled in 2-hour blocks, so hours per week must be even.');
    }
  }

  createAllocation(body: unknown, user: string) {
    const a = clean<CourseAllocation>(body, SPECS.allocation);
    requireFields(a, ['courseId', 'facultyId', 'sectionId']);
    const alloc = { sessionType: 'Lecture', hoursPerWeek: 3, ...a, status: 'Allocated' } as CourseAllocation;
    if (!alloc.subSectionId) delete alloc.subSectionId;
    if (!alloc.preferredRoomId) delete alloc.preferredRoomId;
    this.checkAllocation(alloc);
    const id = `alloc-${alloc.courseId}-${alloc.sectionId}${alloc.subSectionId ? `-${alloc.subSectionId}` : ''}-${alloc.sessionType.toLowerCase()}`;
    return this.create(this.allocations, id, { ...alloc, id }, 'CourseAllocation', user, 'CREATE_ALLOCATION');
  }
  updateAllocation(id: string, body: unknown, user: string) {
    const existing = this.allocations.get(id);
    if (!existing) throw new HttpError(404, `Allocation '${id}' not found.`);
    const changes = clean<CourseAllocation>(body, SPECS.allocation);
    this.checkAllocation({ ...existing, ...changes });
    return this.update(this.allocations, id, changes, 'CourseAllocation', user, 'UPDATE_ALLOCATION');
  }
  deleteAllocation(id: string, user: string) {
    this.remove(this.allocations, id, 'CourseAllocation', user, 'DELETE_ALLOCATION', []);
  }

  // ---------------------------------------------------------------------------
  // Excel master import: built on copies, committed only if nothing fails.
  // ---------------------------------------------------------------------------

  commitMasterExcelImport(input: unknown, mode: unknown, user: string) {
    if (mode !== 'upsert' && mode !== 'replace') throw new ValidationError("mode must be 'upsert' or 'replace'.");
    if (!input || typeof input !== 'object') throw new ValidationError('parsedData is required.');
    const keys = ['departments', 'programs', 'faculty', 'rooms', 'courses', 'groups', 'subgroups', 'allocations', 'students'] as const;
    const data = {} as ParsedImport;
    for (const k of keys) {
      const v = (input as any)[k] ?? [];
      if (!Array.isArray(v)) throw new ValidationError(`parsedData.${k} must be a list.`);
      if (v.length > 50_000) throw new ValidationError(`parsedData.${k} is too large.`);
      (data as any)[k] = v;
    }
    const total = keys.reduce((n, k) => n + (data as any)[k].length, 0);
    if (!total) throw new ValidationError('The workbook contains no rows to import.');
    if (mode === 'replace' && (!data.courses.length || !data.groups.length)) {
      throw new ValidationError('Replace mode needs at least the Courses and Groups sheets filled in; refusing to wipe existing data.');
    }

    const departments = new Map(this.departments);
    const programs = new Map(this.programs);
    const faculty = mode === 'replace' ? new Map<string, Faculty>() : new Map(this.facultyMembers);
    const rooms = mode === 'replace' ? new Map<string, Room>() : new Map(this.rooms);
    const courses = mode === 'replace' ? new Map<string, Course>() : new Map(this.courses);
    const groups = mode === 'replace' ? new Map<string, StudentSection>() : new Map(this.groups);
    const allocations = mode === 'replace' ? new Map<string, CourseAllocation>() : new Map(this.allocations);
    const students = mode === 'replace' ? new Map<string, StudentRecord>() : new Map(this.students);
    const errors: string[] = [];
    let imported = 0;
    const text = (v: unknown) => String(v ?? '').trim();
    const findBy = <V>(map: Map<string, V>, pred: (v: V) => boolean) => [...map.entries()].find(([, v]) => pred(v))?.[0];

    const deptByCode = (code: unknown) => findBy(departments, (d) => d.code.toUpperCase() === text(code).toUpperCase());
    for (const [i, d] of data.departments.entries()) {
      const code = text(d.code).toUpperCase();
      if (!code || !text(d.name)) { errors.push(`Departments row ${i + 2}: code and name are required.`); continue; }
      const id = deptByCode(code) ?? `dept-${slug(code)}`;
      departments.set(id, { ...departments.get(id), hodName: text(d.hodName), contactEmail: text(d.contactEmail), status: 'Active', name: text(d.name), code, id } as Department);
      imported++;
    }
    for (const [i, p] of data.programs.entries()) {
      const code = text(p.code).toUpperCase();
      const deptId = deptByCode(p.departmentCode);
      if (!code || !text(p.name) || !deptId) { errors.push(`Programs row ${i + 2}: code, name and a known department code are required.`); continue; }
      const id = findBy(programs, (x) => x.code.toUpperCase() === code) ?? `prog-${slug(code)}`;
      programs.set(id, { id, name: text(p.name), code, departmentId: deptId, durationYears: Number(p.durationYears) || 4, totalSemesters: Number(p.totalSemesters) || 8, status: 'Active' });
      imported++;
    }
    for (const [i, f] of data.faculty.entries()) {
      const email = text(f.email).toLowerCase();
      const deptId = deptByCode(f.departmentCode);
      if (!email.includes('@') || !text(f.name) || !deptId) { errors.push(`Faculty row ${i + 2}: name, email and a known department code are required.`); continue; }
      const id = findBy(faculty, (x) => x.email.toLowerCase() === email) ?? `fac-${slug(email.split('@')[0])}`;
      const prev = faculty.get(id);
      faculty.set(id, {
        ...prev,
        id,
        name: text(f.name),
        email,
        employeeId: text(f.employeeId) || prev?.employeeId,
        departmentId: deptId,
        designation: f.designation || prev?.designation || 'Assistant Professor',
        subjectsQualified: Array.isArray(f.subjectsQualified) ? f.subjectsQualified : prev?.subjectsQualified ?? [],
        maxDirectTeachingHours: Number(f.maxDirectTeachingHours) || prev?.maxDirectTeachingHours || 14,
        weeklyHoursLimit: prev?.weeklyHoursLimit ?? 40,
        preferences: normalisePreferences(f.preferences ?? prev?.preferences),
        status: prev?.status ?? 'Active',
      } as Faculty);
      imported++;
    }
    for (const [i, r] of data.rooms.entries()) {
      const name = text(r.name);
      const capacity = Number(r.capacity);
      if (!name || !(capacity > 0)) { errors.push(`Rooms row ${i + 2}: name and a positive capacity are required.`); continue; }
      const id = findBy(rooms, (x) => x.name.toUpperCase() === name.toUpperCase()) ?? `room-${slug(name)}`;
      rooms.set(id, { ...rooms.get(id), ...r, id, name, capacity, isAvailable: r.isAvailable ?? true, equipment: Array.isArray(r.equipment) ? r.equipment : [] } as Room);
      imported++;
    }
    const facByEmail = (email: unknown) => findBy(faculty, (x) => x.email.toLowerCase() === text(email).toLowerCase());
    for (const [i, c] of data.courses.entries()) {
      const code = text(c.code).toUpperCase();
      const deptId = deptByCode(c.departmentCode);
      if (!code || !text(c.name) || !deptId) { errors.push(`Courses row ${i + 2}: code, name and a known department code are required.`); continue; }
      const id = findBy(courses, (x) => x.code.toUpperCase() === code) ?? `course-${slug(code)}`;
      const prev = courses.get(id);
      courses.set(id, {
        id,
        code,
        name: text(c.name),
        departmentId: deptId,
        credits: Number(c.credits) || 4,
        requiredLecturesPerWeek: Number(c.requiredLecturesPerWeek) || 0,
        requiredTutorialsPerWeek: Number(c.requiredTutorialsPerWeek) || 0,
        requiredLabsPerWeek: Number(c.requiredLabsPerWeek) || 0,
        totalSemesterHours: Number(c.totalSemesterHours) || 45,
        completedHours: prev?.completedHours ?? 0,
        cancelledHours: prev?.cancelledHours ?? 0,
        requiresLab: Boolean(c.requiresLab) || (Number(c.requiredLabsPerWeek) || 0) > 0,
        requiredEquipment: Array.isArray(c.requiredEquipment) ? c.requiredEquipment : [],
        primaryFacultyId: (c.primaryFacultyEmail && facByEmail(c.primaryFacultyEmail)) || prev?.primaryFacultyId || '',
        status: 'Active',
      });
      imported++;
    }
    for (const [i, g] of data.groups.entries()) {
      const name = text(g.name || (g as any).code);
      const count = Number(g.studentCount);
      if (!name || !(count > 0)) { errors.push(`Groups row ${i + 2}: name and a positive student count are required.`); continue; }
      const id = findBy(groups, (x) => x.name.toUpperCase() === name.toUpperCase()) ?? `sec-${slug(name)}`;
      const prev = groups.get(id);
      const declared = data.subgroups.filter((s) => text(s.groupCode).toUpperCase() === name.toUpperCase());
      // Keep existing subgroup ids when names match so allocations stay attached.
      const subInput = declared.length
        ? declared.map((s) => ({ ...s, id: prev?.subSections?.find((p) => p.name.toUpperCase() === text(s.name).toUpperCase())?.id }))
        : prev?.subSections;
      const programId = findBy(programs, (x) => x.code.toUpperCase() === text((g as any).programCode || g.program).toUpperCase());
      groups.set(id, {
        ...prev,
        id,
        name,
        departmentId: (g.departmentId && departments.has(g.departmentId) ? g.departmentId : undefined) ?? (programId ? programs.get(programId)!.departmentId : prev?.departmentId ?? ''),
        program: text(g.program) || prev?.program || '',
        programId: programId ?? prev?.programId,
        semester: Number(g.semester) || prev?.semester || 1,
        batchYear: Number(g.batchYear) || prev?.batchYear || new Date().getFullYear(),
        studentCount: count,
        targetSize: Number(g.targetSize) || count,
        maxSize: Number(g.maxSize) || Math.ceil(count * 1.2),
        subSections: this.buildSubSections(id, count, subInput),
        classRepresentative: g.classRepresentative ?? prev?.classRepresentative ?? { name: '', email: '', studentId: '' },
        status: 'Active',
      } as StudentSection);
      imported++;
    }
    const groupByName = (n: unknown) => findBy(groups, (x) => x.name.toUpperCase() === text(n).toUpperCase());
    const importedGroups = new Set(data.groups.map((g) => text(g.name || (g as any).code).toUpperCase()));
    for (const [i, sub] of data.subgroups.entries()) {
      const groupName = text(sub.groupCode).toUpperCase();
      if (importedGroups.has(groupName)) continue; // already applied with its group above
      const gid = groupByName(groupName);
      if (!gid) {
        errors.push(`Subgroups row ${i + 2}: group '${text(sub.groupCode)}' does not exist.`);
        continue;
      }
      const g = groups.get(gid)!;
      if ((g.subSections ?? []).some((x) => x.name.toUpperCase() === text(sub.name).toUpperCase())) continue;
      groups.set(gid, { ...g, subSections: [...(g.subSections ?? []), ...this.buildSubSections(gid, g.studentCount, [sub])] });
      imported++;
    }
    const subByName = (gid: string, n: unknown) => groups.get(gid)?.subSections?.find((s) => s.name.toUpperCase() === text(n).toUpperCase());
    for (const [i, a] of data.allocations.entries()) {
      const courseId = findBy(courses, (x) => x.code.toUpperCase() === text(a.courseCode).toUpperCase());
      const facultyId = facByEmail(a.facultyEmail);
      const sectionId = groupByName(a.groupCode);
      const sub = a.subgroupName && sectionId ? subByName(sectionId, a.subgroupName) : undefined;
      const hours = Number(a.hoursPerWeek);
      const type = a.sessionType;
      if (!courseId || !facultyId || !sectionId || (a.subgroupName && !sub) || !(hours > 0)) {
        errors.push(`Allocations row ${i + 2}: unknown course, faculty, group or subgroup, or missing hours (${text(a.courseCode)} / ${text(a.groupCode)}).`);
        continue;
      }
      if ((type === 'Lab' || type === 'Practical') && hours % 2) {
        errors.push(`Allocations row ${i + 2}: lab hours must be even (2-hour blocks).`);
        continue;
      }
      const roomId = a.roomName ? findBy(rooms, (x) => x.name.toUpperCase() === text(a.roomName).toUpperCase()) : undefined;
      const id = `alloc-${courseId}-${sectionId}${sub ? `-${sub.id}` : ''}-${String(type).toLowerCase()}`;
      allocations.set(id, { id, courseId, facultyId, sectionId, subSectionId: sub?.id, sessionType: type, hoursPerWeek: hours, preferredRoomId: roomId, status: 'Allocated' });
      imported++;
    }
    for (const [i, s] of (data.students ?? []).entries()) {
      const studentId = text(s.studentId);
      const email = text(s.email).toLowerCase();
      const sectionId = groupByName(s.groupCode);
      const sub = sectionId && s.subgroupName ? subByName(sectionId, s.subgroupName) : undefined;
      if (!studentId || !email.includes('@') || !text(s.name) || !sectionId) {
        errors.push(`Students row ${i + 2}: roll number, name, email and a known group are required.`);
        continue;
      }
      const g = groups.get(sectionId)!;
      students.set(`stu-${studentId}`, {
        id: `stu-${studentId}`,
        studentId,
        name: text(s.name),
        email,
        programCode: text(s.programCode) || g.program,
        batchYear: Number(s.batchYear) || g.batchYear,
        semester: g.semester,
        sectionId,
        sectionName: g.name,
        subSectionId: sub?.id ?? '',
        subSectionName: sub?.name ?? '',
      });
      imported++;
    }

    if (errors.length) {
      throw new HttpError(422, `Import rejected, nothing was changed. Fix these rows and try again:\n${errors.slice(0, 50).join('\n')}${errors.length > 50 ? `\n...and ${errors.length - 50} more.` : ''}`);
    }

    Object.assign(this, { departments, programs, facultyMembers: faculty, rooms, courses, groups, allocations, students });
    this.logAudit(user, 'EXCEL_MASTER_IMPORT', 'AcademicSetup', 'master-workbook', `Imported ${imported} records (mode: ${mode}).`);
    return { success: true, importedCount: imported, message: `Imported ${imported} records (${mode}).` };
  }

  // ---------------------------------------------------------------------------
  // Timetable generation, editing, publishing
  // ---------------------------------------------------------------------------

  private nextVersionNumber() {
    return Math.max(0, ...this.versions.map((v) => v.versionNumber)) + 1;
  }

  private health(sessions: ClassSession[]) {
    return calculateHealthScore(sessions, [...this.rooms.values()], [...this.facultyMembers.values()], [...this.groups.values()], [...this.courses.values()], this.academicYear).overallScore;
  }

  private context() {
    return {
      academicYear: this.academicYear,
      allocations: this.allocList(),
      facultyMembers: [...this.facultyMembers.values()],
      rooms: [...this.rooms.values()],
      sections: [...this.groups.values()],
      courses: [...this.courses.values()],
      constraints: [...this.constraints.values()],
    };
  }

  /** Records a version; it becomes the active draft unless makeActive is false (generation picks one explicitly). */
  private addVersion(v: { label: string; summary: string; reason: string; sessions: ClassSession[]; createdBy: string; healthScore: number; hardViolations?: number; makeActive?: boolean }) {
    const versionNumber = this.nextVersionNumber();
    const version: TimetableVersion = {
      id: `ver-${versionNumber}`,
      versionNumber,
      versionLabel: v.label.replace('{n}', String(versionNumber)),
      label: v.label.replace('{n}', String(versionNumber)),
      createdAt: new Date().toISOString(),
      createdBy: v.createdBy,
      changeSummary: v.summary,
      reason: v.reason,
      isPublished: false,
      healthScore: v.healthScore,
      sessionsCount: v.sessions.length,
      hardViolationsCount: v.hardViolations ?? 0,
      sessions: clone(v.sessions),
    };
    this.versions.unshift(version);
    if (v.makeActive !== false) this.activeVersionNumber = versionNumber;
    return version;
  }

  generateRoutines(body: unknown, user: string) {
    const b = (body ?? {}) as Record<string, any>;
    const budgetMode: BudgetMode = ['FAST', 'BALANCED', 'MAXIMUM_OPTIMIZATION'].includes(b.budgetMode) ? b.budgetMode : 'BALANCED';
    // The solver is synchronous; cap the TOTAL budget (shared by all routines) so one request
    // cannot stall the server for long. ponytail: move to a worker thread if longer runs are needed.
    const requestedMs = Math.min(3000, Math.max(100, Number(b.timeBudgetMs) || 1600));
    const profiles: OptimizationProfile[] = ['STUDENT_FOCUSED', 'FACULTY_FOCUSED', 'BALANCED'];
    const defaults = [
      { id: 'student-focused', label: 'Student-focused', description: 'Prioritises student timetable quality and minimises student gaps.', optimizationProfile: 'STUDENT_FOCUSED' as OptimizationProfile, seed: 1337 },
      { id: 'faculty-focused', label: 'Faculty-focused', description: 'Prioritises faculty timetable quality and minimises faculty gaps.', optimizationProfile: 'FACULTY_FOCUSED' as OptimizationProfile, seed: 9999 },
    ];
    const routines = Array.isArray(b.routines) && b.routines.length
      ? b.routines.slice(0, 3).map((r: any, i: number) => ({
          id: String(r?.id ?? `routine-${i + 1}`).slice(0, 50),
          label: String(r?.label ?? `Routine ${i + 1}`).slice(0, 80),
          description: String(r?.description ?? '').slice(0, 300),
          optimizationProfile: profiles.includes(r?.optimizationProfile) ? r.optimizationProfile : 'BALANCED',
          seed: 1337 + i * 8642,
        }))
      : defaults;

    const timeBudgetMs = Math.max(100, Math.floor(requestedMs / routines.length));
    const ctx = this.context();
    const totalHours = ctx.allocations.reduce((s, a) => s + a.hoursPerWeek, 0);
    const fixedSessions = this.activeSessions.filter((s) => s.isLocked && s.status !== 'Cancelled' && s.type !== 'Makeup');
    const out: any[] = [];

    for (const [idx, cfg] of routines.entries()) {
      const result = executeOptimizationEngine(ctx.academicYear, ctx.allocations, ctx.facultyMembers, ctx.rooms, ctx.sections, ctx.courses, ctx.constraints, {
        budgetMode,
        optimizationProfile: cfg.optimizationProfile,
        timeBudgetMs,
        seed: cfg.seed,
        maxCandidates: 1,
        fixedSessions,
      });
      const sessions = result.bestCandidate?.sessions ?? [];
      const report = validateTimetableIndependently(sessions, ctx);
      const health = result.bestCandidate?.healthScore ?? 0;
      let version: TimetableVersion | undefined;
      if (sessions.length) {
        version = this.addVersion({
          label: `${cfg.label} Draft V{n}.0`,
          summary: `Generated ${cfg.label} timetable (${sessions.length} sessions).`,
          reason: 'Automated solver run',
          sessions,
          createdBy: user,
          healthScore: health,
          hardViolations: report.hardViolationsCount,
          makeActive: false,
        });
      }
      const count = (codes: string[]) => report.violations.filter((v) => codes.includes(v.code)).length;
      out.push({
        id: cfg.id,
        label: cfg.label,
        description: cfg.description,
        optimizationProfile: cfg.optimizationProfile,
        versionId: version?.id ?? null,
        versionNumber: version?.versionNumber ?? null,
        sessions,
        statusMessage: result.statusMessage,
        diagnostics: result.infeasibilityDiagnostics ?? [],
        validation: {
          valid: sessions.length > 0 && report.hardViolationsCount === 0 && sessions.length === totalHours,
          hardViolations: report.hardViolationsCount,
          unscheduled: Math.max(0, totalHours - sessions.length),
          studentConflicts: count(['GROUP_COLLISION', 'SUBGROUP_COLLISION', 'CROSS_COHORT_COLLISION']),
          facultyConflicts: count(['FACULTY_COLLISION']),
          roomConflicts: count(['ROOM_COLLISION']),
          capacityViolations: count(['CAPACITY_SHORTAGE']),
          availabilityViolations: count(['FACULTY_UNAVAILABLE', 'ROOM_UNAVAILABLE', 'BREAK_PERIOD_VIOLATION', 'NON_WORKING_DAY']),
          blockingReasons: [...(result.infeasibilityDiagnostics ?? []), ...report.violations.filter((v) => v.severity === 'CRITICAL').map((v) => v.message)],
        },
        metrics: {
          studentGaps: report.metrics.totalStudentGaps,
          facultyGaps: report.metrics.totalFacultyGaps,
          roomUtilization: report.metrics.roomUtilizationRate,
          labUtilization: report.metrics.labUtilizationRate,
          sameCourseSameDayCount: report.metrics.sameCourseSameDayCount,
          sameCourseConsecutiveCount: report.metrics.sameCourseConsecutiveCount,
          avgStudentDailyLoad: report.metrics.avgStudentDailyLoad,
          maxStudentDailyLoad: report.metrics.maxStudentDailyLoad,
          avgFacultyDailyLoad: report.metrics.avgFacultyDailyLoad,
          maxFacultyDailyLoad: report.metrics.maxFacultyDailyLoad,
          courseDistributionQualityRate: report.metrics.courseDistributionQualityRate,
        },
        healthScore: health,
      });
      if (idx === 0 && sessions.length) {
        this.activeSessions = clone(sessions);
        this.activeVersionNumber = version!.versionNumber;
        this.academicYear.publishStatus = 'Draft';
      }
    }

    this.logAudit(user, 'ROUTINES_GENERATED', 'TimetableVersion', 'solver-run', `Generated ${out.filter((r) => r.versionNumber).length} of ${out.length} routines.`);
    return {
      success: out.some((r) => r.sessions.length > 0),
      isFeasible: out.every((r) => r.validation.valid),
      routines: out,
      sessionsGenerated: out[0]?.sessions.length ?? 0,
      timestamp: new Date().toISOString(),
    };
  }

  selectVersion(versionNumber: number, user: string) {
    const version = this.getVersion(versionNumber);
    const report = validateTimetableIndependently(version.sessions, this.context());
    if (report.hardViolationsCount > 0) throw new HttpError(422, `Cannot select a version with ${report.hardViolationsCount} hard violations.`);
    this.activeSessions = clone(version.sessions);
    this.activeVersionNumber = versionNumber;
    this.academicYear.publishStatus = 'Draft';
    this.logAudit(user, 'VERSION_SELECTED', 'TimetableVersion', `v-${versionNumber}`, `Selected ${version.versionLabel} as the working draft.`);
    return version;
  }

  moveSession(body: unknown, user: string) {
    const b = (body ?? {}) as Record<string, any>;
    const { sessionId, targetDay, targetTimeSlotId, targetRoomId } = b;
    if (!sessionId || !targetDay || !targetTimeSlotId || !targetRoomId) throw new ValidationError('sessionId, targetDay, targetTimeSlotId and targetRoomId are required.');
    const target = this.activeSessions.find((s) => s.id === sessionId);
    if (!target) throw new HttpError(404, 'Session not found in the working draft.');
    const check = validateProposedSessionMove(this.activeSessions, sessionId, targetDay, targetTimeSlotId, targetRoomId, this.context());
    if (!check.allowed) throw new HttpError(422, check.blockingReason || 'This move breaks a hard constraint.');

    this.activeSessions = this.activeSessions.map((s) =>
      s.id === sessionId ? { ...s, day: targetDay, timeSlotId: targetTimeSlotId, roomId: targetRoomId, version: (s.version || 1) + 1 } : s,
    );
    const course = this.courses.get(target.courseId);
    const version = this.addVersion({
      label: 'Draft V{n}.0',
      summary: `${course?.code ?? target.courseId} moved from ${target.day} ${target.timeSlotId} to ${targetDay} ${targetTimeSlotId} (${this.rooms.get(targetRoomId)?.name ?? targetRoomId}).`,
      reason: String(b.reason || 'Manual adjustment').slice(0, 300),
      sessions: this.activeSessions,
      createdBy: user,
      healthScore: this.health(this.activeSessions),
    });
    this.academicYear.publishStatus = 'Draft';
    this.logAudit(user, 'SESSION_MOVED', 'ClassSession', sessionId, version.changeSummary);
    return version;
  }

  swapSessions(body: unknown, user: string) {
    const b = (body ?? {}) as Record<string, any>;
    const { sessionAId, sessionBId } = b;
    if (!sessionAId || !sessionBId || sessionAId === sessionBId) throw new ValidationError('Two different session ids are required.');
    const a = this.activeSessions.find((s) => s.id === sessionAId);
    const c = this.activeSessions.find((s) => s.id === sessionBId);
    if (!a || !c) throw new HttpError(404, 'Session not found in the working draft.');
    const check = validateProposedSessionSwap(this.activeSessions, sessionAId, sessionBId, this.context());
    if (!check.allowed) throw new HttpError(422, check.blockingReason || 'This swap breaks a hard constraint.');

    this.activeSessions = this.activeSessions.map((s) => {
      if (s.id === sessionAId) return { ...s, day: c.day, timeSlotId: c.timeSlotId, roomId: c.roomId, version: (s.version || 1) + 1 };
      if (s.id === sessionBId) return { ...s, day: a.day, timeSlotId: a.timeSlotId, roomId: a.roomId, version: (s.version || 1) + 1 };
      return s;
    });
    const version = this.addVersion({
      label: 'Draft V{n}.0',
      summary: `Swapped ${this.courses.get(a.courseId)?.code ?? a.courseId} and ${this.courses.get(c.courseId)?.code ?? c.courseId}.`,
      reason: String(b.reason || 'Manual swap').slice(0, 300),
      sessions: this.activeSessions,
      createdBy: user,
      healthScore: this.health(this.activeSessions),
    });
    this.academicYear.publishStatus = 'Draft';
    this.logAudit(user, 'SESSIONS_SWAPPED', 'ClassSession', `${sessionAId}:${sessionBId}`, version.changeSummary);
    return version;
  }

  restoreVersion(versionNumber: number, user: string) {
    const version = this.getVersion(versionNumber);
    this.activeSessions = clone(version.sessions);
    this.activeVersionNumber = versionNumber;
    this.academicYear.publishStatus = 'Draft';
    this.logAudit(user, 'VERSION_RESTORED', 'TimetableVersion', `v-${versionNumber}`, `Restored the working draft to ${version.versionLabel}.`);
    return version;
  }

  setReviewStatus(status: unknown, user: string) {
    if (status !== 'Draft' && status !== 'Review') throw new ValidationError("status must be 'Draft' or 'Review'.");
    this.academicYear.publishStatus = status;
    this.logAudit(user, 'STATUS_CHANGED', 'TimetableVersion', String(this.activeVersionNumber), `Working draft marked ${status}.`);
    return this.academicYear;
  }

  approve(user: string) {
    if (!this.activeSessions.length) throw new HttpError(400, 'There is no draft timetable to approve.');
    const report = validateTimetableIndependently(this.activeSessions, this.context());
    if (report.hardViolationsCount > 0) throw new HttpError(422, `Cannot approve: the draft has ${report.hardViolationsCount} hard violations.`);
    this.academicYear.publishStatus = 'Approved';
    this.academicYear.approvedBy = user;
    this.academicYear.approvedAt = new Date().toISOString();
    this.logAudit(user, 'TIMETABLE_APPROVED', 'TimetableVersion', String(this.activeVersionNumber), 'Working draft approved.');
    return this.academicYear;
  }

  private publishActive(user: string) {
    this.publishedSessions = clone(this.activeSessions);
    this.publishedVersionNumber = this.activeVersionNumber;
    this.versions.forEach((v) => (v.isPublished = v.versionNumber === this.activeVersionNumber));
    this.academicYear.publishStatus = 'Published';
    this.academicYear.publishedAt = new Date().toISOString();
    this.logAudit(user, 'TIMETABLE_PUBLISHED', 'TimetableVersion', String(this.activeVersionNumber), `Published version ${this.activeVersionNumber} to all students and faculty.`);
  }

  publish(user: string) {
    if (!this.activeSessions.length) throw new HttpError(400, 'There is no draft timetable to publish.');
    const report = validateTimetableIndependently(this.activeSessions, this.context());
    if (report.hardViolationsCount > 0) throw new HttpError(422, `Cannot publish: the draft has ${report.hardViolationsCount} hard violations.`);
    this.publishActive(user);
    this.notify({
      type: 'system_alert',
      title: 'Timetable published',
      message: `The ${this.academicYear.yearLabel} timetable has been published.`,
      category: 'Success',
    });
    return this.academicYear;
  }

  /** Adds a single session. Staff edit the draft (new version); faculty add to the live timetable for themselves. */
  addSession(body: unknown, viewer: Viewer) {
    const b = (body ?? {}) as Record<string, any>;
    const staff = STAFF_ROLES.includes(viewer.roleCode);
    const facultyId = staff ? String(b.facultyId ?? '') : this.facultyIdFor(viewer);
    if (!facultyId) throw new HttpError(403, 'Your account is not linked to a faculty record.');
    const types = ['Lecture', 'Lab', 'Tutorial', 'Practical', 'Elective', 'Makeup', 'Seminar'];
    const candidate = {
      courseId: String(b.courseId ?? ''),
      facultyId,
      sectionId: String(b.sectionId ?? ''),
      subSectionId: b.subSectionId ? String(b.subSectionId) : undefined,
      roomId: String(b.roomId ?? ''),
      day: b.day as DayOfWeek,
      timeSlotId: String(b.timeSlotId ?? ''),
      type: (types.includes(b.type) ? b.type : 'Lecture') as ClassSession['type'],
    };
    if (!candidate.courseId || !candidate.sectionId || !candidate.roomId) throw new ValidationError('courseId, sectionId and roomId are required.');
    this.mustExist(this.courses, candidate.courseId, 'Course');
    this.mustExist(this.facultyMembers, candidate.facultyId, 'Faculty');
    this.mustExist(this.groups, candidate.sectionId, 'Group');
    this.mustExist(this.rooms, candidate.roomId, 'Room');
    if (!this.academicYear.workingDays.includes(candidate.day)) throw new ValidationError('That day is not a working day.');
    const slot = this.academicYear.timeSlots.find((t) => t.id === candidate.timeSlotId);
    if (!slot || slot.isBreak || slot.isLunch || slot.id === this.academicYear.lunchPeriodId) throw new ValidationError('Pick a teaching period (not a break).');

    const target = staff ? this.activeSessions : this.publishedSessions.length ? this.publishedSessions : this.activeSessions;
    const check = checkHardConstraints(candidate, target, [...this.rooms.values()], [...this.facultyMembers.values()], [...this.groups.values()], [...this.courses.values()]);
    if (!check.isFeasible) throw new HttpError(422, check.violations.join(' '));

    const session: ClassSession = { ...candidate, id: `sess-${crypto.randomUUID()}`, status: staff ? 'Planned' : 'Confirmed', version: 1 };
    const code = this.courses.get(session.courseId)?.code ?? session.courseId;
    if (staff) {
      this.activeSessions = [...this.activeSessions, session];
      this.addVersion({
        label: 'Draft V{n}.0',
        summary: `Added ${code} for ${this.groups.get(session.sectionId)?.name} on ${session.day} ${slot.label}.`,
        reason: String(b.reason || 'Manual slot assignment').slice(0, 300),
        sessions: this.activeSessions,
        createdBy: viewer.name,
        healthScore: this.health(this.activeSessions),
      });
      this.academicYear.publishStatus = 'Draft';
    } else {
      this.publishedSessions = this.publishedSessions.length ? [...this.publishedSessions, session] : this.publishedSessions;
      this.activeSessions = [...this.activeSessions, session];
      this.notify({
        type: 'room_change',
        title: `Extra class: ${code}`,
        message: `${viewer.name} added a ${session.type.toLowerCase()} on ${session.day} ${slot.label} in ${this.rooms.get(session.roomId)?.name}.`,
        category: 'Info',
      });
    }
    this.logAudit(viewer.name, 'SESSION_ADDED', 'ClassSession', session.id, `Added ${code} (${session.type}) on ${session.day} ${session.timeSlotId}.`);
    return session;
  }

  toggleSessionLock(sessionId: string, reason: unknown, user: string) {
    let updated: ClassSession | undefined;
    this.activeSessions = this.activeSessions.map((s) => {
      if (s.id !== sessionId) return s;
      updated = { ...s, isLocked: !s.isLocked, lockReason: !s.isLocked ? String(reason || 'Pinned by coordinator').slice(0, 200) : undefined };
      return updated;
    });
    if (!updated) throw new HttpError(404, 'Session not found in the working draft.');
    this.logAudit(user, updated.isLocked ? 'SESSION_LOCKED' : 'SESSION_UNLOCKED', 'ClassSession', sessionId, updated.isLocked ? `Pinned: ${updated.lockReason}` : 'Unpinned.');
    return updated;
  }

  toggleConstraint(id: string, user: string) {
    const c = this.constraints.get(id);
    if (!c) throw new HttpError(404, 'Constraint not found.');
    if (c.type === 'Hard') throw new HttpError(409, 'Hard constraints are always enforced by the scheduler and cannot be switched off.');
    c.isActive = !c.isActive;
    this.logAudit(user, 'CONSTRAINT_TOGGLED', 'AcademicConstraint', id, `${c.name} ${c.isActive ? 'enabled' : 'disabled'}.`);
    return c;
  }

  /** Faculty toggle their own unavailable periods; staff may toggle anyone's (body.facultyId). */
  toggleProtectedSlot(body: unknown, viewer: Viewer) {
    const b = (body ?? {}) as Record<string, any>;
    const facultyId = STAFF_ROLES.includes(viewer.roleCode) && b.facultyId ? String(b.facultyId) : this.facultyIdFor(viewer);
    const f = facultyId ? this.facultyMembers.get(facultyId) : undefined;
    if (!f) throw new HttpError(403, 'Your account is not linked to a faculty record.');
    if (!this.academicYear.workingDays.includes(b.day)) throw new ValidationError('Pick a working day.');
    if (!this.academicYear.timeSlots.some((t) => t.id === b.periodId)) throw new ValidationError('Unknown period.');
    const exists = f.preferences.protectedSlots.some((p) => p.day === b.day && p.periodId === b.periodId);
    const protectedSlots = exists
      ? f.preferences.protectedSlots.filter((p) => !(p.day === b.day && p.periodId === b.periodId))
      : [...f.preferences.protectedSlots, { day: b.day, periodId: b.periodId, reason: ['Research', 'Lunch', 'Personal', 'Department', 'Meeting'].includes(b.reason) ? b.reason : 'Personal' }];
    f.preferences = { ...f.preferences, protectedSlots };
    this.logAudit(viewer.name, 'PROTECTED_SLOT_TOGGLED', 'Faculty', f.id, `${exists ? 'Released' : 'Reserved'} ${b.day} ${b.periodId}.`);
    return f;
  }

  /** Requests and announcements from staff, faculty and class representatives. */
  postNotification(body: unknown, viewer: Viewer) {
    const b = (body ?? {}) as Record<string, any>;
    const title = String(b.title ?? '').trim().slice(0, 120);
    const msg = String(b.message ?? '').trim().slice(0, 1000);
    if (!title || !msg) throw new ValidationError('title and message are required.');
    const roles = ['Coordinator', 'Faculty', 'Student', 'HOD', 'Admin'];
    this.notify({
      type: ['makeup_request', 'approval_needed', 'room_change', 'system_alert'].includes(b.type) ? b.type : 'makeup_request',
      title,
      message: `${msg} (from ${viewer.name})`,
      category: ['Critical', 'Warning', 'Info', 'Success'].includes(b.category) ? b.category : 'Info',
      recipientRole: roles.includes(b.recipientRole) ? b.recipientRole : undefined,
      actionable: Boolean(b.actionable),
    });
    this.logAudit(viewer.name, 'NOTIFICATION_POSTED', 'Notification', title, msg);
  }

  // ---------------------------------------------------------------------------
  // Recovery, polls, notifications
  // ---------------------------------------------------------------------------

  private facultyIdFor(viewer: Viewer) {
    return this.rosterContext(viewer).facultyId;
  }

  private assertOwnsFacultyItem(viewer: Viewer, facultyId: string) {
    if (STAFF_ROLES.includes(viewer.roleCode)) return;
    if (this.facultyIdFor(viewer) !== facultyId) throw new HttpError(403, 'You can only act on your own classes.');
  }

  /** Applies a change to a session in both the published timetable and the draft. */
  private patchSession(sessionId: string, fn: (s: ClassSession) => ClassSession) {
    let found: ClassSession | undefined;
    const apply = (list: ClassSession[]) =>
      list.map((s) => {
        if (s.id !== sessionId) return s;
        found ??= s;
        return fn(s);
      });
    this.publishedSessions = apply(this.publishedSessions);
    this.activeSessions = apply(this.activeSessions);
    return found;
  }

  cancelClass(body: unknown, viewer: Viewer) {
    const b = (body ?? {}) as Record<string, any>;
    const sessionId = String(b.sessionId ?? '');
    const reason = String(b.reason || 'Unforeseen conflict').slice(0, 300);
    const target = this.publishedSessions.find((s) => s.id === sessionId) ?? this.activeSessions.find((s) => s.id === sessionId);
    if (!target) throw new HttpError(404, 'Session not found.');
    if (target.status === 'Cancelled') throw new HttpError(409, 'This class is already cancelled.');
    this.assertOwnsFacultyItem(viewer, target.facultyId);

    this.patchSession(sessionId, (s) => ({ ...s, status: 'Cancelled', cancellationReason: reason, cancellationTimestamp: new Date().toISOString() }));
    const task: MakeupTask = {
      id: `makeup-${crypto.randomUUID()}`,
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
    this.makeupTasks.unshift(task);
    const opportunities = findSelfHealingRecoverySlots(
      task,
      this.publishedSessions.length ? this.publishedSessions : this.activeSessions,
      [...this.rooms.values()],
      [...this.facultyMembers.values()],
      [...this.groups.values()],
      [...this.courses.values()],
      this.academicYear,
    );
    this.recoveryOpportunities = [...opportunities, ...this.recoveryOpportunities];
    const code = this.courses.get(target.courseId)?.code ?? target.courseId;
    this.notify({
      type: 'cancellation',
      title: `Class cancelled: ${code}`,
      message: `${target.day} ${this.slotLabel(target.timeSlotId)} for ${this.groups.get(target.sectionId)?.name ?? target.sectionId} was cancelled. Reason: ${reason}. ${opportunities.length} make-up options proposed.`,
      category: 'Critical',
      actionable: true,
    });
    this.logAudit(viewer.name, 'CLASS_CANCELLED', 'ClassSession', sessionId, `Cancelled ${code} (${target.day} ${target.timeSlotId}). Reason: ${reason}.`);
    return { task, opportunities };
  }

  scheduleMakeup(opportunityId: unknown, viewer: Viewer) {
    const opp = this.recoveryOpportunities.find((o) => o.id === opportunityId);
    if (!opp) throw new HttpError(404, 'Make-up option not found.');
    if (opp.status === 'Approved' || opp.status === 'Rejected') throw new HttpError(409, `This option was already ${opp.status.toLowerCase()}.`);
    const task = this.makeupTasks.find((t) => t.id === opp.makeupTaskId);
    if (!task) throw new HttpError(404, 'Make-up task not found.');
    if (task.status === 'Scheduled') throw new HttpError(409, 'A make-up class is already scheduled for this cancellation.');
    this.assertOwnsFacultyItem(viewer, task.facultyId);

    const session: ClassSession = {
      id: `makeup-${crypto.randomUUID()}`,
      courseId: task.courseId,
      facultyId: opp.facultyId,
      sectionId: task.sectionId,
      roomId: opp.roomId,
      day: opp.targetDay,
      timeSlotId: opp.timeSlotId,
      type: 'Makeup',
      status: 'Confirmed',
      originalSessionId: task.cancelledSessionId,
      version: 1,
    };
    const live = this.publishedSessions.length ? this.publishedSessions : this.activeSessions;
    const clash = live.find(
      (s) => s.status !== 'Cancelled' && s.day === session.day && s.timeSlotId === session.timeSlotId &&
        (s.roomId === session.roomId || s.facultyId === session.facultyId || s.sectionId === session.sectionId),
    );
    if (clash) throw new HttpError(409, 'That slot is no longer free. Pick another make-up option.');

    this.publishedSessions = this.publishedSessions.length ? [...this.publishedSessions, session] : this.publishedSessions;
    this.activeSessions = [...this.activeSessions, session];
    this.makeupTasks = this.makeupTasks.map((t) => (t.id === task.id ? { ...t, status: 'Scheduled' } : t));
    this.recoveryOpportunities = this.recoveryOpportunities.map((o) =>
      o.id === opp.id ? { ...o, status: 'Approved' } : o.makeupTaskId === task.id && o.status === 'Proposed' ? { ...o, status: 'Rejected' } : o,
    );
    const code = this.courses.get(task.courseId)?.code ?? task.courseId;
    this.notify({
      type: 'makeup_request',
      title: `Make-up scheduled: ${code}`,
      message: `${opp.targetDay} ${this.slotLabel(opp.timeSlotId)} in ${this.rooms.get(opp.roomId)?.name ?? opp.roomId}.`,
      category: 'Success',
    });
    this.logAudit(viewer.name, 'MAKEUP_SCHEDULED', 'ClassSession', session.id, `Scheduled make-up for ${code} on ${opp.targetDay} ${opp.timeSlotId}.`);
    return session;
  }

  declineOpportunity(opportunityId: unknown, viewer: Viewer) {
    const opp = this.recoveryOpportunities.find((o) => o.id === opportunityId);
    if (!opp) throw new HttpError(404, 'Make-up option not found.');
    const task = this.makeupTasks.find((t) => t.id === opp.makeupTaskId);
    if (task) this.assertOwnsFacultyItem(viewer, task.facultyId);
    if (opp.status !== 'Proposed') throw new HttpError(409, `This option was already ${opp.status.toLowerCase()}.`);
    this.recoveryOpportunities = this.recoveryOpportunities.map((o) => (o.id === opp.id ? { ...o, status: 'Rejected' } : o));
    this.logAudit(viewer.name, 'RECOVERY_DECLINED', 'RecoveryOpportunity', opp.id, `Declined make-up option ${opp.id}.`);
  }

  castVote(body: unknown, viewer: Viewer) {
    const b = (body ?? {}) as Record<string, any>;
    const poll = this.polls.find((p) => p.id === b.pollId);
    if (!poll || !poll.isActive || (poll.expiresAt && new Date(poll.expiresAt) < new Date())) throw new HttpError(409, 'This poll is closed.');
    if (!poll.options.some((o) => o.id === b.optionId)) throw new ValidationError('Unknown poll option.');
    const ctx = this.rosterContext(viewer);
    if (poll.sectionId && ctx.sectionId !== poll.sectionId && !STAFF_ROLES.includes(viewer.roleCode)) throw new HttpError(403, 'This poll is for another section.');
    const key = `${poll.id}:${viewer.id}`;
    if (this.votes.has(key)) throw new HttpError(409, 'You have already voted in this poll.');
    this.votes.set(key, b.optionId);
    poll.votedStudentsCount += 1;
    poll.options = poll.options.map((o) => (o.id === b.optionId ? { ...o, votes: o.votes + 1 } : o));
    return { success: true, message: 'Your vote has been recorded.' };
  }

  createPoll(body: unknown, viewer: Viewer) {
    const b = (body ?? {}) as Record<string, any>;
    const ctx = this.rosterContext(viewer);
    const sectionId = STAFF_ROLES.includes(viewer.roleCode) ? String(b.sectionId ?? '') : ctx.crSectionId;
    if (!sectionId || !this.groups.has(sectionId)) throw new HttpError(403, 'Only the class representative of a section (or staff) can open a poll.');
    const question = String(b.question ?? '').trim().slice(0, 300);
    const options = Array.isArray(b.options) ? b.options.slice(0, 6) : [];
    if (!question || options.length < 2) throw new ValidationError('A poll needs a question and at least two options.');
    const poll: StudentPoll = {
      id: `poll-${crypto.randomUUID()}`,
      makeupTaskId: String(b.makeupTaskId ?? ''),
      courseId: String(b.courseId ?? ''),
      sectionId,
      question,
      options: options.map((o: any, i: number) => ({
        id: `opt-${i + 1}`,
        day: o?.day ?? 'Monday',
        timeSlotLabel: String(o?.timeSlotLabel ?? o?.label ?? `Option ${i + 1}`).slice(0, 80),
        votes: 0,
        isSystemRecommended: Boolean(o?.isSystemRecommended),
      })),
      totalEligibleStudents: this.groups.get(sectionId)!.studentCount,
      votedStudentsCount: 0,
      isActive: true,
      expiresAt: new Date(Date.now() + 3 * 86400_000).toISOString(),
    };
    this.polls.unshift(poll);
    this.notify({ type: 'poll_created', title: 'New class poll', message: question, category: 'Info' });
    this.logAudit(viewer.name, 'POLL_CREATED', 'StudentPoll', poll.id, question);
    return poll;
  }

  markNotificationRead(id: string, viewer: Viewer) {
    const n = this.notifications.find((x) => x.id === id);
    if (!n) throw new HttpError(404, 'Notification not found.');
    n.readBy = [...new Set([...(n.readBy ?? []), viewer.id])];
  }

  private notify(n: Omit<NotificationItem, 'id' | 'timestamp' | 'read'>) {
    this.notifications.unshift({ ...n, id: `notif-${crypto.randomUUID()}`, timestamp: new Date().toISOString(), read: false, readBy: [] });
    this.notifications = this.notifications.slice(0, 300);
  }

  private slotLabel(id: string) {
    return this.academicYear.timeSlots.find((t) => t.id === id)?.label ?? id;
  }

  private logAudit(userName: string, action: string, entityType: string, entityId: string, details: string) {
    const event: AuditLog = {
      id: `audit-${crypto.randomUUID()}`,
      timestamp: new Date().toISOString(),
      userId: userName,
      userName,
      action,
      entityType,
      entityId,
      details,
    };
    this.auditEvents.unshift(event);
    if (this.auditEvents.length > AUDIT_IN_MEMORY) this.auditEvents.length = AUDIT_IN_MEMORY;
    this.pendingAudit.push(event);
  }
}

function roleKeyOf(role: RoleCode) {
  return role === 'COLLEGE_ADMIN' || role === 'SUPER_ADMIN' ? 'Admin' : role === 'CLASS_REPRESENTATIVE' ? 'Student' : role.charAt(0) + role.slice(1).toLowerCase();
}

function normalisePreferences(p: any): Faculty['preferences'] {
  const days: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const reasons = ['Research', 'Lunch', 'Personal', 'Department', 'Meeting'];
  return {
    preferredDays: Array.isArray(p?.preferredDays) ? p.preferredDays.filter((d: DayOfWeek) => days.includes(d)) : days.slice(0, 5),
    preferredPeriods: Array.isArray(p?.preferredPeriods) ? p.preferredPeriods.map(Number).filter(Number.isFinite) : [1, 2, 3, 4, 6, 7],
    protectedSlots: Array.isArray(p?.protectedSlots)
      ? p.protectedSlots
          .filter((s: any) => days.includes(s?.day) && typeof s?.periodId === 'string')
          .map((s: any) => ({ day: s.day, periodId: s.periodId, reason: reasons.includes(s.reason) ? s.reason : 'Personal' }))
      : [],
    maxConsecutivePeriods: Number(p?.maxConsecutivePeriods) || 3,
    availableForMakeup: p?.availableForMakeup ?? true,
    availableForTutorial: p?.availableForTutorial ?? true,
  };
}

export const store = new TimetableStore();
