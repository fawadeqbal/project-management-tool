import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { APPROVAL_REPOSITORY, NotFoundError, type ApprovalRepository, type ApprovalStatus, type Clock } from '@hearth/domain';
import { CLOCK } from '../../../../shared/clock/clock';
import { AccessService } from '../../../../shared/access/access.service';
import { DomainEventPublisher } from '../../../../shared/events/domain-event.publisher';
import { DecideApprovalCommand } from './decide-approval.command';

/** An approver approves or requests changes; the aggregate resolves the request and records approval.decided. */
@CommandHandler(DecideApprovalCommand)
export class DecideApprovalHandler implements ICommandHandler<DecideApprovalCommand, { id: string; status: ApprovalStatus }> {
  constructor(
    @Inject(APPROVAL_REPOSITORY) private readonly approvals: ApprovalRepository,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly access: AccessService,
    private readonly events: DomainEventPublisher,
  ) {}

  async execute({ actor, approvalId, decision, note }: DecideApprovalCommand) {
    this.access.assert(actor, 'approvals.decide');
    const approval = await this.approvals.findById(actor.workspaceId, approvalId);
    if (!approval) throw new NotFoundError('Approval', approvalId);
    approval.decide(actor.userId, decision, note, this.clock.now());
    await this.approvals.save(approval);
    this.events.publishFrom(approval);
    return { id: approval.id, status: approval.status };
  }
}
