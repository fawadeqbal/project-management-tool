import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { createEvent, NotFoundError, type Clock } from '@hearth/domain';
import { PrismaService } from '../../../../shared/prisma/prisma.service';
import { CLOCK } from '../../../../shared/clock/clock';
import { DomainEventPublisher } from '../../../../shared/events/domain-event.publisher';
import { RevokeInviteCommand } from './revoke-invite.command';

@CommandHandler(RevokeInviteCommand)
export class RevokeInviteHandler implements ICommandHandler<RevokeInviteCommand, void> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: DomainEventPublisher,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute({ actor, inviteId }: RevokeInviteCommand): Promise<void> {
    const invite = await this.prisma.invite.findFirst({ where: { id: inviteId, workspaceId: actor.workspaceId, status: 'PENDING' } });
    if (!invite) throw new NotFoundError('Invite', inviteId);
    await this.prisma.invite.update({ where: { id: invite.id }, data: { status: 'REVOKED' } });
    this.events.publish(
      createEvent('member.invite_revoked', { workspaceId: actor.workspaceId, actorId: actor.userId, aggregateId: invite.id, occurredAt: this.clock.now() }, { email: invite.email }),
    );
  }
}
