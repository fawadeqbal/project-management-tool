import { describe, expect, it } from 'vitest';
import { classifyLoad, computeWorkload, suggestRebalance, summarizeWorkload } from './workload';
import { parseDateOnly } from '../shared/dates';

const d = parseDateOnly;
const range = { from: d('2026-10-19'), to: d('2026-10-23') }; // Mon–Fri

describe('workload', () => {
  const people = [
    { userId: 'mo', capacityHoursPerDay: 8 },
    { userId: 'ravi', capacityHoursPerDay: 8 },
    { userId: 'jia', capacityHoursPerDay: 8 },
  ];
  const tasks = [
    { id: 'nav', assigneeId: 'mo', startDate: d('2026-10-19'), dueDate: d('2026-10-23'), estimateHours: 40 },
    {
      id: 'events',
      assigneeId: 'mo',
      startDate: d('2026-10-21'),
      dueDate: d('2026-10-22'),
      estimateHours: 6,
    },
    { id: 'api', assigneeId: 'ravi', startDate: d('2026-10-19'), dueDate: d('2026-10-20'), estimateHours: 4 },
    {
      id: 'copy',
      assigneeId: 'jia',
      startDate: d('2026-10-19'),
      dueDate: d('2026-10-23'),
      estimateHours: 12,
    },
  ];
  const timeOff = [{ userId: 'jia', startDate: d('2026-10-22'), endDate: d('2026-10-23') }];

  it('spreads hours over working days and flags overload', () => {
    const [mo, ravi, jia] = computeWorkload(people, tasks, timeOff, range);
    expect(mo!.cells.map((c) => c.planned)).toEqual([8, 8, 11, 11, 8]);
    expect(mo!.overDays).toEqual(['2026-10-21', '2026-10-22']);
    expect(ravi!.cells[0]!.state).toBe('light');
    // Time off is never "free": hours move to the days Jia works.
    expect(jia!.cells.map((c) => c.state)).toEqual(['normal', 'normal', 'normal', 'off', 'off']);
    expect(jia!.cells[0]!.planned).toBe(4);
  });

  it('summarizes and suggests a rebalance', () => {
    const rows = computeWorkload(people, tasks, timeOff, range);
    const s = summarizeWorkload(rows);
    expect(s.overCapacity).toEqual([{ userId: 'mo', days: ['2026-10-21', '2026-10-22'] }]);
    expect(s.timeOff[0]!.userId).toBe('jia');
    const [suggestion] = suggestRebalance(rows, tasks, { mo: 'Mo', ravi: 'Ravi' });
    expect(suggestion).toMatchObject({ taskId: 'events', fromUserId: 'mo', toUserId: 'ravi' });
  });

  it('classifies load', () => {
    expect(classifyLoad(0, 8)).toBe('free');
    expect(classifyLoad(9, 8)).toBe('over');
    expect(classifyLoad(3, 0)).toBe('off');
  });
});

describe('workload cell items and suggestion projections', () => {
  const people = [
    { userId: 'mo', capacityHoursPerDay: 8 },
    { userId: 'ravi', capacityHoursPerDay: 8 },
  ];
  const tasks = [
    { id: 'nav', assigneeId: 'mo', startDate: d('2026-10-19'), dueDate: d('2026-10-23'), estimateHours: 40 },
    {
      id: 'events',
      assigneeId: 'mo',
      startDate: d('2026-10-21'),
      dueDate: d('2026-10-22'),
      estimateHours: 6,
    },
  ];
  it('records each task share per cell', () => {
    const [mo] = computeWorkload(people, tasks, [], range);
    expect(mo!.cells[2]!.items).toEqual([
      { taskId: 'nav', amount: 8 },
      { taskId: 'events', amount: 3 },
    ]);
  });
  it('projects load before and after a suggested move', () => {
    const rows = computeWorkload(people, tasks, [], range);
    const [s] = suggestRebalance(rows, tasks);
    expect(s).toMatchObject({
      taskId: 'events',
      days: ['2026-10-21', '2026-10-22'],
      totalHours: 6,
      fromLoadPct: 115,
      toLoadPct: 0,
    });
    expect(s!.fromLoadPctAfter).toBe(100);
    expect(s!.toLoadPctAfter).toBe(15);
  });
});

describe('workload range', () => {
  it('accepts up to 92 days and rejects longer or backwards ranges', async () => {
    const { assertWorkloadRange } = await import('./workload');
    expect(() => assertWorkloadRange(d('2026-10-01'), d('2026-12-31'))).not.toThrow(); // 92 days
    expect(() => assertWorkloadRange(d('2026-10-01'), d('2027-01-01'))).toThrow(/92 days/);
    expect(() => assertWorkloadRange(d('2026-10-02'), d('2026-10-01'))).toThrow(/on or after/);
  });
});
