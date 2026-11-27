import {
  Department,
  Program,
  Course,
  Faculty,
  Room,
  StudentSection,
  CourseAllocation,
  SessionType
} from '../types';
import type { StudentRecord } from './initialData';

export interface ExcelImportPreview {
  sheetCounts: {
    departments: number;
    programs: number;
    courses: number;
    faculty: number;
    rooms: number;
    groups: number;
    subgroups: number;
    allocations: number;
    students: number;
  };
  totalRows: number;
  validRows: number;
  warningCount: number;
  errorCount: number;
  warnings: string[];
  errors: string[];
  parsedData: {
    departments: Array<Omit<Department, 'id'> & { code: string; id?: string }>;
    programs: Array<Omit<Program, 'id'> & { code: string; departmentCode: string; id?: string }>;
    courses: Array<Omit<Course, 'id'> & { code: string; departmentCode: string; primaryFacultyEmail?: string; id?: string }>;
    faculty: Array<Omit<Faculty, 'id'> & { email: string; departmentCode: string; id?: string }>;
    rooms: Array<Omit<Room, 'id'> & { name: string; id?: string }>;
    // classRepresentative is omitted on import so an existing CR is kept.
    groups: Array<Omit<StudentSection, 'id' | 'subSections' | 'classRepresentative'> & { classRepresentative?: StudentSection['classRepresentative']; code: string; programCode?: string; id?: string }>;
    subgroups: Array<{ groupCode: string; name: string; studentCount: number; type?: 'Lab' | 'Tutorial' | 'Practical' | 'General' }>;
    allocations: Array<{
      courseCode: string;
      facultyEmail: string;
      groupCode: string;
      subgroupName?: string;
      sessionType: SessionType;
      hoursPerWeek: number;
      roomName?: string;
    }>;
    students: Array<{
      studentId: string;
      name: string;
      email: string;
      programCode?: string;
      batchYear?: number;
      groupCode: string;
      subgroupName?: string;
    }>;
  };
}

/**
 * Builds the master workbook. Without `currentData` it is the blank template with sample rows;
 * with `currentData` it is an export of exactly that data (an empty list exports a header-only sheet).
 */
