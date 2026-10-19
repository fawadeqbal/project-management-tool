import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import {
  NotFoundError,
  WORKSPACE_MEMBER_REPOSITORY,
  type Clock,
  type WorkspaceMemberRepository,
} from '@hearth/domain';
import { CLOCK } from '../../../../shared/clock/clock';
import { DomainEventPublisher } from '../../../../shared/events/domain-event.publisher';
import { DeactivateMemberCommand } from './deactivate-member.command';

/** Reversible: the person loses access but keeps every task, comment and assignment. */
@CommandHandler(DeactivateMemberCommand)
export class DeactivateMemberHandler implements ICommandHandler<
  DeactivateMemberCommand,
  { userId: string; status: 'DEACTIVATED' | 'ACTIVE' }
> {
  constructor(
    @Inject(WORKSPACE_MEMBER_REPOSITORY) private readonly members: WorkspaceMemberRepository,
    private readonly events: DomainEventPublisher,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute({ actor, userId }: DeactivateMemberCommand) {
    const member = await this.members.findByUser(actor.workspaceId, userId);
    if (!member) throw new NotFoundError('Member', userId);
    member.deactivate(actor, await this.members.countActiveOwners(actor.workspaceId), this.clock.now());
    await this.members.save(member);
    this.events.publishFrom(member);
    return { userId, status: member.status };
  }
}
