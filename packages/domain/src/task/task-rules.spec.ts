import { describe, expect, it } from 'vitest';
import { buildTaskSpecification, IsOverdue, AssignedTo } from './task-specifications';
import { groupAndSort } from './task-grouping';
import { parseQuickAdd } from './quick-add-parser';
import { DependencyGraph } from './dependency-graph';
import { humanizeDate, parseDateOnly } from '../shared/dates';
import type { FilterableTask } from './task-view';

const today = parseDateOnly('2026-10-19'); // a Monday
const t = (over: Partial<FilterableTask>): FilterableTask => ({
  id: over.key ?? 'x',
  key: 'HRT-1',
  title: 'Task',
  status: 'TODO',
  priority: 'NONE',
  assigneeId: 'fawad',
  projectId: 'web',
  dueDate: null,
  ...over,
});

describe('specifications', () => {
  it('compose with and/not', () => {
    const tasks = [
      t({ key: 'A', dueDate: '2026-10-17' }),
      t({ key: 'B', dueDate: '2026-10-17', assigneeId: 'sara' }),
      t({ key: 'C', dueDate: '2026-10-25' }),
    ];
    const spec = new IsOverdue(today).and(new AssignedTo(['sara']).not());
    expect(spec.filter(tasks).map((x) => x.key)).toEqual(['A']);
    expect(spec.describe()).toBe('overdue and not assigned to selected people');
  });

  it('builds from a serializable filter and hides done work by default', () => {
    const spec = buildTaskSpecification({ text: 'pricing' }, today);
    expect(spec.isSatisfiedBy(t({ title: 'Pricing page' }))).toBe(true);
    expect(spec.isSatisfiedBy(t({ title: 'Pricing page', status: 'DONE' }))).toBe(false);
  });
});

describe('grouping strategies', () => {
  it('groups by due date with Overdue first and Today always present', () => {
    const groups = groupAndSort(
      [
        t({ key: 'A', dueDate: '2026-10-17', priority: 'URGENT' }),
        t({ key: 'B', dueDate: '2026-10-20' }),
        t({ key: 'C', dueDate: '2026-11-30' }),
      ],
      'due',
      'priority',
      { today },
    );
    expect(groups.map((g) => g.label)).toEqual(['Overdue', 'Today', 'Upcoming', 'Later']);
    expect(groups[0]!.tone).toBe('danger');
  });

  it('sorts by priority inside groups', () => {
    const [g] = groupAndSort(
      [t({ key: 'L', priority: 'LOW' }), t({ key: 'U', priority: 'URGENT' })],
      'none',
      'priority',
      { today },
    );
    expect(g!.items.map((x) => x.key)).toEqual(['U', 'L']);
  });
});

describe('quick add', () => {
  it('extracts assignee, project, priority and a trailing date', () => {
    const p = parseQuickAdd('Draft sprint 24 retro agenda @sara #website !high tomorrow', today);
    expect(p).toMatchObject({
      title: 'Draft sprint 24 retro agenda',
      assigneeHandle: 'sara',
      projectHandle: 'website',
      priority: 'HIGH',
    });
    expect(p.dueDate?.toISOString().slice(0, 10)).toBe('2026-10-20');
  });

  it('understands weekdays and explicit dates', () => {
    expect(parseQuickAdd('Prep walkthrough thu', today).dueDate?.toISOString().slice(0, 10)).toBe(
      '2026-10-22',
    );
    expect(parseQuickAdd('QA swipe ^oct 26', today).dueDate?.toISOString().slice(0, 10)).toBe('2026-10-26');
  });

  it('keeps unknown tokens in the title', () => {
    expect(parseQuickAdd('Email @ the team !nope', today).title).toBe('Email @ the team !nope');
  });
});

describe('dependency graph', () => {
  it('rejects cycles and finds downstream tasks', () => {
    const g = new DependencyGraph([
      { blockerId: 'wire', blockedId: 'pricing' },
      { blockerId: 'pricing', blockedId: 'nav' },
    ]);
    expect(() => g.assertCanLink('nav', 'wire')).toThrow(/loop/);
    expect(g.downstreamOf('wire')).toEqual(['pricing', 'nav']);
  });
});

describe('human dates', () => {
  it('speaks like a person', () => {
    expect(humanizeDate(parseDateOnly('2026-10-19'), today)).toBe('Today');
    expect(humanizeDate(parseDateOnly('2026-10-17'), today)).toBe('2 days ago');
    expect(humanizeDate(parseDateOnly('2026-10-22'), today)).toBe('Thu');
    expect(humanizeDate(parseDateOnly('2026-10-26'), today)).toBe('Oct 26');
  });
});
