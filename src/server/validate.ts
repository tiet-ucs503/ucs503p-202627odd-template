// Whitelists and type checks for academic entities coming from the API.
// Unknown fields are dropped; wrong types are rejected with a readable message.

type Rule =
  | { t: 'string'; max?: number }
  | { t: 'number'; min?: number; max?: number; int?: boolean }
  | { t: 'boolean' }
  | { t: 'enum'; values: readonly string[] }
  | { t: 'strings'; max?: number }
  | { t: 'object' }
  | { t: 'array' };

export type Spec = Record<string, Rule>;

/** An error with an HTTP status; the server's error handler turns it into a JSON response. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export class ValidationError extends HttpError {
  constructor(message: string) {
    super(400, message);
  }
}

const str = (max = 200): Rule => ({ t: 'string', max });
const num = (min = 0, max = 100000, int = true): Rule => ({ t: 'number', min, max, int });

export const SPECS = {
  department: {
    name: str(),
    code: str(30),
    hodName: str(),
    contactEmail: str(254),
    status: { t: 'enum', values: ['Active', 'Inactive'] },
  },
  program: {
    name: str(),
    code: str(30),
    departmentId: str(100),
    durationYears: num(1, 10),
    totalSemesters: num(1, 20),
    status: { t: 'enum', values: ['Active', 'Inactive'] },
  },
  course: {
    code: str(30),
    name: str(),
    departmentId: str(100),
    programId: str(100),
    semester: num(1, 20),
    credits: num(0, 40),
    requiredLecturesPerWeek: num(0, 40),
    requiredTutorialsPerWeek: num(0, 40),
    requiredLabsPerWeek: num(0, 40),
    totalSemesterHours: num(0, 1000),
    completedHours: num(0, 1000),
    cancelledHours: num(0, 1000),
    requiresLab: { t: 'boolean' },
    requiredEquipment: { t: 'strings', max: 50 },
    primaryFacultyId: str(100),
    status: { t: 'enum', values: ['Active', 'Archived'] },
  },
  faculty: {
    name: str(),
    employeeId: str(50),
    email: str(254),
    departmentId: str(100),
    designation: { t: 'enum', values: ['Professor', 'Associate Professor', 'Assistant Professor', 'Visiting Faculty'] },
    subjectsQualified: { t: 'strings', max: 200 },
    maxDirectTeachingHours: num(0, 60),
    weeklyHoursLimit: num(0, 80),
    preferences: { t: 'object' },
    avatarUrl: str(500),
    status: { t: 'enum', values: ['Active', 'OnLeave', 'Inactive'] },
  },
  room: {
    name: str(100),
    building: str(),
    floor: num(-5, 100),
    capacity: num(1, 5000),
    type: { t: 'enum', values: ['LectureHall', 'ComputerLab', 'HardwareLab', 'SeminarRoom', 'TutorialRoom'] },
    equipment: { t: 'strings', max: 50 },
    isAvailable: { t: 'boolean' },
    departmentId: str(100),
    maintenanceNote: str(500),
  },
  group: {
    name: str(100),
    departmentId: str(100),
    program: str(),
    programId: str(100),
    semester: num(1, 20),
    batchYear: num(1950, 2100),
    studentCount: num(1, 5000),
    targetSize: num(0, 5000),
    maxSize: num(0, 5000),
    subSections: { t: 'array' },
    classRepresentative: { t: 'object' },
    homeRoomId: str(100),
    status: { t: 'enum', values: ['Active', 'Inactive'] },
  },
  allocation: {
    courseId: str(100),
    facultyId: str(100),
    sectionId: str(100),
    subSectionId: str(100),
    sessionType: { t: 'enum', values: ['Lecture', 'Lab', 'Tutorial', 'Practical', 'Elective', 'Makeup', 'Seminar'] },
    hoursPerWeek: num(1, 40),
    preferredRoomId: str(100),
    status: { t: 'enum', values: ['Allocated', 'Pending', 'Conflict'] },
  },
} satisfies Record<string, Spec>;

/** Returns only the fields in `spec`, type-checked. Throws ValidationError on the first bad field. */
export function clean<T = Record<string, unknown>>(body: unknown, spec: Spec): Partial<T> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ValidationError('Request body must be a JSON object.');
  const out: Record<string, unknown> = {};
  for (const [key, rule] of Object.entries(spec)) {
    let v = (body as Record<string, unknown>)[key];
    if (v === undefined) continue;
    if (v === null || v === '') {
      if (rule.t === 'string') out[key] = '';
      continue;
    }
    switch (rule.t) {
      case 'string':
        if (typeof v !== 'string' && typeof v !== 'number') throw new ValidationError(`${key} must be text.`);
        v = String(v).trim();
        if ((v as string).length > (rule.max ?? 200)) throw new ValidationError(`${key} is too long.`);
        break;
      case 'number': {
        const n = typeof v === 'string' ? Number(v) : v;
        if (typeof n !== 'number' || !Number.isFinite(n)) throw new ValidationError(`${key} must be a number.`);
        if (rule.int && !Number.isInteger(n)) throw new ValidationError(`${key} must be a whole number.`);
        if (n < (rule.min ?? 0) || n > (rule.max ?? 100000)) throw new ValidationError(`${key} must be between ${rule.min} and ${rule.max}.`);
        v = n;
        break;
      }
      case 'boolean':
        if (typeof v !== 'boolean') throw new ValidationError(`${key} must be true or false.`);
        break;
      case 'enum':
        if (!rule.values.includes(String(v))) throw new ValidationError(`${key} must be one of: ${rule.values.join(', ')}.`);
        break;
      case 'strings':
        if (!Array.isArray(v) || v.length > (rule.max ?? 100) || v.some((s) => typeof s !== 'string')) {
          throw new ValidationError(`${key} must be a list of text values.`);
        }
        v = (v as string[]).map((s) => s.trim()).filter(Boolean);
        break;
      case 'object':
        if (typeof v !== 'object' || Array.isArray(v)) throw new ValidationError(`${key} must be an object.`);
        break;
      case 'array':
        if (!Array.isArray(v)) throw new ValidationError(`${key} must be a list.`);
        break;
    }
    out[key] = v;
  }
  return out as Partial<T>;
}

export function requireFields(obj: Record<string, unknown>, fields: string[]) {
  const missing = fields.filter((f) => obj[f] === undefined || obj[f] === '');
  if (missing.length) throw new ValidationError(`Missing required field(s): ${missing.join(', ')}.`);
}
