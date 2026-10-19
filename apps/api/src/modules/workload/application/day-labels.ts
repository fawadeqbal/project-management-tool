import { addDays, parseDateOnly, startOfDay, toDateOnly, weekdayName } from '@hearth/domain';

/** Monday of the week containing `d`. */
export const mondayOf = (d: Date): Date => {
  const day = startOfDay(d).getUTCDay();
  return addDays(d, day === 0 ? -6 : 1 - day);
};

/** "Mon 19" */
export const dayLabel = (iso: string): string => {
  const d = parseDateOnly(iso);
  return `${weekdayName(d)} ${d.getUTCDate()}`;
};

/**
 * Human label for a set of working days, grouping consecutive ones: "Wed–Thu", "Tue, Thu".
 * With `withDates` the day numbers are kept ("Thu 22 – Fri 23") — used for time off.
 */
export const dayRangeLabel = (days: readonly string[], withDates = false): string => {
  if (!days.length) return '';
  const sorted = [...days].sort();
  const groups: string[][] = [];
  for (const iso of sorted) {
    const last = groups[groups.length - 1];
    const prev = last?.[last.length - 1];
    // Consecutive working days: next calendar day, or Fri → Mon.
    const gap = prev ? (parseDateOnly(iso).getTime() - parseDateOnly(prev).getTime()) / 86_400_000 : Infinity;
    const isNext = gap === 1 || (gap === 3 && parseDateOnly(iso).getUTCDay() === 1);
    if (last && isNext) last.push(iso);
    else groups.push([iso]);
  }
  const fmt = (iso: string) => (withDates ? dayLabel(iso) : weekdayName(parseDateOnly(iso)));
  return groups
    .map((g) => (g.length === 1 ? fmt(g[0]!) : withDates ? `${fmt(g[0]!)} – ${fmt(g[g.length - 1]!)}` : `${fmt(g[0]!)}–${fmt(g[g.length - 1]!)}`))
    .join(', ');
};

export const toIso = toDateOnly;
