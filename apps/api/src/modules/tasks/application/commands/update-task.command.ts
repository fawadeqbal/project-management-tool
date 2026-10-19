import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { TaskDetailDto, UpdateTaskInput } from '@hearth/contracts';
import { parseDateOnly, TASK_REPOSITORY, type Actor, type Clock, type DomainEvent, type TaskRepository } from '@hearth/domain';
import { CLOCK } from '../../../../shared/clock/clock';
import { AccessService } from '../../../../shared/access/access.service';
import { DomainEventPublisher } from '../../../../shared/events/domain-event.publisher';
import { TaskReadModel } from '../../infrastructure/task.read-model';
import { TASK_DIRECTORY, TASK_RELATIONS, type TaskDirectory, type TaskRelations } from '../ports';
import { assertReferencesExist, loadTask, taskUpdatedEvent } from '../task-support';
import { updateParentProgress } from '../progress-rollup';

export class UpdateTaskCommand {
  constructor(
    readonly actor: Actor,
    readonly taskId: string,
    readonly input: UpdateTaskInput,
  ) {}
}

/** Inline edits from the side panel, list cells and board cards — each field via its aggregate method. */
@CommandHandler(UpdateTaskCommand)
export class UpdateTaskHandler implements ICommandHandler<UpdateTaskCommand, TaskDetailDto> {
  constructor(
    @Inject(TASK_REPOSITORY) private readonly tasks: TaskRepository,
    @Inject(TASK_DIRECTORY) private readonly directory: TaskDirectory,
    @Inject(TASK_RELATIONS) private readonly relations: TaskRelations,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly access: AccessService,
    private readonly publisher: DomainEventPublisher,
    private readonly read: TaskReadModel,
  ) {}

  async execute({ actor, taskId, input }: UpdateTaskCommand): Promise<TaskDetailDto> {
    const task = await loadTask(this.tasks, actor, taskId);
    const before = task.toSnapshot();
    this.access.assert(actor, 'tasks.edit', { projectId: before.projectId });
    if (input.projectId !== undefined && input.projectId !== before.projectId) this.access.assert(actor, 'tasks.edit', { projectId: input.projectId });
    await assertReferencesExist(this.directory, actor, {
      projectId: input.projectId,
      sectionId: input.sectionId,
      sprintId: input.sprintId,
      assigneeId: input.assigneeId,
      tagIds: input.tagIds,
    });

    const now = this.clock.now();
    const by = actor.userId;
    if (input.title !== undefined) task.rename(input.title, by, now);
    if (input.description !== undefined) task.describe(input.description, by, now);
    if (input.priority !== undefined) task.prioritize(input.priority, by, now);
    if (input.assigneeId !== undefined) task.assignTo(input.assigneeId, by, now);
    if (input.status !== undefined) task.changeStatus(input.status, by, now);

    if (input.startDate !== undefined || input.dueDate !== undefined) {
      const current = task.toSnapshot();
      const start = input.startDate !== undefined ? (input.startDate ? parseDateOnly(input.startDate) : null) : current.startDate;
      const due = input.dueDate !== undefined ? (input.dueDate ? parseDateOnly(input.dueDate) : null) : current.dueDate;
      task.reschedule(start, due, by, now);
    }

    if (input.estimatePoints !== undefined || input.estimateHours !== undefined) {
      const points = input.estimatePoints !== undefined ? input.estimatePoints : before.estimatePoints;
      const hours = input.estimateHours !== undefined ? input.estimateHours : before.estimateHours;
      if (points !== before.estimatePoints || hours !== before.estimateHours) task.estimate(points, hours, by, now);
    }

    if (input.progress !== undefined && input.progress !== task.toSnapshot().progress) task.setProgress(input.progress, by, now);

    const location = {
      ...(input.projectId !== undefined && input.projectId !== before.projectId ? { projectId: input.projectId } : {}),
      ...(input.sectionId !== undefined && input.sectionId !== before.sectionId ? { sectionId: input.sectionId } : {}),
      ...(input.sprintId !== undefined && input.sprintId !== before.sprintId ? { sprintId: input.sprintId } : {}),
    };
    if (Object.keys(location).length) task.moveTo(location, by, now);

    await this.tasks.save(task);

    const extraFields: string[] = [];
    if (input.tagIds !== undefined) {
      await this.relations.replaceTags(task.id, input.tagIds);
      extraFields.push('tags');
    }
    if (input.epic !== undefined) {
      await this.relations.setEpic(task.id, input.epic);
      extraFields.push('epic');
    }
    const after = task.toSnapshot();
    if (after.assigneeId && after.assigneeId !== before.assigneeId) await this.relations.follow(task.id, [after.assigneeId]);

    const events: DomainEvent[] = [];
    if (extraFields.length) events.push(taskUpdatedEvent(task, extraFields, by, now));
    const statusChanged = after.status !== before.status;
    const parent = statusChanged ? await updateParentProgress({ tasks: this.tasks, relations: this.relations }, actor, after.parentId, now) : null;

    this.publisher.publishFrom(task);
    if (events.length) this.publisher.publish(...events);
    if (parent) this.publisher.publishFrom(parent);
    return this.read.detail(actor, task.id);
  }
}
