import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import {
  NotFoundError,
  WORKSPACE_MEMBER_REPOSITORY,
  type Clock,
  type Role,
  type WorkspaceMemberRepository,
} from '@hearth/domain';
import { CLOCK } from '../../../../shared/clock/clock';
import { DomainEventPublisher } from '../../../../shared/events/domain-event.publisher';
import { ChangeMemberRoleCommand } from './change-member-role.command';

/** Role changes go through the WorkspaceMember aggregate (last owner, self, escalation rules). */
@CommandHandler(ChangeMemberRoleCommand)
export class ChangeMemberRoleHandler implements ICommandHandler<
  ChangeMemberRoleCommand,
  { userId: string; role: Role }
> {
  constructor(
    @Inject(WORKSPACE_MEMBER_REPOSITORY) private readonly members: WorkspaceMemberRepository,
    private readonly events: DomainEventPublisher,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute({ actor, userId, role }: ChangeMemberRoleCommand): Promise<{ userId: string; role: Role }> {
    const member = await this.members.findByUser(actor.workspaceId, userId);
    if (!member) throw new NotFoundError('Member', userId);
    member.changeRole(role, actor, await this.members.countActiveOwners(actor.workspaceId), this.clock.now());
    await this.members.save(member);
    this.events.publishFrom(member);
    return { userId, role: member.role };
  }
}
