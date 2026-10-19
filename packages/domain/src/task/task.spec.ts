import { describe, expect, it } from 'vitest';
import { Task } from './task';
import { parseDateOnly } from '../shared/dates';
import { ValidationError } from '../shared/errors';

const now = new Date('2026-10-19T09:00:00Z');
const make = (over: Partial<Parameters<typeof Task.create>[0]> = {}) =>
  Task.create(
    {
      id: 't1',
      workspaceId: 'w1',
      keyPrefix: 'HRT',
      number: 142,
      creatorId: 'u1',
      title: 'Write onboarding copy',
      ...over,
    },
    now,
  );

describe('Task aggregate', () => {
  it('creates a task with a key and records task.created', () => {
    const t = make();
    expect(t.key.toString()).toBe('HRT-142');
    expect(t.status).toBe('TODO');
    expect(t.pullEvents().map((e) => e.type)).toEqual(['task.created']);
  });

  it('rejects blank titles in the Hearth voice', () => {
    expect(() => make({ title: '   ' })).toThrow(ValidationError);
  });

  it('rejects a start date after the due date', () => {
    expect(() =>
      make({ startDate: parseDateOnly('2026-10-22'), dueDate: parseDateOnly('2026-10-20') }),
    ).toThrow(/start date/);
  });

  it('completing sets completedAt and progress; reopening clears them', () => {
    const t = make();
    t.pullEvents();
    t.complete('u1', now);
    expect(t.isDone).toBe(true);
    expect(t.toSnapshot().completedAt).toEqual(now);
    expect(t.toSnapshot().progress).toBe(100);
    t.reopen('u1', now);
    expect(t.toSnapshot().completedAt).toBeNull();
    expect(t.toSnapshot().progress).toBe(0);
    expect(t.pullEvents().map((e) => e.type)).toEqual(['task.status_changed', 'task.status_changed']);
  });

  it('starting work records a start date when none was set', () => {
    const t = make();
    t.changeStatus('IN_PROGRESS', 'u1', now);
    expect(t.startDate?.toISOString().slice(0, 10)).toBe('2026-10-19');
  });

  it('is idempotent: no event when nothing changes', () => {
    const t = make({ priority: 'HIGH' });
    t.pullEvents();
    t.prioritize('HIGH', 'u1', now);
    t.assignTo(null, 'u1', now);
    expect(t.pullEvents()).toHaveLength(0);
  });

  it('knows when it is overdue', () => {
    const t = make({ dueDate: parseDateOnly('2026-10-17') });
    expect(t.isOverdue(now)).toBe(true);
    t.complete('u1', now);
    expect(t.isOverdue(now)).toBe(false);
  });

  it('shifts its schedule when a blocker moves', () => {
    const t = make({ startDate: parseDateOnly('2026-10-20'), dueDate: parseDateOnly('2026-10-24') });
    t.shiftSchedule(3, 'u1', now);
    expect(t.toSnapshot().dueDate?.toISOString().slice(0, 10)).toBe('2026-10-27');
  });
});
