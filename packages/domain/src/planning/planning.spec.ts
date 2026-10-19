import { describe, expect, it } from 'vitest';
import { computeCriticalPath } from './critical-path';
import { findScheduleConflicts, planDependentShifts } from './schedule-rules';
import { parseDateOnly } from '../shared/dates';

const n = (id: string, s: string, e: string, extra: object = {}) => ({ id, start: parseDateOnly(s), end: parseDateOnly(e), ...extra });

// The Website relaunch plan from the Timeline design.
const nodes = [
  n('wire', '2026-10-18', '2026-10-22'),
  n('pricing', '2026-10-23', '2026-10-30'),
  n('copy', '2026-10-21', '2026-10-29'),
  n('nav', '2026-10-31', '2026-11-07'),
  n('analytics', '2026-11-04', '2026-11-09'),
  n('qa', '2026-11-08', '2026-11-13'),
  n('launch', '2026-11-14', '2026-11-14', { kind: 'milestone' }),
];
const edges = [
  { blockerId: 'wire', blockedId: 'pricing' },
  { blockerId: 'pricing', blockedId: 'nav' },
  { blockerId: 'nav', blockedId: 'analytics' },
  { blockerId: 'nav', blockedId: 'qa' },
  { blockerId: 'qa', blockedId: 'launch' },
];

describe('critical path', () => {
  it('marks the longest dependency chain as critical', () => {
    const r = computeCriticalPath(nodes, edges);
    expect(r.criticalIds).toEqual(expect.arrayContaining(['wire', 'pricing', 'nav', 'qa', 'launch']));
    expect(r.criticalIds).not.toContain('copy');
    expect(r.floatDays['copy']).toBeGreaterThan(0);
    expect(r.projectFinish?.toISOString().slice(0, 10)).toBe('2026-11-13');
  });

  it('handles an empty plan', () => {
    expect(computeCriticalPath([], []).projectFinish).toBeNull();
  });
});

describe('schedule rules', () => {
  it('flags a task that starts before its blocker ends', () => {
    expect(findScheduleConflicts(nodes, edges)).toEqual([{ taskId: 'analytics', blockerId: 'nav', overlapDays: 4 }]);
  });

  it('pushes dependents forward when a blocker slips', () => {
    const slipped = nodes.map((x) => (x.id === 'pricing' ? n('pricing', '2026-10-23', '2026-11-02') : x));
    const shifts = planDependentShifts(slipped, edges, 'pricing');
    expect(shifts['nav']).toBe(3);
    expect(shifts['qa']).toBe(3);
  });
});
