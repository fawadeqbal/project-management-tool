import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { CommentDto, CreateCommentInput } from '@hearth/contracts';
import {
  createEvent,
  NotFoundError,
  TASK_REPOSITORY,
  type Actor,
  type Clock,
  type TaskRepository,
} from '@hearth/domain';
import { CLOCK } from '../../../../shared/clock/clock';
import { AccessService } from '../../../../shared/access/access.service';
import { DomainEventPublisher } from '../../../../shared/events/domain-event.publisher';
import { TaskReadModel } from '../../infrastructure/task.read-model';
import { TASK_DIRECTORY, TASK_RELATIONS, type TaskDirectory, type TaskRelations } from '../ports';
import { loadTask } from '../task-support';
import { resolveMentions } from '../mentions';

export class AddCommentCommand {
  constructor(
    readonly actor: Actor,
    readonly taskId: string,
    readonly input: CreateCommentInput,
  ) {}
}

const EXCERPT_LENGTH = 140;

/** Adds a comment; @mentions of active members travel in `comment.created` for the inbox to notify. */
@CommandHandler(AddCommentCommand)
export class AddCommentHandler implements ICommandHandler<AddCommentCommand, CommentDto> {
  constructor(
    @Inject(TASK_REPOSITORY) private readonly tasks: TaskRepository,
    @Inject(TASK_DIRECTORY) private readonly directory: TaskDirectory,
    @Inject(TASK_RELATIONS) private readonly relations: TaskRelations,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly access: AccessService,
    private readonly publisher: DomainEventPublisher,
    private readonly read: TaskReadModel,
  ) {}

  async execute({ actor, taskId, input }: AddCommentCommand): Promise<CommentDto> {
    const task = await loadTask(this.tasks, actor, taskId);
    this.access.assert(actor, 'comments.create', { projectId: task.projectId });

    const parent = input.parentId ? await this.relations.findComment(task.id, input.parentId) : null;
    if (input.parentId && !parent) throw new NotFoundError('Comment', input.parentId);

    const now = this.clock.now();
    const members = await this.directory.activeMembers(actor.workspaceId);
    const mentionedUserIds = resolveMentions(input.body, members)
      .map((m) => m.id)
      .filter((id) => id !== actor.userId);

    const comment = await this.relations.createComment({
      taskId: task.id,
      authorId: actor.userId,
      body: input.body,
      parentId: parent?.id ?? null,
      createdAt: now,
    });
    await this.relations.follow(task.id, [actor.userId]);

    const body = input.body.trim();
    this.publisher.publish(
      createEvent(
        'comment.created',
        { workspaceId: actor.workspaceId, actorId: actor.userId, aggregateId: comment.id, occurredAt: now },
        {
          taskId: task.id,
          key: task.key.toString(),
          title: task.title,
          projectId: task.projectId,
          commentId: comment.id,
          mentionedUserIds,
          excerpt: body.length > EXCERPT_LENGTH ? `${body.slice(0, EXCERPT_LENGTH - 1)}…` : body,
          parentAuthorId: parent?.authorId ?? null,
        },
      ),
    );
    return this.read.comment(actor.workspaceId, comment.id);
  }
}
