import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { RescheduleResultDto, RescheduleTaskInput, ScheduleChangeDto } from '@hearth/contracts';
import { addDays, diffInDays, NotFoundError, parseDateOnly, planReschedule, toDateOnly, type Actor, type Clock } from '@hearth/domain';
import { AccessService } from '../../../../shared/access/access.service';
import { CLOCK } from '../../../../shared/clock/clock';
import { DomainEventPublisher } from '../../../../shared/events/domain-event.publisher';
import { SCHEDULE_READER, SCHEDULE_WRITER, type ScheduleItem, type ScheduleReader, type ScheduleUpdate, type ScheduleWriter } from '../schedule.ports';
import { sameDate, scheduleEvents } from './schedule-events';

export class RescheduleTaskCommand {
  constructor(
    readonly actor: Actor,
    readonly taskId: string,
    readonly input: RescheduleTaskInput,
  ) {}
}

const d = (x: Date | null) => (x ? toDateOnly(x) : null);

/**
 * Drag a bar on the timeline: move the task and (optionally) push dependents — tasks and gated
 * milestones — that would now start before their blocker finishes. One transaction, one
 * `task.rescheduled` per changed task, and the previous dates come back so the web can Undo.
 */
@CommandHandler(RescheduleTaskCommand)
export class RescheduleTaskHandler implements ICommandHandler<RescheduleTaskCommand, RescheduleResultDto> {
  constructor(
    @Inject(SCHEDULE_READER) private readonly reader: ScheduleReader,
    @Inject(SCHEDULE_WRITER) private readonly writer: ScheduleWriter,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly access: AccessService,
    private readonly events: DomainEventPublisher,
  ) {}

  async execute({ actor, taskId, input }: RescheduleTaskCommand): Promise<RescheduleResultDto> {
    const found = await this.reader.scheduleForTask(actor.workspaceId, taskId);
    if (!found || !this.access.allows(actor, 'tasks.view', { projectId: found.task.projectId })) throw new NotFoundError('Task', taskId);
    this.access.assert(actor, 'tasks.edit', { projectId: found.task.projectId });
    const { task, schedule } = found;

    const start = parseDateOnly(input.startDate);
    const end = parseDateOnly(input.dueDate);
    const plan = planReschedule(schedule.items, schedule.edges, task.id, { start, end }, input.shiftDependents);

    const byId = new Map(schedule.items.map((i) => [i.id, i]));
    const changes: { item: ScheduleItem; update: ScheduleUpdate; days: number }[] = [];
    if (!sameDate(task.startDate, start) || !sameDate(task.dueDate, end))
      changes.push({ item: task, update: { kind: 'task', id: task.id, startDate: start, dueDate: end }, days: plan.movedDays });
    for (const [id, days] of Object.entries(plan.shifts)) {
      const item = byId.get(id);
      if (!item || days === 0) continue;
      const shift = (x: Date | null) => (x ? addDays(x, days) : null);
      changes.push({ item, update: { kind: item.kind, id, startDate: shift(item.startDate), dueDate: shift(item.dueDate) }, days });
    }

    if (changes.length) {
      await this.writer.apply(changes.map((c) => c.update));
      this.events.publish(...scheduleEvents(actor, this.clock.now(), changes));
    }

    const moved: ScheduleChangeDto = {
      kind: 'task',
      id: task.id,
      label: task.label,
      days: task.startDate ? diffInDays(task.startDate, start) : plan.movedDays,
      startDate: input.startDate,
      dueDate: input.dueDate,
    };
    return {
      task: moved,
      shifted: changes.filter((c) => c.item.id !== task.id).map((c) => ({ taskId: c.item.id, key: c.item.label, days: c.days, kind: c.item.kind })),
      previous: changes.map((c) => ({ kind: c.item.kind, id: c.item.id, startDate: d(c.item.startDate), dueDate: d(c.item.dueDate) })),
    };
  }
}
