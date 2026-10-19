import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { DashboardWidgetId } from '@hearth/contracts';
import { createEvent, type Clock } from '@hearth/domain';
import { CLOCK } from '../../../../shared/clock/clock';
import { DomainEventPublisher } from '../../../../shared/events/domain-event.publisher';
import { DashboardPreferencesStore } from '../../infrastructure/dashboard-preferences.store';
import { SaveDashboardLayoutCommand } from './save-dashboard-layout.command';

@CommandHandler(SaveDashboardLayoutCommand)
export class SaveDashboardLayoutHandler implements ICommandHandler<
  SaveDashboardLayoutCommand,
  { layout: DashboardWidgetId[] }
> {
  constructor(
    private readonly prefs: DashboardPreferencesStore,
    private readonly events: DomainEventPublisher,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute({ actor, input }: SaveDashboardLayoutCommand): Promise<{ layout: DashboardWidgetId[] }> {
    await this.prefs.saveLayout(actor.workspaceId, actor.userId, input.widgets);
    const layout = await this.prefs.layout(actor.workspaceId, actor.userId);
    this.events.publish(
      createEvent(
        'dashboard.layout_saved',
        {
          workspaceId: actor.workspaceId,
          actorId: actor.userId,
          aggregateId: actor.userId,
          occurredAt: this.clock.now(),
        },
        { widgets: layout },
      ),
    );
    return { layout };
  }
}
