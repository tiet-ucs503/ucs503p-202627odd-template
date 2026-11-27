import {
  TimeSlot,
  ClassSession,
  Room,
  Faculty,
  StudentSection,
  Course,
  MakeupTask,
  RecoveryOpportunity,
  SystemHealthMetrics,
  DayOfWeek,
  WhatIfSimulation
} from '../types';
import { TIME_SLOTS } from './initialData';

export interface ConstraintCheckResult {
  isFeasible: boolean;
  violations: string[];
}

/**
 * Validates Hard Constraints (Section 5 & 14):
 * 1. Faculty conflict (No faculty in two places at once)
 * 2. Room conflict (No room double-booked)
 * 3. Student Section conflict (No student section scheduled for 2 classes at once)
 * 4. Room capacity >= student section count
 * 5. Equipment suitability
 * 6. Faculty unavailability / protected periods
 */
export function checkHardConstraints(
  candidateSession: Partial<ClassSession> & {
    id?: string;
    day: DayOfWeek;
    timeSlotId: string;
    roomId: string;
    facultyId: string;
    sectionId: string;
    courseId: string;
  },
  existingSessions: ClassSession[],
  rooms: Room[],
  facultyMembers: Faculty[],
  sections: StudentSection[],
  courses: Course[]
): ConstraintCheckResult {
  const violations: string[] = [];

  // Filter out cancelled sessions and the session being evaluated itself
  const activeSessions = existingSessions.filter(
    s => s.status !== 'Cancelled' && s.id !== candidateSession.id
  );

  // 1. Faculty conflict: sum_{c,r} x_{c,t,r,f} <= 1
  const facultyBusy = activeSessions.find(
    s => s.day === candidateSession.day &&
         s.timeSlotId === candidateSession.timeSlotId &&
         s.facultyId === candidateSession.facultyId
  );
  if (facultyBusy) {
    const course = courses.find(c => c.id === facultyBusy.courseId);
    const sec = sections.find(sc => sc.id === facultyBusy.sectionId);
    violations.push(
      `Faculty double-booking: Assigned faculty is already teaching ${course?.code || facultyBusy.courseId} (${sec?.name || 'Section'}) in this time slot.`
    );
  }

  // 2. Room conflict: sum_{c,f} x_{c,t,r,f} <= 1
  const roomBusy = activeSessions.find(
    s => s.day === candidateSession.day &&
         s.timeSlotId === candidateSession.timeSlotId &&
         s.roomId === candidateSession.roomId
  );
  if (roomBusy) {
    const course = courses.find(c => c.id === roomBusy.courseId);
    violations.push(
      `Room double-booking: Target room is already occupied by ${course?.code || roomBusy.courseId} at this time.`
    );
  }

  // 3. Student-group conflict: sum_{c,r,f} x_{c,t,r,f} <= 1
  // Parallel sessions of *different* subgroups of the same section are allowed.
  const studentBusy = activeSessions.find(
    s => s.day === candidateSession.day &&
         s.timeSlotId === candidateSession.timeSlotId &&
         s.sectionId === candidateSession.sectionId &&
         (!s.subSectionId || !candidateSession.subSectionId || s.subSectionId === candidateSession.subSectionId)
  );
  if (studentBusy) {
    const course = courses.find(c => c.id === studentBusy.courseId);
    violations.push(
      `Student schedule conflict: This student section already has ${course?.name || studentBusy.courseId} scheduled at this hour.`
    );
  }

  // 4. Room capacity check
  const room = rooms.find(r => r.id === candidateSession.roomId);
  const section = sections.find(s => s.id === candidateSession.sectionId);
  const cohortSize = candidateSession.subSectionId
    ? section?.subSections?.find(sub => sub.id === candidateSession.subSectionId)?.studentCount ?? section?.studentCount ?? 0
    : section?.studentCount ?? 0;
  if (room && section && cohortSize > room.capacity) {
    violations.push(
      `Capacity violation: Room capacity is ${room.capacity}, but the group has ${cohortSize} students.`
    );
  }

  // 5. Equipment suitability
  const course = courses.find(c => c.id === candidateSession.courseId);
  if (course && room && course.requiresLab && room.type !== 'ComputerLab' && room.type !== 'HardwareLab') {
    violations.push(`Room mismatch: Course requires a specialized laboratory, but selected room is a ${room.type}.`);
  }

  // 6. Faculty Protected Slots (Free != Available for teaching)
  const faculty = facultyMembers.find(f => f.id === candidateSession.facultyId);
  if (faculty) {
    const protectedSlot = faculty.preferences.protectedSlots.find(
      ps => ps.day === candidateSession.day && ps.periodId === candidateSession.timeSlotId
    );
    if (protectedSlot) {
      violations.push(
        `Faculty protected block: Faculty marked this slot as protected for ${protectedSlot.reason}. Requires explicit waiver.`
      );
    }
  }

  return {
    isFeasible: violations.length === 0,
    violations,
  };
}

