import { describe, expect, it } from 'vitest';
import { parseDateOnly } from '@hearth/domain';
import { dayLabel, dayRangeLabel, mondayOf } from './day-labels';

describe('workload day labels', () => {
  it('labels days and ranges in the Hearth voice', () => {
    expect(dayLabel('2026-10-19')).toBe('Mon 19');
    expect(dayRangeLabel(['2026-10-21', '2026-10-22'])).toBe('Wed–Thu');
    expect(dayRangeLabel(['2026-10-20', '2026-10-22'])).toBe('Tue, Thu');
    expect(dayRangeLabel(['2026-10-23', '2026-10-26'])).toBe('Fri–Mon');
    expect(dayRangeLabel(['2026-10-22', '2026-10-23'], true)).toBe('Thu 22 – Fri 23');
  });
  it('finds Monday of the week', () => {
    expect(mondayOf(parseDateOnly('2026-10-25')).toISOString().slice(0, 10)).toBe('2026-10-19');
    expect(mondayOf(parseDateOnly('2026-10-19')).toISOString().slice(0, 10)).toBe('2026-10-19');
  });
});
