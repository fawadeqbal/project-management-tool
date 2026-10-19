import type { TaskDto } from '@hearth/contracts';
import { addDays, isWeekend, parseDateOnly, toDateOnly } from '@hearth/domain';

export type CalendarRange = 'day' | 'week' | 'month';
export const RANGE_OPTIONS: { id: CalendarRange; label: string }[] = [
  { id: 'day', label: 'Day' },
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
];
export const MAX_CHIPS = 3;

export interface CalendarDay {
  date: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
  weekend: boolean;
  tasks: TaskDto[];
}

const startOfMonth = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));

/** Visible days for a range around `cursor` (Sun–Sat weeks; month = whole weeks covering it). */
export function visibleDays(cursor: string, range: CalendarRange): string[] {
  const c = parseDateOnly(cursor);
  if (range === 'day') return [cursor];
  if (range === 'week') {
    const start = addDays(c, -c.getUTCDay());
    return Array.from({ length: 7 }, (_, i) => toDateOnly(addDays(start, i)));
  }
  const first = startOfMonth(c);
  const start = addDays(first, -first.getUTCDay());
  const last = addDays(startOfMonth(new Date(Date.UTC(c.getUTCFullYear(), c.getUTCMonth() + 1, 1))), -1);
  const end = addDays(last, 6 - last.getUTCDay());
  const days: string[] = [];
  for (let d = start; d.getTime() <= end.getTime(); d = addDays(d, 1)) days.push(toDateOnly(d));
  return days;
}

/** Tasks bucketed by due date, in a stable order (open first, then by priority rank via number). */
export function buildDays(tasks: readonly TaskDto[], cursor: string, range: CalendarRange, today: string): CalendarDay[] {
  const month = parseDateOnly(cursor).getUTCMonth();
  const byDate = new Map<string, TaskDto[]>();
  for (const t of tasks) {
    if (!t.dueDate) continue;
    const list = byDate.get(t.dueDate) ?? [];
    list.push(t);
    byDate.set(t.dueDate, list);
  }
  const order = (a: TaskDto, b: TaskDto) => Number(a.status === 'DONE') - Number(b.status === 'DONE') || a.listPosition - b.listPosition || a.number - b.number;
  return visibleDays(cursor, range).map((date) => {
    const d = parseDateOnly(date);
    return {
      date,
      day: d.getUTCDate(),
      inMonth: range !== 'month' || d.getUTCMonth() === month,
      isToday: date === today,
      weekend: isWeekend(d),
      tasks: [...(byDate.get(date) ?? [])].sort(order),
    };
  });
}

/** Query window for GET /tasks?from&to. */
export function rangeWindow(cursor: string, range: CalendarRange): { from: string; to: string } {
  const days = visibleDays(cursor, range);
  return { from: days[0]!, to: days[days.length - 1]! };
}

/** Prev/next by the active range. */
export function stepCursor(cursor: string, range: CalendarRange, dir: -1 | 1): string {
  const c = parseDateOnly(cursor);
  if (range === 'day') return toDateOnly(addDays(c, dir));
  if (range === 'week') return toDateOnly(addDays(c, 7 * dir));
  return toDateOnly(new Date(Date.UTC(c.getUTCFullYear(), c.getUTCMonth() + dir, 1)));
}

export function rangeTitle(cursor: string, range: CalendarRange): string {
  const c = parseDateOnly(cursor);
  if (range === 'month') return c.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  if (range === 'day') return c.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
  const days = visibleDays(cursor, 'week');
  const a = parseDateOnly(days[0]!);
  const b = parseDateOnly(days[6]!);
  const fmt = (d: Date, opts: Intl.DateTimeFormatOptions) => d.toLocaleDateString('en-US', { ...opts, timeZone: 'UTC' });
  return a.getUTCMonth() === b.getUTCMonth()
    ? `${fmt(a, { month: 'long' })} ${a.getUTCDate()}–${b.getUTCDate()}, ${b.getUTCFullYear()}`
    : `${fmt(a, { month: 'short', day: 'numeric' })} – ${fmt(b, { month: 'short', day: 'numeric' })}, ${b.getUTCFullYear()}`;
}

export const longDate = (date: string) => parseDateOnly(date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
