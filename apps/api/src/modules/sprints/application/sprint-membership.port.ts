import type { Actor } from '@hearth/domain';

/** A task changing sprint outside the sprint screens (task panel, create dialog). */
export interface SprintChange {
  taskId: string;
  /** The project the task lives in after the change. */
  projectId: string | null;
  points: number | null;
  from: string | null;
  to: string | null;
  /**
   * True when the task leaves its sprint only because it moved to another project: no sprint
   * permission is needed and a completed sprint keeps its record silently.
   */
  implicit?: boolean;
}

/**
 * Port the Sprints module exports so other contexts change a task's sprint through the same rules
 * as POST/DELETE /sprints/:id/tasks: the sprint must be visible and in the task's project, the
 * actor needs `sprints.manage` and the plan's sprints feature, completed sprints are closed, and
 * a task leaving a sprint goes to the top of the backlog. Records `sprint.task_added` /
 * `sprint.task_removed` (published after the caller's unit of work commits) so the burndown sees
 * the scope change.
 */
export interface SprintMembership {
  changeSprint(actor: Actor, change: SprintChange): Promise<void>;
}

export const SPRINT_MEMBERSHIP = Symbol('SprintMembership');
