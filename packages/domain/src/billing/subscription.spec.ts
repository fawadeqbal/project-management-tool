import { describe, expect, it } from 'vitest';
import { Subscription, recommendedPlan, type SubscriptionProps } from './subscription';
import { ConflictError, ValidationError } from '../shared/errors';

const now = new Date('2026-10-19T12:00:00Z');
const sub = (over: Partial<SubscriptionProps> = {}) =>
  Subscription.restore('s1', {
    workspaceId: 'w',
    plan: 'PRO',
    interval: 'MONTHLY',
    status: 'ACTIVE',
    seats: 10,
    renewsAt: new Date('2026-11-01T00:00:00Z'),
    pausedUntil: null,
    ...over,
  });

describe('Subscription', () => {
  it('upgrades immediately', () => {
    const s = sub();
    expect(
      s.changePlan({ plan: 'BUSINESS', interval: 'ANNUAL', confirm: false, activeSeats: 7 }, 'u', now),
    ).toEqual({ lostFeatures: [] });
    expect(s.toSnapshot()).toMatchObject({ plan: 'BUSINESS', interval: 'ANNUAL' });
    expect(s.pullEvents()[0]).toMatchObject({
      type: 'billing.plan_changed',
      payload: { direction: 'upgrade' },
    });
  });

  it('asks to confirm a downgrade that loses features, listing them', () => {
    const s = sub({ plan: 'BUSINESS' });
    try {
      s.changePlan({ plan: 'PRO', interval: 'MONTHLY', confirm: false, activeSeats: 7 }, 'u', now);
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ConflictError);
      expect((e as ConflictError).details?.lostFeatures).toContain('dashboards');
    }
    expect(
      s.changePlan({ plan: 'PRO', interval: 'MONTHLY', confirm: true, activeSeats: 7 }, 'u', now)
        .lostFeatures,
    ).toContain('sprints');
  });

  it('refuses a plan the team does not fit in', () => {
    expect(() =>
      sub().changePlan({ plan: 'FREE', interval: 'MONTHLY', confirm: true, activeSeats: 7 }, 'u', now),
    ).toThrow(/allows 5 people/);
  });

  it('pauses, resumes and cancels at period end', () => {
    const s = sub();
    s.pause(2, 'u', now);
    expect(s.toSnapshot().pausedUntil?.toISOString().slice(0, 10)).toBe('2026-12-19');
    expect(() => s.pause(4, 'u', now)).toThrow(ValidationError);
    s.resume('u', now);
    expect(s.status).toBe('ACTIVE');
    expect(() => s.cancel(false, 'u', now)).toThrow(/Nov 1/);
    s.cancel(true, 'u', now);
    expect(s.status).toBe('CANCELED');
  });

  it('recommends the next plan up', () => {
    expect(recommendedPlan('PRO')).toBe('BUSINESS');
    expect(recommendedPlan('ENTERPRISE')).toBe('ENTERPRISE');
  });
});
