import { randomUUID } from 'node:crypto';
import { addDays, isWeekend, type Sprint } from '@hearth/domain';

export const newSprintId = (): string => `spr_${randomUUID().replace(/-/g, '').slice(0, 20)}`;

/** Next working day after `d`. */
export const nextWorkingDay = (d: Date): Date => {
  let next = addDays(d, 1);
  while (isWeekend(next)) next = addDays(next, 1);
  return next;
};

/** Default cadence: two weeks, starting the working day after the previous sprint ends. */
export const defaultSprintDates = (
  previous: Sprint | null,
  today: Date,
): { startDate: Date; endDate: Date } => {
  const startDate = previous
    ? nextWorkingDay(previous.endDate)
    : isWeekend(today)
      ? nextWorkingDay(today)
      : today;
  return { startDate, endDate: addDays(startDate, 13) };
};
