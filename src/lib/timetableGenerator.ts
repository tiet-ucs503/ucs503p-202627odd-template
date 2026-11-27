import {
  ClassSession,
  Room,
  Faculty,
  StudentSection,
  Course,
  CourseAllocation,
  AcademicConstraint,
  AcademicYearConfig,
  TimeSlot,
  DayOfWeek,
  ValidationReport,
  ValidationItem
} from '../types';

/**
 * Validates the academic setup data before timetable generation.
 */
export function validateAcademicSetup(
  academicYear: AcademicYearConfig,
  departments: any[],
  programs: any[],
  courses: Course[],
  facultyMembers: Faculty[],
  rooms: Room[],
  sections: StudentSection[],
  allocations: CourseAllocation[],
  constraints: AcademicConstraint[]
): ValidationReport {
  const items: ValidationItem[] = [];

  // 1. Check Working Days & Time Slots
  if (!academicYear.workingDays || academicYear.workingDays.length === 0) {
    items.push({
      id: 'val-workdays',
      title: 'Working Days Configuration',
      category: 'Academic Year',
      status: 'Error',
      message: 'No active working days defined for the semester.',
      fixTab: 'academic_year',
    });
  } else {
    items.push({
      id: 'val-workdays-ok',
      title: 'Working Days Active',
      category: 'Academic Year',
      status: 'Passed',
      message: `${academicYear.workingDays.length} working days configured (${academicYear.workingDays.join(', ')}).`,
    });
  }

  const activeSlots = (academicYear.timeSlots || []).filter(ts => !ts.isLunch && !ts.isBreak);
  if (activeSlots.length === 0) {
    items.push({
      id: 'val-slots',
      title: 'Teaching Periods',
      category: 'Academic Year',
      status: 'Error',
      message: 'No teaching time slots defined.',
      fixTab: 'academic_year',
    });
  } else {
    items.push({
      id: 'val-slots-ok',
      title: 'Teaching Periods Defined',
      category: 'Academic Year',
      status: 'Passed',
      message: `${activeSlots.length} active lecture periods per day configured.`,
    });
  }

  // 2. Check Faculty
  const activeFaculty = facultyMembers.filter(f => f.status !== 'Inactive');
  if (activeFaculty.length === 0) {
    items.push({
      id: 'val-faculty-empty',
      title: 'Faculty Roster',
      category: 'Faculty',
      status: 'Error',
      message: 'No active faculty members registered in the institution.',
      fixTab: 'faculty',
    });
  } else {
    items.push({
      id: 'val-faculty-ok',
      title: 'Faculty Configured',
      category: 'Faculty',
      status: 'Passed',
      message: `${activeFaculty.length} faculty instructors available with defined workload caps.`,
    });
  }

  // 3. Check Courses
  const activeCourses = courses.filter(c => c.status !== 'Archived');
  if (activeCourses.length === 0) {
    items.push({
      id: 'val-courses-empty',
      title: 'Course Catalog',
      category: 'Courses',
      status: 'Error',
      message: 'No active courses configured for this academic semester.',
      fixTab: 'courses',
    });
  } else {
    items.push({
      id: 'val-courses-ok',
      title: 'Courses Configured',
      category: 'Courses',
      status: 'Passed',
      message: `${activeCourses.length} accredited courses configured in catalog.`,
    });
  }

  // 4. Check Rooms & Labs
  const availableRooms = rooms.filter(r => r.isAvailable);
  const labs = availableRooms.filter(r => r.type === 'ComputerLab' || r.type === 'HardwareLab');
  const lectureHalls = availableRooms.filter(r => r.type === 'LectureHall' || r.type === 'SeminarRoom' || r.type === 'TutorialRoom');

  if (availableRooms.length === 0) {
    items.push({
      id: 'val-rooms-empty',
      title: 'Physical Infrastructure',
      category: 'Rooms & Labs',
      status: 'Error',
      message: 'No physical rooms or laboratories available for scheduling.',
      fixTab: 'rooms',
    });
  } else {
    items.push({
      id: 'val-rooms-ok',
      title: 'Physical Classrooms & Labs',
      category: 'Rooms & Labs',
      status: 'Passed',
      message: `${lectureHalls.length} lecture halls and ${labs.length} laboratories available.`,
    });
  }

  // 5. Check Sections
  const activeSections = sections.filter(s => s.status !== 'Inactive');
  if (activeSections.length === 0) {
    items.push({
      id: 'val-sections-empty',
      title: 'Student Cohort Sections',
      category: 'Sections',
      status: 'Error',
      message: 'No student cohort sections defined.',
      fixTab: 'sections',
    });
  } else {
    items.push({
      id: 'val-sections-ok',
      title: 'Student Sections Registered',
      category: 'Sections',
      status: 'Passed',
      message: `${activeSections.length} cohort sections registered with student strengths.`,
    });
  }

  // 6. Check Course Allocations
  if (allocations.length === 0) {
    items.push({
      id: 'val-alloc-empty',
      title: 'Course-to-Faculty Allocations',
      category: 'Allocations',
      status: 'Error',
      message: 'No courses have been allocated to faculty and student sections.',
      fixTab: 'allocations',
    });
  } else {
    const unassignedCourses = activeCourses.filter(c => !allocations.some(a => a.courseId === c.id));
    if (unassignedCourses.length > 0) {
      items.push({
        id: 'val-alloc-unassigned',
        title: 'Unallocated Courses in Catalog',
        category: 'Allocations',
        status: 'Warning',
        message: `${unassignedCourses.length} course(s) (${unassignedCourses.map(c => c.code).join(', ')}) have not been allocated to any faculty/section.`,
        fixTab: 'allocations',
      });
    } else {
      items.push({
        id: 'val-alloc-ok',
        title: 'Course Allocations Complete',
        category: 'Allocations',
        status: 'Passed',
        message: `All ${activeCourses.length} active courses have faculty and section mappings.`,
      });
    }
  }

  // 7. Check Room Type, Equipment and Capacity Matching Compatibility
  let roomMatchingErrors = 0;
  for (const alloc of allocations) {
    const course = courses.find(c => c.id === alloc.courseId);
    const section = sections.find(s => s.id === alloc.sectionId);
    if (!section || !course) continue;

    const subSec = alloc.subSectionId ? section.subSections?.find(sb => sb.id === alloc.subSectionId) : undefined;
    const requiredCap = subSec ? subSec.studentCount : (alloc.subSectionId ? Math.ceil(section.studentCount / 2) : section.studentCount);
    const isLab = alloc.sessionType === 'Lab' || alloc.sessionType === 'Practical';

    const compatibleRooms = availableRooms.filter(r => {
      const typeOk = isLab
        ? (r.type === 'ComputerLab' || r.type === 'HardwareLab')
        : (r.type === 'LectureHall' || r.type === 'SeminarRoom' || r.type === 'TutorialRoom');
      const capOk = r.capacity >= requiredCap;
      const equipSet = new Set(r.equipment || []);
      const equipOk = !course.requiredEquipment || course.requiredEquipment.length === 0 || course.requiredEquipment.every(eq => equipSet.has(eq));
      return typeOk && capOk && equipOk;
    });

    if (compatibleRooms.length === 0) {
      roomMatchingErrors++;
      const reqEquip = course.requiredEquipment || [];
      const bestTypeRooms = availableRooms.filter(r => isLab ? (r.type === 'ComputerLab' || r.type === 'HardwareLab') : (r.type !== 'ComputerLab' && r.type !== 'HardwareLab'));
      const missingEquipDetails = reqEquip.length > 0 ? ` Required equipment: [${reqEquip.join(', ')}].` : '';

      items.push({
        id: `val-room-match-${alloc.id}`,
        title: `Room Matching Shortage: ${course.code} (${alloc.sessionType})`,
        category: 'Rooms & Labs',
        status: 'Error',
        message: `No available ${isLab ? 'laboratory' : 'lecture room'} meets capacity (${requiredCap} students) and equipment for ${course.code} (${section.name}${subSec ? `/${subSec.name}` : ''}).${missingEquipDetails}`,
        fixTab: 'rooms_mgmt',
      });
    }
  }

  if (roomMatchingErrors === 0) {
    items.push({
      id: 'val-room-match-ok',
      title: 'Room & Equipment Matching Compliance',
      category: 'Infrastructure',
      status: 'Passed',
      message: 'All allocations have available matching physical rooms with sufficient capacity and required equipment.',
    });
  }

  // 8. Check Lab Requirements vs Lab Availability
  const labAllocations = allocations.filter(a => a.sessionType === 'Lab' || a.sessionType === 'Practical');
  if (labAllocations.length > 0 && labs.length === 0) {
    items.push({
      id: 'val-lab-missing',
      title: 'Lab Allocation Without Laboratory Rooms',
      category: 'Infrastructure',
      status: 'Error',
      message: `${labAllocations.length} lab session(s) required, but 0 Computer/Hardware Labs are configured.`,
      fixTab: 'rooms_mgmt',
    });
  }

  // 9. Check Faculty Workload Caps
  const facultyHoursMap: Record<string, number> = {};
  allocations.forEach(a => {
    facultyHoursMap[a.facultyId] = (facultyHoursMap[a.facultyId] || 0) + a.hoursPerWeek;
  });

  let workloadOverloadedFaculty = 0;
  for (const fac of activeFaculty) {
    const assignedHours = facultyHoursMap[fac.id] || 0;
    if (assignedHours > fac.maxDirectTeachingHours) {
      workloadOverloadedFaculty++;
    }
  }

  if (workloadOverloadedFaculty > 0) {
    items.push({
      id: 'val-workload-warn',
      title: 'UGC Faculty Workload Overload',
      category: 'Workload',
      status: 'Warning',
      message: `${workloadOverloadedFaculty} faculty member(s) assigned hours exceed their UGC direct teaching limit.`,
      fixTab: 'faculty_mgmt',
    });
  } else {
    items.push({
      id: 'val-workload-ok',
      title: 'Faculty Workload Balance',
      category: 'Workload',
      status: 'Passed',
      message: 'All faculty teaching loads are within UGC limits.',
    });
  }

  const errorCount = items.filter(i => i.status === 'Error').length;
  const warningCount = items.filter(i => i.status === 'Warning').length;
  const passedCount = items.filter(i => i.status === 'Passed').length;

  return {
    isReadyForGeneration: errorCount === 0,
    passedCount,
    warningCount,
    errorCount,
    items,
  };
}

