import { describe, expect, it } from 'vitest';
import { makeTask } from '@/test/render';
import { buildDays, rangeTitle, rangeWindow, stepCursor, visibleDays } from './calendar-model';

describe('calendar model', () => {
  it('covers October 2026 with whole Sun–Sat weeks', () => {
    const days = visibleDays('2026-10-19', 'month');
    expect(days[0]).toBe('2026-09-27');
    expect(days.at(-1)).toBe('2026-10-31');
    expect(days).toHaveLength(35);
    expect(rangeTitle('2026-10-19', 'month')).toBe('October 2026');
  });

  it('buckets tasks by due date, marks today and weekends, open before done', () => {
    const tasks = [
      makeTask({ id: 'a', key: 'HRT-1', title: 'Done one', status: 'DONE', dueDate: '2026-10-19' }),
      makeTask({ id: 'b', key: 'HRT-2', title: 'Open one', dueDate: '2026-10-19' }),
      makeTask({ id: 'c', key: 'HRT-3', title: 'No date' }),
    ];
    const days = buildDays(tasks, '2026-10-19', 'month', '2026-10-19');
    const today = days.find((d) => d.date === '2026-10-19')!;
    expect(today.isToday).toBe(true);
    expect(today.tasks.map((t) => t.id)).toEqual(['b', 'a']);
    expect(days.find((d) => d.date === '2026-10-18')!.weekend).toBe(true);
    expect(days.find((d) => d.date === '2026-09-30')!.inMonth).toBe(false);
  });

  it('steps and windows by range', () => {
    expect(stepCursor('2026-10-19', 'month', 1)).toBe('2026-11-01');
    expect(stepCursor('2026-10-19', 'week', -1)).toBe('2026-10-12');
    expect(rangeWindow('2026-10-19', 'week')).toEqual({ from: '2026-10-18', to: '2026-10-24' });
    expect(rangeWindow('2026-10-19', 'day')).toEqual({ from: '2026-10-19', to: '2026-10-19' });
  });
});
