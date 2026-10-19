import { describe, expect, it } from 'vitest';
import { breakDownTaskLocally, summarizeTaskLocally, taskKindOf } from './local-heuristics';
import type { AiTaskContext } from './ai-provider';

const pricing: AiTaskContext = {
  key: 'HRT-188',
  title: 'Design pricing page in light and dark mode',
  description: 'Plan cards and a comparison table.',
  status: 'IN_PROGRESS',
  dueDate: '2026-10-19',
  today: '2026-10-19',
  blockedBy: [{ key: 'HRT-182', title: 'Final plan names from Marketing', status: 'IN_PROGRESS' }],
  subtasks: [
    { title: 'Light mode comps', done: true },
    { title: 'Dark mode contrast fixes', done: false },
  ],
  comments: [
    { author: 'Sara Ahmed', body: '@Fawad the annual toggle label is 3.9:1 in dark mode', createdAt: '2026-10-19T08:00:00Z' },
    { author: 'Mo Khan', body: 'Nav is ready for the new pricing link once this lands.', createdAt: '2026-10-19T09:00:00Z' },
  ],
};

describe('local AI heuristics', () => {
  it('summarizes from subtasks, comments and blockers, deterministically', () => {
    const a = summarizeTaskLocally(pricing);
    expect(a).toEqual(summarizeTaskLocally(pricing));
    expect(a.source).toBe('generated from 2 comments');
    expect(a.text).toContain('“Light mode comps” is done.');
    expect(a.text).toContain('Blocked until “Final plan names from Marketing” (HRT-182) is done.');
    expect(a.text).toContain('Suggested next step: ship what’s done (light mode comps) behind a flag while HRT-182 is open.');
    expect(a.text).toContain('due today');
  });

  it('breaks a task into 3–6 subtasks by type, skipping existing ones', () => {
    const b = breakDownTaskLocally({ ...pricing, subtasks: [] });
    expect(taskKindOf(pricing.title)).toBe('design');
    expect(b.subtasks.length).toBeGreaterThanOrEqual(3);
    expect(b.subtasks.length).toBeLessThanOrEqual(6);
    expect(b.subtasks[0]).toBe('Gather references and requirements for pricing page in light and dark mode');
    expect(b).toEqual(breakDownTaskLocally({ ...pricing, subtasks: [] }));
  });

  it('prefers bullet steps from the description', () => {
    const b = breakDownTaskLocally({ ...pricing, title: 'Fix broken links', description: '- Crawl the blog\n- Patch redirects', subtasks: [] });
    expect(b.subtasks.slice(0, 2)).toEqual(['Crawl the blog', 'Patch redirects']);
    expect(b.subtasks.length).toBeGreaterThanOrEqual(3);
  });
});
