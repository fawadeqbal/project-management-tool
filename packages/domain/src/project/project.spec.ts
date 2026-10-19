import { describe, expect, it } from 'vitest';
import { parseDateOnly } from '../shared/dates';
import { parseWipLimits, Project } from './project';
import { largestSlip } from './schedule-slip';
import { wipLevel } from './project-health';

const now = new Date('2026-10-19T09:00:00Z');
const make = () =>
  Project.create({ id: 'p1', workspaceId: 'w1', ownerId: 'u1', name: '  Website relaunch ', color: 'blue', dueDate: parseDateOnly('2026-11-14') }, now);

describe('Project aggregate', () => {
  it('creates with a trimmed name and records project.created', () => {
    const p = make();
    expect(p.name).toBe('Website relaunch');
    expect(p.pullEvents().map((e) => e.type)).toEqual(['project.created']);
  });

  it('rejects a blank name and a due date before the start', () => {
    expect(() => Project.create({ id: 'p', workspaceId: 'w', ownerId: 'u', name: ' ' }, now)).toThrow(/can’t be empty/);
    expect(() =>
      Project.create({ id: 'p', workspaceId: 'w', ownerId: 'u', name: 'X', startDate: parseDateOnly('2026-11-02'), dueDate: parseDateOnly('2026-11-01') }, now),
    ).toThrow(/on or after/);
  });

  it('keeps sections densely ordered through add, move and remove', () => {
    const p = make();
    p.addSection('a', 'Discovery', null, 'u1', now);
    p.addSection('c', 'Build', null, 'u1', now);
    p.addSection('b', 'Design', 'c', 'u1', now);
    expect(p.sections.map((s) => [s.name, s.position])).toEqual([['Discovery', 0], ['Design', 1], ['Build', 2]]);
    p.moveSection('c', 0, 'u1', now);
    expect(p.sections.map((s) => s.id)).toEqual(['c', 'a', 'b']);
    p.removeSection('a', 'u1', now);
    expect(p.sections.map((s) => [s.id, s.position])).toEqual([['c', 0], ['b', 1]]);
    expect(() => p.addSection('d', 'design', null, 'u1', now)).toThrow(/already a “design”/);
  });

  it('validates WIP limits and reports changed fields', () => {
    const p = make();
    p.pullEvents();
    expect(p.update({ wipLimits: { IN_PROGRESS: 4 } }, 'u1', now)).toEqual(['wipLimits']);
    expect(p.wipLimits).toEqual({ IN_PROGRESS: 4 });
    expect(() => p.update({ wipLimits: { DONE: 3 } }, 'u1', now)).toThrow(/Done column/);
    expect(() => p.update({ wipLimits: { IN_REVIEW: 0 } }, 'u1', now)).toThrow(/between 1 and/);
    p.update({ wipLimits: { IN_PROGRESS: null } }, 'u1', now);
    expect(p.wipLimits).toEqual({});
  });

  it('records a health change separately', () => {
    const p = make();
    p.pullEvents();
    p.update({ health: 'AT_RISK', name: 'Website relaunch' }, 'u1', now);
    expect(p.pullEvents().map((e) => e.type)).toEqual(['project.health_changed', 'project.updated']);
  });

  it('parses persisted WIP JSON defensively', () => {
    expect(parseWipLimits({ IN_PROGRESS: 4, DONE: 2, TODO: 'x', BLOCKED: 0 })).toEqual({ IN_PROGRESS: 4 });
    expect(parseWipLimits(null)).toEqual({});
  });
});

describe('wipLevel', () => {
  it('is ok without a limit, near one below, over above', () => {
    expect(wipLevel(10, null)).toBe('ok');
    expect(wipLevel(2, 4)).toBe('ok');
    expect(wipLevel(3, 4)).toBe('near');
    expect(wipLevel(4, 4)).toBe('near');
    expect(wipLevel(5, 4)).toBe('over');
  });
});

describe('largestSlip', () => {
  it('finds the open task furthest behind its baseline', () => {
    const d = parseDateOnly;
    const slip = largestSlip([
      { id: 'a', start: d('2026-10-23'), baselineStart: d('2026-10-21') },
      { id: 'b', start: d('2026-10-20'), baselineStart: d('2026-10-25') },
      { id: 'c', start: d('2026-10-30'), baselineStart: d('2026-10-20'), done: true },
    ]);
    expect(slip).toEqual({ task: expect.objectContaining({ id: 'a' }), days: 2 });
  });
});
