import { diffInDays, startOfDay, toDateOnly, workingDaysBetween } from '../shared/dates';

export interface BurndownSnapshot {
  date: Date;
  remainingPoints: number;
  scopePoints: number;
}

export interface BurndownPoint {
  date: string;
  /** Working-day index from sprint start (x axis). */
  day: number;
  remaining: number;
}

export interface Burndown {
  totalDays: number;
  ideal: BurndownPoint[];
  actual: BurndownPoint[];
  /** Days where scope increased — marked on the chart. */
  scopeChanges: { date: string; day: number; addedPoints: number; remaining: number }[];
  todayIndex: number | null;
  /** "Are we on pace?" — actual remaining at or under the ideal line today. */
  onPace: boolean;
  /** Projected finish working-day index from the average burn so far, or null if no burn yet. */
  projectedFinishDay: number | null;
  daysLeft: number;
}

/**
 * Burndown over working days: ideal line from committed scope to zero (dashed), actual line from
 * daily snapshots (solid), scope changes flagged. One chart, one message: are we on pace?
 */
export const computeBurndown = (
  sprint: { startDate: Date; endDate: Date; committedPoints: number },
  snapshots: readonly BurndownSnapshot[],
  today: Date,
): Burndown => {
  const days = workingDaysBetween(sprint.startDate, sprint.endDate);
  const totalDays = Math.max(1, days.length - 1);
  const indexOf = (d: Date) => {
    const i = days.findIndex((x) => diffInDays(x, d) === 0);
    if (i >= 0) return i;
    // Weekend snapshot → the previous working day.
    return days.filter((x) => x.getTime() <= startOfDay(d).getTime()).length - 1;
  };
  const committed = sprint.committedPoints;
  const ideal = days.map((d, i) => ({ date: toDateOnly(d), day: i, remaining: Math.round((committed * (totalDays - i)) / totalDays * 10) / 10 }));

  const sorted = [...snapshots].sort((a, b) => a.date.getTime() - b.date.getTime());
  const byDay = new Map<number, BurndownSnapshot>();
  for (const s of sorted) {
    const i = indexOf(s.date);
    if (i >= 0) byDay.set(i, s);
  }
  const actual = [...byDay.entries()].sort((a, b) => a[0] - b[0]).map(([day, s]) => ({ date: toDateOnly(days[day]!), day, remaining: s.remainingPoints }));

  const scopeChanges: Burndown['scopeChanges'] = [];
  let prevScope: number | null = null;
  for (const [day, s] of [...byDay.entries()].sort((a, b) => a[0] - b[0])) {
    if (prevScope !== null && s.scopePoints > prevScope)
      scopeChanges.push({ date: toDateOnly(days[day]!), day, addedPoints: s.scopePoints - prevScope, remaining: s.remainingPoints });
    prevScope = s.scopePoints;
  }

  const t = startOfDay(today);
  const inSprint = t.getTime() >= days[0]!.getTime() && t.getTime() <= days[days.length - 1]!.getTime();
  const todayIndex = inSprint ? Math.max(0, indexOf(t)) : t.getTime() > days[days.length - 1]!.getTime() ? days.length - 1 : null;
  const last = actual[actual.length - 1];
  const idealAtLast = last ? ideal[last.day]?.remaining ?? 0 : committed;
  const onPace = !last || last.remaining <= idealAtLast + 0.5;
  const burned = last && actual[0] ? actual[0].remaining - last.remaining : 0;
  const projectedFinishDay = last && burned > 0 && last.day > 0 ? Math.ceil(last.day + last.remaining / (burned / last.day)) : null;
  const daysLeft = todayIndex === null ? (t.getTime() < days[0]!.getTime() ? days.length : 0) : Math.max(0, days.length - 1 - todayIndex);

  return { totalDays, ideal, actual, scopeChanges, todayIndex, onPace, projectedFinishDay, daysLeft };
};

/** Average completed points over the last `window` completed sprints. */
export const averageVelocity = (completedPoints: readonly number[], window = 3): number => {
  const recent = completedPoints.slice(-window);
  return recent.length ? Math.round(recent.reduce((a, b) => a + b, 0) / recent.length) : 0;
};

export type CapacityLevel = 'ok' | 'near' | 'over';

/** Warns when committed points exceed the team's average velocity (error prevention). */
export const sprintCapacity = (committedPoints: number, velocity: number): { level: CapacityLevel; ratio: number; message: string } => {
  if (velocity <= 0) return { level: 'ok', ratio: 0, message: 'No velocity yet — this is the team’s first sprint.' };
  const ratio = committedPoints / velocity;
  if (ratio > 1)
    return { level: 'over', ratio, message: `${committedPoints} points committed vs. ${velocity} average velocity — consider moving ${committedPoints - velocity} points back to the backlog.` };
  if (ratio > 0.9) return { level: 'near', ratio, message: `${committedPoints} of ${velocity} points — right at the team’s average.` };
  return { level: 'ok', ratio, message: `${committedPoints} of ${velocity} points — room for ${velocity - committedPoints} more.` };
};
