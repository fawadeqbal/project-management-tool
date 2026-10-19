import { describe, expect, it } from 'vitest';
import { buildRetrospective, ranksAtTop, sprintSnapshotOf, suggestDeferral, type SprintWorkItem } from './planning-helpers';
import { Sprint } from './sprint';
import { parseDateOnly } from '../shared/dates';

const items: SprintWorkItem[] = [
  { id: '301', status: 'DONE', priority: 'HIGH', points: 5 },
  { id: '306', status: 'IN_PROGRESS', priority: 'URGENT', points: 8 },
  { id: '308', status: 'IN_REVIEW', priority: 'HIGH', points: 5 },
  { id: '310', status: 'TODO', priority: 'MEDIUM', points: 3 },
  { id: '311', status: 'TODO', priority: 'MEDIUM', points: 8 },
  { id: '309', status: 'DONE', priority: 'LOW', points: 5 },
];

describe('sprint planning helpers', () => {
  it('computes remaining and scope for a snapshot', () => {
    expect(sprintSnapshotOf(items)).toEqual({ remainingPoints: 24, scopePoints: 34 });
  });

  it('suggests the lowest-priority unstarted task that closes the gap', () => {
    expect(suggestDeferral(items, 4)?.id).toBe('311');
    expect(suggestDeferral(items, 2)?.id).toBe('310');
    expect(suggestDeferral(items, 0)).toBeNull();
  });

  it('pre-sorts unfinished work for the retrospective', () => {
    const r = buildRetrospective(items);
    expect(r.unfinished.map((t) => t.id)).toEqual(['308', '306', '311', '310']);
    expect(r.completed.map((t) => t.id)).toEqual(['301', '309']);
    expect(r).toMatchObject({ completedPoints: 10, unfinishedPoints: 24, completionPct: 29 });
  });

  it('ranks moved tasks above the current top, in order', () => {
    expect(ranksAtTop(1, 2)).toEqual([1 - 2048, 1 - 1024]);
  });
});

describe('Sprint scope changes', () => {
  const now = new Date('2026-10-19T09:00:00Z');
  const sprint = () => Sprint.plan({ id: 's', projectId: 'p', workspaceId: 'w', number: 25, startDate: parseDateOnly('2026-10-27'), endDate: parseDateOnly('2026-11-09') }, 'u', now);
  it('marks additions after start as scope changes', () => {
    const s = sprint();
    s.addTask({ id: 't1', points: 3 }, 'u', now);
    s.start(3, false, 'u', now);
    s.addTask({ id: 't2', points: 4 }, 'u', now);
    const events = s.pullEvents().filter((e) => e.type === 'sprint.task_added');
    expect(events.map((e) => (e.payload as { afterStart: boolean }).afterStart)).toEqual([false, true]);
  });
  it('refuses changes to a completed sprint', () => {
    const s = sprint();
    s.start(0, false, 'u', now);
    s.complete({ completedPoints: 0, unfinishedTaskIds: [], moveTo: 'backlog' }, 'u', now);
    expect(() => s.removeTask({ id: 't', points: 1 }, 'u', now)).toThrow(/complete/);
  });
});
