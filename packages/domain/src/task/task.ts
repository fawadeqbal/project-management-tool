import { AggregateRoot } from '../shared/entity';
import { createEvent } from '../shared/domain-event';
import { InvariantViolation, ValidationError } from '../shared/errors';
import { Guard } from '../shared/guard';
import { diffInDays, startOfDay, toDateOnly } from '../shared/dates';
import { taskStatusState, type TaskStatusContext } from './task-status-state';
import { TaskKey, type Priority, type TaskStatus } from './values';

export interface TaskProps {
  workspaceId: string;
  keyPrefix: string;
  number: number;
  projectId: string | null;
  sectionId: string | null;
  parentId: string | null;
  sprintId: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: Priority;
  assigneeId: string | null;
  creatorId: string;
  startDate: Date | null;
  dueDate: Date | null;
  estimatePoints: number | null;
  estimateHours: number | null;
  progress: number;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTaskInput {
  id: string;
  workspaceId: string;
  keyPrefix: string;
  number: number;
  creatorId: string;
  title: string;
  description?: string | null;
  projectId?: string | null;
  sectionId?: string | null;
  parentId?: string | null;
  sprintId?: string | null;
  status?: TaskStatus;
  priority?: Priority;
  assigneeId?: string | null;
  startDate?: Date | null;
  dueDate?: Date | null;
  estimatePoints?: number | null;
  estimateHours?: number | null;
}

const TITLE_MAX = 500;

/**
 * Task aggregate. All state changes go through intention-revealing methods that enforce
 * invariants and record domain events; persistence is someone else's job (repositories).
 */
export class Task extends AggregateRoot<TaskProps> {
  private constructor(id: string, props: TaskProps) {
    super(id, props);
  }

  /** Factory for brand-new tasks — validates input and records `task.created`. */
  static create(input: CreateTaskInput, now: Date): Task {
    const title = Guard.maxLength(Guard.notBlank(input.title, 'title'), TITLE_MAX, 'title');
    const task = new Task(input.id, {
      workspaceId: input.workspaceId,
      keyPrefix: input.keyPrefix,
      number: input.number,
      projectId: input.projectId ?? null,
      sectionId: input.sectionId ?? null,
      parentId: input.parentId ?? null,
      sprintId: input.sprintId ?? null,
      title,
      description: input.description ?? null,
      status: 'TODO',
      priority: input.priority ?? 'NONE',
      assigneeId: input.assigneeId ?? null,
      creatorId: input.creatorId,
      startDate: input.startDate ? startOfDay(input.startDate) : null,
      dueDate: input.dueDate ? startOfDay(input.dueDate) : null,
      estimatePoints: null,
      estimateHours: null,
      progress: 0,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    });
    Task.assertSchedule(task.props.startDate, task.props.dueDate);
    if (input.estimatePoints != null || input.estimateHours != null)
      task.applyEstimate(input.estimatePoints ?? null, input.estimateHours ?? null);
    if (input.status && input.status !== 'TODO') task.applyStatus(input.status, now);
    task.record(
      createEvent('task.created', task.eventBase(input.creatorId, now), {
        key: task.key.toString(),
        title,
        projectId: task.props.projectId,
        assigneeId: task.props.assigneeId,
      }),
    );
    return task;
  }

  /** Rehydrates a persisted task without recording events (used by repositories). */
  static restore(id: string, props: TaskProps): Task {
    return new Task(id, { ...props });
  }

  // ── Queries ───────────────────────────────────────────────

  get key(): TaskKey {
    return TaskKey.of(this.props.keyPrefix, this.props.number);
  }
  get workspaceId() {
    return this.props.workspaceId;
  }
  get projectId() {
    return this.props.projectId;
  }
  get title() {
    return this.props.title;
  }
  get status() {
    return this.props.status;
  }
  get priority() {
    return this.props.priority;
  }
  get assigneeId() {
    return this.props.assigneeId;
  }
  get dueDate() {
    return this.props.dueDate;
  }
  get startDate() {
    return this.props.startDate;
  }
  get isDone(): boolean {
    return this.props.status === 'DONE';
  }

