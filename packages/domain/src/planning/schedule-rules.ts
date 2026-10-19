import { diffInDays } from '../shared/dates';
import type { DependencyEdge } from '../task/dependency-graph';
import type { ScheduleNode } from './critical-path';

export interface ScheduleConflict {
  taskId: string;
  blockerId: string;
  /** How many days the task starts before its blocker finishes. */
  overlapDays: number;
}

/**
 * A task that starts before its blocker ends gets a warning badge — not a blocked action
 * (error prevention without taking control away).
 */
export const findScheduleConflicts = (
  nodes: readonly ScheduleNode[],
  edges: readonly DependencyEdge[],
): ScheduleConflict[] => {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const conflicts: ScheduleConflict[] = [];
  for (const e of edges) {
    const blocker = byId.get(e.blockerId);
    const task = byId.get(e.blockedId);
    if (!blocker || !task || blocker.done) continue;
    // Finish-to-start: the task may start the day after the blocker ends (milestones: same day).
    const earliest = blocker.kind === 'milestone' ? 0 : 1;
    const gap = diffInDays(blocker.end, task.start);
    if (gap < earliest)
      conflicts.push({ taskId: task.id, blockerId: blocker.id, overlapDays: earliest - gap });
  }
  return conflicts;
};

/**
 * When a bar is dragged on the timeline, dependents that would now start too early are pushed
 * forward by the minimum needed (never pulled back). Returns day shifts per dependent id.
 */
export const planDependentShifts = (
  nodes: readonly ScheduleNode[],
  edges: readonly DependencyEdge[],
  movedId: string,
): Record<string, number> => {
  const working = new Map(nodes.map((n) => [n.id, { ...n }]));
  const shifts: Record<string, number> = {};
  const queue = [movedId];
  const guard = new Set<string>();
  while (queue.length) {
    const id = queue.shift()!;
    const blocker = working.get(id);
    if (!blocker) continue;
    for (const e of edges.filter((x) => x.blockerId === id)) {
      const dep = working.get(e.blockedId);
      if (!dep || dep.done) continue;
      const earliest = blocker.kind === 'milestone' ? 0 : 1;
      const gap = diffInDays(blocker.end, dep.start);
      if (gap >= earliest) continue;
      const push = earliest - gap;
      dep.start = new Date(dep.start.getTime() + push * 86_400_000);
      dep.end = new Date(dep.end.getTime() + push * 86_400_000);
      shifts[dep.id] = (shifts[dep.id] ?? 0) + push;
      const visitKey = `${dep.id}:${shifts[dep.id]}`;
      if (!guard.has(visitKey)) {
        guard.add(visitKey);
        queue.push(dep.id);
      }
    }
  }
  return shifts;
};
