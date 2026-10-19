import { diffInDays, humanizeDate, humanizeTimeAgo, parseDateOnly, toDateOnly } from '@hearth/domain';

/**
 * "Today" as the domain understands it: the viewer's local calendar day, as midnight UTC.
 * (The domain compares calendar days in UTC; using local Y/M/D keeps "Today" honest at 11pm.)
 */
export const today = (now: Date = new Date()): Date =>
  new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));

export const todayIso = (now?: Date): string => toDateOnly(today(now));

export type DueTone = 'default' | 'danger';

export interface DueInfo {
  label: string;
  tone: DueTone;
  overdue: boolean;
  dueToday: boolean;
  /** Days from today (negative when past). */
  delta: number;
}

/** Human due date + tone: overdue is the only red; done tasks are never overdue. */
export const dueInfo = (
  dueDate: string | null,
  opts: { done?: boolean; now?: Date } = {},
): DueInfo | null => {
  if (!dueDate) return null;
  const t = today(opts.now);
  const d = parseDateOnly(dueDate);
  const delta = diffInDays(t, d);
  const overdue = !opts.done && delta < 0;
  return {
    label: humanizeDate(d, t),
    tone: overdue ? 'danger' : 'default',
    overdue,
    dueToday: delta === 0,
    delta,
  };
};

/** "overdue 2 days" / "due today" / "due Thu" — palette hints. */
export const dueHint = (dueDate: string | null, done = false): string | undefined => {
  const info = dueInfo(dueDate, { done });
  if (!info) return undefined;
  if (info.overdue) return `overdue ${-info.delta} ${info.delta === -1 ? 'day' : 'days'}`;
  if (info.dueToday) return 'due today';
  return `due ${info.label}`;
};

export const timeAgo = (iso: string, now: Date = new Date()): string => humanizeTimeAgo(new Date(iso), now);

/** "Monday, October 19" in the viewer's locale. */
export const longToday = (now: Date = new Date()): string =>
  now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

export const greetingFor = (now: Date = new Date()): string => {
  const h = now.getHours();
  if (h < 5) return 'Working late';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
};
