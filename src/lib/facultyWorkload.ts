import type { ClassSession, Faculty } from '../types';

export function facultyTeachingCap(faculty: Faculty): number {
  if (faculty.designation === 'Assistant Professor') return 16;
  if (faculty.designation === 'Professor' || faculty.designation === 'Associate Professor') return 14;
  // Visiting appointments retain their explicit contract value because no shared cap is specified.
  return faculty.maxDirectTeachingHours || faculty.weeklyHoursLimit || 40;
}

export function facultyTeachingPeriods(sessions: ClassSession[], facultyId: string): number {
  const countedCombinedLectures = new Set<string>();
  return sessions.reduce((total, session) => {
    if (session.facultyId !== facultyId || session.status === 'Cancelled') return total;
    const duration = Math.max(1, Number(session.durationPeriods) || 1);
    if (session.type === 'Lecture') {
      const combinedKey = `${session.courseId}:${session.day}:${session.timeSlotId}:${duration}`;
      if (countedCombinedLectures.has(combinedKey)) return total;
      countedCombinedLectures.add(combinedKey);
    }
    return total + duration;
  }, 0);
}