import { executeOptimizationEngine } from './optimizationEngine';
import { validateTimetableIndependently } from './independentValidator';

/**
 * Generates a draft timetable using the high-performance Bitset Constraint Optimization Engine.
 */
export function generateTimetableFromConfiguration(
  academicYear: AcademicYearConfig,
  allocations: CourseAllocation[],
  facultyMembers: Faculty[],
  rooms: Room[],
  sections: StudentSection[],
  courses: Course[],
  constraints: AcademicConstraint[]
): {
  sessions: ClassSession[];
  scheduledHours: number;
  totalRequestedHours: number;
  unscheduledAllocations: CourseAllocation[];
  conflicts: string[];
} {
  const engineResult = executeOptimizationEngine(
    academicYear,
    allocations,
    facultyMembers,
    rooms,
    sections,
    courses,
    constraints,
    { budgetMode: 'FAST', timeBudgetMs: 100, seed: 1337 }
  );

  if (engineResult.isFeasible && engineResult.bestCandidate) {
    const report = validateTimetableIndependently(engineResult.bestCandidate.sessions, {
      academicYear,
      allocations,
      facultyMembers,
      rooms,
      sections,
      courses,
      constraints,
    });

    if (report.isValid) {
      return {
        sessions: engineResult.bestCandidate.sessions,
        scheduledHours: engineResult.bestCandidate.scheduledHours,
        totalRequestedHours: engineResult.bestCandidate.totalRequestedHours,
        unscheduledAllocations: engineResult.bestCandidate.unscheduledAllocations,
        conflicts: [],
      };
    } else {
      return {
        sessions: [],
        scheduledHours: 0,
        totalRequestedHours: allocations.reduce((acc, a) => acc + a.hoursPerWeek, 0),
        unscheduledAllocations: allocations,
        conflicts: report.violations.map(v => v.message),
      };
    }
  }

  return {
    sessions: [],
    scheduledHours: 0,
    totalRequestedHours: allocations.reduce((acc, a) => acc + a.hoursPerWeek, 0),
    unscheduledAllocations: allocations,
    conflicts: engineResult.infeasibilityDiagnostics || [engineResult.statusMessage],
  };
}
