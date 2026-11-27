export interface GridLayoutSlot {
  id: string;
  isBreak?: boolean;
  isLunch?: boolean;
}

export interface GridLayoutSession {
  day: string;
  timeSlotId: string;
  type: string;
  durationPeriods?: number;
}

/** Return a vertical span only when every parallel session is the same lab block. */
export function getGridCellRowSpan(
  sessions: readonly GridLayoutSession[],
  day: string,
  timeSlotId: string,
  slots: readonly GridLayoutSlot[],
): number {
  const cellSessions = sessions.filter((session) => session.day === day && session.timeSlotId === timeSlotId);
  if (!cellSessions.length || cellSessions.some((session) => session.type !== 'Lab')) return 1;

  const spans = new Set(cellSessions.map((session) => Math.max(1, Number(session.durationPeriods) || 1)));
  if (spans.size !== 1) return 1;
  const span = spans.values().next().value as number;
  if (span < 2) return 1;

  const startIndex = slots.findIndex((slot) => slot.id === timeSlotId);
  if (startIndex < 0 || startIndex + span > slots.length) return 1;
  const occupiedSlots = slots.slice(startIndex, startIndex + span);
  if (occupiedSlots.some((slot) => slot.isBreak || slot.isLunch || /break|lunch/i.test(slot.id))) return 1;
  return span;
}

/** A lab continuation row is covered only when its starting cell is safely row-spanned. */
export function isGridCellCoveredByLab(
  sessions: readonly GridLayoutSession[],
  day: string,
  timeSlotId: string,
  slots: readonly GridLayoutSlot[],
): boolean {
  const currentIndex = slots.findIndex((slot) => slot.id === timeSlotId);
  if (currentIndex < 0) return false;

  return sessions.some((session) => {
    if (session.day !== day || session.type !== 'Lab') return false;
    const startIndex = slots.findIndex((slot) => slot.id === session.timeSlotId);
    if (startIndex < 0 || startIndex >= currentIndex) return false;
    const rowSpan = getGridCellRowSpan(sessions, day, session.timeSlotId, slots);
    return rowSpan > currentIndex - startIndex;
  });
}
