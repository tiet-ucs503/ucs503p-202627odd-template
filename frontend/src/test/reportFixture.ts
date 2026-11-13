import type { DailyPoint, StudentReport } from '@/lib/api';

const isoDay = (daysAgo: number) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const emptyDay = (daysAgo: number): DailyPoint => ({
  date: isoDay(daysAgo), questions: 0, correct: 0, accuracy_pct: null,
  practice_minutes: 0, attention_measured: 0, avg_on_screen_pct: null,
});

export const emptyDaily = (): DailyPoint[] => Array.from({ length: 14 }, (_, i) => emptyDay(13 - i));

const TOPICS = [
  ['linear_equations', 'Algebra (Linear Equations)'],
  ['area_perimeter', 'Geometry (Area & Perimeter)'],
  ['sequences_patterns', 'Number Patterns & Sequences'],
  ['percentages', 'Percentages'],
  ['exponents_radicals', 'Exponents & Radicals'],
  ['ratios_proportions', 'Ratios & Proportions'],
];

/** A student who has never played. */
export function emptyReport(overrides: Partial<StudentReport> = {}): StudentReport {
  return {
    student_id: 5, student_name: 'Asha', is_demo: false, points: 0, level: 1, last_active: null,
    questions_answered: 0, correct_answers: 0, accuracy_pct: null, practice_minutes: 0,
    missions_played: 0, missions_won: 0, bosses_defeated: 0, total_bosses: 6,
    topic_mastery: TOPICS.map(([topic, label]) => ({
      topic, label, mastery_pct: null, mastery_band: null, questions_answered: 0, correct_answers: 0,
    })),
    needs_practice: [], daily: emptyDaily(), mastery_history: [], observations: [], badges: [],
    recent_attempts: [],
    attention: { measured_questions: 0, total_questions: 0, avg_on_screen_pct: null },
    ...overrides,
  };
}

/** A student with 15 answers over two days who never switched the camera on. */
export function activeReport(overrides: Partial<StudentReport> = {}): StudentReport {
  const daily = emptyDaily();
  daily[11] = { ...daily[11], questions: 10, correct: 7, accuracy_pct: 70, practice_minutes: 4.5 };
  daily[13] = { ...daily[13], questions: 5, correct: 2, accuracy_pct: 40, practice_minutes: 2 };
  const base = emptyReport();
  return {
    ...base,
    points: 640, level: 2, last_active: new Date().toISOString().slice(0, 19),
    questions_answered: 15, correct_answers: 9, accuracy_pct: 60, practice_minutes: 7,
    missions_played: 2, missions_won: 1, bosses_defeated: 1,
    topic_mastery: base.topic_mastery.map((t) =>
      t.topic === 'linear_equations'
        ? { ...t, mastery_pct: 95, mastery_band: 'strong' as const, questions_answered: 10, correct_answers: 8 }
        : t.topic === 'area_perimeter'
          ? { ...t, mastery_pct: 5, mastery_band: 'needs_practice' as const, questions_answered: 5, correct_answers: 1 }
          : t),
    needs_practice: [{
      topic: 'area_perimeter', label: 'Geometry (Area & Perimeter)', mastery_pct: 5,
      mastery_band: 'needs_practice', questions_answered: 5, correct_answers: 1,
    }],
    daily,
    mastery_history: [
      { topic: 'linear_equations', label: 'Algebra (Linear Equations)', points: [{ date: isoDay(2), mastery_pct: 95 }] },
      { topic: 'area_perimeter', label: 'Geometry (Area & Perimeter)', points: [{ date: isoDay(0), mastery_pct: 5 }] },
    ],
    observations: ['Practised on 2 of the last 7 days.', 'Algebra (Linear Equations) is a strength (estimated mastery 95% or more).'],
    badges: [{ id: 'defeated-goblin', label: 'Green Goblin defeated', description: 'Won a mission on Algebra (Linear Equations).' }],
    recent_attempts: [{
      id: 1, boss_name: 'Doctor Octopus', topic_label: 'Geometry (Area & Perimeter)', difficulty: 'easy',
      is_correct: false, response_time_s: 24, hint_used: true, points_awarded: 5,
      answered_at: new Date().toISOString().slice(0, 19), attention_label: null,
    }],
    attention: { measured_questions: 0, total_questions: 15, avg_on_screen_pct: null },
    ...overrides,
  };
}
