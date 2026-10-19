import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Optional } from '@nestjs/common';
import {
  parseDateOnly,
  positionsAfter,
  Task,
  TASK_REPOSITORY,
  type Actor,
  type Clock,
  type Priority,
  type TaskRepository,
  type TaskStatus,
} from '@hearth/domain';
import { CLOCK } from '../../../shared/clock/clock';
import { AccessService } from '../../../shared/access/access.service';
import { DomainEventPublisher } from '../../../shared/events/domain-event.publisher';
import { TASK_DIRECTORY, TASK_RELATIONS, type TaskDirectory, type TaskRelations } from './ports';
import { assertReferencesExist } from './task-support';
import { updateParentProgress } from './progress-rollup';

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

/** Optional injectable id source, so tests can predict ids. Defaults to random UUIDs. */
export const TASK_ID_FACTORY = Symbol('TaskIdFactory');
export type TaskIdFactory = () => string;

/**
 * The one way a task comes into existence (used by "create" and "quick add"): checks access
 * and references, reserves the number, appends it to its column, tags it, and makes the
 * creator and assignee followers. Returns the saved aggregate after publishing its events.
 */
@Injectable()
export class TaskCreationService {
  private readonly newId: TaskIdFactory;

  constructor(
    @Inject(TASK_REPOSITORY) private readonly tasks: TaskRepository,
    @Inject(TASK_DIRECTORY) private readonly directory: TaskDirectory,
    @Inject(TASK_RELATIONS) private readonly relations: TaskRelations,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly access: AccessService,
    private readonly publisher: DomainEventPublisher,
    @Optional() @Inject(TASK_ID_FACTORY) idFactory?: TaskIdFactory | null,
  ) {
    this.newId = idFactory ?? randomUUID;
  }

  async create(actor: Actor, input: NewTask): Promise<Task> {
    // Subtasks live in their parent's project unless told otherwise.
    let projectId = input.projectId ?? null;
    if (input.parentId && input.projectId === undefined) {
      const parentProject = await this.directory.projectOfTask(actor.workspaceId, input.parentId);
      if (parentProject !== undefined) projectId = parentProject;
    }
    this.access.assert(actor, 'tasks.create', { projectId });
    await assertReferencesExist(this.directory, actor, {
      projectId,
      sectionId: input.sectionId,
      parentId: input.parentId,
      sprintId: input.sprintId,
      assigneeId: input.assigneeId,
      tagIds: input.tagIds,
    });

    const now = this.clock.now();
    const { number, keyPrefix } = await this.tasks.nextNumber(actor.workspaceId);
    const task = Task.create(
      {
        id: this.newId(),
        workspaceId: actor.workspaceId,
        keyPrefix,
        number,
        creatorId: actor.userId,
        title: input.title,
        description: input.description?.trim() ? input.description : null,
        projectId,
        sectionId: input.sectionId ?? null,
        parentId: input.parentId ?? null,
        sprintId: input.sprintId ?? null,
        status: input.status,
        priority: input.priority,
        assigneeId: input.assigneeId ?? null,
        startDate: toDate(input.startDate),
        dueDate: toDate(input.dueDate),
        estimatePoints: input.estimatePoints ?? null,
        estimateHours: input.estimateHours ?? null,
      },
      now,
    );
    await this.tasks.save(task);

    const snapshot = task.toSnapshot();
    const last = await this.relations.lastPositions(actor.workspaceId, {
      projectId,
      status: snapshot.status,
      parentId: snapshot.parentId,
    });
    await this.relations.setOrdering(task.id, {
      boardPosition: positionsAfter(last.board, 1)[0]!,
      listPosition: positionsAfter(last.list, 1)[0]!,
    });
    if (input.tagIds?.length) await this.relations.replaceTags(task.id, input.tagIds);
    await this.relations.follow(task.id, [
      actor.userId,
      ...(snapshot.assigneeId ? [snapshot.assigneeId] : []),
    ]);

    const parent = await updateParentProgress(
      { tasks: this.tasks, relations: this.relations },
      actor,
      snapshot.parentId,
      now,
    );
    this.publisher.publishFrom(task, ...(parent ? [parent] : []));
    return task;
  }
}

const toDate = (v: string | Date | null | undefined): Date | null =>
  v == null ? null : v instanceof Date ? v : parseDateOnly(v);
