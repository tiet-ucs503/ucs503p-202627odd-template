import React, { useMemo, useState } from 'react';
import { useTimetable } from '../../context/TimetableContext';
import type { DayOfWeek } from '../../types';

export function PollComposer({ sectionIds }: { sectionIds?: string[] }) {
  const { sections, courses, allocations, academicYear, createPoll, polls, sessions } = useTimetable();
  const availableSections = useMemo(() => sections.filter((section) => !sectionIds || sectionIds.includes(section.id)), [sections, sectionIds]);
  const [sectionId, setSectionId] = useState('');
  const [courseId, setCourseId] = useState('');
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(() => [
    { day: academicYear.workingDays[0] || 'Monday' as DayOfWeek, timeSlotLabel: '' },
    { day: academicYear.workingDays[1] || academicYear.workingDays[0] || 'Tuesday' as DayOfWeek, timeSlotLabel: '' },
  ]);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const selectedSectionId = availableSections.some((item) => item.id === sectionId) ? sectionId : availableSections[0]?.id || '';
  const availableCourses = useMemo(() => {
    const enrolledCourseIds = new Set(allocations.filter((allocation) => allocation.sectionId === selectedSectionId).map((allocation) => allocation.courseId));
    for (const session of sessions) if (session.sectionId === selectedSectionId) enrolledCourseIds.add(session.courseId);
    return courses.filter((course) => enrolledCourseIds.has(course.id));
  }, [allocations, courses, selectedSectionId, sessions]);
  const selectedCourseId = availableCourses.some((item) => item.id === courseId) ? courseId : availableCourses[0]?.id || '';

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    const result = await createPoll({ sectionId: selectedSectionId, courseId: selectedCourseId, question, options });
    setMessage(result.message || (result.success ? 'Poll created.' : 'Poll could not be created.'));
    if (result.success) setQuestion('');
    setSaving(false);
  };

  if (!availableSections.length) return <p className="text-xs text-stone-500">No sections with assigned classes are available for a poll.</p>;
  return (
    <div className="space-y-3 rounded-xl border border-[#E5E2D9] bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950/50">
      <form onSubmit={submit} className="space-y-3">
      <h3 className="text-sm font-semibold text-stone-900 dark:text-zinc-100">Create a student poll</h3>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="space-y-1 text-[11px] text-stone-600 dark:text-zinc-400">Section
          <select value={selectedSectionId} onChange={(event) => setSectionId(event.target.value)} className="w-full rounded-lg border border-[#E5E2D9] bg-white p-2 text-xs dark:border-zinc-700 dark:bg-zinc-900">
            {availableSections.map((section) => <option key={section.id} value={section.id}>{section.name}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-[11px] text-stone-600 dark:text-zinc-400">Course
          <select value={selectedCourseId} onChange={(event) => setCourseId(event.target.value)} className="w-full rounded-lg border border-[#E5E2D9] bg-white p-2 text-xs dark:border-zinc-700 dark:bg-zinc-900">
            {availableCourses.map((course) => <option key={course.id} value={course.id}>{course.code} · {course.name}</option>)}
          </select>
        </label>
      </div>
      <label className="block space-y-1 text-[11px] text-stone-600 dark:text-zinc-400">Question
        <input required minLength={5} maxLength={240} value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Which makeup class time works best?" className="w-full rounded-lg border border-[#E5E2D9] bg-white p-2 text-xs dark:border-zinc-700 dark:bg-zinc-900" />
      </label>
      <div className="space-y-2">
        {options.map((option, index) => <div key={index} className="grid grid-cols-[1fr_1.4fr] gap-2">
          <select value={option.day} onChange={(event) => setOptions((previous) => previous.map((item, i) => i === index ? { ...item, day: event.target.value as DayOfWeek } : item))} className="rounded-lg border border-[#E5E2D9] bg-white p-2 text-xs dark:border-zinc-700 dark:bg-zinc-900">
            {academicYear.workingDays.map((day) => <option key={day} value={day}>{day}</option>)}
          </select>
          <input required value={option.timeSlotLabel} onChange={(event) => setOptions((previous) => previous.map((item, i) => i === index ? { ...item, timeSlotLabel: event.target.value } : item))} placeholder="10:00 – 11:00" className="rounded-lg border border-[#E5E2D9] bg-white p-2 text-xs dark:border-zinc-700 dark:bg-zinc-900" />
        </div>)}
      </div>
      {message && <p role="status" className="text-xs text-stone-600 dark:text-zinc-400">{message}</p>}
      <button type="submit" disabled={saving || !selectedCourseId} className="rounded-lg bg-[#8C1B2E] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{saving ? 'Creating…' : 'Create poll'}</button>
      </form>
      {polls.filter((poll) => poll.isActive && availableSections.some((section) => section.id === poll.sectionId)).map((poll) => {
        const total = poll.options.reduce((count, option) => count + option.votes, 0);
        return <div key={poll.id} className="border-t border-[#E5E2D9] pt-3 text-xs dark:border-zinc-800">
          <p className="font-semibold text-stone-800 dark:text-zinc-200">Live results: {poll.question}</p>
          <p className="mt-1 text-[11px] text-stone-500">{poll.votedStudentsCount} of {poll.totalEligibleStudents} students voted</p>
          <div className="mt-2 space-y-1">{poll.options.map((option) => <div key={option.id} className="flex justify-between text-[11px] text-stone-600 dark:text-zinc-400"><span>{option.day} · {option.timeSlotLabel}</span><span>{option.votes} ({total ? Math.round(option.votes / total * 100) : 0}%)</span></div>)}</div>
        </div>;
      })}
    </div>
  );
}
