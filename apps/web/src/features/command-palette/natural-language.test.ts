import { describe, expect, it } from 'vitest';
import { interpretQuery, type NlContext } from './natural-language';

const ctx: NlContext = {
  tags: [{ name: 'Design' }, { name: 'Engineering' }],
  teams: [{ id: 't-mkt', name: 'Marketing' }],
  projects: [{ id: 'p-web', name: 'Website relaunch' }],
  members: [{ id: 'u-sara', name: 'Sara Ahmed' }],
};

describe('interpretQuery (Ask Hearth heuristic)', () => {
  it('needs at least two words', () => {
    expect(interpretQuery('overdue', ctx)).toBeNull();
  });

  it('"overdue design" → overdue tasks tagged Design', () => {
    const r = interpretQuery('overdue design', ctx)!;
    expect(r.params).toEqual({ overdue: '1', tag: 'Design' });
    expect(r.href).toBe('/my-tasks?overdue=1&tag=Design');
    expect(r.label).toBe('Show overdue tasks tagged Design');
  });

  it('matches teams, projects, people, status and priority', () => {
    expect(interpretQuery('blocked marketing tasks', ctx)!.params).toEqual({
      status: 'BLOCKED',
      team: 't-mkt',
    });
    expect(interpretQuery('urgent website relaunch', ctx)!.params).toEqual({
      priority: 'URGENT',
      project: 'p-web',
    });
    const sara = interpretQuery('tasks for sara due today', ctx)!;
    expect(sara.params).toEqual({ due: 'today', assignee: 'u-sara' });
    expect(sara.label).toBe('Show tasks assigned to Sara Ahmed due today');
  });

  it('keeps unrecognized words as a text filter', () => {
    expect(interpretQuery('overdue pricing copy', ctx)!.params).toEqual({ overdue: '1', q: 'pricing copy' });
  });

  it('returns null for plain searches with nothing recognized', () => {
    expect(interpretQuery('pricing page copy', ctx)).toBeNull();
  });
});
