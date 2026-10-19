import { randomUUID } from 'node:crypto';
import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { APPROVAL_REPOSITORY, Approval, NotFoundError, ValidationError, parseDateOnly, type Clock } from '@hearth/domain';
import { PrismaService } from '../../../../shared/prisma/prisma.service';
import { CLOCK } from '../../../../shared/clock/clock';
import { AccessService } from '../../../../shared/access/access.service';
import { DomainEventPublisher } from '../../../../shared/events/domain-event.publisher';
import type { InboxApprovalRepository } from '../ports';
import { RequestApprovalCommand } from './request-approval.command';

/** Asks teammates to approve a task deliverable; approvers hear about it in their inbox. */
@CommandHandler(RequestApprovalCommand)
export class RequestApprovalHandler implements ICommandHandler<RequestApprovalCommand, { id: string }> {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(APPROVAL_REPOSITORY) private readonly approvals: InboxApprovalRepository,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly access: AccessService,
    private readonly events: DomainEventPublisher,
  ) {}

  async execute({ actor, taskId, input }: RequestApprovalCommand): Promise<{ id: string }> {
    const task = await this.prisma.task.findFirst({ where: { id: taskId, workspaceId: actor.workspaceId }, select: { id: true, projectId: true } });
    if (!task) throw new NotFoundError('Task', taskId);
    this.access.assert(actor, 'tasks.edit', { projectId: task.projectId });
    const members = await this.prisma.membership.count({ where: { workspaceId: actor.workspaceId, userId: { in: input.approverIds }, status: 'ACTIVE' } });
    if (members !== new Set(input.approverIds).size)
      throw new ValidationError('approval.approvers', 'Some approvers aren’t active members of this workspace. Pick people from the list.');

    const approval = Approval.request(
      {
        id: randomUUID(),
        workspaceId: actor.workspaceId,
        taskId: task.id,
        requesterId: actor.userId,
        title: input.title,
        summary: input.summary ?? null,
        dueDate: input.dueDate ? parseDateOnly(input.dueDate) : null,
        approverIds: input.approverIds,
      },
      this.clock.now(),
    );
    await this.approvals.save(approval);
    await this.approvals.addAttachments(
      approval.id,
      (input.attachments ?? []).map((a) => ({ name: a.name, kind: a.kind, url: a.url, sizeBytes: a.sizeBytes })),
    );
    this.events.publishFrom(approval);
    return { id: approval.id };
  }
}
