import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { NotFoundError, createEvent, toDateOnly, type Clock } from '@hearth/domain';
import { PrismaService } from '../../../../shared/prisma/prisma.service';
import { AccessService } from '../../../../shared/access/access.service';
import { CLOCK } from '../../../../shared/clock/clock';
import { DomainEventPublisher } from '../../../../shared/events/domain-event.publisher';
import { DeleteTimeOffCommand } from './delete-time-off.command';
import { assertCanManageTimeOff } from './time-off-policy';

@CommandHandler(DeleteTimeOffCommand)
export class DeleteTimeOffHandler implements ICommandHandler<DeleteTimeOffCommand, void> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly events: DomainEventPublisher,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute({ actor, id }: DeleteTimeOffCommand): Promise<void> {
    const row = await this.prisma.timeOff.findFirst({ where: { id, workspaceId: actor.workspaceId } });
    if (!row) throw new NotFoundError('Time off', id);
    assertCanManageTimeOff(this.access, actor, row.userId);
    await this.prisma.timeOff.delete({ where: { id } });
    this.events.publish(
      createEvent(
        'time_off.removed',
        {
          workspaceId: actor.workspaceId,
          actorId: actor.userId,
          aggregateId: id,
          occurredAt: this.clock.now(),
        },
        { userId: row.userId, startDate: toDateOnly(row.startDate), endDate: toDateOnly(row.endDate) },
      ),
    );
  }
}
