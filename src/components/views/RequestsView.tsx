import React, { useState } from 'react';
import { Check, CalendarCheck, Vote } from 'lucide-react';
import { useTimetable } from '../../context/TimetableContext';
import { formatLocalizedTimestamp } from '../../lib/userUtils';

export function RequestsView() {
  const { notifications, markNotificationRead, makeupTasks, recoveryOpportunities, scheduleMakeup, polls, sections, courses, applyWinningPoll } = useTimetable();
  const [savingId, setSavingId] = useState<string | null>(null);
  const [schedulingId, setSchedulingId] = useState<string | null>(null);
  const [applyingPollId, setApplyingPollId] = useState<string | null>(null);
  const [pollFeedback, setPollFeedback] = useState<string | null>(null);
  const requests = notifications.filter(item => ['makeup_request', 'approval_needed', 'cancellation', 'poll_created'].includes(item.type));

  const markRead = async (id: string) => {
    setSavingId(id);
    try { await markNotificationRead(id); } finally { setSavingId(null); }
  };

  const handleApplyPoll = async (pollId: string) => {
    setApplyingPollId(pollId);
    setPollFeedback(null);
    try {
      const result = await applyWinningPoll(pollId);
      setPollFeedback(result.message);
    } finally {
      setApplyingPollId(null);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-12">
      <header className="border-b border-[#E5E2D9] pb-4 dark:border-zinc-800">
        <h1 className="text-2xl font-serif font-bold text-stone-900 dark:text-zinc-100 sm:text-3xl">Requests, Polls & Disruptions</h1>
        <p className="mt-1 text-xs text-stone-500 dark:text-zinc-400">Live cancellations, CR makeup polls, and student voting synced in real time across all portals.</p>
      </header>

      {polls.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-stone-900 dark:text-zinc-100">
              <Vote className="h-4 w-4 text-[#8C1B2E]" />
              Student Makeup Polls
            </h2>
            {pollFeedback && <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">{pollFeedback}</span>}
          </div>
          {polls.map((poll) => {
            const sectionName = sections.find((s) => s.id === poll.sectionId)?.name || poll.sectionId;
            const courseCode = courses.find((c) => c.id === poll.courseId)?.code;
            const sortedOptions = [...poll.options].sort((a, b) => b.votes - a.votes);
            const leader = sortedOptions[0];
            return (
              <article key={poll.id} className="rounded-xl border border-[#E5E2D9] bg-[#FAF9F5] p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-stone-900 dark:text-zinc-100">{poll.question}</span>
                      <span className={`rounded px-2 py-0.5 text-[10px] font-semibold ${poll.isActive ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200' : 'bg-stone-200 text-stone-700 dark:bg-zinc-800 dark:text-zinc-300'}`}>
                        {poll.isActive ? 'Voting Open' : 'Closed / Applied'}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-stone-500 dark:text-zinc-400">
                      Section: {sectionName}{courseCode ? ` · Course: ${courseCode}` : ''} · {poll.votedStudentsCount} vote{poll.votedStudentsCount === 1 ? '' : 's'}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {sortedOptions.map((opt) => (
                        <span key={opt.id} className="rounded-md border border-[#E5E2D9] bg-white px-2.5 py-1 text-xs text-stone-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200">
                          {opt.day} {opt.timeSlotLabel}: <strong>{opt.votes}</strong>
                        </span>
                      ))}
                    </div>
                  </div>
                  {poll.isActive && leader && (
                    <button
                      type="button"
                      onClick={() => void handleApplyPoll(poll.id)}
                      disabled={applyingPollId !== null}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#8C1B2E] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      <CalendarCheck className="h-3.5 w-3.5" />
                      {applyingPollId === poll.id ? 'Scheduling…' : `Apply Winner (${leader.day} ${leader.timeSlotLabel})`}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-stone-900 dark:text-zinc-100">Incoming Requests & Disruptions</h2>
        {requests.length === 0 ? (
          <div className="rounded-xl border border-[#E5E2D9] bg-[#FAF9F5] p-6 text-center text-xs text-stone-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
            No incoming requests or class disruptions.
          </div>
        ) : requests.map(item => (
          <article key={item.id} className="flex flex-col justify-between gap-3 rounded-xl border border-[#E5E2D9] bg-[#FAF9F5] p-4 dark:border-zinc-800 dark:bg-zinc-900 sm:flex-row sm:items-center">
            <div>
              <div className="text-sm font-semibold text-stone-900 dark:text-zinc-100">{item.title}</div>
              <p className="mt-1 text-xs text-stone-600 dark:text-zinc-400">{item.message}</p>
              <time className="mt-2 block text-[11px] text-stone-500 dark:text-zinc-400">{formatLocalizedTimestamp(item.timestamp)}</time>
            </div>
            {!item.read && <button type="button" onClick={() => void markRead(item.id)} disabled={savingId !== null} className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-[#E5E2D9] bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"><Check className="h-3.5 w-3.5" />{savingId === item.id ? 'Saving…' : 'Mark read'}</button>}
            {item.type === 'cancellation' && (() => {
              const task = makeupTasks.find((entry) => entry.cancelledSessionId === item.actionPayload?.sessionId);
              const options = task ? recoveryOpportunities.filter((entry) => entry.makeupTaskId === task.id && entry.status === 'Proposed') : [];
              return options.slice(0, 3).map((option) => <button key={option.id} type="button" onClick={() => { setSchedulingId(option.id); void scheduleMakeup(option.id).finally(() => setSchedulingId(null)); }} disabled={schedulingId !== null} className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-[#8C1B2E] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"><CalendarCheck className="h-3.5 w-3.5" />{schedulingId === option.id ? 'Scheduling…' : `Schedule ${option.targetDay} ${option.timeSlotId}`}</button>);
            })()}
          </article>
        ))}
      </section>
    </div>
  );
}
