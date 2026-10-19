import type { TaskStatus } from './values';

/**
 * State pattern for task status. Each state owns its entry/exit side effects so the Task
 * aggregate never grows a switch statement (Open/Closed: a new status is a new class).
 */
export interface TaskStatusContext {
  completedAt: Date | null;
  startDate: Date | null;
  progress: number;
}

export abstract class TaskStatusState {
  abstract readonly status: TaskStatus;

  /** Every status may move to every other status — Hearth prefers Undo over blocking rules. */
  canTransitionTo(next: TaskStatus): boolean {
    return next !== this.status;
  }

  onEnter(_ctx: TaskStatusContext, _now: Date): void {}
  onExit(_ctx: TaskStatusContext, _now: Date): void {}
}

class TodoState extends TaskStatusState {
  readonly status = 'TODO' as const;
}

class InProgressState extends TaskStatusState {
  readonly status = 'IN_PROGRESS' as const;
  override onEnter(ctx: TaskStatusContext, now: Date): void {
    // Starting work without a start date records when it actually started (keeps the timeline honest).
    if (!ctx.startDate) ctx.startDate = now;
  }
}

class InReviewState extends TaskStatusState {
  readonly status = 'IN_REVIEW' as const;
}

class BlockedState extends TaskStatusState {
  readonly status = 'BLOCKED' as const;
}

class DoneState extends TaskStatusState {
  readonly status = 'DONE' as const;
  override onEnter(ctx: TaskStatusContext, now: Date): void {
    ctx.completedAt = now;
    ctx.progress = 100;
  }
  override onExit(ctx: TaskStatusContext): void {
    // Reopened work is no longer "100% done"; progress restarts from the subtasks or the owner.
    ctx.completedAt = null;
    ctx.progress = 0;
  }
}

const FACTORIES: Record<TaskStatus, () => TaskStatusState> = {
  TODO: () => new TodoState(),
  IN_PROGRESS: () => new InProgressState(),
  IN_REVIEW: () => new InReviewState(),
  BLOCKED: () => new BlockedState(),
  DONE: () => new DoneState(),
};

export const taskStatusState = (status: TaskStatus): TaskStatusState => FACTORIES[status]();
