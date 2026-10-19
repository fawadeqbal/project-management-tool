import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { createEvent, type Clock } from '@hearth/domain';
import { CLOCK } from '../../../../shared/clock/clock';
import { DomainEventPublisher } from '../../../../shared/events/domain-event.publisher';
import {
  DashboardPreferencesStore,
  type DashboardSchedule,
} from '../../infrastructure/dashboard-preferences.store';
import { ScheduleDashboardCommand } from './schedule-dashboard.command';

/** Stores a weekly email schedule. No email is sent in this build — the schedule is the record. */
@CommandHandler(ScheduleDashboardCommand)
export class ScheduleDashboardHandler implements ICommandHandler<
  ScheduleDashboardCommand,
  { schedule: DashboardSchedule }
> {
  constructor(
    private readonly prefs: DashboardPreferencesStore,
    private readonly events: DomainEventPublisher,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute({ actor, input }: ScheduleDashboardCommand): Promise<{ schedule: DashboardSchedule }> {
    const schedule: DashboardSchedule = { cadence: 'weekly', recipients: [...new Set(input.recipients)] };
    await this.prefs.saveSchedule(actor.workspaceId, actor.userId, schedule);
    this.events.publish(
      createEvent(
        'dashboard.scheduled',
        {
          workspaceId: actor.workspaceId,
          actorId: actor.userId,
          aggregateId: actor.userId,
          occurredAt: this.clock.now(),
        },
        { ...schedule },
      ),
    );
    return { schedule };
  }
}
