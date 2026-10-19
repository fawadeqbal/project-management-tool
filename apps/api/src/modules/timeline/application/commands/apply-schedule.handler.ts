import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { ApplyScheduleInput, ScheduleItemInput } from '@hearth/contracts';
import { NotFoundError, parseDateOnly, toDateOnly, ValidationError, type Actor, type Clock } from '@hearth/domain';
import { AccessService } from '../../../../shared/access/access.service';
import { CLOCK } from '../../../../shared/clock/clock';
import { DomainEventPublisher } from '../../../../shared/events/domain-event.publisher';
import { SCHEDULE_READER, SCHEDULE_WRITER, type ScheduleReader, type ScheduleWriter } from '../schedule.ports';
import { sameDate, scheduleEvents } from './schedule-events';

export class ApplyScheduleCommand {
  constructor(
    readonly actor: Actor,
    readonly input: ApplyScheduleInput,
  ) {}
}

/** Puts explicit dates back on several items at once — the Undo of a reschedule. */
@CommandHandler(ApplyScheduleCommand)
export class ApplyScheduleHandler implements ICommandHandler<ApplyScheduleCommand, { updated: ScheduleItemInput[] }> {
  constructor(
    @Inject(SCHEDULE_READER) private readonly reader: ScheduleReader,
    @Inject(SCHEDULE_WRITER) private readonly writer: ScheduleWriter,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly access: AccessService,
    private readonly events: DomainEventPublisher,
  ) {}

  async execute({ actor, input }: ApplyScheduleCommand): Promise<{ updated: ScheduleItemInput[] }> {
    const items = await this.reader.itemsByIds(actor.workspaceId, input.items);
    const byKey = new Map(items.map((i) => [`${i.kind}:${i.id}`, i]));
    const changes = input.items.map((req) => {
      const item = byKey.get(`${req.kind}:${req.id}`);
      if (!item || !this.access.allows(actor, 'tasks.view', { projectId: item.projectId })) throw new NotFoundError(req.kind === 'task' ? 'Task' : 'Milestone', req.id);
      this.access.assert(actor, req.kind === 'task' ? 'tasks.edit' : 'projects.manage', { projectId: item.projectId });
      const startDate = req.startDate ? parseDateOnly(req.startDate) : null;
      const dueDate = req.dueDate ? parseDateOnly(req.dueDate) : null;
      if (startDate && dueDate && dueDate < startDate)
        throw new ValidationError('schedule.dates', 'The due date has to be on or after the start date.', { field: 'dueDate' });
      if (req.kind === 'milestone' && !dueDate) throw new ValidationError('milestone.date', 'A milestone needs a date.', { field: 'dueDate' });
      return { item, update: { kind: req.kind, id: req.id, startDate: req.kind === 'milestone' ? dueDate : startDate, dueDate } };
    });
    const real = changes.filter((c) => !sameDate(c.item.startDate, c.update.startDate) || !sameDate(c.item.dueDate, c.update.dueDate));
    if (real.length) {
      await this.writer.apply(real.map((c) => c.update));
      this.events.publish(...scheduleEvents(actor, this.clock.now(), real));
    }
    const d = (x: Date | null) => (x ? toDateOnly(x) : null);
    return { updated: real.map((c) => ({ kind: c.update.kind, id: c.update.id, startDate: d(c.update.startDate), dueDate: d(c.update.dueDate) })) };
  }
}
