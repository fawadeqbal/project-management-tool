import type { SprintSummaryDto, SprintTaskDto } from '@hearth/contracts';
import { sprintSnapshotOf, toDateOnly, type Sprint } from '@hearth/domain';

/** A task's sprint-planning facts (write side). */
export interface SprintTaskFacts {
  id: string;
  projectId: string | null;
  sprintId: string | null;
  points: number | null;
  status: SprintTaskDto['status'];
  backlogRank: number | null;
}

/**
 * Port: task membership in sprints and the backlog order. Sprint membership and backlog rank are
 * planning data owned by this context, even though they live on the task row.
 */
export interface SprintTaskStore {
  findTask(workspaceId: string, taskId: string): Promise<SprintTaskFacts | null>;
  /** Tasks in a sprint, shaped for planning screens (key, assignee, points). */
  itemsInSprint(sprintId: string): Promise<SprintTaskDto[]>;
  moveToSprint(taskIds: readonly string[], sprintId: string): Promise<void>;
  /** Takes tasks out of their sprint and gives each a backlog rank. */
  moveToBacklog(entries: readonly { taskId: string; rank: number }[]): Promise<void>;
  /** Best (lowest) rank in the project backlog, or null when it's empty. */
  topBacklogRank(projectId: string): Promise<number | null>;
  setBacklogRank(taskId: string, rank: number): Promise<void>;
}
export const SPRINT_TASK_STORE = Symbol('SprintTaskStore');

/** Port: daily burndown snapshots. */
export interface SprintSnapshotStore {
  /** Active sprints of a project (normally zero or one). */
  activeSprintIds(projectId: string): Promise<string[]>;
  statusOf(sprintId: string): Promise<'PLANNED' | 'ACTIVE' | 'COMPLETED' | null>;
  upsert(sprintId: string, date: Date, remainingPoints: number, scopePoints: number): Promise<void>;
}
export const SPRINT_SNAPSHOT_STORE = Symbol('SprintSnapshotStore');

/** Maps the aggregate + its tasks to the summary DTO used across sprint screens. */
export const toSprintSummary = (
  sprint: Sprint,
  items: readonly Pick<SprintTaskDto, 'status' | 'points'>[],
  completedPoints?: number,
): SprintSummaryDto => {
  const s = sprint.toSnapshot();
  const { remainingPoints, scopePoints } = sprintSnapshotOf(items);
  return {
    id: s.id,
    projectId: s.projectId,
    number: s.number,
    name: s.name,
    goal: s.goal,
    status: s.status,
    startDate: toDateOnly(s.startDate),
    endDate: toDateOnly(s.endDate),
    committedPoints: s.committedPoints,
    completedPoints: completedPoints ?? scopePoints - remainingPoints,
    scopePoints,
    taskCount: items.length,
    completedAt: s.completedAt ? s.completedAt.toISOString() : null,
  };
};