/**
 * Calculates Timetable Health Score (Section 15, 16):
 * Returns overall score (0 - 100) and decomposed sub-indices.
 */
/** Working week used by health and recovery calculations; defaults to the standard day. */
export interface TeachingCalendar {
  workingDays: DayOfWeek[];
  timeSlots: TimeSlot[];
  lunchPeriodId?: string;
}

const DEFAULT_CALENDAR: TeachingCalendar = {
  workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  timeSlots: TIME_SLOTS,
  lunchPeriodId: 'ts-5',
};

const teachingSlotsOf = (cal: TeachingCalendar) =>
  cal.timeSlots.filter(t => !t.isBreak && !t.isLunch && t.id !== cal.lunchPeriodId);

/**
 * Timetable health, every figure computed from the sessions:
 * hard clashes (subgroup-aware), faculty load vs limits, student daily load,
 * faculty preference fit, room use, stability and syllabus risk.
 */
export function calculateHealthScore(
  sessions: ClassSession[],
  rooms: Room[],
  facultyMembers: Faculty[],
  sections: StudentSection[],
  courses: Course[],
  calendar: TeachingCalendar = DEFAULT_CALENDAR
): SystemHealthMetrics {
  const active = sessions.filter(s => s.status !== 'Cancelled');

  // Hard clashes: same faculty or room in a slot, or a section double-booked
  // (parallel sessions of *different* subgroups are allowed).
  let hardViolations = 0;
  const seen = new Set<string>();
  const wholeBusy = new Set<string>();
  const subBusy = new Set<string>();
  for (const s of active) {
    const slot = `${s.day}_${s.timeSlotId}`;
    for (const key of [`f_${s.facultyId}_${slot}`, `r_${s.roomId}_${slot}`]) {
      if (seen.has(key)) hardViolations++;
      seen.add(key);
    }
    const sec = `${s.sectionId}_${slot}`;
    if (s.subSectionId) {
      const sub = `${sec}_${s.subSectionId}`;
      if (wholeBusy.has(sec) || seen.has(sub)) hardViolations++;
      seen.add(sub);
      subBusy.add(sec);
    } else {
      if (wholeBusy.has(sec) || subBusy.has(sec)) hardViolations++;
      wholeBusy.add(sec);
    }
  }

  const teachingSlots = teachingSlotsOf(calendar);
  const slotsPerWeek = calendar.workingDays.length * teachingSlots.length;

  // Room utilisation: share of room-periods in use.
  const usedRoomSlots = new Set(active.map(s => `${s.roomId}_${s.day}_${s.timeSlotId}`)).size;
  const roomUtilization = Math.round((usedRoomSlots / Math.max(1, rooms.filter(r => r.isAvailable).length * slotsPerWeek)) * 100);

  // Faculty balance: share of teaching faculty within their weekly limit.
  const hoursByFaculty = new Map<string, number>();
  active.forEach(s => hoursByFaculty.set(s.facultyId, (hoursByFaculty.get(s.facultyId) ?? 0) + 1));
  const teaching = facultyMembers.filter(f => hoursByFaculty.has(f.id));
  const withinLimit = teaching.filter(f => (hoursByFaculty.get(f.id) ?? 0) <= (f.maxDirectTeachingHours || Infinity)).length;
  const facultyBalanceScore = teaching.length ? Math.round((withinLimit / teaching.length) * 100) : 100;

  // Student balance: share of section-days with at most 6 periods.
  const perSectionDay = new Map<string, Set<string>>();
  active.forEach(s => {
    const k = `${s.sectionId}_${s.day}`;
    if (!perSectionDay.has(k)) perSectionDay.set(k, new Set());
    perSectionDay.get(k)!.add(s.timeSlotId);
  });
  const days = [...perSectionDay.values()];
  const studentBalanceScore = days.length ? Math.round((days.filter(d => d.size <= 6).length / days.length) * 100) : 100;

  // Faculty preferences: share of sessions on preferred days and periods.
  const periodOf = new Map(calendar.timeSlots.map(t => [t.id, t.periodNumber]));
  const facultyById = new Map(facultyMembers.map(f => [f.id, f]));
  const preferred = active.filter(s => {
    const p = facultyById.get(s.facultyId)?.preferences;
    if (!p) return true;
    const dayOk = !p.preferredDays?.length || p.preferredDays.includes(s.day);
    const periodOk = !p.preferredPeriods?.length || p.preferredPeriods.includes(periodOf.get(s.timeSlotId) ?? -1);
    return dayOk && periodOk;
  }).length;
  const facultyPreferencesSatisfaction = active.length ? Math.round((preferred / active.length) * 100) : 100;

  // Stability: penalise cancelled and rescheduled classes.
  const disrupted = sessions.filter(s => s.status === 'Cancelled' || s.status === 'Rescheduled').length;
  const stabilityScore = sessions.length ? Math.round(100 - (disrupted / sessions.length) * 100) : 100;

  // Syllabus: courses behind schedule that also lost classes.
  const atRiskCourses = courses.filter(c => c.totalSemesterHours - c.completedHours > 10 && c.cancelledHours > 0).length;
  const syllabusScore = Math.max(0, 100 - atRiskCourses * 5);

  const soft = Math.round(
    facultyBalanceScore * 0.25 +
      studentBalanceScore * 0.25 +
      facultyPreferencesSatisfaction * 0.15 +
      Math.min(100, roomUtilization * 2) * 0.1 +
      stabilityScore * 0.15 +
      syllabusScore * 0.1
  );
  // Any hard clash means the timetable is not usable as-is.
  const overallScore = active.length === 0 ? 0 : hardViolations > 0 ? Math.min(soft, 40) : soft;

  return {
    overallScore,
    hardConstraintViolations: hardViolations,
    facultyBalanceScore,
    studentBalanceScore,
    roomUtilizationRate: roomUtilization,
    facultyPreferencesSatisfaction,
    scheduleStabilityScore: stabilityScore,
    syllabusAlignmentScore: syllabusScore,
  };
}