  isOverdue(today: Date): boolean {
    return !this.isDone && !!this.props.dueDate && diffInDays(today, this.props.dueDate) < 0;
  }

  /** A defensive copy for mappers and read models. */
  toSnapshot(): Readonly<TaskProps & { id: string; key: string }> {
    return { ...this.props, id: this.id, key: this.key.toString() };
  }

  // ── Commands ──────────────────────────────────────────────

  rename(title: string, actorId: string, now: Date): void {
    const next = Guard.maxLength(Guard.notBlank(title, 'title'), TITLE_MAX, 'title');
    if (next === this.props.title) return;
    const from = this.props.title;
    this.props.title = next;
    this.touch(now);
    this.record(
      createEvent('task.renamed', this.eventBase(actorId, now), {
        key: this.key.toString(),
        from,
        to: next,
        projectId: this.props.projectId,
      }),
    );
  }

  describe(description: string | null, actorId: string, now: Date): void {
    const next = description?.trim() ? description : null;
    if (next === this.props.description) return;
    this.props.description = next;
    this.touch(now);
    this.record(
      createEvent('task.updated', this.eventBase(actorId, now), {
        key: this.key.toString(),
        fields: ['description'],
        projectId: this.props.projectId,
      }),
    );
  }

  changeStatus(next: TaskStatus, actorId: string, now: Date): void {
    if (next === this.props.status) return;
    const from = this.props.status;
    this.applyStatus(next, now);
    this.record(
      createEvent('task.status_changed', this.eventBase(actorId, now), {
        key: this.key.toString(),
        title: this.props.title,
        from,
        to: next,
        projectId: this.props.projectId,
      }),
    );
  }

  complete(actorId: string, now: Date): void {
    this.changeStatus('DONE', actorId, now);
  }

  reopen(actorId: string, now: Date): void {
    if (this.isDone) this.changeStatus('TODO', actorId, now);
  }

  assignTo(assigneeId: string | null, actorId: string, now: Date): void {
    if (assigneeId === this.props.assigneeId) return;
    const from = this.props.assigneeId;
    this.props.assigneeId = assigneeId;
    this.touch(now);
    this.record(
      createEvent('task.assigned', this.eventBase(actorId, now), {
        key: this.key.toString(),
        title: this.props.title,
        from,
        to: assigneeId,
        projectId: this.props.projectId,
      }),
    );
  }

  reschedule(startDate: Date | null, dueDate: Date | null, actorId: string, now: Date): void {
    const s = startDate ? startOfDay(startDate) : null;
    const d = dueDate ? startOfDay(dueDate) : null;
    Task.assertSchedule(s, d);
    if (sameDate(s, this.props.startDate) && sameDate(d, this.props.dueDate)) return;
    this.props.startDate = s;
    this.props.dueDate = d;
    this.touch(now);
    this.record(
      createEvent('task.rescheduled', this.eventBase(actorId, now), {
        key: this.key.toString(),
        startDate: s ? toDateOnly(s) : null,
        dueDate: d ? toDateOnly(d) : null,
        projectId: this.props.projectId,
      }),
    );
  }

  /** Shifts both dates by `days` — used when a blocker moves on the timeline. */
  shiftSchedule(days: number, actorId: string, now: Date): void {
    if (days === 0) return;
    const shift = (d: Date | null) => (d ? new Date(d.getTime() + days * 86_400_000) : null);
    this.reschedule(shift(this.props.startDate), shift(this.props.dueDate), actorId, now);
  }

