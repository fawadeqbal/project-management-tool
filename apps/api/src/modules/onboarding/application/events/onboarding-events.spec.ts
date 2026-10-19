import { createEvent, FixedClock, type DomainEvent } from '@hearth/domain';
import type { DomainEventPublisher } from '../../../../shared/events/domain-event.publisher';
import type { PrismaService } from '../../../../shared/prisma/prisma.service';
import type { OnboardingProgressStore } from '../../infrastructure/onboarding-progress.store';
import { DomainEventEnvelope } from '../../../../shared/events/domain-event.envelope';
import { FirstTaskCreatedHandler } from './first-task-created.handler';
import { TeammatesJoinedHandler } from './teammates-joined.handler';

class InMemoryProgress {
  done = new Map<string, Set<string>>();
  async complete(_w: string, userId: string, step: string) {
    const set = this.done.get(userId) ?? new Set<string>();
    const isNew = !set.has(step);
    set.add(step);
    this.done.set(userId, set);
    return isNew;
  }
}

const published: DomainEvent[] = [];
const events = { publish: (...e: DomainEvent[]) => published.push(...e) } as unknown as DomainEventPublisher;
const clock = new FixedClock(new Date('2026-10-19T12:00:00Z'));
const base = { workspaceId: 'w', actorId: 'fawad', aggregateId: 'x', occurredAt: clock.now() };

describe('onboarding event subscribers', () => {
  beforeEach(() => {
    published.length = 0;
  });

  it('ticks "create first task" once on task.created', async () => {
    const store = new InMemoryProgress();
    const handler = new FirstTaskCreatedHandler(store as unknown as OnboardingProgressStore, events, clock);
    const e = createEvent('task.created', base, {
      key: 'HRT-1',
      title: 'Kickoff',
      projectId: null,
      assigneeId: null,
    });
    await handler.handle(new DomainEventEnvelope(e));
    await handler.handle(new DomainEventEnvelope(e));
    expect([...store.done.get('fawad')!]).toEqual(['create-first-task']);
    expect(published).toHaveLength(1);
  });

  it('ticks "invite teammates" only when the second invite is accepted', async () => {
    const store = new InMemoryProgress();
    let accepted = 1;
    const prisma = { invite: { count: async () => accepted } } as unknown as PrismaService;
    const handler = new TeammatesJoinedHandler(
      prisma,
      store as unknown as OnboardingProgressStore,
      events,
      clock,
    );
    const joined = createEvent(
      'member.joined',
      { ...base, actorId: 'lena' },
      { userId: 'lena', role: 'MEMBER', invitedById: 'fawad', projectId: null },
    );
    await handler.handle(new DomainEventEnvelope(joined));
    expect(store.done.get('fawad')).toBeUndefined();
    accepted = 2;
    await handler.handle(new DomainEventEnvelope(joined));
    expect([...store.done.get('fawad')!]).toEqual(['invite-teammates']);
  });
});
