import { describe, expect, it } from 'vitest';
import { Sprint } from './sprint';
import { averageVelocity, computeBurndown, sprintCapacity } from './burndown';
import { parseDateOnly } from '../shared/dates';

const now = new Date('2026-10-19T09:00:00Z');

describe('Sprint aggregate', () => {
  const plan = () =>
    Sprint.plan({ id: 's24', projectId: 'p', workspaceId: 'w', number: 24, startDate: parseDateOnly('2026-10-13'), endDate: parseDateOnly('2026-10-26') }, 'u', now);

  it('moves planned → active → completed', () => {
    const s = plan();
    s.start(42, false, 'u', now);
    expect(s.status).toBe('ACTIVE');
    s.complete({ completedPoints: 30, unfinishedTaskIds: ['t1'], moveTo: 'backlog' }, 'u', now);
    expect(s.status).toBe('COMPLETED');
    expect(s.pullEvents().map((e) => e.type)).toEqual(['sprint.planned', 'sprint.started', 'sprint.completed']);
  });

  it('refuses a second active sprint', () => {
    expect(() => plan().start(10, true, 'u', now)).toThrow(/already running/);
  });
});

describe('burndown', () => {
  const sprint = { startDate: parseDateOnly('2026-10-13'), endDate: parseDateOnly('2026-10-26'), committedPoints: 38 };
  const snaps = [
    ['2026-10-13', 38, 38],
    ['2026-10-14', 38, 38],
    ['2026-10-15', 33, 38],
    ['2026-10-16', 33, 38],
    ['2026-10-19', 37, 42],
    ['2026-10-20', 29, 42],
    ['2026-10-21', 24, 42],
  ].map(([d, r, s]) => ({ date: parseDateOnly(d as string), remainingPoints: r as number, scopePoints: s as number }));

  it('builds ideal and actual lines over working days and flags scope changes', () => {
    const b = computeBurndown(sprint, snaps, parseDateOnly('2026-10-21'));
    expect(b.totalDays).toBe(9);
    expect(b.ideal[0]!.remaining).toBe(38);
    expect(b.ideal[9]!.remaining).toBe(0);
    expect(b.actual).toHaveLength(7);
    expect(b.scopeChanges).toEqual([{ date: '2026-10-19', day: 4, addedPoints: 4, remaining: 37 }]);
    expect(b.todayIndex).toBe(6);
    expect(b.daysLeft).toBe(3);
  });

  it('computes velocity and capacity warnings', () => {
    expect(averageVelocity([34, 40, 39])).toBe(38);
    expect(sprintCapacity(42, 38).level).toBe('over');
    expect(sprintCapacity(35, 38).level).toBe('near');
  });
});
