import { diffInDays, startOfDay, toDateOnly, workingDaysBetween } from '../shared/dates';

export interface WorkloadPerson {
  userId: string;
  capacityHoursPerDay: number;
}

export interface WorkloadTask {
  id: string;
  key?: string;
  title?: string;
  assigneeId: string | null;
  startDate: Date | null;
  dueDate: Date | null;
  estimateHours: number | null;
  estimatePoints?: number | null;
  done?: boolean;
}

export interface TimeOffRange {
  userId: string;
  startDate: Date;
  endDate: Date;
}

export type LoadState = 'off' | 'free' | 'light' | 'normal' | 'full' | 'over';

export interface WorkloadCell {
  date: string;
  planned: number;
  capacity: number;
  state: LoadState;
  taskIds: string[];
  /** Each task's share of this day, in the requested unit (popover: "HRT-192 · 3.2h"). */
  items: { taskId: string; amount: number }[];
}

export interface WorkloadRow {
  userId: string;
  cells: WorkloadCell[];
  plannedTotal: number;
  capacityTotal: number;
  /** planned / capacity × 100 over the range. */
  loadPct: number;
  overDays: string[];
}

export type WorkloadUnit = 'hours' | 'tasks' | 'points';

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Lightness scale + number in every cell; "over" also gets a warning icon in the UI (colorblind-safe). */
export const classifyLoad = (planned: number, capacity: number): LoadState => {
  if (capacity <= 0) return 'off';
  if (planned > capacity) return 'over';
  if (planned >= capacity) return 'full';
  if (planned >= capacity / 2) return 'normal';
  if (planned > 0) return 'light';
  return 'free';
};

/**
 * Spreads each task's work evenly across the assignee's working days between start and due
 * (time off excluded — hours move to the remaining days), then compares with capacity.
 * Unit "tasks" counts tasks per day; "points" spreads story points like hours.
 */
export const computeWorkload = (
  people: readonly WorkloadPerson[],
  tasks: readonly WorkloadTask[],
  timeOff: readonly TimeOffRange[],
  range: { from: Date; to: Date },
  unit: WorkloadUnit = 'hours',
): WorkloadRow[] => {
  const days = workingDaysBetween(range.from, range.to);
  const isOff = (userId: string, d: Date) =>
    timeOff.some((t) => t.userId === userId && d.getTime() >= startOfDay(t.startDate).getTime() && d.getTime() <= startOfDay(t.endDate).getTime());

  return people.map((p) => {
    const cells: WorkloadCell[] = days.map((d) => {
      const off = isOff(p.userId, d);
      return { date: toDateOnly(d), planned: 0, capacity: off ? 0 : capacityIn(unit, p.capacityHoursPerDay), state: off ? 'off' : 'free', taskIds: [], items: [] };
    });
    const index = new Map(cells.map((c, i) => [c.date, i]));

    for (const t of tasks) {
      if (t.assigneeId !== p.userId || t.done) continue;
      const due = t.dueDate ?? t.startDate;
      if (!due) continue;
      const start = t.startDate ?? due;
      const amount = unit === 'tasks' ? 1 : unit === 'points' ? (t.estimatePoints ?? 0) : (t.estimateHours ?? 0);
      if (amount <= 0) continue;
      const workDays = workingDaysBetween(start, due).filter((d) => !isOff(p.userId, d));
      const spread = workDays.length ? workDays : [startOfDay(due)];
      const perDay = unit === 'tasks' ? 1 : amount / spread.length;
      for (const d of spread) {
        const i = index.get(toDateOnly(d));
        if (i === undefined) continue;
        cells[i]!.planned = round1(cells[i]!.planned + perDay);
        cells[i]!.taskIds.push(t.id);
        cells[i]!.items.push({ taskId: t.id, amount: round1(perDay) });
      }
    }

    for (const c of cells) if (c.capacity > 0) c.state = classifyLoad(c.planned, c.capacity);
    const plannedTotal = round1(cells.reduce((a, c) => a + c.planned, 0));
    const capacityTotal = cells.reduce((a, c) => a + c.capacity, 0);
    return {
      userId: p.userId,
      cells,
      plannedTotal,
      capacityTotal,
      loadPct: capacityTotal ? Math.round((plannedTotal / capacityTotal) * 100) : 0,
      overDays: cells.filter((c) => c.state === 'over').map((c) => c.date),
    };
  });
};

const capacityIn = (unit: WorkloadUnit, hoursPerDay: number) => (unit === 'hours' ? hoursPerDay : unit === 'tasks' ? 3 : Math.max(1, Math.round(hoursPerDay / 4)));

