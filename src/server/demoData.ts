import type { AuditLog, NotificationItem } from '../types';
import {
  DEPARTMENTS,
  PROGRAMS,
  FACULTY_MEMBERS,
  ROOMS,
  SECTIONS,
  STUDENTS,
  COURSES,
  INITIAL_ALLOCATIONS,
  INITIAL_SESSIONS,
  INITIAL_NOTIFICATIONS,
} from '../lib/initialData';

export function buildDemoDataset() {
  return {
    departments: structuredClone(DEPARTMENTS),
    programs: structuredClone(PROGRAMS),
    facultyMembers: structuredClone(FACULTY_MEMBERS),
    rooms: structuredClone(ROOMS),
    sections: structuredClone(SECTIONS),
    students: structuredClone(STUDENTS),
    courses: structuredClone(COURSES),
    allocations: structuredClone(INITIAL_ALLOCATIONS),
    sessions: structuredClone(INITIAL_SESSIONS),
  };
}

export const DEMO_NOTIFICATIONS: NotificationItem[] = structuredClone(INITIAL_NOTIFICATIONS);

export const DEMO_AUDIT_EVENTS: AuditLog[] = [
  {
    id: 'audit-third-year-init',
    timestamp: new Date().toISOString(),
    userName: 'System',
    action: 'DATASET_INITIALIZED',
    entityType: 'Institution',
    entityId: 'inst-thapar',
    details: 'Initialized Third-Year Computer dataset (1,847 students, 149 faculty, 68 subgroups, 37 courses, 60 rooms, 617 sessions).',
  } as AuditLog,
];
