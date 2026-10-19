import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { AcceptSuggestionResultDto } from '@hearth/contracts';
import { InvariantViolation, NotFoundError, ValidationError, createEvent, type Actor, type Clock, type TaskCreated, type TaskUpdated } from '@hearth/domain';
import type { AiSuggestion } from '@prisma/client';
import { PrismaService } from '../../../../shared/prisma/prisma.service';
import { CLOCK } from '../../../../shared/clock/clock';
import { AccessService } from '../../../../shared/access/access.service';
import { DomainEventPublisher } from '../../../../shared/events/domain-event.publisher';
import { toSuggestionDto } from '../../infrastructure/ai-suggestion.read-model';
import { AcceptSuggestionCommand } from './accept-suggestion.command';

const SUMMARY_HEADING = 'Summary';

/**
 * The only place AI output reaches a task, and only on a person's click: a summary is appended
 * to the description; a breakdown becomes real subtasks with fresh keys.
 */
@CommandHandler(AcceptSuggestionCommand)
export class AcceptSuggestionHandler implements ICommandHandler<AcceptSuggestionCommand, AcceptSuggestionResultDto> {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly access: AccessService,
    private readonly events: DomainEventPublisher,
  ) {}

  async execute({ actor, suggestionId, edited }: AcceptSuggestionCommand): Promise<AcceptSuggestionResultDto> {
    const suggestion = await this.prisma.aiSuggestion.findFirst({
      where: { id: suggestionId, task: { workspaceId: actor.workspaceId } },
      include: { task: { select: { projectId: true } } },
    });
    if (!suggestion) throw new NotFoundError('Suggestion', suggestionId);
    if (suggestion.status !== 'PENDING')
      throw new InvariantViolation('ai.suggestion_closed', `This suggestion was already ${suggestion.status === 'ACCEPTED' ? 'added' : 'discarded'}. Generate a new one.`);
    this.access.assert(actor, suggestion.kind === 'breakdown' ? 'tasks.create' : 'tasks.edit', { projectId: suggestion.task.projectId });
    return suggestion.kind === 'breakdown' ? this.acceptBreakdown(actor, suggestion, edited?.subtasks) : this.acceptSummary(actor, suggestion, edited?.text);
  }

  private async acceptSummary(actor: Actor, s: AiSuggestion, editedText: string | undefined): Promise<AcceptSuggestionResultDto> {
    const content = s.content as { text?: string };
    const text = (editedText ?? content.text ?? '').trim();
    if (!text) throw new ValidationError('ai.empty', 'The summary is empty. Edit it or generate a new one.');
    const now = this.clock.now();
    const { task, suggestion } = await this.prisma.$transaction(async (tx) => {
      const current = await tx.task.findUniqueOrThrow({ where: { id: s.taskId }, select: { description: true } });
      const block = `${SUMMARY_HEADING}: ${text}`;
      const description = current.description?.trim() ? `${current.description.trimEnd()}\n\n${block}` : block;
      const task = await tx.task.update({
        where: { id: s.taskId },
        data: { description },
        select: { id: true, number: true, description: true, projectId: true, workspace: { select: { keyPrefix: true } } },
      });
      const suggestion = await tx.aiSuggestion.update({
        where: { id: s.id },
        data: { status: 'ACCEPTED', content: { ...(s.content as object), acceptedText: text, edited: editedText !== undefined } },
      });
      return { task, suggestion };
    });
    const event: TaskUpdated = createEvent(
      'task.updated',
      { workspaceId: actor.workspaceId, actorId: actor.userId, aggregateId: task.id, occurredAt: now },
      { key: `${task.workspace.keyPrefix}-${task.number}`, fields: ['description'], projectId: task.projectId },
    );
    this.events.publish(event);
    return { suggestion: toSuggestionDto(suggestion), description: task.description ?? '' };
  }

  private async acceptBreakdown(actor: Actor, s: AiSuggestion, chosen: string[] | undefined): Promise<AcceptSuggestionResultDto> {
    const proposed = ((s.content as { subtasks?: string[] }).subtasks ?? []).map((t) => t.trim()).filter(Boolean);
    const titles = (chosen ?? proposed).map((t) => t.trim()).filter(Boolean);
    if (!titles.length) throw new ValidationError('ai.empty', 'Pick at least one subtask to add.');
    const now = this.clock.now();
    const result = await this.prisma.$transaction(async (tx) => {
      const parent = await tx.task.findUniqueOrThrow({
        where: { id: s.taskId },
        select: { id: true, projectId: true, sectionId: true, workspaceId: true, assigneeId: true, sprintId: true },
      });
      // Allocate numbers atomically: bump the workspace sequence by N and use the range.
      const ws = await tx.workspace.update({ where: { id: parent.workspaceId }, data: { taskSeq: { increment: titles.length } }, select: { taskSeq: true, keyPrefix: true } });
      const first = ws.taskSeq - titles.length + 1;
      const last = await tx.task.aggregate({ where: { parentId: parent.id }, _max: { listPosition: true } });
      const base = last._max.listPosition ?? 0;
      const created: { id: string; number: number; title: string; assigneeId: string | null }[] = [];
      for (const [i, title] of titles.entries()) {
        const row = await tx.task.create({
          data: {
            workspaceId: parent.workspaceId,
            projectId: parent.projectId,
            sectionId: parent.sectionId,
            sprintId: parent.sprintId,
            parentId: parent.id,
            number: first + i,
            title: title.slice(0, 500),
            creatorId: actor.userId,
            assigneeId: parent.assigneeId,
            listPosition: base + (i + 1) * 1000,
            boardPosition: (i + 1) * 1000,
            createdAt: now,
            followers: { create: [{ userId: actor.userId }] },
          },
          select: { id: true, number: true, title: true, assigneeId: true },
        });
        created.push(row);
      }
      const suggestion = await tx.aiSuggestion.update({
        where: { id: s.id },
        data: { status: 'ACCEPTED', content: { ...(s.content as object), acceptedSubtasks: titles } },
      });
      return { parent, created, prefix: ws.keyPrefix, suggestion };
    });
    const events: TaskCreated[] = result.created.map((t) =>
      createEvent(
        'task.created',
        { workspaceId: actor.workspaceId, actorId: actor.userId, aggregateId: t.id, occurredAt: now },
        { key: `${result.prefix}-${t.number}`, title: t.title, projectId: result.parent.projectId, assigneeId: t.assigneeId },
      ),
    );
    this.events.publish(...events);
    return {
      suggestion: toSuggestionDto(result.suggestion),
      createdSubtasks: result.created.map((t) => ({ id: t.id, key: `${result.prefix}-${t.number}`, title: t.title })),
    };
  }
}
