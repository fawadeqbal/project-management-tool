import { randomBytes } from 'node:crypto';
import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { CreateInviteResultDto } from '@hearth/contracts';
import {
  ConflictError,
  createEvent,
  inviteExpiry,
  inviteTakesSeat,
  NotFoundError,
  validateInvite,
  type Clock,
} from '@hearth/domain';
import { PrismaService } from '../../../../shared/prisma/prisma.service';
import { CLOCK } from '../../../../shared/clock/clock';
import { PlanService } from '../../../../shared/billing/require-feature';
import { DomainEventPublisher } from '../../../../shared/events/domain-event.publisher';
import { MembersReadModel } from '../../infrastructure/members.read-model';
import { SeatCounter } from '../../infrastructure/seat-counter';
import { CreateInviteCommand } from './create-invite.command';

/**
 * Invites someone by email. Seats are checked against active members plus pending invites, so a
 * plan limit is visible before anyone accepts. Guests are scoped to one project and take no seat.
 */
@CommandHandler(CreateInviteCommand)
export class CreateInviteHandler implements ICommandHandler<CreateInviteCommand, CreateInviteResultDto> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly plans: PlanService,
    private readonly seats: SeatCounter,
    private readonly read: MembersReadModel,
    private readonly events: DomainEventPublisher,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute({ actor, input }: CreateInviteCommand): Promise<CreateInviteResultDto> {
    const now = this.clock.now();
    validateInvite(actor.role, input);
    const { workspaceId } = actor;

    const existingMember = await this.prisma.membership.findFirst({
      where: { workspaceId, user: { email: input.email } },
    });
    if (existingMember)
      throw new ConflictError(
        'invites.already_member',
        `${input.email} is already in this workspace${existingMember.status === 'DEACTIVATED' ? ' (deactivated) — reactivate them instead' : ''}.`,
      );
    const pending = await this.prisma.invite.findFirst({
      where: { workspaceId, email: input.email, status: 'PENDING' },
    });
    if (pending)
      throw new ConflictError(
        'invites.pending',
        `${input.email} already has a pending invite. Resend it from the list instead.`,
      );

    const projectId = input.role === 'GUEST' ? input.projectId! : null;
    if (projectId && !(await this.prisma.project.count({ where: { id: projectId, workspaceId } })))
      throw new NotFoundError('Project', projectId);
    if (input.teamId && !(await this.prisma.team.count({ where: { id: input.teamId, workspaceId } })))
      throw new NotFoundError('Team', input.teamId);

    if (inviteTakesSeat(input.role))
      (await this.plans.policyFor(workspaceId)).assertWithinLimit(
        'seats',
        await this.seats.committedSeats(workspaceId, now),
      );

    const token = randomBytes(24).toString('base64url');
    const invite = await this.prisma.invite.create({
      data: {
        workspaceId,
        email: input.email,
        role: input.role,
        teamId: input.role === 'GUEST' ? null : (input.teamId ?? null),
        projectId,
        invitedById: actor.userId,
        token,
        expiresAt: inviteExpiry(now),
        createdAt: now,
      },
    });
    this.events.publish(
      createEvent(
        'member.invited',
        { workspaceId, actorId: actor.userId, aggregateId: invite.id, occurredAt: now },
        { email: input.email, role: input.role, projectId },
      ),
    );
    return { invite: (await this.read.invite(workspaceId, invite.id))!, token };
  }
}
