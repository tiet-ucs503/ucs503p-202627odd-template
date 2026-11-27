import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import {
  Department,
  Program,
  Course,
  Faculty,
  Room,
  StudentSection,
  SubSection,
  CourseAllocation,
  DayOfWeek,
} from '../src/types';
import { INITIAL_ACADEMIC_YEAR } from '../src/lib/initialData';
import { buildDemoDataset } from '../src/server/demoData';

const { departments: DEPARTMENTS, programs: PROGRAMS } = buildDemoDataset();

function build500StudentWorkbook() {
  const wb = XLSX.utils.book_new();

  // 1. README Sheet
  const readmeData = [
    ['THAPAR INSTITUTE OF ENGINEERING & TECHNOLOGY — MASTER TIMETABLE SETUP WORKBOOK'],
    ['Version: 2026.3-ThirdYear-ComputerBranches'],
    ['Scenario: 1,847 Students | 68 Subgroups (3C11–3R13) | 149 Faculty | 60 Rooms & Labs | 37 Courses | 617 Sessions'],
    [''],
    ['INSTRUCTIONS FOR ACADEMIC COORDINATORS:'],
    ['1. Each worksheet represents one academic data entity.'],
    ['2. Use stable human-readable codes (e.g. CSED, UCS501, CSE-A, A1) to connect rows across sheets.'],
    ['3. Do NOT rename sheets or modify column headers in row 1.'],
    ['4. All codes are case-insensitive and trimmed automatically.'],
    ['5. Subgroups belong to Groups (e.g., Group CSE-A has Subgroup A1).'],
    ['6. Whole-group lectures target Group (e.g. CSE-A), while practicals target Subgroups (e.g. A1, A2).'],
    [''],
    ['WORKSHEETS SUMMARY:'],
    ['Sheet Name', 'Purpose', 'Key Identifier', 'Total Rows'],
    ['Departments', 'Academic Departments (e.g., CSED, ECED)', 'department_code', '4'],
    ['Programs', 'Academic Degrees/Branches (e.g., BTECH-CSE)', 'program_code', '3'],
    ['Courses', 'Curriculum Offerings & Lecture/Lab Hours', 'course_code', '6'],
    ['Faculty', 'Faculty Instructors, Designations & Workload Caps', 'email / faculty_code', '50'],
    ['Rooms', 'Classrooms, Lecture Theatres, & Computer/Hardware Labs', 'room_name / code', '50'],
    ['Groups', 'Batch Cohort Groups (CSE-A through CSE-J, 50 students each)', 'group_code', '10'],
    ['Subgroups', 'Lab/Tutorial Small Cohorts (A1, A2 .. J1, J2, 25 students each)', 'group_code + subgroup_name', '20'],
    ['Course Allocations', 'Curriculum Teaching Assignments to Groups/Subgroups', 'course_code + faculty + group', '150'],
    ['Students', '1,847 Student Enrollments with Subgroup/Practical Group assignments', 'student_id', '1847'],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(readmeData), 'README');

  // 2. Departments Sheet
  const deptData = [
    ['department_code', 'department_name', 'hod_name', 'contact_email', 'status'],
    ['CSED', 'Computer Science & Engineering', 'Dr. Rajesh Kumar', 'hod.csed@thapar.edu', 'Active'],
    ['ECED', 'Electronics & Communication Engineering', 'Dr. Alpana Agarwal', 'hod.eced@thapar.edu', 'Active'],
    ['MED', 'Mechanical Engineering Department', 'Dr. S. K. Mohapatra', 'hod.med@thapar.edu', 'Active'],
    ['CED', 'Civil Engineering Department', 'Dr. Naveen Kwatra', 'hod.ced@thapar.edu', 'Active'],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(deptData), 'Departments');

  // 3. Programs Sheet
  const progData = [
    ['program_code', 'program_name', 'department_code', 'duration_years', 'total_semesters', 'status'],
    ['BTECH-CSE', 'B.Tech Computer Science & Engineering', 'CSED', '4', '8', 'Active'],
    ['BTECH-ECE', 'B.Tech Electronics & Communication', 'ECED', '4', '8', 'Active'],
    ['BTECH-ME', 'B.Tech Mechanical Engineering', 'MED', '4', '8', 'Active'],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(progData), 'Programs');

  // 4. Courses Sheet (6 Courses: 4 Lab+Lecture, 2 Lecture-only)
  const courseData = [
    ['course_code', 'course_name', 'department_code', 'credits', 'lecture_hours', 'tutorial_hours', 'lab_hours', 'requires_lab', 'primary_faculty_email'],
    ['UCS501', 'Operating Systems Principles', 'CSED', '4', '3', '0', '2', 'YES', 'faculty1@thapar.edu'],
    ['UCS502', 'Database Management Systems', 'CSED', '4', '3', '0', '2', 'YES', 'faculty2@thapar.edu'],
    ['UCS503', 'Computer Networks & Protocols', 'CSED', '4', '3', '0', '2', 'YES', 'faculty3@thapar.edu'],
    ['UCS504', 'Embedded Systems & Architecture', 'CSED', '4', '3', '0', '2', 'YES', 'faculty4@thapar.edu'],
    ['UCS505', 'Design and Analysis of Algorithms', 'CSED', '4', '3', '1', '0', 'NO', 'faculty5@thapar.edu'],
    ['UCS506', 'Software Engineering & Agile Methodologies', 'CSED', '3', '3', '0', '0', 'NO', 'faculty6@thapar.edu'],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(courseData), 'Courses');

  // 5. Faculty Sheet (50 Faculty Members)
  const facData = [
    ['name', 'email', 'department_code', 'designation', 'max_teaching_hours_per_week', 'status'],
  ];
  for (let i = 1; i <= 50; i++) {
    const isSenior = i <= 15;
    facData.push([
      isSenior ? `Prof. Dr. Faculty ${i}` : `Dr. Assistant Prof. Faculty ${i}`,
      `faculty${i}@thapar.edu`,
      'CSED',
      isSenior ? 'Professor' : 'Assistant Professor',
      isSenior ? '16' : '20',
      'Active',
    ]);
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(facData), 'Faculty');

  // 6. Rooms Sheet (30 Classrooms + 20 Labs = 50 Total)
  const roomData = [
    ['room_name', 'building', 'type', 'capacity', 'equipment', 'status'],
  ];
  // 30 Classrooms
  for (let i = 1; i <= 30; i++) {
    const isLarge = i <= 10;
    const isSmall = i > 25;
    const roomName = isLarge ? `LT-${100 + i}` : isSmall ? `Seminar-${300 + i}` : `CR-${200 + i}`;
    const bldg = isLarge ? 'Lecture Complex A' : 'Academic Block B';
    const capacity = isLarge ? 100 : isSmall ? 30 : 60;
    const type = isSmall ? 'TutorialRoom' : 'LectureHall';
    roomData.push([roomName, bldg, type, String(capacity), 'Projector; Whiteboard; AudioSystem', 'Available']);
  }
  // 20 Labs
  for (let i = 1; i <= 20; i++) {
    const isHardware = i > 15;
    const roomName = isHardware ? `Hardware-Lab-${i}` : `Computing-Lab-${i}`;
    const capacity = 35;
    const type = isHardware ? 'HardwareLab' : 'ComputerLab';
    const equipment = isHardware ? 'MicrocontrollerKits; Oscilloscopes; PCs' : 'HighPerformancePCs; GPUCluster; GigabitLAN';
    roomData.push([roomName, 'Computer Centre Block C', type, String(capacity), equipment, 'Available']);
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(roomData), 'Rooms');

  // 7. Groups Sheet (10 Groups: CSE-A to CSE-J, 50 students each)
  const groupLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
  const groupData = [
    ['group_code', 'group_name', 'program_code', 'batch_year', 'semester', 'student_count', 'target_size', 'status'],
  ];
  groupLetters.forEach(l => {
    groupData.push([`CSE-${l}`, `CSE Section ${l}`, 'BTECH-CSE', '2024', '5', '50', '50', 'Active']);
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(groupData), 'Groups');

  // 8. Subgroups Sheet (20 Subgroups: A1, A2 .. J1, J2, 25 students each)
  const subData = [
    ['group_code', 'subgroup_code', 'subgroup_name', 'student_count', 'type'],
  ];
  groupLetters.forEach(l => {
    subData.push([`CSE-${l}`, `${l}1`, `CSE-${l} Subgroup 1`, '25', 'Lab']);
    subData.push([`CSE-${l}`, `${l}2`, `CSE-${l} Subgroup 2`, '25', 'Lab']);
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(subData), 'Subgroups');

  // 9. Course Allocations Sheet (150 Allocations across all 50 faculty)
  const allocData = [
    ['course_code', 'faculty_email', 'group_code', 'subgroup_code', 'session_type', 'hours_per_week', 'preferred_room'],
  ];
  const courses = [
    { code: 'UCS501', lecHours: 3, labHours: 2, tutHours: 0, requiresLab: true },
    { code: 'UCS502', lecHours: 3, labHours: 2, tutHours: 0, requiresLab: true },
    { code: 'UCS503', lecHours: 3, labHours: 2, tutHours: 0, requiresLab: true },
    { code: 'UCS504', lecHours: 3, labHours: 2, tutHours: 0, requiresLab: true },
    { code: 'UCS505', lecHours: 3, labHours: 0, tutHours: 1, requiresLab: false },
    { code: 'UCS506', lecHours: 3, labHours: 0, tutHours: 0, requiresLab: false },
  ];

  groupLetters.forEach((letter, gIdx) => {
    courses.forEach((c, cIdx) => {
      // Lecture (whole group)
      const lecFId = ((gIdx * 5 + cIdx) % 50) + 1;
      allocData.push([c.code, `faculty${lecFId}@thapar.edu`, `CSE-${letter}`, '', 'Lecture', String(c.lecHours), '']);

      // Labs (subgroups)
      if (c.requiresLab && c.labHours > 0) {
        const lab1FId = ((gIdx * 5 + cIdx + 20) % 50) + 1;
        const lab2FId = ((gIdx * 5 + cIdx + 27) % 50) + 1;
        allocData.push([c.code, `faculty${lab1FId}@thapar.edu`, `CSE-${letter}`, `${letter}1`, 'Lab', String(c.labHours), '']);
        allocData.push([c.code, `faculty${lab2FId}@thapar.edu`, `CSE-${letter}`, `${letter}2`, 'Lab', String(c.labHours), '']);
      }

      // Tutorial
      if (c.tutHours > 0) {
        const tutFId = ((gIdx * 3 + cIdx + 35) % 50) + 1;
        allocData.push([c.code, `faculty${tutFId}@thapar.edu`, `CSE-${letter}`, '', 'Tutorial', String(c.tutHours), '']);
      }
    });
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(allocData), 'Course Allocations');

  // 10. Students Sheet (Third-Year Computer Cohort)
  const studentData = [
    ['student_id', 'name', 'email', 'program_code', 'batch_year', 'group_code', 'subgroup_code'],
  ];
  let sid = 102401001;
  groupLetters.forEach(letter => {
    for (let i = 1; i <= 25; i++) {
      studentData.push([String(sid++), `Student ${letter}1-${i}`, `s_${letter.toLowerCase()}1_${i}@thapar.edu`, 'BTECH-CSE', '2024', `CSE-${letter}`, `${letter}1`]);
    }
    for (let i = 1; i <= 25; i++) {
      studentData.push([String(sid++), `Student ${letter}2-${i}`, `s_${letter.toLowerCase()}2_${i}@thapar.edu`, 'BTECH-CSE', '2024', `CSE-${letter}`, `${letter}2`]);
    }
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(studentData), 'Students');

  // Ensure directories exist and write files
  const publicDir = path.resolve(process.cwd(), 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  const distDir = path.resolve(process.cwd(), 'dist');
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  const publicFile = path.join(publicDir, 'third_year_computer_synthetic_dataset.xlsx');
  const distFile = path.join(distDir, 'third_year_computer_synthetic_dataset.xlsx');
  const rootFile = path.resolve(process.cwd(), 'third_year_computer_synthetic_dataset.xlsx');

  XLSX.writeFile(wb, publicFile);
  XLSX.writeFile(wb, distFile);
  XLSX.writeFile(wb, rootFile);

  console.log(`✓ Master Excel File Generated:`);
  console.log(`  - Root: ${rootFile}`);
  console.log(`  - Public: ${publicFile}`);
  console.log(`  - Dist: ${distFile}`);
  console.log(`  - Sheets: ${wb.SheetNames.join(', ')}`);
  console.log(`  - Students: 500 rows`);
  console.log(`  - Allocations: 150 rows`);
  console.log(`  - Rooms: 50 rows (30 Classrooms + 20 Labs)`);
  console.log(`  - Faculty: 50 rows`);
}

build500StudentWorkbook();
