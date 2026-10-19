import { diffInDays } from '../shared/dates';

export interface SlipCandidate {
  id: string;
  start: Date | null;
  baselineStart: Date | null;
  done?: boolean;
}

/**
 * The open task that slipped furthest against its baseline start ("pricing slipped 2 days").
 * Only forward slips count; done work and tasks without a baseline are ignored.
 */
export const largestSlip = <T extends SlipCandidate>(tasks: readonly T[]): { task: T; days: number } | null => {
  let best: { task: T; days: number } | null = null;
  for (const t of tasks) {
    if (t.done || !t.start || !t.baselineStart) continue;
    const days = diffInDays(t.baselineStart, t.start);
    if (days > 0 && (!best || days > best.days)) best = { task: t, days };
  }
  return best;
};
