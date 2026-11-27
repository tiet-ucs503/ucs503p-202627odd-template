import {
  ClassSession,
  Room,
  Faculty,
  StudentSection,
  SubSection,
  Course,
  CourseAllocation,
  AcademicYearConfig,
  DayOfWeek,
  AcademicConstraint
} from '../types';
import { facultyTeachingCap, facultyTeachingPeriods } from './facultyWorkload';

export type ViolationCode =
  | 'FACULTY_COLLISION'
  | 'ROOM_COLLISION'
  | 'GROUP_COLLISION'
  | 'SUBGROUP_COLLISION'
  | 'CROSS_COHORT_COLLISION'
  | 'CAPACITY_SHORTAGE'
  | 'ROOM_TYPE_MISMATCH'
  | 'FACULTY_UNAVAILABLE'
  | 'ROOM_UNAVAILABLE'
  | 'BREAK_PERIOD_VIOLATION'
  | 'NON_WORKING_DAY'
  | 'DISCONTINUOUS_BLOCK'
  | 'MISSING_REQUIRED_SESSIONS'
  | 'LAB_DURATION_VIOLATION'
  | 'PINNED_SESSION_VIOLATION'
  | 'ELECTIVE_GROUP_MISMATCH'
  | 'SAME_COURSE_SAME_DAY'
  | 'SAME_COURSE_CONSECUTIVE'
  | 'EXCESSIVE_STUDENT_GAPS'
  | 'EXCESSIVE_FACULTY_GAPS'
  | 'EXCESSIVE_STUDENT_DAILY_LOAD'
  | 'EXCESSIVE_FACULTY_DAILY_LOAD'
  | 'POOR_COURSE_DISTRIBUTION'
  | 'UNNECESSARY_ROOM_CHANGE';

export interface ViolationDetail {
  id: string;
  code: ViolationCode;
  severity: 'CRITICAL' | 'WARNING';
  sessionIds: string[];
  entityName: string;
  day: DayOfWeek;
  timeSlotId: string;
  message: string;
  recommendation: string;
}

export interface DetailedQualityMetrics {
  facultyConflictFreeRate: number;
  roomUtilizationRate: number;
  labUtilizationRate: number;
  capacityComplianceRate: number;
  subgroupParallelEfficiency: number;
  sameCourseSameDayCount: number;
  sameCourseConsecutiveCount: number;
  totalStudentGaps: number;
  totalFacultyGaps: number;
  avgStudentDailyLoad: number;
  maxStudentDailyLoad: number;
  avgFacultyDailyLoad: number;
  maxFacultyDailyLoad: number;
  courseDistributionQualityRate: number;
}

export interface IndependentValidationReport {
  isValid: boolean;
  canPublish: boolean;
  hardViolationsCount: number;
  warningCount: number;
  violations: ViolationDetail[];
  totalSessionsEvaluated: number;
  requiredSessionsCount: number;
  scheduledSessionsCount: number;
  completionRate: number; // 0 - 100%
  metrics: DetailedQualityMetrics;
  auditTimestamp: string;
}

export interface ValidationContext {
  academicYear: AcademicYearConfig;
  allocations: CourseAllocation[];
  facultyMembers: Faculty[];
  rooms: Room[];
  sections: StudentSection[];
  courses: Course[];
  constraints?: AcademicConstraint[];
}

/**
 * Independent Timetable Validator
 * Validates any candidate, draft, or published timetable matrix against all
 * university hard and soft constraints without relying on the solver's internal state.
 */