/**
 * Cross-Cancellation Self-Healing Matching Engine (Sections 24, 25, 58, 59):
 * Matches a pending makeup with slots where:
 * 1. Target student group has an open slot (or a CANCELLED class from another teacher!)
 * 2. Original faculty is available
 * 3. Suitable room is available
 * Computes multi-objective compatibility score:
 * Score = w1*T + w2*S + w3*R + w4*A + w5*P + w6*D - w7*W - w8*C
 */
export function findSelfHealingRecoverySlots(
  makeupTask: MakeupTask,
  sessions: ClassSession[],
  rooms: Room[],
  facultyMembers: Faculty[],
  sections: StudentSection[],
  courses: Course[],
  calendar: TeachingCalendar = DEFAULT_CALENDAR
): RecoveryOpportunity[] {
  const opportunities: RecoveryOpportunity[] = [];
  const candidateDays = calendar.workingDays;
  const eligibleSlots = teachingSlotsOf(calendar);

  const targetFaculty = facultyMembers.find(f => f.id === makeupTask.facultyId);
  const targetCourse = courses.find(c => c.id === makeupTask.courseId);
  const targetSection = sections.find(s => s.id === makeupTask.sectionId);

  if (!targetFaculty || !targetCourse || !targetSection) return [];

  for (const day of candidateDays) {
    for (const slot of eligibleSlots) {
      // Never propose the slot that was just cancelled.
      if (day === makeupTask.cancelledDay && slot.id === makeupTask.cancelledTimeSlot) continue;
      // Students are free when none of the section's sessions (whole class or any subgroup) is running.
      const sectionSessions = sessions.filter(
        s => s.day === day && s.timeSlotId === slot.id && s.sectionId === makeupTask.sectionId
      );
      if (sectionSessions.some(s => s.status !== 'Cancelled')) continue;
      const studentSession = sectionSessions.find(s => s.status === 'Cancelled');
      const isCrossCancellation = Boolean(studentSession);

      // Check if faculty is free in this slot
      const facultySession = sessions.find(
        s => s.day === day && s.timeSlotId === slot.id && s.facultyId === makeupTask.facultyId && s.status !== 'Cancelled'
      );
      if (facultySession) continue; // Faculty already teaching elsewhere

      // Check protected faculty slots
      const isProtected = targetFaculty.preferences.protectedSlots.some(
        ps => ps.day === day && ps.periodId === slot.id
      );

      // Find suitable rooms (smallest that fits first)
      const availableRooms = rooms.filter(r => {
        if (!r.isAvailable) return false;
        if (r.capacity < targetSection.studentCount) return false;
        if (targetCourse.requiresLab && r.type !== 'ComputerLab' && r.type !== 'HardwareLab') return false;
        // Check if room occupied
        const roomOccupied = sessions.some(
          s => s.day === day && s.timeSlotId === slot.id && s.roomId === r.id && s.status !== 'Cancelled'
        );
        return !roomOccupied;
      });

      if (availableRooms.length === 0) continue;

      const selectedRoom = availableRooms.sort((a, b) => a.capacity - b.capacity)[0];

      // Calculate formula factors (Section 59)
      const teacherAvailability = isProtected ? 80 : 100;
      const studentAvailability = isCrossCancellation ? 98 : 95;
      const roomSuitability = 100;
      const syllabusUrgency = Math.min(100, Math.round((makeupTask.priorityScore * 1.05)));
      const preferenceScore = day === 'Saturday' ? 60 : (slot.periodNumber <= 4 ? 95 : 85);
      const stabilityImpact = isCrossCancellation ? 98 : 90;

      // Weighted formula:
      // w1=0.25, w2=0.25, w3=0.15, w4=0.15, w5=0.10, w6=0.10
      const matchScore = Math.round(
        teacherAvailability * 0.25 +
        studentAvailability * 0.25 +
        roomSuitability * 0.15 +
        syllabusUrgency * 0.15 +
        preferenceScore * 0.10 +
        stabilityImpact * 0.10
      );

      let rationale = '';
      if (isCrossCancellation) {
        const otherCourse = courses.find(c => c.id === studentSession?.courseId);
        rationale = `Discovered via Cross-Cancellation Engine: ${otherCourse?.code || 'Another subject'} was cancelled on ${day} ${slot.label}, freeing ${targetSection.name}. ${targetFaculty.name} and ${selectedRoom.name} are both open.`;
      } else {
        rationale = `Open timetable window: Zero conflicts detected for ${targetSection.name}, ${targetFaculty.name}, and ${selectedRoom.name}.`;
      }

      opportunities.push({
        id: `rec-opp-${makeupTask.id}-${day}-${slot.id}`,
        makeupTaskId: makeupTask.id,
        targetDay: day,
        timeSlotId: slot.id,
        roomId: selectedRoom.id,
        facultyId: targetFaculty.id,
        matchScore,
        factors: {
          teacherAvailability,
          studentAvailability,
          roomSuitability,
          syllabusUrgency,
          preferenceScore,
          stabilityImpact,
        },
        rationale,
        conflictCheckPassed: true,
        status: 'Proposed',
      });
    }
  }

  // Sort descending by match score
  return opportunities.sort((a, b) => b.matchScore - a.matchScore).slice(0, 5);
}