  prioritize(priority: Priority, actorId: string, now: Date): void {
    if (priority === this.props.priority) return;
    const from = this.props.priority;
    this.props.priority = priority;
    this.touch(now);
    this.record(
      createEvent('task.priority_changed', this.eventBase(actorId, now), {
        key: this.key.toString(),
        from,
        to: priority,
        projectId: this.props.projectId,
      }),
    );
  }

  estimate(points: number | null, hours: number | null, actorId: string, now: Date): void {
    this.applyEstimate(points, hours);
    this.touch(now);
    this.record(
      createEvent('task.updated', this.eventBase(actorId, now), {
        key: this.key.toString(),
        fields: ['estimate'],
        projectId: this.props.projectId,
      }),
    );
  }

  setProgress(progress: number, actorId: string, now: Date): void {
    this.props.progress = Math.round(Guard.inRange(progress, 0, 100, 'progress'));
    this.touch(now);
    this.record(
      createEvent('task.updated', this.eventBase(actorId, now), {
        key: this.key.toString(),
        fields: ['progress'],
        projectId: this.props.projectId,
      }),
    );
  }

  moveTo(
    location: { projectId?: string | null; sectionId?: string | null; sprintId?: string | null },
    actorId: string,
    now: Date,
  ): void {
    const fromProjectId = this.props.projectId;
    if (location.projectId !== undefined) this.props.projectId = location.projectId;
    if (location.sectionId !== undefined) this.props.sectionId = location.sectionId;
    if (location.sprintId !== undefined) this.props.sprintId = location.sprintId;
    if (location.projectId !== undefined && location.projectId !== fromProjectId) {
      // Sections and sprints belong to a project; they can't follow the task elsewhere.
      if (location.sectionId === undefined) this.props.sectionId = null;
      if (location.sprintId === undefined) this.props.sprintId = null;
    }
    this.touch(now);
    this.record(
      createEvent('task.moved', this.eventBase(actorId, now), {
        key: this.key.toString(),
        fromProjectId,
        toProjectId: this.props.projectId,
      }),
    );
  }

  markDeleted(actorId: string, now: Date): void {
    this.record(
      createEvent('task.deleted', this.eventBase(actorId, now), {
        key: this.key.toString(),
        title: this.props.title,
        projectId: this.props.projectId,
      }),
    );
  }

  // ── Internals ─────────────────────────────────────────────

  private applyStatus(next: TaskStatus, now: Date): void {
    const current = taskStatusState(this.props.status);
    if (!current.canTransitionTo(next))
      throw new InvariantViolation(
        'task.status.transition',
        `A task can’t move from ${this.props.status} to ${next}.`,
      );
    const ctx: TaskStatusContext = {
      completedAt: this.props.completedAt,
      startDate: this.props.startDate,
      progress: this.props.progress,
    };
    current.onExit(ctx, now);
    taskStatusState(next).onEnter(ctx, now);
    this.props.status = next;
    this.props.completedAt = ctx.completedAt;
    this.props.startDate = ctx.startDate ? startOfDay(ctx.startDate) : null;
    this.props.progress = ctx.progress;
    this.touch(now);
  }

  private applyEstimate(points: number | null, hours: number | null): void {
    if (points != null) Guard.inRange(points, 0, 100, 'estimate');
    if (hours != null) Guard.inRange(hours, 0, 1000, 'hours');
    this.props.estimatePoints = points;
    this.props.estimateHours = hours;
  }

  private static assertSchedule(start: Date | null, due: Date | null): void {
    if (start && due && start.getTime() > due.getTime())
      throw new ValidationError(
        'task.schedule.order',
        'The start date is after the due date — pick a start on or before the due date.',
      );
  }

  private touch(now: Date): void {
    this.props.updatedAt = now;
  }

  private eventBase(actorId: string, now: Date) {
    return { workspaceId: this.props.workspaceId, actorId, aggregateId: this.id, occurredAt: now };
  }
}

const sameDate = (a: Date | null, b: Date | null) =>
  a === null ? b === null : b !== null && a.getTime() === b.getTime();
