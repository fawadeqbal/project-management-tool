import type { WorkloadDto } from '@hearth/contracts';
import { addDays, parseDateOnly, startOfDay, toDateOnly } from '@hearth/domain';

/** Monday of the week `weekOffset` weeks from the week containing `today`. */
export const mondayFor = (today: Date, weekOffset: number): Date => {
  const d = startOfDay(today);
  const dow = d.getUTCDay();
  return addDays(d, (dow === 0 ? -6 : 1 - dow) + weekOffset * 7);
};

/** This week + next: Monday → Friday of the following week. */
export const rangeFor = (today: Date, weekOffset: number): { from: string; to: string } => {
  const monday = mondayFor(today, weekOffset);
  return { from: toDateOnly(monday), to: toDateOnly(addDays(monday, 11)) };
};

export const dayLabelOf = (w: WorkloadDto, date: string): string =>
  w.days.find((d) => d.date === date)?.label ?? date;

export const isoToday = (now = new Date()) => toDateOnly(now);
export const parse = parseDateOnly;
