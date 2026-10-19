import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { CapacityDto } from '@hearth/contracts';
import { NotFoundError, createEvent, type Clock } from '@hearth/domain';
import { PrismaService } from '../../../../shared/prisma/prisma.service';
import { CLOCK } from '../../../../shared/clock/clock';
import { DomainEventPublisher } from '../../../../shared/events/domain-event.publisher';
import { UpdateCapacityCommand } from './update-capacity.command';

/** Admins set a person's daily capacity (the route requires members.manage). */
@CommandHandler(UpdateCapacityCommand)
export class UpdateCapacityHandler implements ICommandHandler<UpdateCapacityCommand, CapacityDto> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: DomainEventPublisher,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute({ actor, userId, hoursPerDay }: UpdateCapacityCommand): Promise<CapacityDto> {
    const member = await this.prisma.membership.findUnique({ where: { workspaceId_userId: { workspaceId: actor.workspaceId, userId } } });
    if (!member) throw new NotFoundError('Member', userId);
    await this.prisma.membership.update({ where: { id: member.id }, data: { capacityHoursPerDay: hoursPerDay } });
    this.events.publish(
      createEvent('capacity.changed', { workspaceId: actor.workspaceId, actorId: actor.userId, aggregateId: userId, occurredAt: this.clock.now() }, { from: member.capacityHoursPerDay, to: hoursPerDay }),
    );
    return { userId, hoursPerDay };
  }
}
