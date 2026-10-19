import { AggregateRoot } from '../shared/entity';
import { createEvent } from '../shared/domain-event';
import { ConflictError, InvariantViolation, ValidationError } from '../shared/errors';
import { Guard } from '../shared/guard';
import { startOfDay } from '../shared/dates';

export const SPRINT_STATUSES = ['PLANNED', 'ACTIVE', 'COMPLETED'] as const;
export type SprintStatus = (typeof SPRINT_STATUSES)[number];

export interface SprintProps {
  projectId: string;
  workspaceId: string;
  number: number;
  name: string;
  goal: string | null;
  startDate: Date;
  endDate: Date;
  status: SprintStatus;
  committedPoints: number;
  completedAt: Date | null;
}

/**
 * Sprint aggregate: PLANNED → ACTIVE → COMPLETED. Only one active sprint per project
 * (checked by the application layer against the repository, passed in as `hasActiveSprint`).
 */
export class Sprint extends AggregateRoot<SprintProps> {
  private constructor(id: string, props: SprintProps) {
    super(id, props);
  }

  static plan(
    input: { id: string; projectId: string; workspaceId: string; number: number; name?: string; goal?: string | null; startDate: Date; endDate: Date },
    actorId: string,
    now: Date,
  ): Sprint {
    const start = startOfDay(input.startDate);
    const end = startOfDay(input.endDate);
    if (end.getTime() < start.getTime()) throw new ValidationError('sprint.dates', 'A sprint has to end on or after the day it starts.');
    const sprint = new Sprint(input.id, {
      projectId: input.projectId,
      workspaceId: input.workspaceId,
      number: input.number,
      name: input.name?.trim() || `Sprint ${input.number}`,
      goal: input.goal?.trim() || null,
      startDate: start,
      endDate: end,
      status: 'PLANNED',
      committedPoints: 0,
      completedAt: null,
    });
    sprint.record(createEvent('sprint.planned', sprint.base(actorId, now), { number: input.number, projectId: input.projectId }));
    return sprint;
  }

  static restore(id: string, props: SprintProps): Sprint {
    return new Sprint(id, { ...props });
  }

  get status() {
    return this.props.status;
  }
  get projectId() {
    return this.props.projectId;
  }
  toSnapshot(): Readonly<SprintProps & { id: string }> {
    return { ...this.props, id: this.id };
  }

  updateDetails(details: { name?: string; goal?: string | null; startDate?: Date; endDate?: Date }, actorId: string, now: Date): void {
    if (this.props.status === 'COMPLETED') throw new InvariantViolation('sprint.completed', 'This sprint is complete — start a new one to keep planning.');
    if (details.name !== undefined) this.props.name = Guard.notBlank(details.name, 'name');
    if (details.goal !== undefined) this.props.goal = details.goal?.trim() || null;
    const start = details.startDate ? startOfDay(details.startDate) : this.props.startDate;
    const end = details.endDate ? startOfDay(details.endDate) : this.props.endDate;
    if (end.getTime() < start.getTime()) throw new ValidationError('sprint.dates', 'A sprint has to end on or after the day it starts.');
    this.props.startDate = start;
    this.props.endDate = end;
    this.record(createEvent('sprint.updated', this.base(actorId, now), {}));
  }

  start(committedPoints: number, hasActiveSprint: boolean, actorId: string, now: Date): void {
    if (this.props.status !== 'PLANNED') throw new InvariantViolation('sprint.not_planned', 'Only a planned sprint can be started.');
    if (hasActiveSprint) throw new ConflictError('sprint.already_active', 'Another sprint is already running in this project. Complete it first.');
    this.props.status = 'ACTIVE';
    this.props.committedPoints = committedPoints;
    this.record(createEvent('sprint.started', this.base(actorId, now), { committedPoints }));
  }

  /** Completes the sprint; unfinished work is moved by the application layer (to backlog or next sprint). */
  complete(summary: { completedPoints: number; unfinishedTaskIds: string[]; moveTo: 'backlog' | 'next' }, actorId: string, now: Date): void {
    if (this.props.status !== 'ACTIVE') throw new InvariantViolation('sprint.not_active', 'Only the active sprint can be completed.');
    this.props.status = 'COMPLETED';
    this.props.completedAt = now;
    this.record(createEvent('sprint.completed', this.base(actorId, now), summary));
  }

  private base(actorId: string, now: Date) {
    return { workspaceId: this.props.workspaceId, actorId, aggregateId: this.id, occurredAt: now };
  }
}

export interface SprintRepository {
  findById(workspaceId: string, id: string): Promise<Sprint | null>;
  findActive(projectId: string): Promise<Sprint | null>;
  nextNumber(projectId: string): Promise<number>;
  save(sprint: Sprint): Promise<void>;
}

export const SPRINT_REPOSITORY = Symbol('SprintRepository');
