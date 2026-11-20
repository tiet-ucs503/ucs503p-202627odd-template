import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import ParentDashboard from '@/components/ParentDashboard';
import { installFakeServer } from '@/test/fakeServer';
import { activeReport, emptyReport } from '@/test/reportFixture';

const viewer = { role: 'teacher', name: 'Ms Rao' };
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 9, email: 't@example.com', is_demo: false, ...viewer }, logout: vi.fn() }),
}));

const student = (id: number, name: string, answered: number, accuracy: number | null) => ({
  id, name, level: 1, points: 0, is_demo: false,
  questions_answered: answered, accuracy_pct: accuracy,
  last_active: answered ? new Date().toISOString().slice(0, 19) : null,
});

describe('teacher with several students', () => {
  it('lists the linked students, then opens the chosen report', async () => {
    viewer.role = 'teacher';
    const server = installFakeServer({
      '/guardians/students': () => [student(5, 'Asha', 15, 60), student(6, 'Ben', 0, null)],
      '/students/5/report': () => activeReport(),
      '/students/6/report': () => emptyReport({ student_id: 6, student_name: 'Ben' }),
    });
    render(<ParentDashboard />);

    expect(await screen.findByText('Your students')).toBeTruthy();
    expect(screen.getByText('Asha')).toBeTruthy();
    expect(screen.getByText('No answers yet')).toBeTruthy(); // Ben: unknown, not 0%
    expect(server.requests.some((r) => r.url.includes('/report'))).toBe(false); // nothing loaded until chosen

    fireEvent.click(screen.getByRole('button', { name: 'View report for Ben' }));
    expect(await screen.findByText('No practice recorded yet')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /all students/i }));
    fireEvent.click(await screen.findByRole('button', { name: 'View report for Asha' }));
    expect(await screen.findByText('9 of 15 correct')).toBeTruthy();
    expect(server.requests.find((r) => r.url.includes('/students/5/report'))!.url).toMatch(/tz_offset_minutes=-?\d+/);
  });
});

describe('parent with one child', () => {
  it('goes straight to that child\'s report', async () => {
    viewer.role = 'parent';
    installFakeServer({
      '/guardians/students': () => [student(5, 'Asha', 15, 60)],
      '/students/5/report': () => activeReport(),
    });
    render(<ParentDashboard />);
    expect(await screen.findByText('9 of 15 correct')).toBeTruthy();
    expect(screen.queryByText('Your children')).toBeNull();
  });
});
