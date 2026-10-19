import type { DependencyEdge, ScheduleNode } from '@hearth/domain';

/** A schedulable item on a project's timeline, as the write side needs it. */
export interface ScheduleItem extends ScheduleNode {
  kind: 'task' | 'milestone';
  /** Task key ("HRT-188") or milestone name. */
  label: string;
  projectId: string | null;
  /** Actual stored dates (a task may have only one of them). */
  startDate: Date | null;
  dueDate: Date | null;
}

export interface ProjectSchedule {
  projectId: string | null;
  items: ScheduleItem[];
  edges: DependencyEdge[];
}

/** Read port: the schedule graph around a task (its project's tasks, milestones and links). */
export interface ScheduleReader {
  scheduleForTask(
    workspaceId: string,
    taskId: string,
  ): Promise<{ task: ScheduleItem; schedule: ProjectSchedule } | null>;
  /** Current dates for explicit items (Undo). Unknown ids are omitted. */
  itemsByIds(
    workspaceId: string,
    refs: { kind: 'task' | 'milestone'; id: string }[],
  ): Promise<ScheduleItem[]>;
}
export const SCHEDULE_READER = Symbol('ScheduleReader');

export interface ScheduleUpdate {
  kind: 'task' | 'milestone';
  id: string;
  startDate: Date | null;
  dueDate: Date | null;
}

/**
 * Write port: applies date changes to Task/Milestone rows in ONE transaction. The Tasks context
 * owns the Task aggregate and is built separately, so the timeline writes dates through this
 * narrow adapter and publishes the same `task.rescheduled` events the aggregate would.
 */
export interface ScheduleWriter {
  apply(updates: ScheduleUpdate[]): Promise<void>;
}
export const SCHEDULE_WRITER = Symbol('ScheduleWriter');