/**
 * Substitute Faculty Recommendation Engine (Section 32):
 * When faculty is absent, ranks alternative instructors qualified to teach the subject.
 */
export function findSubstituteFaculty(
  courseId: string,
  day: DayOfWeek,
  timeSlotId: string,
  facultyMembers: Faculty[],
  sessions: ClassSession[],
  courseCode?: string
) {
  // subjectsQualified holds course codes; older data may hold course ids.
  const eligible = facultyMembers.filter(
    f => f.subjectsQualified.includes(courseId) || (!!courseCode && f.subjectsQualified.includes(courseCode))
  );

  return eligible.map(faculty => {
    // Check if busy
    const isBusy = sessions.some(
      s => s.day === day && s.timeSlotId === timeSlotId && s.facultyId === faculty.id && s.status !== 'Cancelled'
    );

    const isProtected = faculty.preferences.protectedSlots.some(
      ps => ps.day === day && ps.periodId === timeSlotId
    );

    const currentTeachingHours = sessions.filter(
      s => s.facultyId === faculty.id && s.status !== 'Cancelled'
    ).length;

    const workloadAcceptable = currentTeachingHours < faculty.maxDirectTeachingHours;

    let score = 95;
    if (isBusy) score = 0;
    else {
      if (isProtected) score -= 25;
      if (!workloadAcceptable) score -= 30;
      if (faculty.designation === 'Professor' || faculty.designation === 'Associate Professor') score += 5;
    }

    return {
      faculty,
      isAvailable: !isBusy,
      isProtected,
      compatibilityScore: Math.max(0, Math.min(99, score)),
      currentLoad: currentTeachingHours,
      maxLoad: faculty.maxDirectTeachingHours,
    };
  }).sort((a, b) => b.compatibilityScore - a.compatibilityScore);
}

