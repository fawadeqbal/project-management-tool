import { describe, expect, it } from 'vitest';
import { inferOnboardingSteps, onboardingProgress } from './checklist';
import { PROJECT_TEMPLATES, findTemplate } from './templates';
import { budgetTone, throughputVerdict } from '../reporting/ranges';

describe('onboarding', () => {
  it('merges inferred and stored steps with one next step', () => {
    const inferred = inferOnboardingSteps({ tasksCreatedByUser: 3, activeMembers: 2, projectsFromTemplate: 0, slackConnected: false });
    const p = onboardingProgress([...new Set([...inferred, 'start-from-template'])]);
    expect(p.completed).toBe(3);
    expect(p.steps.filter((s) => s.isNext).map((s) => s.id)).toEqual(['invite-teammates']);
  });

  it('ships 3–6 templates whose tasks belong to their sections', () => {
    expect(PROJECT_TEMPLATES.length).toBeGreaterThanOrEqual(3);
    expect(PROJECT_TEMPLATES.length).toBeLessThanOrEqual(6);
    for (const t of PROJECT_TEMPLATES) for (const task of t.tasks) expect(t.sections).toContain(task.section);
    expect(findTemplate('product-sprint')?.featured).toBe(true);
  });
});

describe('reporting helpers', () => {
  it('summarizes throughput and budget', () => {
    const v = throughputVerdict([
      { label: 'a', weekStart: '', created: 5, completed: 6 },
      { label: 'b', weekStart: '', created: 5, completed: 3 },
    ]);
    expect(v.text).toBe('Completed ≥ created for 1 of 2 weeks');
    expect(budgetTone(93, 35)).toBe('danger');
    expect(budgetTone(71, 62)).toBe('normal');
  });
});
