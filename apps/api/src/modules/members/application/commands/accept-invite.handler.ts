import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { AcceptInviteResultDto } from '@hearth/contracts';
import { ConflictError, createEvent, ForbiddenError, NotFoundError, type Clock, type Role } from '@hearth/domain';
import { PrismaService } from '../../../../shared/prisma/prisma.service';
import { CLOCK } from '../../../../shared/clock/clock';
import { DomainEventPublisher } from '../../../../shared/events/domain-event.publisher';
import { AcceptInviteCommand } from './accept-invite.command';

/**
 * The signed-in person accepts an invite sent to their email: they get a membership with the
 * invited role (plus their team), and guests get access to exactly the invited project.
 */
@CommandHandler(AcceptInviteCommand)
export class AcceptInviteHandler implements ICommandHandler<AcceptInviteCommand, AcceptInviteResultDto> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: DomainEventPublisher,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute({ userId, token }: AcceptInviteCommand): Promise<AcceptInviteResultDto> {
    const now = this.clock.now();
    const invite = await this.prisma.invite.findUnique({ where: { token } });
    if (!invite || invite.status === 'REVOKED') throw new NotFoundError('Invite', token.slice(0, 6));
    if (invite.status === 'ACCEPTED') throw new ConflictError('invites.accepted', 'This invite was already used. Sign in to open the workspace.');
    if (invite.expiresAt.getTime() <= now.getTime())
      throw new ConflictError('invites.expired', 'This invite has expired. Ask the person who invited you to resend it.');
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError('User', userId);
    if (user.email.toLowerCase() !== invite.email.toLowerCase())
      throw new ForbiddenError('invites.wrong_account', `This invite is for ${invite.email}. Sign in with that email to accept it.`);
    if (await this.prisma.membership.count({ where: { workspaceId: invite.workspaceId, userId } }))
      throw new ConflictError('invites.already_member', 'You’re already in this workspace.');

    await this.prisma.$transaction(async (tx) => {
      await tx.membership.create({ data: { workspaceId: invite.workspaceId, userId, role: invite.role, joinedAt: now, lastActiveAt: now } });
      if (invite.teamId) await tx.teamMember.upsert({ where: { teamId_userId: { teamId: invite.teamId, userId } }, create: { teamId: invite.teamId, userId }, update: {} });
      if (invite.role === 'GUEST' && invite.projectId)
        await tx.projectMember.upsert({ where: { projectId_userId: { projectId: invite.projectId, userId } }, create: { projectId: invite.projectId, userId }, update: {} });
      await tx.invite.update({ where: { id: invite.id }, data: { status: 'ACCEPTED' } });
    });

    this.events.publish(
      createEvent(
        'member.joined',
        { workspaceId: invite.workspaceId, actorId: userId, aggregateId: invite.id, occurredAt: now },
        { userId, role: invite.role, invitedById: invite.invitedById, projectId: invite.projectId },
      ),
    );
    return { workspaceId: invite.workspaceId, role: invite.role as Role, projectId: invite.projectId };
  }
}
