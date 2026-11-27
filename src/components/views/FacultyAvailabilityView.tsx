import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTimetable } from '../../context/TimetableContext';
import type { DayOfWeek } from '../../types';

export function FacultyAvailabilityView() {
  const { currentUser, roster } = useAuth();
  const { academicYear, facultyMembers, setFacultyProtectedSlot } = useTimetable();
  const facultyId = roster?.facultyId;
  const faculty = facultyMembers.find((item) => item.id === facultyId);
  const [reason, setReason] = useState<'Research' | 'Personal' | 'Department' | 'Meeting'>('Personal');
  const [busy, setBusy] = useState('');
  const [feedback, setFeedback] = useState('');

  const toggle = async (day: DayOfWeek, periodId: string) => {
    if (!faculty) return;
    const key = `${day}:${periodId}`;
    setBusy(key);
    setFeedback('');
    try {
      const result = await setFacultyProtectedSlot(faculty.id, day, periodId, reason);
      setFeedback(result.success ? 'Availability saved.' : 'Availability could not be saved. Please retry.');
    } finally {
      setBusy('');
    }
  };

  if (!faculty) return <div className="mx-auto max-w-5xl rounded-xl border border-[#E5E2D9] p-6 text-sm text-stone-600 dark:border-zinc-800 dark:text-zinc-300">{currentUser?.name ?? 'Your account'} is not linked to a faculty record yet.</div>;

  return <section className="mx-auto max-w-7xl space-y-5">
    <header className="flex flex-col gap-3 border-b border-[#E5E2D9] pb-4 sm:flex-row sm:items-end sm:justify-between dark:border-zinc-800">
      <div><h1 className="font-serif text-2xl font-bold text-stone-900 dark:text-zinc-100">My Availability</h1><p className="mt-1 text-sm text-stone-500 dark:text-zinc-400">Manage periods when you are unavailable for teaching.</p></div>
      <label className="flex items-center gap-2 text-xs text-stone-600 dark:text-zinc-300">Reason
        <select value={reason} onChange={(event) => setReason(event.target.value as typeof reason)} className="rounded-lg border border-[#E5E2D9] bg-white px-2.5 py-2 dark:border-zinc-700 dark:bg-zinc-900">
          <option>Personal</option><option>Research</option><option>Department</option><option>Meeting</option>
        </select>
      </label>
    </header>
    {feedback && <p role="status" className="rounded-lg border border-[#E5E2D9] bg-white p-3 text-xs dark:border-zinc-800 dark:bg-zinc-900">{feedback}</p>}
    <div className="overflow-x-auto rounded-xl border border-[#E5E2D9] dark:border-zinc-800">
      <table className="w-full min-w-[760px] border-collapse text-left text-xs">
        <thead className="bg-[#FAF9F5] dark:bg-zinc-900"><tr><th className="p-3">Period</th>{academicYear.workingDays.map((day) => <th key={day} className="p-3">{day}</th>)}</tr></thead>
        <tbody>{academicYear.timeSlots.filter((slot) => !slot.isBreak && !slot.isLunch && slot.id !== academicYear.lunchPeriodId).map((slot) => <tr key={slot.id} className="border-t border-[#E5E2D9] dark:border-zinc-800">
          <th className="p-3 font-medium">Period {slot.periodNumber}<span className="block text-[10px] font-normal text-stone-500">{slot.startTime}–{slot.endTime}</span></th>
          {academicYear.workingDays.map((day) => {
            const protectedSlot = faculty.preferences.protectedSlots.find((item) => item.day === day && item.periodId === slot.id);
            const key = `${day}:${slot.id}`;
            return <td key={day} className="p-2"><button type="button" disabled={busy === key} aria-pressed={Boolean(protectedSlot)} onClick={() => void toggle(day, slot.id)} className={`w-full rounded-md border px-2 py-2 text-[11px] font-medium disabled:opacity-50 ${protectedSlot ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200' : 'border-[#E5E2D9] bg-white text-stone-600 hover:border-[#8C1B2E] dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300'}`}>
              {busy === key ? 'Saving…' : protectedSlot ? `Free · ${protectedSlot.reason} (release)` : 'Keep this period free'}
            </button></td>;
          })}
        </tr>)}</tbody>
      </table>
    </div>
  </section>;
}
