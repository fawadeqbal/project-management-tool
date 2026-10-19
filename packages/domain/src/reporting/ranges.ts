import type { ThroughputBucket } from './kpis';

export const REPORT_RANGES = ['2w', '6w', 'q'] as const;
export type ReportRange = (typeof REPORT_RANGES)[number];

/** Dashboard date ranges, in weeks, with the words used in the subtitle. */
export const REPORT_RANGE_META: Record<ReportRange, { weeks: number; label: string; phrase: string }> = {
  '2w': { weeks: 2, label: '2W', phrase: 'last 2 weeks' },
  '6w': { weeks: 6, label: '6W', phrase: 'last 6 weeks' },
  q: { weeks: 13, label: 'Quarter', phrase: 'last quarter' },
};

/** The chart's one-line answer: "Completed ≥ created for 4 of 6 weeks". */
export const throughputVerdict = (buckets: readonly ThroughputBucket[]): { keptUp: number; weeks: number; text: string; tone: 'good' | 'bad' } => {
  const keptUp = buckets.filter((b) => b.completed >= b.created).length;
  const weeks = buckets.length;
  return { keptUp, weeks, text: `Completed ≥ created for ${keptUp} of ${weeks} weeks`, tone: keptUp * 2 >= weeks ? 'good' : 'bad' };
};

/** Budget used is a warning when it runs ahead of progress by more than 20 points, or above 90%. */
export const budgetTone = (budgetUsedPct: number | null, progressPct: number): 'normal' | 'danger' =>
  budgetUsedPct !== null && (budgetUsedPct >= 90 || budgetUsedPct - progressPct > 20) ? 'danger' : 'normal';
