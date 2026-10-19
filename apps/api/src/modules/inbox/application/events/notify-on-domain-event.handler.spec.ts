import { describe, expect, it } from 'vitest';
import { createEvent, type DomainEvent } from '@hearth/domain';
import { DomainEventEnvelope } from '../../../../shared/events/domain-event.envelope';
import type { DomainEventPublisher } from '../../../../shared/events/domain-event.publisher';
import type { NewNotification, NotificationContext, NotificationGateway } from '../ports';
import { NotifyOnDomainEventHandler } from './notify-on-domain-event.handler';

class FakeGateway implements NotificationGateway {
  created: NewNotification[] = [];
  constructor(private readonly ctx: NotificationContext) {}
  async contextFor() {
    return this.ctx;
  }
  async createMany(n: NewNotification[]) {
    this.created.push(...n);
    return n.map((x, i) => ({ id: `n${i}`, recipientId: x.recipientId, type: x.type, taskId: x.taskId }));
  }
}

const at = new Date('2026-10-19T09:10:00Z');
const base = { workspaceId: 'w', actorId: 'sara', aggregateId: 'task-188', occurredAt: at };

const setup = (ctx: Partial<NotificationContext> = {}) => {
  const gateway = new FakeGateway({ actorName: 'Sara Ahmed', followerIds: [], taskAssigneeId: null, context: 'Website relaunch · HRT-188', ...ctx });
  const published: DomainEvent[] = [];
  const events = { publish: (...e: DomainEvent[]) => published.push(...e) } as unknown as DomainEventPublisher;
  return { gateway, published, handler: new NotifyOnDomainEventHandler(gateway, events) };
};

describe('NotifyOnDomainEventHandler', () => {
  it('writes a mention with the context line and announces notification.created', async () => {
    const { gateway, published, handler } = setup({ taskAssigneeId: 'fawad' });
    await handler.handle(
      new DomainEventEnvelope(
        createEvent('comment.created', base, { taskId: 'task-188', key: 'HRT-188', title: 'Pricing', commentId: 'c1', mentionedUserIds: ['fawad'], excerpt: '@Fawad the toggle', parentAuthorId: null }),
      ),
    );
    expect(gateway.created).toEqual([
      {
        recipientId: 'fawad',
        type: 'MENTION',
        title: 'Sara Ahmed mentioned you',
        excerpt: '@Fawad the toggle',
        taskId: 'task-188',
        workspaceId: 'w',
        actorId: 'sara',
        context: 'Website relaunch · HRT-188',
        createdAt: at,
      },
    ]);
    expect(published.map((e) => [e.type, e.aggregateId, (e.payload as { recipientId: string }).recipientId])).toEqual([['notification.created', 'n0', 'fawad']]);
  });

  it('notifies followers but never the actor on status changes', async () => {
    const { gateway, handler } = setup({ followerIds: ['fawad', 'sara', 'mo'] });
    await handler.handle(new DomainEventEnvelope(createEvent('task.status_changed', base, { key: 'HRT-188', title: 'Pricing', from: 'IN_PROGRESS', to: 'BLOCKED', projectId: 'p' })));
    expect(gateway.created.map((n) => [n.recipientId, n.title])).toEqual([
      ['fawad', 'Sara Ahmed changed status to Blocked'],
      ['mo', 'Sara Ahmed changed status to Blocked'],
    ]);
  });

  it('notifies each approver with the approval id', async () => {
    const { gateway, handler } = setup({ actorName: 'Jia Li', context: 'Q4 brand campaign · HRT-328' });
    await handler.handle(
      new DomainEventEnvelope(createEvent('approval.requested', { ...base, actorId: 'jia', aggregateId: 'a1' }, { taskId: 't', title: 'Homepage copy v3', approverIds: ['sara', 'fawad'] })),
    );
    expect(gateway.created.map((n) => [n.recipientId, n.type, n.approvalId])).toEqual([
      ['sara', 'APPROVAL_REQUESTED', 'a1'],
      ['fawad', 'APPROVAL_REQUESTED', 'a1'],
    ]);
  });

  it('ignores events it does not handle and publishes nothing when nobody is notified', async () => {
    const { gateway, published, handler } = setup();
    await handler.handle(new DomainEventEnvelope(createEvent('task.renamed', base, { key: 'HRT-188', from: 'a', to: 'b', projectId: null })));
    await handler.handle(new DomainEventEnvelope(createEvent('task.assigned', base, { key: 'HRT-188', title: 'x', from: null, to: 'sara', projectId: null })));
    expect(gateway.created).toEqual([]);
    expect(published).toEqual([]);
  });
});
