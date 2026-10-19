import { describe, expect, it } from 'vitest';
import { WorkspaceMember, lastActiveLabel, type WorkspaceMemberProps } from './workspace-member';
import { inviteMeta, validateInvite } from './invites';
import { permissionMatrix } from './permission-matrix';
import { ConflictError, ForbiddenError, ValidationError } from '../shared/errors';
import { parseDateOnly } from '../shared/dates';

const now = new Date('2026-10-19T12:00:00Z');
const member = (over: Partial<WorkspaceMemberProps> = {}) =>
  WorkspaceMember.restore('m1', { workspaceId: 'w', userId: 'u-target', role: 'MEMBER', status: 'ACTIVE', deactivatedAt: null, ...over });
const owner = { userId: 'u-owner', role: 'OWNER' as const };
const admin = { userId: 'u-admin', role: 'ADMIN' as const };

describe('WorkspaceMember role changes', () => {
  it('changes a role and records an event', () => {
    const m = member();
    m.changeRole('ADMIN', owner, 1, now);
    expect(m.role).toBe('ADMIN');
    expect(m.pullEvents()[0]).toMatchObject({ type: 'member.role_changed', payload: { from: 'MEMBER', to: 'ADMIN', userId: 'u-target' } });
  });

  it('blocks escalation: an admin cannot make an owner', () => {
    expect(() => member().changeRole('OWNER', admin, 1, now)).toThrow(ForbiddenError);
  });

  it('blocks acting on someone who outranks you', () => {
    expect(() => member({ role: 'OWNER' }).changeRole('MEMBER', admin, 2, now)).toThrow(ForbiddenError);
  });

  it('protects the last owner (409) even from themselves', () => {
    const last = member({ role: 'OWNER', userId: 'u-owner' });
    expect(() => last.changeRole('ADMIN', owner, 1, now)).toThrow(ConflictError);
    expect(() => member({ role: 'OWNER' }).changeRole('ADMIN', owner, 2, now)).not.toThrow();
  });

  it('forbids changing your own role', () => {
    expect(() => member({ userId: 'u-admin', role: 'ADMIN' }).changeRole('MEMBER', admin, 1, now)).toThrow(/yourself/);
  });

  it('does not turn members into guests', () => {
    expect(() => member().changeRole('GUEST', owner, 1, now)).toThrow(ValidationError);
  });
});

describe('WorkspaceMember deactivate / reactivate / remove', () => {
  it('is reversible and keeps the role', () => {
    const m = member();
    m.deactivate(admin, 1, now);
    expect(m.status).toBe('DEACTIVATED');
    m.reactivate(admin, now);
    expect(m.status).toBe('ACTIVE');
    expect(m.pullEvents().map((e) => e.type)).toEqual(['member.deactivated', 'member.reactivated']);
  });

  it('cannot deactivate yourself or the last owner', () => {
    expect(() => member({ userId: 'u-admin', role: 'ADMIN' }).deactivate(admin, 1, now)).toThrow(ForbiddenError);
    expect(() => member({ role: 'OWNER' }).deactivate(owner, 1, now)).toThrow(ConflictError);
  });

  it('requires confirmation to remove', () => {
    expect(() => member().remove(owner, 1, false, now)).toThrow(ValidationError);
    const m = member();
    m.remove(owner, 1, true, now);
    expect(m.pullEvents()[0]!.type).toBe('member.removed');
  });
});

describe('invites', () => {
  it('requires a project for guests and blocks escalation', () => {
    expect(() => validateInvite('ADMIN', { role: 'GUEST' })).toThrow(/project/);
    expect(() => validateInvite('ADMIN', { role: 'GUEST', projectId: 'p' })).not.toThrow();
    expect(() => validateInvite('ADMIN', { role: 'OWNER' })).toThrow(ForbiddenError);
  });

  it('describes pending invites in plain words', () => {
    const today = parseDateOnly('2026-10-19');
    expect(inviteMeta({ role: 'MEMBER', teamName: 'Design', sentAt: parseDateOnly('2026-10-17'), expiresAt: parseDateOnly('2026-10-24') }, today)).toBe(
      'Member · Design · sent 2 days ago',
    );
    expect(inviteMeta({ role: 'GUEST', projectName: 'Website relaunch', sentAt: parseDateOnly('2026-10-14'), expiresAt: parseDateOnly('2026-10-21') }, today)).toBe(
      'Guest · Website relaunch · expires in 2 days',
    );
  });
});

describe('labels and matrix', () => {
  it('humanizes last active', () => {
    expect(lastActiveLabel(now, now)).toBe('Now');
    expect(lastActiveLabel(new Date(now.getTime() - 5 * 60_000), now)).toBe('5 min ago');
    expect(lastActiveLabel(new Date(now.getTime() - 60 * 60_000), now)).toBe('1 hour ago');
    expect(lastActiveLabel(new Date(now.getTime() - 24 * 3600_000), now)).toBe('Yesterday');
    expect(lastActiveLabel(new Date('2026-09-02T10:00:00Z'), now)).toBe('Sep 2');
  });

  it('derives matrix rows from the enforced policy', () => {
    const billing = permissionMatrix().find((r) => r.permission === 'billing.manage');
    expect(billing).toMatchObject({ label: 'Manage billing and plan', roles: ['OWNER'] });
  });
});
