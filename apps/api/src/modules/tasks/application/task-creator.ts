import type { Actor, Priority, TaskStatus } from '@hearth/domain';

/** Everything a new task may start with. */
export interface NewTask {
  title: string;
  description?: string | null;
  projectId?: string | null;
  sectionId?: string | null;
  parentId?: string | null;
  sprintId?: string | null;
  assigneeId?: string | null;
  status?: TaskStatus;
  priority?: Priority;
  startDate?: string | Date | null;
  dueDate?: string | Date | null;
  estimatePoints?: number | null;
  estimateHours?: number | null;
  tagIds?: readonly string[];
}

export interface CreatedTask {
  id: string;
  key: string;
  number: number;
  title: string;
  projectId: string | null;
  assigneeId: string | null;
}

/**
 * Port: the one way a task comes into existence, exported by the Tasks module for other contexts
 * (AI breakdowns, onboarding templates). It enforces access and project scope, reference and
 * assignment rules, `Task.create` invariants, column ordering, following, sprint membership and
 * the `task.created` event — inside the caller's unit of work when there is one.
 */
export interface TaskCreator {
  create(actor: Actor, input: NewTask): Promise<CreatedTask>;
}

export const TASK_CREATOR = Symbol('TaskCreator');
