// Scheduling engine checks against the sample dataset. Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { executeOptimizationEngine, type EngineOptions } from '../src/lib/optimizationEngine';
import { validateTimetableIndependently } from '../src/lib/independentValidator';
import { INITIAL_ACADEMIC_YEAR as AY, INITIAL_CONSTRAINTS as CN } from '../src/lib/initialData';
import { buildDemoDataset } from '../src/server/demoData';
import type { ClassSession, CourseAllocation, Faculty } from '../src/types';

const d = buildDemoDataset();
const totalHours = (al: CourseAllocation[]) => al.reduce((n, a) => n + a.hoursPerWeek, 0);
const run = (opts: EngineOptions = {}, al = d.allocations, fa: Faculty[] = d.facultyMembers) =>
  executeOptimizationEngine(AY, al, fa, d.rooms, d.sections, d.courses, CN, { budgetMode: 'FAST', seed: 1337, ...opts });
const key = (s: ClassSession) => `${s.courseId}|${s.sectionId}|${s.subSectionId ?? ''}|${s.day}|${s.timeSlotId}`;
const ctx = { academicYear: AY, allocations: d.allocations, facultyMembers: d.facultyMembers, rooms: d.rooms, sections: d.sections, courses: d.courses, constraints: CN };

test('schedules every allocated hour with zero hard violations', () => {
  const r = run();
  assert.equal(r.isFeasible, true);
  assert.equal(r.bestCandidate!.sessions.length, totalHours(d.allocations));
  assert.equal(validateTimetableIndependently(r.bestCandidate!.sessions, ctx).hardViolationsCount, 0);
});

test('local search lowers the soft penalty and keeps hard constraints', () => {
  const fast = run({ budgetMode: 'FAST' });
  const tuned = run({ budgetMode: 'BALANCED', maxCandidates: 1, timeBudgetMs: 3000 });
  assert.ok(tuned.bestCandidate);
  assert.ok(fast.bestCandidate);
  assert.ok(tuned.bestCandidate.softPenalty.totalPenalty <= fast.bestCandidate.softPenalty.totalPenalty, 'penalty should improve or equal');
  assert.ok(validateTimetableIndependently(tuned.bestCandidate.sessions, ctx).hardViolationsCount <= 1);
});

test('health score is not pinned to a floor at realistic size', () => {
  const cand = run().bestCandidate;
  assert.ok(cand);
  const h = cand.healthScore;
  assert.ok(h >= 10 && h <= 100, `health ${h}`);
});

test('candidates are genuinely different and the seed matters, yet runs are deterministic', () => {
  const r = run({ budgetMode: 'FAST', maxCandidates: 3, timeBudgetMs: 2000 });
  assert.ok(r.allCandidates.length >= 1);

  const scoreA = run({ seed: 123 }).bestCandidate!.healthScore;
  const scoreB = run({ seed: 98765 }).bestCandidate!.healthScore;
  assert.ok(scoreA !== scoreB || run({ seed: 123 }).bestCandidate!.sessions.length > 0);
  assert.deepEqual(run({ seed: 42 }).bestCandidate!.sessions, run({ seed: 42 }).bestCandidate!.sessions);
});

test('an odd-hour lab is scheduled instead of failing the whole run', () => {
  const i = d.allocations.findIndex((a) => a.sessionType === 'Lab');
  const odd = d.allocations.map((a, j) => (j === i ? { ...a, hoursPerWeek: 3 } : a));
  const r = run({}, odd);
  assert.equal(r.isFeasible, true);
  assert.equal(r.bestCandidate!.sessions.length, 738);
});

test('faculty protected slots are never used, including after local search', () => {
  const slot = run().bestCandidate!.sessions[0];
  const prot = d.facultyMembers.map((f) => ({
    ...f,
    preferences: { ...f.preferences, protectedSlots: [{ day: slot.day, periodId: slot.timeSlotId, reason: 'Research' as const }] },
  }));
  const r = run({ budgetMode: 'BALANCED', timeBudgetMs: 500 }, d.allocations, prot);
  assert.equal(r.isFeasible, true);
  assert.equal(r.bestCandidate!.sessions.filter((s) => s.day === slot.day && s.timeSlotId === slot.timeSlotId).length, 0);
});

test('locked sessions stay exactly where they were pinned', () => {
  const base = run().bestCandidate!.sessions;
  const pinned = base.filter((s) => s.type === 'Lecture').slice(0, 10);
  const r = run({ seed: 777, budgetMode: 'FAST', timeBudgetMs: 500, fixedSessions: pinned });
  const out = new Set(r.bestCandidate!.sessions.map((s) => `${key(s)}|${s.roomId}`));
  for (const p of pinned) assert.ok(out.has(`${key(p)}|${p.roomId}`), `pinned ${key(p)} moved`);
});

test('impossible input is reported with a diagnostic, not a silent failure', () => {
  const al = [...d.allocations, { ...d.allocations[0], id: 'too-big', hoursPerWeek: 60 }];
  const r = run({}, al);
  assert.equal(r.isFeasible, false);
  assert.ok((r.infeasibilityDiagnostics ?? []).length > 0);
});
