import { describe, expect, it } from 'vitest';
import { PlanLimitPolicy, PLANS, cheapestPlanWith } from './plans';
import { annualSavings, describePlanChange, usageMeter } from './usage';
import { parseDateOnly } from '../shared/dates';
import { LimitReachedError } from '../shared/errors';

const period = { start: parseDateOnly('2026-10-01'), resetsAt: parseDateOnly('2026-11-01') };
const today = parseDateOnly('2026-10-19');

describe('plans', () => {
  it('gates features and names the plan that unlocks them', () => {
    const pro = new PlanLimitPolicy(PLANS.PRO);
    expect(pro.hasFeature('timeline')).toBe(true);
    expect(() => pro.assertFeature('sprints')).toThrow(LimitReachedError);
    expect(cheapestPlanWith('sprints').id).toBe('BUSINESS');
  });

  it('enforces metered limits', () => {
    expect(() => new PlanLimitPolicy(PLANS.FREE).assertWithinLimit('seats', 5)).toThrow(/all 5 seats/);
    expect(() => new PlanLimitPolicy(PLANS.ENTERPRISE).assertWithinLimit('seats', 10_000)).not.toThrow();
  });
});

describe('usage meters', () => {
  it('warns when on pace to hit the limit before reset', () => {
    const m = usageMeter('automation_runs', 940, 1000, period, today);
    expect(m.warning).toBe(true);
    expect(m.note).toBe('Resets Nov 1 · on pace to hit the limit Oct 21');
  });

  it('describes seats left', () => {
    expect(usageMeter('seats', 9, 10, period, today).note).toBe('1 seat left · next seat is prorated');
  });

  it('shows annual savings in money', () => {
    expect(annualSavings('PRO', 10)).toEqual({ perYearCents: 24_000, pct: 20 });
    expect(annualSavings('FREE', 3)).toBeNull();
  });

  it('lists what a downgrade removes', () => {
    expect(describePlanChange('BUSINESS', 'PRO')).toMatchObject({ direction: 'downgrade' });
    expect(describePlanChange('BUSINESS', 'PRO').lostFeatures).toContain('sprints');
  });
});
