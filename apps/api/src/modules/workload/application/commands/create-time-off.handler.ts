import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { TimeOffDto } from '@hearth/contracts';
import { ConflictError, NotFoundError, createEvent, parseDateOnly, type Clock } from '@hearth/domain';
import { PrismaService } from '../../../../shared/prisma/prisma.service';
import { AccessService } from '../../../../shared/access/access.service';
import { CLOCK } from '../../../../shared/clock/clock';
import { DomainEventPublisher } from '../../../../shared/events/domain-event.publisher';
import { USER_REF_SELECT } from '../../../../shared/mappers/refs';
import { toTimeOffDto } from '../../infrastructure/workload.read-model';
import { CreateTimeOffCommand } from './create-time-off.command';
import { assertCanManageTimeOff } from './time-off-policy';

@CommandHandler(CreateTimeOffCommand)
export class CreateTimeOffHandler implements ICommandHandler<CreateTimeOffCommand, TimeOffDto> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly events: DomainEventPublisher,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute({ actor, input }: CreateTimeOffCommand): Promise<TimeOffDto> {
    const userId = input.userId ?? actor.userId;
    assertCanManageTimeOff(this.access, actor, userId);
    const member = await this.prisma.membership.findUnique({
      where: { workspaceId_userId: { workspaceId: actor.workspaceId, userId } },
    });
    if (!member) throw new NotFoundError('Member', userId);
    const startDate = parseDateOnly(input.startDate);
    const endDate = parseDateOnly(input.endDate);
    const overlap = await this.prisma.timeOff.findFirst({
      where: {
        workspaceId: actor.workspaceId,
        userId,
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
    });
    if (overlap)
      throw new ConflictError(
        'time_off.overlap',
        'Those days overlap time off that’s already planned. Edit the existing entry instead.',
        { timeOffId: overlap.id },
      );
    const row = await this.prisma.timeOff.create({
      data: { workspaceId: actor.workspaceId, userId, startDate, endDate, reason: input.reason ?? null },
      include: { user: { select: USER_REF_SELECT } },
    });
    const dto = toTimeOffDto(row);
    this.events.publish(
      createEvent(
        'time_off.added',
        {
          workspaceId: actor.workspaceId,
          actorId: actor.userId,
          aggregateId: row.id,
          occurredAt: this.clock.now(),
        },
        { userId, startDate: dto.startDate, endDate: dto.endDate },
      ),
    );
    return dto;
  }
}
