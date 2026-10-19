import { describe, expect, it } from 'vitest';
import { Approval, FixedClock, type ApprovalRepository, type DomainEvent } from '@hearth/domain';
import { AccessService } from '../../../../shared/access/access.service';
import type { DomainEventPublisher } from '../../../../shared/events/domain-event.publisher';
import { DecideApprovalCommand } from './decide-approval.command';
import { DecideApprovalHandler } from './decide-approval.handler';

class InMemoryApprovals implements ApprovalRepository {
  readonly rows = new Map<string, Approval>();
  async findById(workspaceId: string, id: string) {
    const a = this.rows.get(id);
    return a && a.toSnapshot().workspaceId === workspaceId ? Approval.restore(id, a.toSnapshot()) : null;
  }
  async save(a: Approval) {
    this.rows.set(a.id, Approval.restore(a.id, a.toSnapshot()));
  }
}

const now = new Date('2026-10-19T10:00:00Z');
const actor = (userId: string, role: 'MEMBER' | 'VIEWER' = 'MEMBER') => ({ userId, workspaceId: 'w', role });

const setup = async () => {
  const repo = new InMemoryApprovals();
  const a = Approval.request(
    {
      id: 'a1',
      workspaceId: 'w',
      taskId: 't',
      requesterId: 'jia',
      title: 'Homepage copy v3',
      approverIds: ['sara', 'fawad'],
    },
    now,
  );
  a.decide('sara', 'APPROVED', null, now);
  a.pullEvents();
  await repo.save(a);
  const published: DomainEvent[] = [];
  const events = {
    publishFrom: (...aggs: Approval[]) => aggs.forEach((x) => published.push(...x.pullEvents())),
  } as unknown as DomainEventPublisher;
  return {
    repo,
    published,
    handler: new DecideApprovalHandler(repo, new FixedClock(now), new AccessService(), events),
  };
};

describe('DecideApprovalHandler', () => {
  it('resolves to APPROVED when the last approver approves and publishes approval.decided', async () => {
    const { repo, published, handler } = await setup();
    const result = await handler.execute(
      new DecideApprovalCommand(actor('fawad'), 'a1', 'APPROVED', 'Ship it'),
    );
    expect(result).toEqual({ id: 'a1', status: 'APPROVED' });
    expect((await repo.findById('w', 'a1'))?.status).toBe('APPROVED');
    expect(published.map((e) => [e.type, (e.payload as { requesterId: string }).requesterId])).toEqual([
      ['approval.decided', 'jia'],
    ]);
  });

  it('rejects people who are not approvers', async () => {
    const { handler } = await setup();
    await expect(
      handler.execute(new DecideApprovalCommand(actor('mo'), 'a1', 'APPROVED', null)),
    ).rejects.toThrow(/not an approver/);
  });

  it('rejects roles without approvals.decide and unknown approvals', async () => {
    const { handler } = await setup();
    await expect(
      handler.execute(new DecideApprovalCommand(actor('fawad', 'VIEWER'), 'a1', 'APPROVED', null)),
    ).rejects.toThrow(/can’t do that/);
    await expect(
      handler.execute(new DecideApprovalCommand(actor('fawad'), 'nope', 'APPROVED', null)),
    ).rejects.toThrow(/couldn’t find/);
  });
});
