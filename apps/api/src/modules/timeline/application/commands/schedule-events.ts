import { createEvent, toDateOnly, type Actor, type DomainEvent } from '@hearth/domain';
import type { ScheduleItem, ScheduleUpdate } from '../schedule.ports';

/** Same payload shape as the domain's TaskRescheduled; milestones get milestone.rescheduled. */
export const scheduleEvents = (actor: Actor, now: Date, changes: { item: ScheduleItem; update: ScheduleUpdate }[]): DomainEvent[] =>
  changes.map(({ item, update }) => {
    const base = { workspaceId: actor.workspaceId, actorId: actor.userId, aggregateId: item.id, occurredAt: now };
    const startDate = update.startDate ? toDateOnly(update.startDate) : null;
    const dueDate = update.dueDate ? toDateOnly(update.dueDate) : null;
    return item.kind === 'task'
      ? createEvent('task.rescheduled', base, { key: item.label, startDate, dueDate, projectId: item.projectId })
      : createEvent('milestone.rescheduled', base, { name: item.label, date: dueDate, projectId: item.projectId });
  });

export const sameDate = (a: Date | null, b: Date | null) => (a?.getTime() ?? null) === (b?.getTime() ?? null);