export async function generateMasterExcelTemplate(currentData?: {
  departments?: Department[];
  programs?: Program[];
  courses?: Course[];
  facultyMembers?: Faculty[];
  rooms?: Room[];
  sections?: StudentSection[];
  allocations?: CourseAllocation[];
  students?: StudentRecord[];
}): Promise<Blob> {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  const addSheet = (name: string, rows: (string | undefined)[][]) =>
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name);
  // Export rows from the database, or the template's sample rows when no data was passed.
  const rowsOf = <T,>(list: T[] | undefined, toRow: (item: T) => (string | undefined)[], samples: string[][]) =>
    currentData ? (list ?? []).map(toRow) : samples;
  const deptCode = (id: string) => currentData?.departments?.find(d => d.id === id)?.code ?? '';

  // 1. README Sheet
  addSheet('README', [
    ['THAPAR INSTITUTE OF ENGINEERING & TECHNOLOGY — MASTER TIMETABLE SETUP WORKBOOK'],
    ['Version: 2026.1-Unified'],
    ['Instructions for Academic Coordinators:'],
    ['1. Each worksheet represents one academic data entity.'],
    ['2. Use stable human-readable codes (e.g. CSED, CS501, CSE-A, A1) to connect rows across sheets.'],
    ['3. Do NOT rename sheets or modify column headers in row 1.'],
    ['4. All codes are case-insensitive and trimmed automatically.'],
    ['5. Subgroups belong to Groups (e.g., Group CSE-A has Subgroup A1).'],
    ['6. Save and upload this workbook directly in the Academic Setup > Import Master Data tab.'],
    [],
    ['WORKSHEETS SUMMARY:'],
    ['Sheet Name', 'Purpose', 'Key Identifier'],
    ['Departments', 'Academic Departments (e.g., CSED, ECED)', 'department_code'],
    ['Programs', 'Academic Degrees/Branches (e.g., BTECH-CSE)', 'program_code'],
    ['Courses', 'Curriculum Offerings & Lecture/Lab Hours', 'course_code'],
    ['Faculty', 'Faculty Instructors, Designations & Workload Caps', 'email / faculty_code'],
    ['Rooms', 'Classrooms, Lecture Theatres, & Computer/Hardware Labs', 'room_name / code'],
    ['Groups', 'Batch Cohort Groups (e.g. CSE-A, CSE-B ... CSE-T)', 'group_code'],
    ['Subgroups', 'Lab/Tutorial Small Cohorts (e.g. A1, A2, A3, A4)', 'group_code + subgroup_name'],
    ['Course Allocations', 'Curriculum Teaching Assignments to Groups/Subgroups', 'course_code + faculty + group'],
    ['Students', 'Optional Student Enrollment & Group Assignments', 'student_id']
  ]);

  // 2. Departments Sheet
  addSheet('Departments', [
    ['department_code', 'department_name', 'hod_name', 'contact_email', 'status'],
    ...rowsOf(currentData?.departments, d => [d.code, d.name, d.hodName, d.contactEmail, d.status], [
      ['CSED', 'Computer Science & Engineering', 'Dr. Rajesh Kumar', 'hod.csed@thapar.edu', 'Active'],
      ['ECED', 'Electronics & Communication Engineering', 'Dr. Alpana Agarwal', 'hod.eced@thapar.edu', 'Active'],
      ['MED', 'Mechanical Engineering Department', 'Dr. S. K. Mohapatra', 'hod.med@thapar.edu', 'Active'],
      ['CED', 'Civil Engineering Department', 'Dr. Naveen Kwatra', 'hod.ced@thapar.edu', 'Active']
    ])
  ]);

  // 3. Programs Sheet
  addSheet('Programs', [
    ['program_code', 'program_name', 'department_code', 'duration_years', 'total_semesters', 'status'],
    ...rowsOf(currentData?.programs, p => [p.code, p.name, deptCode(p.departmentId), String(p.durationYears), String(p.totalSemesters), p.status], [
      ['BTECH-CSE', 'B.Tech Computer Science & Engineering', 'CSED', '4', '8', 'Active'],
      ['BTECH-ECE', 'B.Tech Electronics & Communication', 'ECED', '4', '8', 'Active'],
      ['BTECH-ME', 'B.Tech Mechanical Engineering', 'MED', '4', '8', 'Active']
    ])
  ]);

  // 4. Courses Sheet
  addSheet('Courses', [
    ['course_code', 'course_name', 'department_code', 'credits', 'lecture_hours', 'tutorial_hours', 'lab_hours', 'requires_lab', 'primary_faculty_email'],
    ...rowsOf(
      currentData?.courses,
      c => [
        c.code,
        c.name,
        deptCode(c.departmentId),
        String(c.credits),
        String(c.requiredLecturesPerWeek),
        String(c.requiredTutorialsPerWeek),
        String(c.requiredLabsPerWeek),
        c.requiresLab ? 'YES' : 'NO',
        currentData?.facultyMembers?.find(f => f.id === c.primaryFacultyId)?.email ?? ''
      ],
      [
        ['CS501', 'Database Management Systems', 'CSED', '4', '3', '0', '2', 'YES', 'arvind.sharma@thapar.edu'],
        ['CS502', 'Operating Systems Principles', 'CSED', '4', '3', '0', '2', 'YES', 'priya.nair@thapar.edu'],
        ['CS503', 'Theory of Computation', 'CSED', '4', '3', '1', '0', 'NO', 'vikram.seth@thapar.edu'],
        ['CS504', 'Computer Networks & Security', 'CSED', '4', '3', '0', '2', 'YES', 'ananya.roy@thapar.edu'],
        ['CS505', 'Design & Analysis of Algorithms', 'CSED', '4', '3', '1', '0', 'NO', 'arvind.sharma@thapar.edu']
      ]
    )
  ]);

  // 5. Faculty Sheet
  addSheet('Faculty', [
    ['name', 'email', 'department_code', 'designation', 'max_teaching_hours_per_week', 'status'],
    ...rowsOf(currentData?.facultyMembers, f => [f.name, f.email, deptCode(f.departmentId), f.designation, String(f.maxDirectTeachingHours), f.status || 'Active'], [
      ['Prof. Arvind Sharma', 'arvind.sharma@thapar.edu', 'CSED', 'Professor', '14', 'Active'],
      ['Dr. Priya Nair', 'priya.nair@thapar.edu', 'CSED', 'Associate Professor', '14', 'Active'],
      ['Dr. Vikram Seth', 'vikram.seth@thapar.edu', 'CSED', 'Assistant Professor', '16', 'Active'],
      ['Dr. Ananya Roy', 'ananya.roy@thapar.edu', 'CSED', 'Assistant Professor', '16', 'Active'],
      ['Dr. Rajesh Kumar', 'rajesh.kumar@thapar.edu', 'CSED', 'Professor', '14', 'Active']
    ])
  ]);

  // 6. Rooms Sheet
  addSheet('Rooms', [
    ['room_name', 'building', 'type', 'capacity', 'equipment', 'status'],
    ...rowsOf(currentData?.rooms, r => [r.name, r.building, r.type, String(r.capacity), r.equipment.join('; '), r.isAvailable ? 'Available' : 'Maintenance'], [
      ['LT101', 'Academic Block A', 'LectureHall', '80', 'Projector; Smart Board; Audio System', 'Available'],
      ['LT102', 'Academic Block A', 'LectureHall', '80', 'Projector; Smart Board; Audio System', 'Available'],
      ['LT201', 'Academic Block B', 'LectureHall', '120', 'Projector; Tiered Seating; Surround Audio', 'Available'],
      ['C-Lab 301', 'Computer Centre', 'ComputerLab', '60', '60 Workstations; Linux/Windows; Gigabit LAN', 'Available'],
      ['C-Lab 302', 'Computer Centre', 'ComputerLab', '60', '60 Workstations; GPU Nodes; Gigabit LAN', 'Available'],
      ['TR-105', 'Academic Block A', 'TutorialRoom', '35', 'Whiteboard; Display Screen', 'Available']
    ])
  ]);

  // 7. Groups Sheet
  addSheet('Groups', [
    ['group_code', 'group_name', 'program_code', 'batch_year', 'semester', 'student_count', 'target_size', 'status'],
    ...rowsOf(
      currentData?.sections,
      s => [
        s.name,
        s.name,
        currentData?.programs?.find(p => p.id === s.programId)?.code ?? '',
        String(s.batchYear),
        String(s.semester),
        String(s.studentCount),
        String(s.targetSize ?? s.studentCount),
        s.status || 'Active'
      ],
      [
        ['CSE-A', 'CSE Section A', 'BTECH-CSE', '2024', '5', '50', '50', 'Active'],
        ['CSE-B', 'CSE Section B', 'BTECH-CSE', '2024', '5', '50', '50', 'Active'],
        ['CSE-C', 'CSE Section C', 'BTECH-CSE', '2024', '5', '50', '50', 'Active']
      ]
    )
  ]);

  // 8. Subgroups Sheet
  addSheet('Subgroups', [
    ['group_code', 'subgroup_code', 'subgroup_name', 'student_count', 'type'],
    ...rowsOf(
      currentData?.sections?.flatMap(s => (s.subSections ?? []).map(sub => ({ s, sub }))),
      ({ s, sub }) => [s.name, sub.name, `${s.name}-${sub.name}`, String(sub.studentCount), sub.type || 'Lab'],
      [
        ['CSE-A', 'A1', 'CSE-A Lab Batch 1', '25', 'Lab'],
        ['CSE-A', 'A2', 'CSE-A Lab Batch 2', '25', 'Lab'],
        ['CSE-B', 'B1', 'CSE-B Lab Batch 1', '25', 'Lab'],
        ['CSE-B', 'B2', 'CSE-B Lab Batch 2', '25', 'Lab']
      ]
    )
  ]);

  // 9. Course Allocations Sheet
  addSheet('Course Allocations', [
    ['course_code', 'faculty_email', 'group_code', 'subgroup_code', 'session_type', 'hours_per_week', 'preferred_room'],
    ...rowsOf(
      currentData?.allocations,
      a => {
        const sec = currentData?.sections?.find(s => s.id === a.sectionId);
        return [
          currentData?.courses?.find(c => c.id === a.courseId)?.code ?? '',
          currentData?.facultyMembers?.find(f => f.id === a.facultyId)?.email ?? '',
          sec?.name ?? '',
          sec?.subSections?.find(sub => sub.id === a.subSectionId)?.name ?? '',
          a.sessionType,
          String(a.hoursPerWeek),
          currentData?.rooms?.find(r => r.id === a.preferredRoomId)?.name ?? ''
        ];
      },
      [
        ['CS501', 'arvind.sharma@thapar.edu', 'CSE-A', '', 'Lecture', '3', 'LT101'],
        ['CS501', 'arvind.sharma@thapar.edu', 'CSE-A', 'A1', 'Lab', '2', 'C-Lab 301'],
        ['CS501', 'arvind.sharma@thapar.edu', 'CSE-A', 'A2', 'Lab', '2', 'C-Lab 302'],
        ['CS502', 'priya.nair@thapar.edu', 'CSE-A', '', 'Lecture', '3', 'LT102'],
        ['CS503', 'vikram.seth@thapar.edu', 'CSE-A', '', 'Lecture', '3', 'LT101'],
        ['CS504', 'ananya.roy@thapar.edu', 'CSE-A', '', 'Lecture', '3', 'LT102'],
        ['CS505', 'arvind.sharma@thapar.edu', 'CSE-A', '', 'Lecture', '3', 'LT101']
      ]
    )
  ]);

  // 10. Students Sheet (Optional Enrollment). Exports only students actually passed in.
  addSheet('Students', [
    ['student_id', 'name', 'email', 'program_code', 'batch_year', 'group_code', 'subgroup_code'],
    ...rowsOf(currentData?.students, st => [st.studentId, st.name, st.email, st.programCode, String(st.batchYear), st.sectionName, st.subSectionName], [
      ['102303101', 'Sample Student One', 'student1@thapar.edu', 'BTECH-CSE', '2024', 'CSE-A', 'A1'],
      ['102303102', 'Sample Student Two', 'student2@thapar.edu', 'BTECH-CSE', '2024', 'CSE-A', 'A1'],
      ['102303103', 'Sample Student Three', 'student3@thapar.edu', 'BTECH-CSE', '2024', 'CSE-A', 'A2']
    ])
  ]);

  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

