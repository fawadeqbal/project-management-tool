import { addDays, diffInDays, formatShortDate, startOfDay } from '../shared/dates';
import { STATUS_META, type TaskStatus } from '../task/values';

/** The minimal task facts reporting needs (Interface Segregation). */
export interface ReportTask {
  status: TaskStatus;
  createdAt: Date;
  startDate: Date | null;
  dueDate: Date | null;
  completedAt: Date | null;
  projectId: string | null;
}

export interface Kpi {
  label: string;
  value: string;
  delta: string;
  /** Whether the change is good — drives color plus an icon, never color alone. */
  deltaTone: 'good' | 'bad' | 'neutral';
  sub: string;
}

const inRange = (d: Date | null, from: Date, to: Date) => !!d && d.getTime() >= from.getTime() && d.getTime() < to.getTime();
const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);
const fmtDelta = (n: number, unit = '') => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${Math.abs(n)}${unit}`;

/**
 * Dashboard KPI tiles: the number, the change, and what "good" means. The window is the last
 * `weeks` weeks compared with the window before it.
 */
export const computeKpis = (tasks: readonly ReportTask[], today: Date, weeks = 6, onTimeTarget = 85): Kpi[] => {
  const end = addDays(startOfDay(today), 1);
  const start = addDays(end, -weeks * 7);
  const prevStart = addDays(start, -weeks * 7);

  const completed = tasks.filter((t) => inRange(t.completedAt, start, end));
  const prevCompleted = tasks.filter((t) => inRange(t.completedAt, prevStart, start));
  const completedDeltaPct = prevCompleted.length ? Math.round(((completed.length - prevCompleted.length) / prevCompleted.length) * 100) : 0;

  const onTime = (list: readonly ReportTask[]) => {
    const withDue = list.filter((t) => t.dueDate);
    return pct(withDue.filter((t) => diffInDays(t.dueDate!, t.completedAt!) <= 0).length, withDue.length);
  };
  const onTimeNow = onTime(completed);
  const onTimePrev = onTime(prevCompleted);

  const cycle = (list: readonly ReportTask[]) => {
    const spans = list.map((t) => Math.max(0, (t.completedAt!.getTime() - (t.startDate ?? t.createdAt).getTime()) / 86_400_000));
    return spans.length ? Math.round((spans.reduce((a, b) => a + b, 0) / spans.length) * 10) / 10 : 0;
  };
  const cycleNow = cycle(completed);
  const cyclePrev = cycle(prevCompleted);

  const overdueAt = (day: Date) =>
    tasks.filter((t) => t.dueDate && diffInDays(day, t.dueDate) < 0 && (!t.completedAt || t.completedAt.getTime() > day.getTime()) && t.createdAt.getTime() <= day.getTime()).length;
  const overdueNow = tasks.filter((t) => t.status !== 'DONE' && t.dueDate && diffInDays(today, t.dueDate) < 0).length;
  const overdueWeekAgo = overdueAt(addDays(startOfDay(today), -7));
  const cycleDelta = Math.round((cycleNow - cyclePrev) * 10) / 10;

  // With nothing finished in the previous window there is no honest comparison: say so (neutral).
  const noHistory = prevCompleted.length === 0;
  const NEW = { delta: 'New', deltaTone: 'neutral' as const };

  return [
    {
      label: 'Tasks completed',
      value: String(completed.length),
      ...(noHistory ? NEW : { delta: `${fmtDelta(completedDeltaPct)}%`, deltaTone: completedDeltaPct >= 0 ? ('good' as const) : ('bad' as const) }),
      sub: noHistory ? `no data before the last ${weeks} weeks` : `vs. previous ${weeks} weeks`,
    },
    {
      label: 'On-time delivery',
      value: `${onTimeNow}%`,
      ...(noHistory ? NEW : { delta: `${fmtDelta(onTimeNow - onTimePrev)} pts`, deltaTone: onTimeNow >= onTimePrev ? ('good' as const) : ('bad' as const) }),
      sub: `target ${onTimeTarget}%`,
    },
    {
      label: 'Avg. cycle time',
      value: `${cycleNow} days`,
      ...(noHistory ? NEW : { delta: fmtDelta(cycleDelta), deltaTone: cycleDelta <= 0 ? ('good' as const) : ('bad' as const) }),
      sub: 'lower is better',
    },
    { label: 'Overdue now', value: String(overdueNow), delta: fmtDelta(overdueNow - overdueWeekAgo), deltaTone: overdueNow <= overdueWeekAgo ? 'good' : 'bad', sub: 'since last week' },
  ];
};

export interface ThroughputBucket {
  label: string;
  weekStart: string;
  created: number;
  completed: number;
}

/** "Are we finishing what we start?" — created vs completed per week. */
export const weeklyThroughput = (tasks: readonly ReportTask[], today: Date, weeks = 6): ThroughputBucket[] => {
  const day = startOfDay(today);
  const monday = addDays(day, -((day.getUTCDay() + 6) % 7));
  return Array.from({ length: weeks }, (_, i) => {
    const from = addDays(monday, -(weeks - 1 - i) * 7);
    const to = addDays(from, 7);
    return {
      label: formatShortDate(from),
      weekStart: from.toISOString().slice(0, 10),
      created: tasks.filter((t) => inRange(t.createdAt, from, to)).length,
      completed: tasks.filter((t) => inRange(t.completedAt, from, to)).length,
    };
  });
};

/** Open work by status (Done excluded) with percentages for the stacked bar. */
export const statusMix = (tasks: readonly ReportTask[]): { status: TaskStatus; label: string; count: number; pct: number }[] => {
  const open = tasks.filter((t) => t.status !== 'DONE');
  return (['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'BLOCKED'] as const).map((s) => {
    const count = open.filter((t) => t.status === s).length;
    return { status: s, label: STATUS_META[s].label, count, pct: pct(count, open.length) };
  });
};