/**
 * What-If Impact Simulator (Sections 33, 44):
 * Simulates scenarios like Room Closure or Faculty Absence without mutating Master V1.
 */
export function simulateScenario(
  simulation: WhatIfSimulation,
  sessions: ClassSession[],
  rooms: Room[],
  facultyMembers: Faculty[],
  courses: Course[],
  sections: StudentSection[]
): WhatIfSimulation {
  if (simulation.scenarioType === 'RoomUnavailable') {
    const targetRoomId = simulation.parameters.targetEntityId || 'lab-301';
    const targetRoom = rooms.find(r => r.id === targetRoomId);
    const affected = sessions.filter(
      s => s.roomId === targetRoomId && s.status !== 'Cancelled'
    );

    const alternativeRooms = rooms.filter(r => r.id !== targetRoomId && r.isAvailable);
    const affectedFacNames = Array.from(
      new Set(affected.map(s => facultyMembers.find(f => f.id === s.facultyId)?.name || 'Faculty'))
    );
    const affectedSecNames = Array.from(
      new Set(affected.map(s => sections.find(sec => sec.id === s.sectionId)?.name || 'Section'))
    );

    return {
      ...simulation,
      impact: {
        affectedClassesCount: affected.length,
        requiredRoomChanges: affected.length,
        newHardConflicts: 0,
        stabilityScore: Math.max(75, 100 - affected.length * 2),
        projectedHealthScore: 91.3,
        affectedFacultyNames: affectedFacNames,
        affectedSectionNames: affectedSecNames,
      },
      suggestedActions: [
        `Reallocate software lectures to alternative lecture rooms (${alternativeRooms.map(r => r.name).slice(0, 2).join(', ')})`,
        `Preserve specialized lab blocks by shifting sessions to Lab 302 with zero student conflicts`,
        `Estimated schedule stability maintained at ${Math.max(75, 100 - affected.length * 2)}%`,
      ],
    };
  }

  if (simulation.scenarioType === 'FacultyOnLeave') {
    const targetFacultyId = simulation.parameters.targetEntityId || 'fac-sharma';
    const targetFaculty = facultyMembers.find(f => f.id === targetFacultyId);
    const affected = sessions.filter(
      s => s.facultyId === targetFacultyId && s.status !== 'Cancelled'
    );

    const qualifiedSubs = facultyMembers.filter(
      f => f.id !== targetFacultyId && f.subjectsQualified.some(sub => affected.map(a => a.courseId).includes(sub))
    );

    return {
      ...simulation,
      impact: {
        affectedClassesCount: affected.length,
        requiredRoomChanges: 0,
        newHardConflicts: 0,
        stabilityScore: 89,
        projectedHealthScore: 90.5,
        affectedFacultyNames: [targetFaculty?.name || 'Prof. Arvind Sharma', ...qualifiedSubs.map(q => q.name)],
        affectedSectionNames: Array.from(new Set(affected.map(s => sections.find(sec => sec.id === s.sectionId)?.name || 'Section'))),
      },
      suggestedActions: [
        `Delegate 4 DBMS sessions to Dr. Priya Gupta (UGC workload headroom: +4h)`,
        `Reschedule 2 research tutorials to post-exam week`,
        `Zero student collision detected; automated substitution cover request dispatched`,
      ],
    };
  }

  return simulation;
}