export interface WorkloadSummary {
  capacityUsedPct: number;
  planned: number;
  capacity: number;
  overCapacity: { userId: string; days: string[] }[];
  freeCapacity: number;
  /** People with the most free capacity, largest first. */
  freeBy: { userId: string; free: number }[];
  timeOff: { userId: string; days: string[] }[];
}

/** Summary chips answer the PM's first question: who is overloaded this week? */
export const summarizeWorkload = (rows: readonly WorkloadRow[]): WorkloadSummary => {
  const planned = round1(rows.reduce((a, r) => a + r.plannedTotal, 0));
  const capacity = rows.reduce((a, r) => a + r.capacityTotal, 0);
  const freeBy = rows
    .map((r) => ({ userId: r.userId, free: round1(r.cells.reduce((a, c) => a + Math.max(0, c.capacity - c.planned), 0)) }))
    .filter((x) => x.free > 0)
    .sort((a, b) => b.free - a.free);
  return {
    capacityUsedPct: capacity ? Math.round((planned / capacity) * 100) : 0,
    planned,
    capacity,
    overCapacity: rows.filter((r) => r.overDays.length).map((r) => ({ userId: r.userId, days: r.overDays })),
    freeCapacity: round1(freeBy.reduce((a, x) => a + x.free, 0)),
    freeBy,
    timeOff: rows
      .map((r) => ({ userId: r.userId, days: r.cells.filter((c) => c.state === 'off').map((c) => c.date) }))
      .filter((x) => x.days.length),
  };
};

export interface RebalanceSuggestion {
  taskId: string;
  fromUserId: string;
  toUserId: string;
  /** Hours freed on the overloaded person's worst day. */
  hoursMoved: number;
  /** Days in the range the task covers (where the hours move). */
  days: string[];
  /** Hours moved across those days. */
  totalHours: number;
  fromLoadPct: number;
  toLoadPct: number;
  /** Projected load over the range once the task moves. */
  fromLoadPctAfter: number;
  toLoadPctAfter: number;
  reason: string;
}

/**
 * Proposes moving one task from each overloaded person to the teammate with the most free
 * capacity across that task's days. A suggestion a person accepts or ignores — never automatic.
 */
export const suggestRebalance = (
  rows: readonly WorkloadRow[],
  tasks: readonly WorkloadTask[],
  names: Record<string, string> = {},
): RebalanceSuggestion[] => {
  const suggestions: RebalanceSuggestion[] = [];
  const byUser = new Map(rows.map((r) => [r.userId, r]));
  for (const row of rows) {
    const worst = [...row.cells].filter((c) => c.state === 'over').sort((a, b) => b.planned - b.capacity - (a.planned - a.capacity))[0];
    if (!worst) continue;
    const candidates = worst.taskIds
      .map((id) => tasks.find((t) => t.id === id))
      .filter((t): t is WorkloadTask => !!t)
      .sort((a, b) => (a.estimateHours ?? 0) - (b.estimateHours ?? 0));
    for (const task of candidates) {
      const shares = row.cells.flatMap((c) => c.items.filter((x) => x.taskId === task.id).map((x) => ({ date: c.date, amount: x.amount })));
      const taskDays = new Set(shares.map((x) => x.date));
      const perDay = Math.max(0, ...shares.map((x) => x.amount));
      const target = [...byUser.values()]
        .filter((r) => r.userId !== row.userId)
        .map((r) => ({ r, fits: r.cells.filter((c) => taskDays.has(c.date)).every((c) => c.capacity > 0 && c.planned + perDay <= c.capacity) }))
        .filter((x) => x.fits)
        .sort((a, b) => a.r.loadPct - b.r.loadPct)[0];
      if (target) {
        const name = (id: string) => names[id] ?? 'a teammate';
        const totalHours = round1(shares.reduce((a, x) => a + x.amount, 0));
        const pct = (planned: number, capacity: number) => (capacity ? Math.round((planned / capacity) * 100) : 0);
        suggestions.push({
          taskId: task.id,
          fromUserId: row.userId,
          toUserId: target.r.userId,
          hoursMoved: round1(perDay),
          days: [...taskDays].sort(),
          totalHours,
          fromLoadPct: row.loadPct,
          toLoadPct: target.r.loadPct,
          fromLoadPctAfter: pct(row.plannedTotal - totalHours, row.capacityTotal),
          toLoadPctAfter: pct(target.r.plannedTotal + totalHours, target.r.capacityTotal),
          reason: `${name(row.userId)} is over capacity on ${worst.date}; ${name(target.r.userId)} has room on those days.`,
        });
        break;
      }
    }
  }
  return suggestions;
};

/** Days in range helper exposed for UIs that render the header row. */
export const workloadDays = (from: Date, to: Date): string[] => workingDaysBetween(from, to).map(toDateOnly);
export const isToday = (date: string, today: Date) => diffInDays(today, new Date(date + 'T00:00:00Z')) === 0;
