import { formatDistanceToNow, isToday, parseISO, isValid } from 'date-fns';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';

export const TIMEZONE = 'Asia/Kolkata';

/**
 * Parses a date string safely into a Date object in Asia/Kolkata zone.
 */
export const parseInTimezone = (dateStr?: string | null): Date | null => {
  if (!dateStr) return null;
  try {
    const parsed = typeof dateStr === 'string' ? parseISO(dateStr) : new Date(dateStr);
    if (!isValid(parsed)) return null;
    return toZonedTime(parsed, TIMEZONE);
  } catch {
    return null;
  }
};

/**
 * Formats a timestamp into standard Indian format: "05 Sep 2026, 02:30 PM"
 */
export const formatDateTime = (dateStr?: string | null): string => {
  if (!dateStr) return '—';
  try {
    const parsed = typeof dateStr === 'string' ? parseISO(dateStr) : new Date(dateStr);
    if (!isValid(parsed)) return '—';
    return formatInTimeZone(parsed, TIMEZONE, 'dd MMM yyyy, hh:mm a');
  } catch {
    return '—';
  }
};

/**
 * Formats date only: "05 Sep 2026"
 */
export const formatDateOnly = (dateStr?: string | null): string => {
  if (!dateStr) return '—';
  try {
    const parsed = typeof dateStr === 'string' ? parseISO(dateStr) : new Date(dateStr);
    if (!isValid(parsed)) return '—';
    return formatInTimeZone(parsed, TIMEZONE, 'dd MMM yyyy');
  } catch {
    return '—';
  }
};

/**
 * Formats for HTML input[type="date"]: "YYYY-MM-DD"
 */
export const formatInputDate = (dateStr?: string | null): string => {
  if (!dateStr) return '';
  try {
    const parsed = typeof dateStr === 'string' ? parseISO(dateStr) : new Date(dateStr);
    if (!isValid(parsed)) return '';
    return formatInTimeZone(parsed, TIMEZONE, 'yyyy-MM-dd');
  } catch {
    return '';
  }
};

/**
 * Formats for HTML input[type="datetime-local"]: "YYYY-MM-DDThh:mm"
 */
export const formatInputDateTime = (dateStr?: string | null): string => {
  if (!dateStr) return '';
  try {
    const parsed = typeof dateStr === 'string' ? parseISO(dateStr) : new Date(dateStr);
    if (!isValid(parsed)) return '';
    return formatInTimeZone(parsed, TIMEZONE, "yyyy-MM-dd'T'HH:mm");
  } catch {
    return '';
  }
};

/**
 * Calculates human-readable pending duration, e.g., "3 days ago"
 */
export const formatRelativePending = (pendingSinceStr?: string | null): string => {
  if (!pendingSinceStr) return 'Unknown';
  try {
    const parsed = typeof pendingSinceStr === 'string' ? parseISO(pendingSinceStr) : new Date(pendingSinceStr);
    if (!isValid(parsed)) return 'Unknown';
    return formatDistanceToNow(parsed, { addSuffix: true });
  } catch {
    return 'Unknown';
  }
};

/**
 * Checks if a task is overdue.
 * Condition: Task has a due_date, due_date is in the past,
 * and status is NOT 'completed' and NOT 'cancelled'.
 */
export const isTaskOverdue = (
  dueDateStr?: string | null,
  status?: string
): boolean => {
  if (!dueDateStr) return false;
  if (status === 'completed' || status === 'cancelled') return false;

  try {
    const parsed = typeof dueDateStr === 'string' ? parseISO(dueDateStr) : new Date(dueDateStr);
    if (!isValid(parsed)) return false;

    // If it's a date-only string like YYYY-MM-DD (10 chars), set to end of that day in Asia/Kolkata (+05:30)
    if (typeof dueDateStr === 'string' && dueDateStr.length === 10) {
      const endOfDayIst = new Date(`${dueDateStr}T23:59:59.999+05:30`);
      return Date.now() > endOfDayIst.getTime();
    }

    return Date.now() > parsed.getTime();
  } catch {
    return false;
  }
};

/**
 * Checks if a task is due today in Asia/Kolkata timezone
 */
export const isTaskDueToday = (dueDateStr?: string | null): boolean => {
  if (!dueDateStr) return false;
  try {
    const parsed = typeof dueDateStr === 'string' ? parseISO(dueDateStr) : new Date(dueDateStr);
    if (!isValid(parsed)) return false;
    const dateInIst = toZonedTime(parsed, TIMEZONE);
    return isToday(dateInIst);
  } catch {
    return false;
  }
};