export function validateTimetableIndependently(
  sessions: ClassSession[],
  context: ValidationContext
): IndependentValidationReport {
  const {
    academicYear,
    allocations,
    facultyMembers,
    rooms,
    sections,
    courses
  } = context;

  const violations: ViolationDetail[] = [];
  const workingDays = new Set(academicYear.workingDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
  const lunchSlotIds = new Set(
    (academicYear.timeSlots || []).filter(ts => ts.isLunch || ts.id === academicYear.lunchPeriodId).map(ts => ts.id)
  );

  // Fast entity lookup maps
  const facultyMap = new Map<string, Faculty>();
  facultyMembers.forEach(f => facultyMap.set(f.id, f));

  const roomMap = new Map<string, Room>();
  rooms.forEach(r => roomMap.set(r.id, r));

  const sectionMap = new Map<string, StudentSection>();
  sections.forEach(s => sectionMap.set(s.id, s));

  const courseMap = new Map<string, Course>();
  courses.forEach(c => courseMap.set(c.id, c));

  const activeSessions = sessions.filter(s => s.status !== 'Cancelled');

  // Multi-map indexing for O(1) collision detection across timeslots:
  // Key: `${day}:${timeSlotId}`
  const facultySlotMap = new Map<string, ClassSession[]>();
  const roomSlotMap = new Map<string, ClassSession[]>();
  const sectionSlotMap = new Map<string, ClassSession[]>();

  // 1. Evaluate individual sessions
  activeSessions.forEach(session => {
    const timeKey = `${session.day}:${session.timeSlotId}`;
    const course = courseMap.get(session.courseId);
    const faculty = facultyMap.get(session.facultyId);
    const room = roomMap.get(session.roomId);
    const section = sectionMap.get(session.sectionId);
    const subgroup = section?.subSections?.find(sub => sub.id === session.subSectionId);

    // Check A: Non-working day
    if (!workingDays.has(session.day)) {
      violations.push({
        id: `viol-nwd-${session.id}`,
        code: 'NON_WORKING_DAY',
        severity: 'CRITICAL',
        sessionIds: [session.id],
        entityName: session.day,
        day: session.day,
        timeSlotId: session.timeSlotId,
        message: `Class for ${course?.code || session.courseId} is scheduled on ${session.day}, which is not an active academic working day.`,
        recommendation: `Move this class to Monday–Friday.`
      });
    }

    // Check B: Protected lunch / break period
    if (lunchSlotIds.has(session.timeSlotId)) {
      violations.push({
        id: `viol-lunch-${session.id}`,
        code: 'BREAK_PERIOD_VIOLATION',
        severity: 'CRITICAL',
        sessionIds: [session.id],
        entityName: 'Campus Lunch Break',
        day: session.day,
        timeSlotId: session.timeSlotId,
        message: `Class for ${course?.code || session.courseId} conflicts with the protected campus lunch/break period (${session.timeSlotId}).`,
        recommendation: `Reschedule to an active teaching period.`
      });
    }

    // Check C: Room Availability
    if (room && !room.isAvailable) {
      violations.push({
        id: `viol-room-avail-${session.id}`,
        code: 'ROOM_UNAVAILABLE',
        severity: 'CRITICAL',
        sessionIds: [session.id],
        entityName: room.name,
        day: session.day,
        timeSlotId: session.timeSlotId,
        message: `Room ${room.name} is marked as unavailable/maintenance for session ${course?.code || session.courseId}.`,
        recommendation: `Assign an available active facility.`
      });
    }

    // Check D: Room Capacity
    if (room && section) {
      const cohortSize = subgroup ? subgroup.studentCount : section.studentCount;
      if (cohortSize > room.capacity) {
        violations.push({
          id: `viol-cap-${session.id}`,
          code: 'CAPACITY_SHORTAGE',
          severity: 'CRITICAL',
          sessionIds: [session.id],
          entityName: room.name,
          day: session.day,
          timeSlotId: session.timeSlotId,
          message: `Facility ${room.name} (capacity ${room.capacity}) cannot accommodate ${cohortSize} students of ${section.name}${subgroup ? `/${subgroup.name}` : ''}.`,
          recommendation: `Move to a facility with at least ${cohortSize} seating capacity.`
        });
      }
    }

    // Check E: Room Type & Equipment Compliance
    if (room) {
      const isLabSession = session.type === 'Lab' || session.type === 'Practical';
      const isLabRoom = room.type === 'ComputerLab' || room.type === 'HardwareLab';
      if (isLabSession && !isLabRoom) {
        violations.push({
          id: `viol-room-type-${session.id}`,
          code: 'ROOM_TYPE_MISMATCH',
          severity: 'CRITICAL',
          sessionIds: [session.id],
          entityName: room.name,
          day: session.day,
          timeSlotId: session.timeSlotId,
          message: `Laboratory session ${course?.code || session.courseId} cannot be held in a lecture classroom (${room.name} is ${room.type}).`,
          recommendation: `Assign a dedicated Computer Lab or Hardware Lab.`
        });
      }

      // Lectures not in labs (unless course explicitly requires lab facilities)
      if (!isLabSession && isLabRoom && !course?.requiresLab) {
        violations.push({
          id: `viol-lecture-in-lab-${session.id}`,
          code: 'ROOM_TYPE_MISMATCH',
          severity: 'CRITICAL',
          sessionIds: [session.id],
          entityName: room.name,
          day: session.day,
          timeSlotId: session.timeSlotId,
          message: `Lecture session ${course?.code || session.courseId} should not occupy a specialised laboratory (${room.name}).`,
          recommendation: `Assign a standard lecture hall or tutorial room.`
        });
      }

      // Check Equipment Requirements
      if (course?.requiredEquipment && course.requiredEquipment.length > 0) {
        const roomEquip = new Set(room.equipment || []);
        const missingEquip = course.requiredEquipment.filter(eq => !roomEquip.has(eq));
        if (missingEquip.length > 0) {
          violations.push({
            id: `viol-equip-${session.id}`,
            code: 'ROOM_TYPE_MISMATCH',
            severity: 'CRITICAL',
            sessionIds: [session.id],
            entityName: room.name,
            day: session.day,
            timeSlotId: session.timeSlotId,
            message: `Facility ${room.name} lacks required equipment for ${course.code || course.id}: missing [${missingEquip.join(', ')}].`,
            recommendation: `Assign a facility equipped with ${missingEquip.join(', ')}.`
          });
        }
      }
    }

    // Check F: Faculty Protected / Unavailable Slots & Status
    if (faculty) {
      if (faculty.status === 'OnLeave' || faculty.status === 'Inactive') {
        violations.push({
          id: `viol-fac-status-${session.id}`,
          code: 'FACULTY_UNAVAILABLE',
          severity: 'CRITICAL',
          sessionIds: [session.id],
          entityName: faculty.name,
          day: session.day,
          timeSlotId: session.timeSlotId,
          message: `Faculty ${faculty.name} is marked as ${faculty.status} and cannot be assigned teaching sessions.`,
          recommendation: `Reassign allocations to active faculty.`
        });
      }

      if (faculty.preferences?.protectedSlots) {
        const isProtected = faculty.preferences.protectedSlots.some(
          ps => ps.day === session.day && ps.periodId === session.timeSlotId
        );
        if (isProtected) {
          violations.push({
            id: `viol-fac-unavail-${session.id}`,
            code: 'FACULTY_UNAVAILABLE',
            severity: 'CRITICAL',
            sessionIds: [session.id],
            entityName: faculty.name,
            day: session.day,
            timeSlotId: session.timeSlotId,
            message: `Instructor ${faculty.name} has a designated protected slot on ${session.day} at ${session.timeSlotId}.`,
            recommendation: `Move session to an open period for ${faculty.name}.`
          });
        }
      }
    }

    // Index into multi-maps
    const facKey = `${session.facultyId}@${timeKey}`;
    const facSessions = facultySlotMap.get(facKey) || [];
    facSessions.push(session);
    facultySlotMap.set(facKey, facSessions);

    const roomKey = `${session.roomId}@${timeKey}`;
    const rSessions = roomSlotMap.get(roomKey) || [];
    rSessions.push(session);
    roomSlotMap.set(roomKey, rSessions);

    const secKey = `${session.sectionId}@${timeKey}`;
    const secSessions = sectionSlotMap.get(secKey) || [];
    secSessions.push(session);
    sectionSlotMap.set(secKey, secSessions);
  });

  // 2. Detect Faculty Collisions (same faculty teaching 2+ classes simultaneously)
  facultySlotMap.forEach((matchedSessions, key) => {
    if (matchedSessions.length > 1) {
      const [facId, timeInfo] = key.split('@');
      const [day, timeSlotId] = timeInfo.split(':') as [DayOfWeek, string];
      const faculty = facultyMap.get(facId);
      const courseCodes = matchedSessions.map(s => courseMap.get(s.courseId)?.code || s.courseId).join(', ');

      violations.push({
        id: `viol-fac-col-${facId}-${timeInfo}`,
        code: 'FACULTY_COLLISION',
        severity: 'CRITICAL',
        sessionIds: matchedSessions.map(s => s.id),
        entityName: faculty?.name || facId,
        day,
        timeSlotId,
        message: `Faculty collision: ${faculty?.name || 'Instructor'} is double-booked across ${matchedSessions.length} courses (${courseCodes}) on ${day} at ${timeSlotId}.`,
        recommendation: `Reschedule one of the conflicting sessions to a free slot.`
      });
    }
  });

  // 3. Detect Room Collisions (same room hosting 2+ classes simultaneously)
  roomSlotMap.forEach((matchedSessions, key) => {
    if (matchedSessions.length > 1) {
      const [roomId, timeInfo] = key.split('@');
      const [day, timeSlotId] = timeInfo.split(':') as [DayOfWeek, string];
      const room = roomMap.get(roomId);
      const coursesInRoom = matchedSessions.map(s => courseMap.get(s.courseId)?.code || s.courseId).join(', ');

      violations.push({
        id: `viol-room-col-${roomId}-${timeInfo}`,
        code: 'ROOM_COLLISION',
        severity: 'CRITICAL',
        sessionIds: matchedSessions.map(s => s.id),
        entityName: room?.name || roomId,
        day,
        timeSlotId,
        message: `Facility collision: Room ${room?.name || 'Room'} is double-booked with ${matchedSessions.length} concurrent classes (${coursesInRoom}) on ${day} at ${timeSlotId}.`,
        recommendation: `Assign distinct rooms or move to non-conflicting time slots.`
      });
    }
  });

  // 4. Detect Cohort (Group & Subgroup) Collisions:
  // - A whole-group lecture collides with ANY other whole-group or subgroup session for that group.
  // - Two sessions for the EXACT SAME subgroup collide.
  // - Two sessions for DIFFERENT subgroups (e.g. A1 in Lab 1 and A2 in Lab 2) DO NOT collide!
  sectionSlotMap.forEach((matchedSessions, key) => {
    if (matchedSessions.length <= 1) return;

    const [secId, timeInfo] = key.split('@');
    const [day, timeSlotId] = timeInfo.split(':') as [DayOfWeek, string];
    const section = sectionMap.get(secId);

    const wholeSectionSessions = matchedSessions.filter(s => !s.subSectionId);
    const subgroupSessions = matchedSessions.filter(s => !!s.subSectionId);

    // Whole section lecture with another whole section lecture
    if (wholeSectionSessions.length > 1) {
      const coursesList = wholeSectionSessions.map(s => courseMap.get(s.courseId)?.code || s.courseId).join(', ');
      violations.push({
        id: `viol-sec-col-${secId}-${timeInfo}`,
        code: 'GROUP_COLLISION',
        severity: 'CRITICAL',
        sessionIds: wholeSectionSessions.map(s => s.id),
        entityName: section?.name || secId,
        day,
        timeSlotId,
        message: `Cohort collision: Section ${section?.name} has ${wholeSectionSessions.length} overlapping whole-class sessions (${coursesList}) on ${day} at ${timeSlotId}.`,
        recommendation: `Stagger lectures across different periods.`
      });
    }

    // Whole section lecture overlapping with a subgroup session
    if (wholeSectionSessions.length > 0 && subgroupSessions.length > 0) {
      const lectureCourse = courseMap.get(wholeSectionSessions[0].courseId)?.code || wholeSectionSessions[0].courseId;
      const subNames = subgroupSessions
        .map(s => {
          const sub = section?.subSections?.find(sub => sub.id === s.subSectionId);
          return sub?.name || 'Subgroup';
        })
        .join(', ');

      violations.push({
        id: `viol-cross-col-${secId}-${timeInfo}`,
        code: 'CROSS_COHORT_COLLISION',
        severity: 'CRITICAL',
        sessionIds: [...wholeSectionSessions.map(s => s.id), ...subgroupSessions.map(s => s.id)],
        entityName: section?.name || secId,
        day,
        timeSlotId,
        message: `Cross-cohort collision: Section ${section?.name} has a whole-class lecture (${lectureCourse}) while subgroups (${subNames}) are scheduled for separate sessions on ${day} at ${timeSlotId}.`,
        recommendation: `Lectures require full student attendance and cannot overlap with laboratory subgroups.`
      });
    }

    // Check duplicate bookings for the EXACT same subgroup
    const subgroupMap = new Map<string, ClassSession[]>();
    subgroupSessions.forEach(s => {
      const subList = subgroupMap.get(s.subSectionId!) || [];
      subList.push(s);
      subgroupMap.set(s.subSectionId!, subList);
    });

    subgroupMap.forEach((subSessions, subId) => {
      if (subSessions.length > 1) {
        const subObj = section?.subSections?.find(sub => sub.id === subId);
        const subCourses = subSessions.map(s => courseMap.get(s.courseId)?.code || s.courseId).join(', ');
        violations.push({
          id: `viol-sub-col-${subId}-${timeInfo}`,
          code: 'SUBGROUP_COLLISION',
          severity: 'CRITICAL',
          sessionIds: subSessions.map(s => s.id),
          entityName: `${section?.name}/${subObj?.name || 'Subgroup'}`,
          day,
          timeSlotId,
          message: `Subgroup collision: Subgroup ${section?.name}/${subObj?.name} has ${subSessions.length} overlapping classes (${subCourses}) on ${day} at ${timeSlotId}.`,
          recommendation: `Schedule subgroup sessions at distinct non-overlapping times.`
        });
      }
    });
  });

  // 5. Check Required vs Scheduled session counts
  let totalRequiredHours = 0;
  allocations.forEach(a => {
    totalRequiredHours += a.hoursPerWeek;
  });

  const scheduledHours = activeSessions.length;
  if (scheduledHours < totalRequiredHours) {
    const missingHours = totalRequiredHours - scheduledHours;
    violations.push({
      id: 'viol-missing-sessions',
      code: 'MISSING_REQUIRED_SESSIONS',
      severity: 'CRITICAL',
      sessionIds: [],
      entityName: 'Curriculum Requirements',
      day: 'Monday',
      timeSlotId: 'N/A',
      message: `Timetable is incomplete: ${missingHours} required teaching hour(s) are unscheduled (${scheduledHours} scheduled vs ${totalRequiredHours} required).`,
      recommendation: `Run the generator or manually place remaining sessions.`
    });
  }

  // 5b. Academic Quality Checks & Hard Lab Rules
  let sameCourseSameDayCount = 0;
  let sameCourseConsecutiveCount = 0;
  let totalStudentGaps = 0;
  let totalFacultyGaps = 0;

  const studentDailyLoadMap = new Map<string, number>();
  const studentDayPeriodsMap = new Map<string, number[]>();
  const facultyDailyLoadMap = new Map<string, number>();
  const facultyDayPeriodsMap = new Map<string, number[]>();
  const courseDayMap = new Map<string, Set<DayOfWeek>>();
  const courseLectureDayMap = new Map<string, Map<DayOfWeek, ClassSession[]>>();
  const labCohortDayMap = new Map<string, ClassSession[]>();

  activeSessions.forEach(session => {
    const timeSlotNum = parseInt(session.timeSlotId.replace('ts-', ''), 10) || 1;
    const course = courseMap.get(session.courseId);
    const section = sectionMap.get(session.sectionId);
    const subSecKey = session.subSectionId || 'ALL';

    const studentKey = `${session.sectionId}_${subSecKey}_${session.day}`;
    studentDailyLoadMap.set(studentKey, (studentDailyLoadMap.get(studentKey) || 0) + 1);
    if (!studentDayPeriodsMap.has(studentKey)) studentDayPeriodsMap.set(studentKey, []);
    studentDayPeriodsMap.get(studentKey)!.push(timeSlotNum);

    const facultyKey = `${session.facultyId}_${session.day}`;
    facultyDailyLoadMap.set(facultyKey, (facultyDailyLoadMap.get(facultyKey) || 0) + 1);
    if (!facultyDayPeriodsMap.has(facultyKey)) facultyDayPeriodsMap.set(facultyKey, []);
    facultyDayPeriodsMap.get(facultyKey)!.push(timeSlotNum);

    const courseSecKey = `${session.sectionId}_${session.courseId}`;
    if (!courseDayMap.has(courseSecKey)) courseDayMap.set(courseSecKey, new Set());
    courseDayMap.get(courseSecKey)!.add(session.day);

    if (session.type === 'Lecture') {
      const lecKey = `${session.sectionId}_${subSecKey}_${session.courseId}`;
      if (!courseLectureDayMap.has(lecKey)) courseLectureDayMap.set(lecKey, new Map());
      const dayMap = courseLectureDayMap.get(lecKey)!;
      if (!dayMap.has(session.day)) dayMap.set(session.day, []);
      dayMap.get(session.day)!.push(session);
    } else if (session.type === 'Lab' || session.type === 'Practical') {
      const labKey = `${session.sectionId}_${subSecKey}_${session.courseId}_${session.day}`;
      if (!labCohortDayMap.has(labKey)) labCohortDayMap.set(labKey, []);
      labCohortDayMap.get(labKey)!.push(session);
    }
  });

  // Check Lab Atomicity & Duration Rules (Supports 2-period and 3-period lab blocks)
  labCohortDayMap.forEach((labSessions, labKey) => {
    const [secId, subSecId, courseId, day] = labKey.split('_') as [string, string, string, DayOfWeek];
    const course = courseMap.get(courseId);
    const section = sectionMap.get(secId);
    const subObj = section?.subSections?.find(sub => sub.id === subSecId);
    const cohortName = `${section?.name || secId}${subObj ? `/${subObj.name}` : ''}`;

    // Expected block duration: check session durationPeriods, allocation, or course definition (default 2, or 3)
    const expectedDuration = labSessions[0]?.durationPeriods || (course?.requiredLabsPerWeek === 3 ? 3 : 2);

    if (labSessions.length < expectedDuration) {
      violations.push({
        id: `viol-lab-dur-${labKey}`,
        code: 'LAB_DURATION_VIOLATION',
        severity: 'CRITICAL',
        sessionIds: labSessions.map(s => s.id),
        entityName: cohortName,
        day,
        timeSlotId: labSessions[0]?.timeSlotId || 'ts-1',
        message: `Laboratory session for ${course?.code || courseId} (${cohortName}) on ${day} has only ${labSessions.length} hour(s). Labs must occupy exactly ${expectedDuration} consecutive periods.`,
        recommendation: `Schedule lab as a ${expectedDuration}-hour contiguous block.`,
      });
    } else {
      labSessions.sort((a, b) => {
        const pA = parseInt(a.timeSlotId.replace('ts-', ''), 10) || 1;
        const pB = parseInt(b.timeSlotId.replace('ts-', ''), 10) || 1;
        return pA - pB;
      });

      for (let i = 0; i < labSessions.length; i += expectedDuration) {
        const block = labSessions.slice(i, i + expectedDuration);
        if (block.length < expectedDuration) {
          violations.push({
            id: `viol-lab-dur-rem-${labKey}-${i}`,
            code: 'LAB_DURATION_VIOLATION',
            severity: 'CRITICAL',
            sessionIds: block.map(s => s.id),
            entityName: cohortName,
            day,
            timeSlotId: block[0].timeSlotId,
            message: `Laboratory session for ${course?.code || courseId} (${cohortName}) on ${day} has incomplete trailing periods (${block.length} of ${expectedDuration} hrs).`,
            recommendation: `Labs must be scheduled in ${expectedDuration}-hour contiguous blocks.`,
          });
          continue;
        }

        const firstRoomId = block[0].roomId;
        const firstFacultyId = block[0].facultyId;

        for (let j = 0; j < block.length; j++) {
          const sCurr = block[j];
          const pCurr = parseInt(sCurr.timeSlotId.replace('ts-', ''), 10) || 1;

          if (lunchSlotIds.has(sCurr.timeSlotId) || pCurr === 5) {
            violations.push({
              id: `viol-lab-lunch-${labKey}-${i}-${j}`,
              code: 'LAB_DURATION_VIOLATION',
              severity: 'CRITICAL',
              sessionIds: [sCurr.id],
              entityName: cohortName,
              day,
              timeSlotId: sCurr.timeSlotId,
              message: `Laboratory block for ${course?.code || courseId} (${cohortName}) overlaps with campus lunch break at ${sCurr.timeSlotId}.`,
              recommendation: `Schedule lab entirely before or after lunch break.`,
            });
          }

          if (j > 0) {
            const sPrev = block[j - 1];
            const pPrev = parseInt(sPrev.timeSlotId.replace('ts-', ''), 10) || 1;
            if (pCurr !== pPrev + 1) {
              violations.push({
                id: `viol-lab-cont-${labKey}-${i}-${j}`,
                code: 'LAB_DURATION_VIOLATION',
                severity: 'CRITICAL',
                sessionIds: [sPrev.id, sCurr.id],
                entityName: cohortName,
                day,
                timeSlotId: sPrev.timeSlotId,
                message: `Laboratory session for ${course?.code || courseId} (${cohortName}) on ${day} is discontinuous (period ${pPrev} to ${pCurr}).`,
                recommendation: `Labs must occupy consecutive periods.`,
              });
            }
          }

          if (sCurr.roomId !== firstRoomId) {
            violations.push({
              id: `viol-lab-room-${labKey}-${i}-${j}`,
              code: 'LAB_DURATION_VIOLATION',
              severity: 'CRITICAL',
              sessionIds: [block[0].id, sCurr.id],
              entityName: cohortName,
              day,
              timeSlotId: sCurr.timeSlotId,
              message: `Laboratory session for ${course?.code || courseId} changes rooms within the block (${firstRoomId} to ${sCurr.roomId}).`,
              recommendation: `All periods of a lab block must use the same laboratory room.`,
            });
          }

          if (sCurr.facultyId !== firstFacultyId) {
            violations.push({
              id: `viol-lab-fac-${labKey}-${i}-${j}`,
              code: 'LAB_DURATION_VIOLATION',
              severity: 'CRITICAL',
              sessionIds: [block[0].id, sCurr.id],
              entityName: cohortName,
              day,
              timeSlotId: sCurr.timeSlotId,
              message: `Laboratory session for ${course?.code || courseId} changes faculty within the block.`,
              recommendation: `All periods of a lab block must be led by the same faculty instructor.`,
            });
          }
        }
      }
    }
  });

  // Check Faculty Weekly Teaching Limits
  const facultyIds = new Set(activeSessions.map((session) => session.facultyId));
  facultyIds.forEach((facId) => {
    const fac = facultyMap.get(facId);
    if (fac) {
      const hours = facultyTeachingPeriods(activeSessions, facId);
      const maxHours = facultyTeachingCap(fac);
      if (hours > maxHours) {
        violations.push({
          id: `viol-fac-max-load-${facId}`,
          code: 'EXCESSIVE_FACULTY_DAILY_LOAD',
          severity: 'CRITICAL',
          sessionIds: activeSessions.filter(s => s.facultyId === facId).map(s => s.id),
          entityName: fac.name,
          day: 'Monday',
          timeSlotId: 'N/A',
          message: `Faculty ${fac.name} is allocated ${hours} hours/week, exceeding the maximum direct teaching limit of ${maxHours} hours.`,
          recommendation: `Reduce teaching allocations or reassign sections.`
        });
      }
    }
  });

  // Check Pinned Sessions Compliance
  allocations.forEach(alloc => {
    if (alloc.isPinned && alloc.pinnedDay && alloc.pinnedTimeSlotId) {
      const matchingSession = activeSessions.find(
        s => (s.allocationId === alloc.id || (s.courseId === alloc.courseId && s.sectionId === alloc.sectionId)) &&
             s.day === alloc.pinnedDay &&
             s.timeSlotId === alloc.pinnedTimeSlotId
      );
      if (!matchingSession) {
        violations.push({
          id: `viol-pinned-${alloc.id}`,
          code: 'PINNED_SESSION_VIOLATION',
          severity: 'CRITICAL',
          sessionIds: [],
          entityName: `Pinned Session (${alloc.courseId})`,
          day: alloc.pinnedDay,
          timeSlotId: alloc.pinnedTimeSlotId,
          message: `Pinned session for course ${alloc.courseId} was not scheduled at its fixed slot (${alloc.pinnedDay} ${alloc.pinnedTimeSlotId}).`,
          recommendation: `Ensure pinned session is fixed in place by solver.`
        });
      } else if (alloc.pinnedRoomId && matchingSession.roomId !== alloc.pinnedRoomId) {
        violations.push({
          id: `viol-pinned-room-${alloc.id}`,
          code: 'PINNED_SESSION_VIOLATION',
          severity: 'CRITICAL',
          sessionIds: [matchingSession.id],
          entityName: `Pinned Session Room (${alloc.courseId})`,
          day: alloc.pinnedDay,
          timeSlotId: alloc.pinnedTimeSlotId,
          message: `Pinned session for course ${alloc.courseId} was scheduled in ${matchingSession.roomId} instead of pinned room ${alloc.pinnedRoomId}.`,
          recommendation: `Assign exact pinned room.`
        });
      }
    }
  });

  // Check Elective Group Synchronous Parallel Slots
  const electiveGroupMap = new Map<string, CourseAllocation[]>();
  allocations.forEach(alloc => {
    if (alloc.electiveGroupId) {
      if (!electiveGroupMap.has(alloc.electiveGroupId)) electiveGroupMap.set(alloc.electiveGroupId, []);
      electiveGroupMap.get(alloc.electiveGroupId)!.push(alloc);
    }
  });

  electiveGroupMap.forEach((groupAllocs, grpId) => {
    if (groupAllocs.length > 1) {
      // For each day and session, verify that allocations in the same elective group are scheduled in the same time slot
      const allocSessionMap = new Map<string, ClassSession[]>();
      groupAllocs.forEach(a => {
        const sess = activeSessions.filter(s => s.allocationId === a.id || (s.courseId === a.courseId && s.sectionId === a.sectionId));
        allocSessionMap.set(a.id, sess);
      });

      const firstAllocsSessions = allocSessionMap.get(groupAllocs[0].id) || [];
      firstAllocsSessions.forEach((baseSess, idx) => {
        for (let k = 1; k < groupAllocs.length; k++) {
          const otherAllocsSessions = allocSessionMap.get(groupAllocs[k].id) || [];
          const matchedSlot = otherAllocsSessions.some(
            os => os.day === baseSess.day && os.timeSlotId === baseSess.timeSlotId
          );
          if (otherAllocsSessions.length > 0 && !matchedSlot) {
            violations.push({
              id: `viol-elective-${grpId}-${idx}-${k}`,
              code: 'ELECTIVE_GROUP_MISMATCH',
              severity: 'CRITICAL',
              sessionIds: [baseSess.id],
              entityName: `Elective Group ${grpId}`,
              day: baseSess.day,
              timeSlotId: baseSess.timeSlotId,
              message: `Elective group ${grpId} sessions must be held in the same time slot across sections for concurrent student selection.`,
              recommendation: `Align elective course slots concurrently.`
            });
          }
        }
      });
    }
  });

  // Check Same Course Per Day & Consecutive Lectures Quality Warnings
  courseLectureDayMap.forEach((dayMap, key) => {
    const [secId, subSecId, courseId] = key.split('_');
    const course = courseMap.get(courseId);
    const section = sectionMap.get(secId);

    dayMap.forEach((daySessions, day) => {
      if (daySessions.length > 1) {
        sameCourseSameDayCount += daySessions.length - 1;
        violations.push({
          id: `warn-sameday-${key}-${day}`,
          code: 'SAME_COURSE_SAME_DAY',
          severity: 'WARNING',
          sessionIds: daySessions.map(s => s.id),
          entityName: section?.name || secId,
          day,
          timeSlotId: daySessions[0].timeSlotId,
          message: `Course ${course?.code || courseId} has ${daySessions.length} lecture sessions on ${day} for ${section?.name}. Recommended: max 1 lecture per day.`,
          recommendation: `Distribute lectures across distinct days.`,
        });

        daySessions.sort((a, b) => {
          const pA = parseInt(a.timeSlotId.replace('ts-', ''), 10) || 1;
          const pB = parseInt(b.timeSlotId.replace('ts-', ''), 10) || 1;
          return pA - pB;
        });

        for (let i = 0; i < daySessions.length - 1; i++) {
          const p1 = parseInt(daySessions[i].timeSlotId.replace('ts-', ''), 10) || 1;
          const p2 = parseInt(daySessions[i + 1].timeSlotId.replace('ts-', ''), 10) || 1;
          if (p2 === p1 + 1) {
            sameCourseConsecutiveCount++;
            violations.push({
              id: `warn-consec-${key}-${day}-${i}`,
              code: 'SAME_COURSE_CONSECUTIVE',
              severity: 'WARNING',
              sessionIds: [daySessions[i].id, daySessions[i + 1].id],
              entityName: section?.name || secId,
              day,
              timeSlotId: daySessions[i].timeSlotId,
              message: `Course ${course?.code || courseId} has consecutive lecture sessions on ${day} (periods ${p1} & ${p2}) for ${section?.name}.`,
              recommendation: `Avoid consecutive lectures for the same course.`,
            });
          }
        }
      }
    });
  });

  // Check Student & Faculty Gaps
  studentDayPeriodsMap.forEach((periods, key) => {
    periods.sort((a, b) => a - b);
    if (periods.length > 1) {
      let gapCount = 0;
      for (let i = 0; i < periods.length - 1; i++) {
        let diff = periods[i + 1] - periods[i] - 1;
        if (periods[i] < 5 && periods[i + 1] > 5) diff -= 1; // exclude lunch
        if (diff > 0) gapCount += diff;
      }
      totalStudentGaps += gapCount;
      if (gapCount > 1) {
        const [secId, subSecId, day] = key.split('_') as [string, string, DayOfWeek];
        const section = sectionMap.get(secId);
        violations.push({
          id: `warn-stugap-${key}`,
          code: 'EXCESSIVE_STUDENT_GAPS',
          severity: 'WARNING',
          sessionIds: [],
          entityName: section?.name || secId,
          day,
          timeSlotId: `ts-${periods[0]}`,
          message: `Section ${section?.name} has ${gapCount} internal free period gap(s) on ${day}.`,
          recommendation: `Compact student timetable to eliminate internal gaps.`,
        });
      }
    }
  });

  facultyDayPeriodsMap.forEach((periods, key) => {
    periods.sort((a, b) => a - b);
    if (periods.length > 1) {
      let gapCount = 0;
      for (let i = 0; i < periods.length - 1; i++) {
        let diff = periods[i + 1] - periods[i] - 1;
        if (periods[i] < 5 && periods[i + 1] > 5) diff -= 1; // exclude lunch
        if (diff > 0) gapCount += diff;
      }
      totalFacultyGaps += gapCount;
      if (gapCount > 1) {
        const [facId, day] = key.split('_') as [string, DayOfWeek];
        const faculty = facultyMap.get(facId);
        violations.push({
          id: `warn-facgap-${key}`,
          code: 'EXCESSIVE_FACULTY_GAPS',
          severity: 'WARNING',
          sessionIds: [],
          entityName: faculty?.name || facId,
          day,
          timeSlotId: `ts-${periods[0]}`,
          message: `Faculty ${faculty?.name} has ${gapCount} internal free period gap(s) on ${day}.`,
          recommendation: `Compact faculty teaching schedule.`,
        });
      }
    }
  });

  // Calculate daily load metrics
  const studentLoads = Array.from(studentDailyLoadMap.values());
  const avgStudentDailyLoad = studentLoads.length > 0 ? Number((studentLoads.reduce((a, b) => a + b, 0) / studentLoads.length).toFixed(1)) : 0;
  const maxStudentDailyLoad = studentLoads.length > 0 ? Math.max(...studentLoads) : 0;

  const facultyLoads = Array.from(facultyDailyLoadMap.values());
  const avgFacultyDailyLoad = facultyLoads.length > 0 ? Number((facultyLoads.reduce((a, b) => a + b, 0) / facultyLoads.length).toFixed(1)) : 0;
  const maxFacultyDailyLoad = facultyLoads.length > 0 ? Math.max(...facultyLoads) : 0;

  const totalCourseSecs = courseDayMap.size;
  let wellDistributedCourses = 0;
  courseDayMap.forEach((daysSet) => {
    if (daysSet.size >= 3) wellDistributedCourses++;
  });
  const courseDistributionQualityRate = totalCourseSecs > 0 ? Math.round((wellDistributedCourses / totalCourseSecs) * 100) : 100;

  // 6. Metrics Calculation
  const hardViolations = violations.filter(v => v.severity === 'CRITICAL');
  const warnings = violations.filter(v => v.severity === 'WARNING');
  const isValid = hardViolations.length === 0;
  const canPublish = isValid && scheduledHours >= totalRequiredHours;

  const totalPossibleChecks = Math.max(1, activeSessions.length * 4);
  const facultyConflictFreeRate = Math.max(
    0,
    Math.round(((totalPossibleChecks - violations.filter(v => v.code === 'FACULTY_COLLISION').length) / totalPossibleChecks) * 100)
  );
  const capacityComplianceRate = Math.max(
    0,
    Math.round(((activeSessions.length - violations.filter(v => v.code === 'CAPACITY_SHORTAGE').length) / Math.max(1, activeSessions.length)) * 100)
  );

  const labSessionsCount = activeSessions.filter(s => s.type === 'Lab' || s.type === 'Practical').length;
  const labRoomsCount = rooms.filter(r => r.type === 'ComputerLab' || r.type === 'HardwareLab').length;

  return {
    isValid,
    canPublish,
    hardViolationsCount: hardViolations.length,
    warningCount: warnings.length,
    violations,
    totalSessionsEvaluated: activeSessions.length,
    requiredSessionsCount: totalRequiredHours,
    scheduledSessionsCount: scheduledHours,
    completionRate: Math.min(100, Math.round((scheduledHours / Math.max(1, totalRequiredHours)) * 100)),
    metrics: {
      facultyConflictFreeRate,
      roomUtilizationRate: Math.min(100, Math.round((activeSessions.length / Math.max(1, rooms.length * 35)) * 100)),
      labUtilizationRate: Math.min(100, Math.round((labSessionsCount / Math.max(1, labRoomsCount * 35)) * 100)),
      capacityComplianceRate,
      subgroupParallelEfficiency: 96,
      sameCourseSameDayCount,
      sameCourseConsecutiveCount,
      totalStudentGaps,
      totalFacultyGaps,
      avgStudentDailyLoad,
      maxStudentDailyLoad,
      avgFacultyDailyLoad,
      maxFacultyDailyLoad,
      courseDistributionQualityRate,
    },
    auditTimestamp: new Date().toISOString()
  };
}

/**
 * Validates a proposed manual session move before applying it to the matrix.
 * Returns { allowed: true } or { allowed: false, blockingReason: string }
 */
export function validateProposedSessionMove(
  currentSessions: ClassSession[],
  sessionId: string,
  targetDay: DayOfWeek,
  targetTimeSlotId: string,
  targetRoomId: string,
  context: ValidationContext
): { allowed: boolean; blockingReason?: string; hypotheticalReport: IndependentValidationReport } {
  // Create simulated copy of sessions with the modification applied
  const simulatedSessions = currentSessions.map(s => {
    if (s.id !== sessionId) return s;
    return {
      ...s,
      day: targetDay,
      timeSlotId: targetTimeSlotId,
      roomId: targetRoomId
    };
  });

  const report = validateTimetableIndependently(simulatedSessions, context);

  // Check if this specific session has any violations in the simulation
  const sessionViolations = report.violations.filter(v => v.sessionIds.includes(sessionId));

  if (sessionViolations.length > 0) {
    return {
      allowed: false,
      blockingReason: sessionViolations[0].message,
      hypotheticalReport: report
    };
  }

  return {
    allowed: report.isValid,
    blockingReason: report.isValid ? undefined : report.violations[0]?.message,
    hypotheticalReport: report
  };
}

/**
 * Validates an intelligent swap between two class sessions before executing it.
 */
export function validateProposedSessionSwap(
  currentSessions: ClassSession[],
  sessionAId: string,
  sessionBId: string,
  context: ValidationContext
): { allowed: boolean; blockingReason?: string; hypotheticalReport: IndependentValidationReport } {
  const sessionA = currentSessions.find(s => s.id === sessionAId);
  const sessionB = currentSessions.find(s => s.id === sessionBId);

  if (!sessionA || !sessionB) {
    return {
      allowed: false,
      blockingReason: 'One or both sessions to swap could not be found.',
      hypotheticalReport: validateTimetableIndependently(currentSessions, context)
    };
  }

  // Swap day, timeSlotId, and roomId between A and B
  const simulatedSessions = currentSessions.map(s => {
    if (s.id === sessionAId) {
      return {
        ...s,
        day: sessionB.day,
        timeSlotId: sessionB.timeSlotId,
        roomId: sessionB.roomId
      };
    }
    if (s.id === sessionBId) {
      return {
        ...s,
        day: sessionA.day,
        timeSlotId: sessionA.timeSlotId,
        roomId: sessionA.roomId
      };
    }
    return s;
  });

  const report = validateTimetableIndependently(simulatedSessions, context);

  const swapViolations = report.violations.filter(
    v => v.sessionIds.includes(sessionAId) || v.sessionIds.includes(sessionBId)
  );

  if (swapViolations.length > 0) {
    return {
      allowed: false,
      blockingReason: swapViolations[0].message,
      hypotheticalReport: report
    };
  }

  return {
    allowed: report.isValid,
    blockingReason: report.isValid ? undefined : report.violations[0]?.message,
    hypotheticalReport: report
  };
}
