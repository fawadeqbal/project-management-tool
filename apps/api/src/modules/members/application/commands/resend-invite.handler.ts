import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { InviteDto } from '@hearth/contracts';
import { createEvent, inviteExpiry, NotFoundError, type Clock } from '@hearth/domain';
import { PrismaService } from '../../../../shared/prisma/prisma.service';
import { CLOCK } from '../../../../shared/clock/clock';
import { DomainEventPublisher } from '../../../../shared/events/domain-event.publisher';
import { MembersReadModel } from '../../infrastructure/members.read-model';
import { ResendInviteCommand } from './resend-invite.command';

/** Resending refreshes the 7-day expiry, so a pending invite is never a dead end. */
@CommandHandler(ResendInviteCommand)
export class ResendInviteHandler implements ICommandHandler<ResendInviteCommand, InviteDto> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly read: MembersReadModel,
    private readonly events: DomainEventPublisher,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute({ actor, inviteId }: ResendInviteCommand): Promise<InviteDto> {
    const now = this.clock.now();
    const invite = await this.prisma.invite.findFirst({
      where: { id: inviteId, workspaceId: actor.workspaceId, status: 'PENDING' },
    });
    if (!invite) throw new NotFoundError('Invite', inviteId);
    await this.prisma.invite.update({
      where: { id: invite.id },
      data: { resentAt: now, expiresAt: inviteExpiry(now) },
    });
    this.events.publish(
      createEvent(
        'member.invite_resent',
        { workspaceId: actor.workspaceId, actorId: actor.userId, aggregateId: invite.id, occurredAt: now },
        { email: invite.email },
      ),
    );
    return (await this.read.invite(actor.workspaceId, invite.id))!;
  }
}
