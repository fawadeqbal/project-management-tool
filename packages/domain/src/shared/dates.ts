/**
 * Calendar-date helpers. Hearth stores due dates as calendar days (midnight UTC). All helpers
 * here work in UTC so "Oct 21" means the same day for every viewer and every server.
 */
export const DAY_MS = 86_400_000;

export const startOfDay = (d: Date): Date =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

export const addDays = (d: Date, days: number): Date => new Date(startOfDay(d).getTime() + days * DAY_MS);

/** Whole calendar days from `a` to `b` (positive when b is later). */
export const diffInDays = (a: Date, b: Date): number =>
  Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / DAY_MS);

export const isSameDay = (a: Date, b: Date): boolean => diffInDays(a, b) === 0;

export const isWeekend = (d: Date): boolean => {
  const day = d.getUTCDay();
  return day === 0 || day === 6;
};

/** Working days (Mon–Fri) in the inclusive range [from, to]. */
export const workingDaysBetween = (from: Date, to: Date): Date[] => {
  const days: Date[] = [];
  for (let d = startOfDay(from); d.getTime() <= startOfDay(to).getTime(); d = addDays(d, 1)) {
    if (!isWeekend(d)) days.push(d);
  }
  return days;
};

/** Parses "YYYY-MM-DD" (or an ISO string) to a UTC calendar date. */
export const parseDateOnly = (value: string): Date => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) throw new RangeError(`Invalid date: ${value}`);
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
};

export const toDateOnly = (d: Date): string => startOfDay(d).toISOString().slice(0, 10);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const formatShortDate = (d: Date): string => `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
export const weekdayName = (d: Date): string => WEEKDAYS[d.getUTCDay()]!;

/**
 * Human dates per the Hearth voice: "Today", "Tomorrow", "Thu", "2 days ago", and an absolute
 * date ("Oct 26") beyond a week.
 */
export const humanizeDate = (date: Date, today: Date): string => {
  const delta = diffInDays(today, date);
  if (delta === 0) return 'Today';
  if (delta === 1) return 'Tomorrow';
  if (delta === -1) return 'Yesterday';
  if (delta < -1 && delta >= -6) return `${-delta} days ago`;
  if (delta > 1 && delta <= 6) return weekdayName(date);
  return formatShortDate(date);
};

/** Relative time for activity and comments: "now", "5 min ago", "2h ago", "Yesterday", "Oct 12". */
export const humanizeTimeAgo = (at: Date, now: Date): string => {
  const secs = Math.max(0, Math.round((now.getTime() - at.getTime()) / 1000));
  if (secs < 60) return 'now';
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = diffInDays(at, now);
  if (days === 1) return 'Yesterday';
  if (days < 7) return weekdayName(at);
  return formatShortDate(at);
};
