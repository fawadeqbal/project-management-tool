import { describe, expect, it } from 'vitest';
import { computeKpis, statusMix, weeklyThroughput } from './kpis';
import { evaluateHealth, wipLevel } from '../project/project-health';
import { fuzzyMatch, fuzzyRank } from '../search/fuzzy';
import { onboardingProgress } from '../onboarding/checklist';
import { interpretTaskQuery } from '../ai/ai-provider';
import { parseDateOnly } from '../shared/dates';

const today = parseDateOnly('2026-10-19');
const d = parseDateOnly;

describe('reporting', () => {
  const tasks = [
    { status: 'DONE' as const, createdAt: d('2026-10-01'), startDate: d('2026-10-02'), dueDate: d('2026-10-10'), completedAt: d('2026-10-08'), projectId: 'p' },
    { status: 'DONE' as const, createdAt: d('2026-10-05'), startDate: null, dueDate: d('2026-10-09'), completedAt: d('2026-10-12'), projectId: 'p' },
    { status: 'TODO' as const, createdAt: d('2026-10-12'), startDate: null, dueDate: d('2026-10-15'), completedAt: null, projectId: 'p' },
    { status: 'BLOCKED' as const, createdAt: d('2026-10-14'), startDate: null, dueDate: null, completedAt: null, projectId: 'p' },
  ];

  it('computes KPI tiles with tone', () => {
    const [completed, onTime, cycle, overdue] = computeKpis(tasks, today);
    expect(completed!.value).toBe('2');
    expect(onTime!.value).toBe('50%');
    expect(cycle!.value).toBe('6.5 days');
    expect(overdue!.value).toBe('1');
  });

  it('buckets created vs completed by week and mixes statuses', () => {
    const weeks = weeklyThroughput(tasks, today, 3);
    expect(weeks.map((w) => w.label)).toEqual(['Oct 5', 'Oct 12', 'Oct 19']);
    expect(weeks[0]).toMatchObject({ created: 1, completed: 1 });
    expect(statusMix(tasks).find((s) => s.status === 'BLOCKED')!.pct).toBe(50);
  });
});

describe('project health', () => {
  it('flags projects falling behind the clock', () => {
    const base = { totalTasks: 10, overdueTasks: 0, blockedTasks: 0, startDate: d('2026-10-01'), dueDate: d('2026-10-31') };
    expect(evaluateHealth({ ...base, doneTasks: 6 }, today).health).toBe('ON_TRACK');
    expect(evaluateHealth({ ...base, doneTasks: 4 }, today).health).toBe('AT_RISK');
    expect(evaluateHealth({ ...base, doneTasks: 2 }, today).health).toBe('OFF_TRACK');
    expect(wipLevel(3, 4)).toBe('near');
  });
});

describe('search, onboarding, ai query', () => {
  it('ranks exact and word-start matches first', () => {
    const items = ['Design pricing page', 'Review Q3 analytics dashboard', 'Update pricing table'];
    expect(fuzzyRank('pric', items, (x) => [x]).map((r) => r.item)).toEqual(['Design pricing page', 'Update pricing table']);
    expect(fuzzyMatch('dpp', 'Design pricing page')).not.toBeNull();
    expect(fuzzyMatch('xyz', 'Design pricing page')).toBeNull();
  });

  it('tracks the checklist with one next step', () => {
    const p = onboardingProgress(['create-workspace', 'start-from-template', 'create-first-task']);
    expect(p).toMatchObject({ completed: 3, total: 5, nextStep: 'Invite 2 teammates' });
  });

  it('interprets “overdue design”', () => {
    const q = interpretTaskQuery('Show overdue tasks for the Design team', { tags: ['Design'], teamsOrProjects: ['Design', 'Engineering'], people: ['Sara'] });
    expect(q).toMatchObject({ overdue: true, teamOrProject: 'Design' });
    expect(q.explanation).toBe('Show overdue tasks for Design');
  });
});

describe('computeKpis without history', () => {
  it('marks deltas neutral when the previous window has nothing to compare', () => {
    const today = new Date('2026-10-19T00:00:00Z');
    const kpis = computeKpis([{ status: 'DONE', createdAt: new Date('2026-10-10'), startDate: null, dueDate: new Date('2026-10-12'), completedAt: new Date('2026-10-11'), projectId: null }], today, 6);
    expect(kpis.slice(0, 3).map((k) => [k.delta, k.deltaTone])).toEqual([
      ['New', 'neutral'],
      ['New', 'neutral'],
      ['New', 'neutral'],
    ]);
    expect(kpis[0]!.sub).toBe('no data before the last 6 weeks');
  });
});
