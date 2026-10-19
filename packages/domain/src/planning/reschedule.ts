import { diffInDays, startOfDay } from '../shared/dates';
import { ValidationError } from '../shared/errors';
import type { DependencyEdge } from '../task/dependency-graph';
import type { ScheduleNode } from './critical-path';
import { planDependentShifts } from './schedule-rules';

export interface ReschedulePlan {
  /** Days the moved node's start moved (negative = earlier). */
  movedDays: number;
  /** Day shifts per dependent id (always forward), empty when `shiftDependents` is false. */
  shifts: Record<string, number>;
}

/**
 * Drag-to-reschedule on the timeline: put the moved node on its new dates, then push forward
 * any dependents (tasks or milestones) that would now start before their blocker finishes.
 */
export const planReschedule = (
  nodes: readonly ScheduleNode[],
  edges: readonly DependencyEdge[],
  movedId: string,
  next: { start: Date; end: Date },
  shiftDependents: boolean,
): ReschedulePlan => {
  const start = startOfDay(next.start);
  const end = startOfDay(next.end);
  if (end.getTime() < start.getTime())
    throw new ValidationError('schedule.dates', 'The due date has to be on or after the start date.', { field: 'dueDate' });
  const moved = nodes.find((n) => n.id === movedId);
  const movedDays = moved ? diffInDays(moved.start, start) : 0;
  if (!shiftDependents) return { movedDays, shifts: {} };
  const working = nodes.map((n) => (n.id === movedId ? { ...n, start, end } : n));
  if (!moved) working.push({ id: movedId, start, end });
  return { movedDays, shifts: planDependentShifts(working, edges, movedId) };
};
