import { diffInDays } from '../shared/dates';

export const PROJECT_HEALTH = ['ON_TRACK', 'AT_RISK', 'OFF_TRACK'] as const;
export type ProjectHealth = (typeof PROJECT_HEALTH)[number];

/** Health is always shown as icon + label + color (WCAG 1.4.1). */
export const HEALTH_META: Record<ProjectHealth, { label: string; icon: string; tone: 'success' | 'warning' | 'danger' }> = {
  ON_TRACK: { label: 'On track', icon: 'status-done', tone: 'success' },
  AT_RISK: { label: 'At risk', icon: 'alert', tone: 'warning' },
  OFF_TRACK: { label: 'Off track', icon: 'status-blocked', tone: 'danger' },
};

export interface ProjectProgressInput {
  totalTasks: number;
  doneTasks: number;
  overdueTasks: number;
  blockedTasks: number;
  startDate: Date | null;
  dueDate: Date | null;
}

export const projectProgress = (i: Pick<ProjectProgressInput, 'totalTasks' | 'doneTasks'>): number =>
  i.totalTasks ? Math.round((i.doneTasks / i.totalTasks) * 100) : 0;

/**
 * Suggested health: compare work done with time elapsed. Behind schedule by >25 points or past
 * due → off track; behind by >10, or overdue/blocked work piling up → at risk. Owners can
 * override; this is the default the dashboard proposes.
 */
export const evaluateHealth = (i: ProjectProgressInput, today: Date): { health: ProjectHealth; reason: string } => {
  const progress = projectProgress(i);
  if (i.dueDate && diffInDays(today, i.dueDate) < 0 && progress < 100)
    return { health: 'OFF_TRACK', reason: 'Past the due date with work still open.' };
  let expected = 0;
  if (i.startDate && i.dueDate) {
    const total = Math.max(1, diffInDays(i.startDate, i.dueDate));
    expected = Math.min(100, Math.max(0, Math.round((diffInDays(i.startDate, today) / total) * 100)));
  }
  const gap = expected - progress;
  if (gap > 25) return { health: 'OFF_TRACK', reason: `${progress}% done with ${expected}% of the time gone.` };
  if (gap > 10 || i.overdueTasks >= 3 || i.blockedTasks >= 2)
    return { health: 'AT_RISK', reason: i.overdueTasks >= 3 ? `${i.overdueTasks} overdue tasks.` : i.blockedTasks >= 2 ? `${i.blockedTasks} blocked tasks.` : `${progress}% done with ${expected}% of the time gone.` };
  return { health: 'ON_TRACK', reason: 'Progress is keeping pace with the schedule.' };
};

export type WipLevel = 'ok' | 'near' | 'over';

/** "3 / 4 WIP" turns amber near the column limit and warns before it is exceeded. */
export const wipLevel = (count: number, limit: number | null | undefined): WipLevel => {
  if (!limit) return 'ok';
  if (count > limit) return 'over';
  if (count >= limit - 1) return 'near';
  return 'ok';
};
