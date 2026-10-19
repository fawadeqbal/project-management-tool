import type { LoadStateDto, WorkloadCellDto, WorkloadDto, WorkloadUnitDto } from '@hearth/contracts';
import { classifyLoad } from '@hearth/domain';

const round1 = (n: number) => Math.round(n * 10) / 10;

/** "8h" · "3" · "5 pt" — the number is always in the cell (color is never the only signal). */
export const formatAmount = (n: number, unit: WorkloadUnitDto): string => {
  const v = round1(n);
  if (unit === 'hours') return `${v}h`;
  if (unit === 'points') return `${v} pt`;
  return String(v);
};

export const UNIT_WORDS: Record<WorkloadUnitDto, [string, string]> = { hours: ['hour', 'hours'], tasks: ['task', 'tasks'], points: ['point', 'points'] };
export const unitWord = (n: number, unit: WorkloadUnitDto) => UNIT_WORDS[unit][n === 1 ? 0 : 1];

export const STATE_LABEL: Record<LoadStateDto, string> = {
  off: 'Time off',
  free: 'Free',
  light: 'Under 50%',
  normal: '50–87%',
  full: 'Full',
  over: 'Over capacity',
};

/** Accessible + tooltip text for a cell: "Wed 21: 11 of 8 hours planned — over capacity". */
export const cellTitle = (cell: WorkloadCellDto, unit: WorkloadUnitDto, dayLabel: string): string => {
  if (cell.state === 'off') return `${dayLabel}: time off`;
  const base = `${dayLabel}: ${round1(cell.planned)} of ${cell.capacity} ${unitWord(cell.capacity, unit)} planned`;
  return cell.state === 'over' ? `${base} — over capacity` : base;
};

/** "Mo (Wed–Thu), Sara (Wed–Thu)" */
export const firstName = (name: string) => name.split(' ')[0] ?? name;

/** "Mostly Ravi, Nadia and Fawad" */
export const listNames = (names: string[]): string => {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
};

/**
 * Optimistic reassign inside the cached workload: the task's daily shares move from one row to
 * the other on the same dates (capacity-aware states recomputed with the domain rule). The
 * server's answer replaces this when the query refreshes.
 */
export const reassignInWorkload = (w: WorkloadDto, taskId: string, toUserId: string): WorkloadDto => {
  const fromIndex = w.people.findIndex((p) => p.cells.some((c) => c.taskIds.includes(taskId)));
  const toIndex = w.people.findIndex((p) => p.user.id === toUserId);
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return w;
  const moved = new Map<string, number>();
  for (const c of w.people[fromIndex]!.cells) {
    const share = c.items.find((x) => x.taskId === taskId);
    if (share) moved.set(c.date, share.amount);
  }
  const recompute = (p: WorkloadDto['people'][number], sign: 1 | -1): WorkloadDto['people'][number] => {
    const cells = p.cells.map((c) => {
      const amount = moved.get(c.date);
      if (amount === undefined || (sign === 1 && c.state === 'off')) return c;
      const items = sign === -1 ? c.items.filter((x) => x.taskId !== taskId) : [...c.items, { taskId, amount }];
      const planned = Math.max(0, round1(c.planned + sign * amount));
      return { ...c, items, planned, taskIds: items.map((x) => x.taskId), state: c.capacity > 0 ? classifyLoad(planned, c.capacity) : c.state };
    });
    const plannedTotal = round1(cells.reduce((a, c) => a + c.planned, 0));
    return {
      ...p,
      cells,
      plannedTotal,
      loadPct: p.capacityTotal ? Math.round((plannedTotal / p.capacityTotal) * 100) : 0,
      overDays: cells.filter((c) => c.state === 'over').map((c) => c.date),
    };
  };
  return {
    ...w,
    people: w.people.map((p, i) => (i === fromIndex ? recompute(p, -1) : i === toIndex ? recompute(p, 1) : p)),
    tasks: { ...w.tasks, [taskId]: w.tasks[taskId] ? { ...w.tasks[taskId]!, assigneeId: toUserId } : w.tasks[taskId]! },
  };
};
