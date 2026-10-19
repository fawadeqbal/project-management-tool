import { describe, expect, it } from 'vitest';
import { parseDateOnly } from '../shared/dates';
import { planReschedule } from './reschedule';

const n = (id: string, s: string, e: string, extra: object = {}) => ({
  id,
  start: parseDateOnly(s),
  end: parseDateOnly(e),
  ...extra,
});
const nodes = [
  n('pricing', '2026-10-23', '2026-10-30'),
  n('nav', '2026-10-31', '2026-11-07'),
  n('qa', '2026-11-08', '2026-11-13'),
  n('launch', '2026-11-14', '2026-11-14', { kind: 'milestone' }),
  n('copy', '2026-10-21', '2026-10-29'),
];
const edges = [
  { blockerId: 'pricing', blockedId: 'nav' },
  { blockerId: 'nav', blockedId: 'qa' },
  { blockerId: 'qa', blockedId: 'launch' },
];

describe('planReschedule', () => {
  it('pushes the whole chain, milestones included, by the minimum needed', () => {
    const plan = planReschedule(
      nodes,
      edges,
      'pricing',
      { start: parseDateOnly('2026-10-25'), end: parseDateOnly('2026-11-01') },
      true,
    );
    expect(plan.movedDays).toBe(2);
    expect(plan.shifts).toEqual({ nav: 2, qa: 2, launch: 2 });
  });

  it('never pulls dependents back when a task moves earlier', () => {
    const plan = planReschedule(
      nodes,
      edges,
      'pricing',
      { start: parseDateOnly('2026-10-20'), end: parseDateOnly('2026-10-27') },
      true,
    );
    expect(plan.movedDays).toBe(-3);
    expect(plan.shifts).toEqual({});
  });

  it('leaves dependents alone when shifting is off', () => {
    const plan = planReschedule(
      nodes,
      edges,
      'pricing',
      { start: parseDateOnly('2026-10-30'), end: parseDateOnly('2026-11-05') },
      false,
    );
    expect(plan.shifts).toEqual({});
  });

  it('rejects a due date before the start', () => {
    expect(() =>
      planReschedule(
        nodes,
        edges,
        'pricing',
        { start: parseDateOnly('2026-10-30'), end: parseDateOnly('2026-10-20') },
        true,
      ),
    ).toThrow(/on or after/);
  });
});