/** Lower-cases a header and drops spaces/underscores/punctuation: "Roll No." -> "rollno". */
const normKey = (k: string) => k.toLowerCase().replace(/[^a-z0-9]/g, '');

/** First non-empty cell among the given header variants (compared after normKey). */
const cell = (row: Record<string, unknown>, ...keys: string[]) => {
  for (const k of keys) {
    const v = row[normKey(k)];
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
};

/** Integer cell, or `fallback` only when the cell is empty or not a number (so "0" stays 0). */
const intCell = (row: Record<string, unknown>, fallback: number, ...keys: string[]) => {
  const n = parseInt(cell(row, ...keys), 10);
  return Number.isFinite(n) ? n : fallback;
};

/**
 * Parses and validates an uploaded Excel workbook, generating a clean validation preview
 */
export async function parseAndValidateMasterWorkbook(
  file: File,
  existingState: {
    departments: Department[];
    programs: Program[];
    courses: Course[];
    facultyMembers: Faculty[];
    rooms: Room[];
    sections: StudentSection[];
  }
): Promise<ExcelImportPreview> {
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });

  const errors: string[] = [];
  const warnings: string[] = [];

  const preview: ExcelImportPreview = {
    sheetCounts: {
      departments: 0,
      programs: 0,
      courses: 0,
      faculty: 0,
      rooms: 0,
      groups: 0,
      subgroups: 0,
      allocations: 0,
      students: 0,
    },
    totalRows: 0,
    validRows: 0,
    warningCount: 0,
    errorCount: 0,
    warnings,
    errors,
    parsedData: {
      departments: [],
      programs: [],
      courses: [],
      faculty: [],
      rooms: [],
      groups: [],
      subgroups: [],
      allocations: [],
      students: [],
    },
  };

  // Rows of a sheet (sheet name matched case-insensitively), with normalised header keys.
  const getSheetRows = (sheetName: string): Record<string, unknown>[] => {
    const key = Object.keys(wb.Sheets).find(k => k.trim().toLowerCase() === sheetName.toLowerCase());
    if (!key) return [];
    return XLSX.utils
      .sheet_to_json<Record<string, unknown>>(wb.Sheets[key], { defval: '' })
      .map(row => Object.fromEntries(Object.entries(row).map(([k, v]) => [normKey(k), v])));
  };

  // Maps for cross-validation within workbook and existing database
  const validDeptCodes = new Set(existingState.departments.map(d => d.code.toUpperCase()));
  const validProgCodes = new Set(existingState.programs.map(p => p.code.toUpperCase()));
  const validCourseCodes = new Set(existingState.courses.map(c => c.code.toUpperCase()));
  const validFacultyEmails = new Set(existingState.facultyMembers.map(f => f.email.toLowerCase()));
  const validRoomNames = new Set(existingState.rooms.map(r => r.name.toUpperCase()));
  const validGroupCodes = new Set(existingState.sections.map(s => s.name.toUpperCase()));
  const validSubgroups = new Set<string>(); // "GROUP:SUBGROUP"

  existingState.sections.forEach(s => {
    (s.subSections || []).forEach(sub => {
      validSubgroups.add(`${s.name.toUpperCase()}:${sub.name.toUpperCase()}`);
    });
  });

  // --- 1. DEPARTMENTS ---
  const deptRows = getSheetRows('Departments');
  preview.sheetCounts.departments = deptRows.length;
  deptRows.forEach((row, idx) => {
    const lineNum = idx + 2;
    const code = cell(row, 'department_code', 'code').toUpperCase();
    const name = cell(row, 'department_name', 'name');

    if (!code || !name) {
      errors.push(`Row ${lineNum} · Departments: Missing department_code or department_name.`);
      return;
    }

    validDeptCodes.add(code);
    preview.parsedData.departments.push({
      code,
      name,
      hodName: cell(row, 'hod_name', 'hod'),
      contactEmail: cell(row, 'contact_email', 'email'),
      status: cell(row, 'status') === 'Inactive' ? 'Inactive' : 'Active'
    });
  });

  const checkDept = (sheet: string, lineNum: number, deptCode: string) => {
    if (!deptCode) errors.push(`Row ${lineNum} · ${sheet}: Missing department_code.`);
    else if (!validDeptCodes.has(deptCode)) errors.push(`Row ${lineNum} · ${sheet}: Department code "${deptCode}" does not exist in Departments sheet or database.`);
    else return true;
    return false;
  };

  // --- 2. PROGRAMS ---
  const progRows = getSheetRows('Programs');
  preview.sheetCounts.programs = progRows.length;
  progRows.forEach((row, idx) => {
    const lineNum = idx + 2;
    const code = cell(row, 'program_code', 'code').toUpperCase();
    const name = cell(row, 'program_name', 'name');
    const deptCode = cell(row, 'department_code').toUpperCase();

    if (!code || !name) {
      errors.push(`Row ${lineNum} · Programs: Missing program_code or program_name.`);
      return;
    }
    if (!checkDept('Programs', lineNum, deptCode)) return;

    validProgCodes.add(code);
    preview.parsedData.programs.push({
      code,
      name,
      departmentId: '', // resolved on the server from departmentCode
      departmentCode: deptCode,
      durationYears: intCell(row, 4, 'duration_years'),
      totalSemesters: intCell(row, 8, 'total_semesters'),
      status: 'Active'
    });
  });

  // --- 3. FACULTY ---
  const facRows = getSheetRows('Faculty');
  preview.sheetCounts.faculty = facRows.length;
  facRows.forEach((row, idx) => {
    const lineNum = idx + 2;
    const name = cell(row, 'name', 'faculty_name');
    const email = cell(row, 'email', 'faculty_email').toLowerCase();
    const deptCode = cell(row, 'department_code').toUpperCase();
    const designation = (cell(row, 'designation') || 'Assistant Professor') as Faculty['designation'];

    if (!name || !email.includes('@')) {
      errors.push(`Row ${lineNum} · Faculty: Missing faculty name or a valid email.`);
      return;
    }
    if (!checkDept('Faculty', lineNum, deptCode)) return;

    validFacultyEmails.add(email);
    preview.parsedData.faculty.push({
      name,
      email,
      departmentId: '',
      departmentCode: deptCode,
      designation: ['Professor', 'Associate Professor', 'Assistant Professor', 'Visiting Faculty'].includes(designation) ? designation : 'Assistant Professor',
      subjectsQualified: [],
      maxDirectTeachingHours: intCell(row, 14, 'max_teaching_hours_per_week', 'max_hours'),
      weeklyHoursLimit: 40,
      preferences: {
        preferredDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        preferredPeriods: [1, 2, 3, 4, 6, 7],
        protectedSlots: [],
        maxConsecutivePeriods: 3,
        availableForMakeup: true,
        availableForTutorial: true,
      },
      status: 'Active'
    });
  });

  // --- 4. ROOMS ---
  const roomRows = getSheetRows('Rooms');
  preview.sheetCounts.rooms = roomRows.length;
  roomRows.forEach((row, idx) => {
    const lineNum = idx + 2;
    const name = cell(row, 'room_name', 'name');
    const type = (cell(row, 'type') || 'LectureHall') as Room['type'];
    const capacity = intCell(row, 0, 'capacity');
    const equipStr = cell(row, 'equipment');

    if (!name || capacity <= 0) {
      errors.push(`Row ${lineNum} · Rooms: Missing room_name or a positive capacity.`);
      return;
    }

    validRoomNames.add(name.toUpperCase());
    preview.parsedData.rooms.push({
      name,
      building: cell(row, 'building'),
      floor: intCell(row, 0, 'floor'),
      capacity,
      type: ['LectureHall', 'ComputerLab', 'HardwareLab', 'SeminarRoom', 'TutorialRoom'].includes(type) ? type : 'LectureHall',
      equipment: equipStr ? equipStr.split(/[;,]/).map(s => s.trim()).filter(Boolean) : [],
      isAvailable: cell(row, 'status').toLowerCase() !== 'maintenance'
    });
  });

  // --- 5. COURSES ---
  const courseRows = getSheetRows('Courses');
  preview.sheetCounts.courses = courseRows.length;
  courseRows.forEach((row, idx) => {
    const lineNum = idx + 2;
    const code = cell(row, 'course_code', 'code').toUpperCase();
    const name = cell(row, 'course_name', 'name');
    const deptCode = cell(row, 'department_code').toUpperCase();
    const lectures = intCell(row, 3, 'lecture_hours');
    const tutorials = intCell(row, 0, 'tutorial_hours');
    const labs = intCell(row, 0, 'lab_hours');
    const reqLab = cell(row, 'requires_lab').toUpperCase().startsWith('Y') || labs > 0;

    if (!code || !name) {
      errors.push(`Row ${lineNum} · Courses: Missing course_code or course_name.`);
      return;
    }
    if (!checkDept('Courses', lineNum, deptCode)) return;

    validCourseCodes.add(code);
    preview.parsedData.courses.push({
      code,
      name,
      departmentId: '',
      departmentCode: deptCode,
      credits: intCell(row, 4, 'credits'),
      requiredLecturesPerWeek: lectures,
      requiredTutorialsPerWeek: tutorials,
      requiredLabsPerWeek: labs,
      totalSemesterHours: (lectures + tutorials + labs) * 14,
      completedHours: 0,
      cancelledHours: 0,
      requiresLab: reqLab,
      requiredEquipment: [],
      primaryFacultyId: '',
      primaryFacultyEmail: cell(row, 'primary_faculty_email').toLowerCase(),
      status: 'Active'
    });
  });

  // --- 6. GROUPS ---
  const groupRows = getSheetRows('Groups');
  preview.sheetCounts.groups = groupRows.length;
  groupRows.forEach((row, idx) => {
    const lineNum = idx + 2;
    const code = cell(row, 'group_code', 'name').toUpperCase();
    const progCode = cell(row, 'program_code').toUpperCase();
    const count = intCell(row, 0, 'student_count');

    if (!code || count <= 0) {
      errors.push(`Row ${lineNum} · Groups: Missing group_code or a positive student_count.`);
      return;
    }
    if (progCode && !validProgCodes.has(progCode)) {
      warnings.push(`Row ${lineNum} · Groups: Program "${progCode}" not found; the group will have no program.`);
    }

    validGroupCodes.add(code);
    preview.parsedData.groups.push({
      code,
      programCode: progCode,
      name: code,
      departmentId: '',
      program: progCode,
      programId: '',
      // 0 lets the server keep the existing value or use its default.
      semester: intCell(row, 0, 'semester'),
      batchYear: intCell(row, 0, 'batch_year', 'batch'),
      studentCount: count,
      targetSize: intCell(row, count, 'target_size'),
      maxSize: Math.ceil(count * 1.2),
      status: 'Active'
    });
  });

  // --- 7. SUBGROUPS ---
  const subRows = getSheetRows('Subgroups');
  preview.sheetCounts.subgroups = subRows.length;
  subRows.forEach((row, idx) => {
    const lineNum = idx + 2;
    const groupCode = cell(row, 'group_code').toUpperCase();
    const subCode = cell(row, 'subgroup_code', 'name').toUpperCase();
    const type = (cell(row, 'type') || 'Lab') as 'Lab' | 'Tutorial' | 'Practical' | 'General';

    if (!groupCode || !subCode) {
      errors.push(`Row ${lineNum} · Subgroups: Missing group_code or subgroup_code.`);
      return;
    }

    if (!validGroupCodes.has(groupCode)) {
      errors.push(`Row ${lineNum} · Subgroups: Parent group "${groupCode}" does not exist in Groups sheet or database.`);
      return;
    }

    validSubgroups.add(`${groupCode}:${subCode}`);
    preview.parsedData.subgroups.push({
      groupCode,
      name: subCode,
      studentCount: intCell(row, 0, 'student_count'), // 0 = split the group evenly on the server
      type: ['Lab', 'Tutorial', 'Practical', 'General'].includes(type) ? type : 'Lab'
    });
  });

  // --- 8. COURSE ALLOCATIONS ---
  const allocRows = getSheetRows('Course Allocations');
  preview.sheetCounts.allocations = allocRows.length;
  allocRows.forEach((row, idx) => {
    const lineNum = idx + 2;
    const cCode = cell(row, 'course_code').toUpperCase();
    const fEmail = cell(row, 'faculty_email').toLowerCase();
    const gCode = cell(row, 'group_code').toUpperCase();
    const subName = cell(row, 'subgroup_code', 'subgroup').toUpperCase();
    const sType = (cell(row, 'session_type') || 'Lecture') as SessionType;
    const hours = intCell(row, 3, 'hours_per_week');
    const roomName = cell(row, 'preferred_room');

    if (!cCode || !fEmail || !gCode) {
      errors.push(`Row ${lineNum} · Course Allocations: Missing course_code, faculty_email, or group_code.`);
      return;
    }

    if (!validCourseCodes.has(cCode)) {
      errors.push(`Row ${lineNum} · Course Allocations: Course "${cCode}" was not found.`);
      return;
    }

    if (!validFacultyEmails.has(fEmail)) {
      errors.push(`Row ${lineNum} · Course Allocations: Faculty "${fEmail}" was not found.`);
      return;
    }

    if (!validGroupCodes.has(gCode)) {
      errors.push(`Row ${lineNum} · Course Allocations: Group "${gCode}" was not found.`);
      return;
    }

    if (hours <= 0) {
      errors.push(`Row ${lineNum} · Course Allocations: hours_per_week must be a positive number.`);
      return;
    }

    if ((sType === 'Lab' || sType === 'Practical') && hours % 2 !== 0) {
      errors.push(`Row ${lineNum} · Course Allocations: ${sType} hours must be even (2-hour blocks).`);
      return;
    }

    if (roomName && !validRoomNames.has(roomName.toUpperCase())) {
      warnings.push(`Row ${lineNum} · Course Allocations: Room "${roomName}" not found; the solver will pick a room.`);
    }

    if (subName && !validSubgroups.has(`${gCode}:${subName}`)) {
      warnings.push(`Row ${lineNum} · Course Allocations: Subgroup "${subName}" not declared for group "${gCode}". It will be auto-created.`);
      validSubgroups.add(`${gCode}:${subName}`);
      preview.parsedData.subgroups.push({
        groupCode: gCode,
        name: subName,
        studentCount: 0,
        type: sType === 'Lab' ? 'Lab' : 'Tutorial'
      });
    }

    preview.parsedData.allocations.push({
      courseCode: cCode,
      facultyEmail: fEmail,
      groupCode: gCode,
      subgroupName: subName || undefined,
      sessionType: ['Lecture', 'Lab', 'Tutorial', 'Practical', 'Elective', 'Makeup', 'Seminar'].includes(sType) ? sType : 'Lecture',
      hoursPerWeek: hours,
      roomName: roomName || undefined
    });
  });

  // --- 9. STUDENTS (optional roster) ---
  const studentRows = getSheetRows('Students');
  preview.sheetCounts.students = studentRows.length;
  const seenStudentIds = new Set<string>();
  studentRows.forEach((row, idx) => {
    const lineNum = idx + 2;
    const studentId = cell(row, 'student_id', 'studentId', 'roll_number', 'roll_no', 'roll', 'enrollment_no', 'enrollment_number', 'registration_no');
    const name = cell(row, 'name', 'student_name', 'full_name');
    const email = cell(row, 'email', 'student_email', 'email_id').toLowerCase();
    const programCode = cell(row, 'program_code', 'program').toUpperCase();
    const batchYear = intCell(row, 0, 'batch_year', 'batch');
    const groupCode = cell(row, 'group_code', 'group', 'section', 'section_code').toUpperCase();
    const subgroupName = cell(row, 'subgroup_code', 'subgroup_name', 'subgroup', 'sub_group').toUpperCase();

    if (!studentId || !name || !email.includes('@') || !groupCode) {
      errors.push(`Row ${lineNum} · Students: roll number, name, a valid email and group_code are required.`);
      return;
    }
    if (!validGroupCodes.has(groupCode)) {
      errors.push(`Row ${lineNum} · Students: Group "${groupCode}" was not found in Groups sheet or database.`);
      return;
    }
    if (seenStudentIds.has(studentId)) {
      warnings.push(`Row ${lineNum} · Students: Roll number ${studentId} appears more than once; the last row wins.`);
    }
    seenStudentIds.add(studentId);
    if (subgroupName && !validSubgroups.has(`${groupCode}:${subgroupName}`)) {
      warnings.push(`Row ${lineNum} · Students: Subgroup "${subgroupName}" not found in group "${groupCode}"; the student will be placed in the whole group only.`);
    }

    preview.parsedData.students.push({
      studentId,
      name,
      email,
      programCode: programCode || undefined,
      batchYear: batchYear || undefined,
      groupCode,
      subgroupName: subgroupName || undefined
    });
  });

  // Calculate totals
  const total =
    deptRows.length +
    progRows.length +
    facRows.length +
    roomRows.length +
    courseRows.length +
    groupRows.length +
    subRows.length +
    allocRows.length +
    studentRows.length;

  preview.totalRows = total;
  preview.errorCount = errors.length;
  preview.warningCount = warnings.length;
  preview.validRows = Math.max(0, total - errors.length);

  return preview;
}

export const parseMasterExcelWorkbook = parseAndValidateMasterWorkbook;
