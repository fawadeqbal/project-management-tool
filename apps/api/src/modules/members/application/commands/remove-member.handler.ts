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
import { RemoveMemberCommand } from './remove-member.command';

/** Permanent removal (the only confirmed action on the screen). Open tasks become unassigned. */
@CommandHandler(RemoveMemberCommand)
export class RemoveMemberHandler implements ICommandHandler<
  RemoveMemberCommand,
  { userId: string; unassignedTasks: number }
> {
  constructor(
    @Inject(WORKSPACE_MEMBER_REPOSITORY) private readonly members: WorkspaceMemberRepository,
    private readonly events: DomainEventPublisher,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute({ actor, userId, confirmed }: RemoveMemberCommand) {
    const member = await this.members.findByUser(actor.workspaceId, userId);
    if (!member) throw new NotFoundError('Member', userId);
    member.remove(
      actor,
      await this.members.countActiveOwners(actor.workspaceId),
      confirmed,
      this.clock.now(),
    );
    const { unassignedTasks } = await this.members.remove(member);
    this.events.publishFrom(member);
    return { userId, unassignedTasks };
  }
}
