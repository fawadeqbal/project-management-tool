import { ConflictError, FixedClock, Subscription, type DomainEvent, type SubscriptionRepository } from '@hearth/domain';
import type { BillingDto } from '@hearth/contracts';
import type { DomainEventPublisher } from '../../../../shared/events/domain-event.publisher';
import type { BillingReadModel } from '../../infrastructure/billing.read-model';
import type { UsageReader } from '../../infrastructure/usage.reader';
import { ChangePlanHandler } from './change-plan.handler';
import { ChangePlanCommand } from './change-plan.command';
import { PauseBillingHandler } from './pause-billing.handler';
import { PauseBillingCommand } from './pause-billing.command';
import { CancelPlanHandler } from './cancel-plan.handler';
import { CancelPlanCommand } from './cancel-plan.command';

class InMemorySubscriptions implements SubscriptionRepository {
  current = Subscription.restore('s', {
    workspaceId: 'w',
    plan: 'PRO',
    interval: 'MONTHLY',
    status: 'ACTIVE',
    seats: 10,
    renewsAt: new Date('2026-11-01T00:00:00Z'),
    pausedUntil: null,
  });
  async findByWorkspace() {
    return Subscription.restore('s', this.current.toSnapshot());
  }
  async save(s: Subscription) {
    this.current = Subscription.restore('s', s.toSnapshot());
  }
}

const published: DomainEvent[] = [];
const events = {
  publish: (...e: DomainEvent[]) => published.push(...e),
  publishFrom: (...a: Subscription[]) => a.forEach((x) => published.push(...x.pullEvents())),
} as unknown as DomainEventPublisher;
const clock = new FixedClock(new Date('2026-10-19T12:00:00Z'));
const usage = { read: async () => ({ seats: 7, storage_bytes: 0, automation_runs: 0, ai_credits: 0 }) } as unknown as UsageReader;
const read = { get: async () => ({}) as BillingDto } as unknown as BillingReadModel;
const owner = { userId: 'fawad', workspaceId: 'w', role: 'OWNER' as const };

describe('billing commands', () => {
  let repo: InMemorySubscriptions;
  beforeEach(() => {
    repo = new InMemorySubscriptions();
    published.length = 0;
  });

  it('upgrades to Business immediately and publishes billing.plan_changed', async () => {
    const res = await new ChangePlanHandler(repo, usage, read, events, clock).execute(new ChangePlanCommand(owner, { plan: 'BUSINESS', interval: 'ANNUAL', confirm: false }));
    expect(res.lostFeatures).toEqual([]);
    expect(repo.current.plan).toBe('BUSINESS');
    expect(published[0]!.type).toBe('billing.plan_changed');
  });

  it('requires confirm for a lossy downgrade and lists the features', async () => {
    const handler = new ChangePlanHandler(repo, usage, read, events, clock);
    await handler.execute(new ChangePlanCommand(owner, { plan: 'BUSINESS', interval: 'MONTHLY', confirm: false }));
    const err = await handler.execute(new ChangePlanCommand(owner, { plan: 'PRO', interval: 'MONTHLY', confirm: false })).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConflictError);
    expect((err as ConflictError).details?.lostFeatureNames).toContain('Dashboards');
    expect(repo.current.plan).toBe('BUSINESS');
  });

  it('pauses and cancels at period end', async () => {
    await new PauseBillingHandler(repo, read, events, clock).execute(new PauseBillingCommand(owner, 1));
    expect(repo.current.status).toBe('PAUSED');
    await new CancelPlanHandler(repo, read, events, clock).execute(new CancelPlanCommand(owner, true));
    expect(repo.current.status).toBe('CANCELED');
    expect(published.map((e) => e.type)).toEqual(['billing.paused', 'billing.canceled']);
  });
});
