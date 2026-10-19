import { ConflictError, FixedClock, ForbiddenError, WorkspaceMember, type DomainEvent, type Role, type WorkspaceMemberRepository } from '@hearth/domain';
import type { DomainEventPublisher } from '../../../../shared/events/domain-event.publisher';
import type { PlanService } from '../../../../shared/billing/require-feature';
import type { SeatCounter } from '../../infrastructure/seat-counter';
import { PLANS, PlanLimitPolicy } from '@hearth/domain';
import { ChangeMemberRoleHandler } from './change-member-role.handler';
import { ChangeMemberRoleCommand } from './change-member-role.command';
import { DeactivateMemberHandler } from './deactivate-member.handler';
import { DeactivateMemberCommand } from './deactivate-member.command';
import { ReactivateMemberHandler } from './reactivate-member.handler';
import { ReactivateMemberCommand } from './reactivate-member.command';
import { RemoveMemberHandler } from './remove-member.handler';
import { RemoveMemberCommand } from './remove-member.command';

/** In-memory adapter: passes the same handler tests as the Prisma repository. */
class InMemoryMembers implements WorkspaceMemberRepository {
  rows = new Map<string, { role: Role; status: 'ACTIVE' | 'DEACTIVATED'; deactivatedAt: Date | null }>();
  removed: string[] = [];
  constructor(seed: Record<string, Role>) {
    for (const [userId, role] of Object.entries(seed)) this.rows.set(userId, { role, status: 'ACTIVE', deactivatedAt: null });
  }
  async findByUser(workspaceId: string, userId: string) {
    const r = this.rows.get(userId);
    return r ? WorkspaceMember.restore(`m-${userId}`, { workspaceId, userId, ...r }) : null;
  }
  async countActiveOwners() {
    return [...this.rows.values()].filter((r) => r.role === 'OWNER' && r.status === 'ACTIVE').length;
  }
  async save(m: WorkspaceMember) {
    const s = m.toSnapshot();
    this.rows.set(s.userId, { role: s.role, status: s.status, deactivatedAt: s.deactivatedAt });
  }
  async remove(m: WorkspaceMember) {
    this.rows.delete(m.userId);
    this.removed.push(m.userId);
    return { unassignedTasks: 2 };
  }
}

const published: DomainEvent[] = [];
const events = {
  publish: (...e: DomainEvent[]) => published.push(...e),
  publishFrom: (...a: WorkspaceMember[]) => a.forEach((x) => published.push(...x.pullEvents())),
} as unknown as DomainEventPublisher;
const clock = new FixedClock(new Date('2026-10-19T12:00:00Z'));
const fawad = { userId: 'fawad', workspaceId: 'w', role: 'OWNER' as const };
const sara = { userId: 'sara', workspaceId: 'w', role: 'ADMIN' as const };

describe('member commands', () => {
  let repo: InMemoryMembers;
  beforeEach(() => {
    repo = new InMemoryMembers({ fawad: 'OWNER', sara: 'ADMIN', mo: 'MEMBER' });
    published.length = 0;
  });

  it('changes a role and publishes member.role_changed', async () => {
    const handler = new ChangeMemberRoleHandler(repo, events, clock);
    await expect(handler.execute(new ChangeMemberRoleCommand(fawad, 'mo', 'ADMIN'))).resolves.toEqual({ userId: 'mo', role: 'ADMIN' });
    expect(published.map((e) => e.type)).toEqual(['member.role_changed']);
  });

  it('rejects escalation (admin → owner) with 403 and the last-owner demotion with 409', async () => {
    const handler = new ChangeMemberRoleHandler(repo, events, clock);
    await expect(handler.execute(new ChangeMemberRoleCommand(sara, 'mo', 'OWNER'))).rejects.toBeInstanceOf(ForbiddenError);
    await expect(handler.execute(new ChangeMemberRoleCommand(fawad, 'fawad', 'ADMIN'))).rejects.toBeInstanceOf(ConflictError);
    expect(repo.rows.get('mo')!.role).toBe('MEMBER');
  });

  it('deactivates and reactivates (seat-checked)', async () => {
    const plans = { policyFor: async () => new PlanLimitPolicy(PLANS.PRO) } as unknown as PlanService;
    const seats = { activeSeats: async () => 2 } as unknown as SeatCounter;
    await new DeactivateMemberHandler(repo, events, clock).execute(new DeactivateMemberCommand(sara, 'mo'));
    expect(repo.rows.get('mo')!.status).toBe('DEACTIVATED');
    await new ReactivateMemberHandler(repo, plans, seats, events, clock).execute(new ReactivateMemberCommand(sara, 'mo'));
    expect(repo.rows.get('mo')!.status).toBe('ACTIVE');
    expect(published.map((e) => e.type)).toEqual(['member.deactivated', 'member.reactivated']);
  });

  it('blocks reactivation when the plan has no seats left', async () => {
    repo.rows.set('mo', { role: 'MEMBER', status: 'DEACTIVATED', deactivatedAt: null });
    const plans = { policyFor: async () => new PlanLimitPolicy(PLANS.PRO) } as unknown as PlanService;
    const seats = { activeSeats: async () => 10 } as unknown as SeatCounter;
    await expect(new ReactivateMemberHandler(repo, plans, seats, events, clock).execute(new ReactivateMemberCommand(sara, 'mo'))).rejects.toThrow(/all 10 seats/);
  });

  it('removes permanently only when confirmed', async () => {
    const handler = new RemoveMemberHandler(repo, events, clock);
    await expect(handler.execute(new RemoveMemberCommand(fawad, 'mo', false))).rejects.toThrow(/can’t be undone/);
    await expect(handler.execute(new RemoveMemberCommand(fawad, 'mo', true))).resolves.toEqual({ userId: 'mo', unassignedTasks: 2 });
    expect(repo.removed).toEqual(['mo']);
  });
});
