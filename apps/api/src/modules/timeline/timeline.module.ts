import { Module } from '@nestjs/common';
import { SCHEDULE_READER, SCHEDULE_WRITER } from './application/schedule.ports';
import { RescheduleTaskHandler } from './application/commands/reschedule-task.handler';
import { ApplyScheduleHandler } from './application/commands/apply-schedule.handler';
import { GetTimelineHandler } from './application/queries/get-timeline.query';
import { PrismaScheduleAdapter } from './infrastructure/prisma-schedule.adapter';
import { TimelineReadModel } from './infrastructure/timeline.read-model';
import { TimelineController } from './presentation/timeline.controller';

/**
 * Timeline bounded context: the Gantt read model (critical path, conflicts) and drag-to-
 * reschedule with dependent shifting. Writes dates via its own ScheduleWriter adapter and
 * publishes `task.rescheduled`, so it never reaches into the Tasks context.
 */
@Module({
  controllers: [TimelineController],
  providers: [
    PrismaScheduleAdapter,
    { provide: SCHEDULE_READER, useExisting: PrismaScheduleAdapter },
    { provide: SCHEDULE_WRITER, useExisting: PrismaScheduleAdapter },
    TimelineReadModel,
    GetTimelineHandler,
    RescheduleTaskHandler,
    ApplyScheduleHandler,
  ],
})
export class TimelineModule {}
