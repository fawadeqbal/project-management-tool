import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { NotFoundError, WORKSPACE_MEMBER_REPOSITORY, type Clock, type WorkspaceMemberRepository } from '@hearth/domain';
import { CLOCK } from '../../../../shared/clock/clock';
import { PlanService } from '../../../../shared/billing/require-feature';
import { DomainEventPublisher } from '../../../../shared/events/domain-event.publisher';
import { SeatCounter } from '../../infrastructure/seat-counter';
import { ReactivateMemberCommand } from './reactivate-member.command';

@CommandHandler(ReactivateMemberCommand)
export class ReactivateMemberHandler implements ICommandHandler<ReactivateMemberCommand, { userId: string; status: 'DEACTIVATED' | 'ACTIVE' }> {
  constructor(
    @Inject(WORKSPACE_MEMBER_REPOSITORY) private readonly members: WorkspaceMemberRepository,
    private readonly plans: PlanService,
    private readonly seats: SeatCounter,
    private readonly events: DomainEventPublisher,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute({ actor, userId }: ReactivateMemberCommand) {
    const member = await this.members.findByUser(actor.workspaceId, userId);
    if (!member) throw new NotFoundError('Member', userId);
    if (member.status === 'DEACTIVATED' && member.takesSeat)
      (await this.plans.policyFor(actor.workspaceId)).assertWithinLimit('seats', await this.seats.activeSeats(actor.workspaceId));
    member.reactivate(actor, this.clock.now());
    await this.members.save(member);
    this.events.publishFrom(member);
    return { userId, status: member.status };
  }
}
