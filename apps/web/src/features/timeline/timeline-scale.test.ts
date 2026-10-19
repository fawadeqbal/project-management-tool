import { describe, expect, it } from 'vitest';
import { barGeometry, chartRange, headerCells, linkPath, makeScale, PX_PER_DAY } from './timeline-scale';

describe('timeline scale', () => {
  it('maps dates to x at the zoom’s px/day', () => {
    const week = makeScale('2026-10-11', '2026-11-21', 'week');
    expect(week.px).toBe(19);
    expect(week.x('2026-10-18')).toBe(7 * 19);
    expect(week.width).toBe(42 * 19);
    expect(week.dateAt(7 * 19 + 3)).toBe('2026-10-18');
    const day = makeScale('2026-10-11', '2026-11-21', 'day');
    expect(day.x('2026-10-18')).toBe(7 * PX_PER_DAY.day);
  });

  it('builds Sunday weeks and month headers', () => {
    const week = makeScale('2026-10-11', '2026-11-21', 'week');
    expect(headerCells(week, 'week').map((c) => c.label)).toEqual([
      'Oct 11',
      'Oct 18',
      'Oct 25',
      'Nov 1',
      'Nov 8',
      'Nov 15',
    ]);
    const month = makeScale('2026-10-11', '2026-11-21', 'month');
    expect(headerCells(month, 'month').map((c) => c.label)).toEqual(['October', 'November']);
  });

  it('sizes bars inclusively and draws connectors bar end → bar start', () => {
    const s = makeScale('2026-10-11', '2026-11-21', 'week');
    expect(barGeometry(s, '2026-10-23', '2026-10-30')).toEqual({ left: 12 * 19 + 1, width: 8 * 19 - 2 });
    const rows = [
      {
        kind: 'task' as const,
        id: 'a',
        key: 'A',
        title: 'A',
        status: 'TODO' as const,
        sectionId: null,
        startDate: '2026-10-23',
        dueDate: '2026-10-30',
        baselineStart: null,
        baselineDue: null,
        progress: 0,
        assignee: null,
        critical: true,
      },
      {
        kind: 'milestone' as const,
        id: 'm',
        name: 'Launch',
        date: '2026-11-14',
        done: false,
        critical: true,
      },
    ];
    expect(linkPath(rows, s, { fromId: 'a', toId: 'm', critical: true })).toMatch(/^M\d+ 20 C .* 60$/);
  });

  it('extends a short window to fill the chart', () => {
    expect(chartRange({ from: '2026-10-11', to: '2026-11-21' }, 'quarter', 900).to > '2026-11-21').toBe(true);
    expect(chartRange({ from: '2026-10-11', to: '2026-11-21' }, 'day', 900)).toEqual({
      from: '2026-10-11',
      to: '2026-11-21',
    });
  });
});
