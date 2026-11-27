/**
 * User Identity and Formatting Utilities
 */

/**
 * Derives clean initials from a full name, removing titles like Prof., Dr., Mr., Ms., Dean, HOD.
 * E.g., "Prof. Rajesh K. Demo" -> "RD"
 * E.g., "Dr. K. N. Murthy" -> "KM"
 * E.g., "Aarav Mehta" -> "AM"
 */
export function getUserInitials(name?: string): string {
  if (!name) return 'U';
  
  // Strip common academic titles
  const cleanName = name
    .replace(/^(Prof\.|Dr\.|Mr\.|Ms\.|Dean|HOD|Chief)\s+/i, '')
    .replace(/\s+\(.*\)$/, '') // Strip trailing parenthetical notes like (Coordinator)
    .trim();

  const parts = cleanName.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return name.charAt(0).toUpperCase();
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  
  const first = parts[0].charAt(0).toUpperCase();
  const last = parts[parts.length - 1].charAt(0).toUpperCase();
  return `${first}${last}`;
}

/**
 * Formats a last login or updated timestamp cleanly.
 * E.g., "Oct 4, 2026 at 09:15 AM"
 */
export function formatFormattedDateTime(isoString?: string): string {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '—';
    
    const datePart = d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const timePart = d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
    return `${datePart} at ${timePart}`;
  } catch {
    return '—';
  }
}

export function formatLocalizedTimestamp(value?: string | null): string {
  if (!value) return 'Date unavailable';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleString();
}
