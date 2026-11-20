/** "2026-11-04" -> "Nov 4" in the viewer's own language. */
export function formatDay(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString([], { month: 'short', day: 'numeric' });
}
